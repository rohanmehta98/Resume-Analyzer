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
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
