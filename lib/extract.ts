import mammoth from "mammoth";
import { MAX_FILE_BYTES, MAX_FILE_MB, MAX_TEXT_CHARS } from "./constants";

export { MAX_FILE_BYTES };

export class ExtractionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExtractionError";
    this.status = status;
  }
}

// A .docx is a ZIP; the 3MB upload cap bounds only the COMPRESSED size. A crafted
// file can inflate to many GB inside mammoth and OOM-kill the process before the
// text cap ever applies — and a V8 OOM is NOT catchable by try/catch. Guard by
// reading the uncompressed sizes declared in the ZIP central directory and
// rejecting anything that would expand past this ceiling (orders of magnitude
// above any real resume, which uncompresses to well under 1 MB).
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

export type ExtractSource = "pdf" | "docx" | "txt" | "paste";

export interface ExtractInput {
  buffer?: Buffer | Uint8Array;
  fileName?: string;
  pastedText?: string;
}

export interface ExtractResult {
  text: string;
  fileName: string;
  source: ExtractSource;
}

export async function extractText(input: ExtractInput): Promise<ExtractResult> {
  const { buffer: rawBuffer, fileName = "resume", pastedText } = input;

  if (pastedText && pastedText.trim().length > 0) {
    const text = normalize(pastedText);
    if (text.length < 100) {
      throw new ExtractionError("Please paste more of your resume — that's too short to analyze.", 422);
    }
    return { text, fileName: "Pasted text", source: "paste" };
  }

  if (!rawBuffer) {
    throw new ExtractionError("No file or text was provided.", 400);
  }

  const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
  if (buffer.length === 0) {
    throw new ExtractionError("The uploaded file appears to be empty.", 400);
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new ExtractionError(`File is too large. Please upload a file under ${MAX_FILE_MB} MB.`, 413);
  }

  const lower = fileName.toLowerCase();
  let text = "";
  let source: ExtractSource;

  if (lower.endsWith(".pdf")) {
    source = "pdf";
    text = await extractPdf(buffer);
  } else if (lower.endsWith(".docx")) {
    source = "docx";
    assertDocxNotBomb(buffer); // reject zip bombs before mammoth decompresses
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } catch {
      throw new ExtractionError("Could not read this DOCX file. It may be corrupted.", 422);
    }
  } else if (lower.endsWith(".txt")) {
    source = "txt";
    text = buffer.toString("utf8");
  } else {
    throw new ExtractionError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.", 415);
  }

  text = normalize(text);

  if (text.trim().length < 100) {
    throw new ExtractionError(
      "We couldn't extract enough text. If this is a scanned/image PDF, paste your resume text instead.",
      422
    );
  }

  return { text, fileName, source };
}

/**
 * Reject DOCX (zip) decompression bombs before mammoth ever decompresses them,
 * by summing the uncompressed sizes declared in the ZIP central directory. This
 * is cheap (no decompression) and runs on data the attacker can't hide: mammoth
 * relies on the same records to read the file. Parsing is best-effort — if the
 * archive can't be inspected we fall through and let mammoth reject a bad file.
 */
function assertDocxNotBomb(buffer: Buffer): void {
  const EOCD_SIG = 0x06054b50; // End Of Central Directory
  const CDH_SIG = 0x02014b50; // Central Directory Header
  // The EOCD record lives within the final 22 + up-to-65535 (comment) bytes.
  let eocd = -1;
  const minPos = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= minPos; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return; // not an inspectable zip — mammoth will reject it

  const tooBig = () => {
    throw new ExtractionError(
      "This DOCX looks malformed or unreasonably large. Please re-save it, or paste your resume text instead.",
      422
    );
  };

  const count = buffer.readUInt16LE(eocd + 10); // total central-directory records
  let off = buffer.readUInt32LE(eocd + 16); // offset of the central directory
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (off + 46 > buffer.length || buffer.readUInt32LE(off) !== CDH_SIG) break;
    const uncompressed = buffer.readUInt32LE(off + 24);
    // 0xFFFFFFFF marks a zip64 size (>= 4 GB) stored in the extra field — a bomb here.
    if (uncompressed === 0xffffffff) tooBig();
    total += uncompressed;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES) tooBig();
    const nameLen = buffer.readUInt16LE(off + 28);
    const extraLen = buffer.readUInt16LE(off + 30);
    const commentLen = buffer.readUInt16LE(off + 32);
    off += 46 + nameLen + extraLen + commentLen;
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    // unpdf ships a serverless-friendly build of pdf.js — no native deps.
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch {
    throw new ExtractionError(
      "Could not read this PDF. It may be scanned/image-based or corrupted — try pasting the text instead.",
      422
    );
  }
}

function normalize(text: string): string {
  return String(text)
    .slice(0, MAX_TEXT_CHARS)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/ /g, " ")
    // Strip trailing horizontal whitespace per line. Native trimEnd() is linear;
    // the old /[ \t]+\n/g backtracked O(n^2) on a long whitespace run (paste DoS).
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
