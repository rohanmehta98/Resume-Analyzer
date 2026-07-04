import { describe, it, expect } from "vitest";
import { extractText, ExtractionError } from "@/lib/extract";
import { MAX_TEXT_CHARS } from "@/lib/constants";

const LINES = [
  "Jane Doe",
  "Senior Software Engineer",
  "jane.doe@email.com | (555) 123-4567",
  "Led migration of a monolith to microservices, reducing p95 latency by 40 percent.",
  "Built a CI/CD pipeline that cut deploy time from 2 hours to 15 minutes.",
  "Skills: JavaScript, TypeScript, Node.js, AWS, Docker, Kubernetes.",
];
const SAMPLE = LINES.join("\n");

function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, "\\$1");
  let stream = "BT /F1 12 Tf 72 740 Td\n";
  lines.forEach((l, i) => {
    stream += (i === 0 ? "" : "0 -18 Td ") + "(" + esc(l) + ") Tj\n";
  });
  stream += "ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += i + 1 + " 0 obj\n" + obj + "\nendobj\n";
  });
  const xrefStart = Buffer.byteLength(body, "latin1");
  let xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  offsets.forEach((off) => (xref += String(off).padStart(10, "0") + " 00000 n \n"));
  const trailer = "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF";
  return Buffer.from(body + xref + trailer, "latin1");
}

describe("extractText", () => {
  it("accepts pasted text", async () => {
    const r = await extractText({ pastedText: SAMPLE });
    expect(r.source).toBe("paste");
    expect(r.text.length).toBeGreaterThan(100);
  });

  it("rejects pasted text that is too short", async () => {
    await expect(extractText({ pastedText: "hi" })).rejects.toBeInstanceOf(ExtractionError);
  });

  it("extracts from a .txt buffer", async () => {
    const r = await extractText({ buffer: Buffer.from(SAMPLE, "utf8"), fileName: "resume.txt" });
    expect(r.source).toBe("txt");
    expect(r.text).toContain("microservices");
  });

  it("extracts from a real PDF via unpdf", async () => {
    const r = await extractText({ buffer: makePdf(LINES), fileName: "resume.pdf" });
    expect(r.source).toBe("pdf");
    expect(r.text.toLowerCase()).toContain("jane doe");
  });

  it("rejects unsupported file types", async () => {
    await expect(
      extractText({ buffer: Buffer.from("x".repeat(200)), fileName: "resume.png" })
    ).rejects.toMatchObject({ status: 415 });
  });

  it("rejects an empty file", async () => {
    await expect(extractText({ buffer: Buffer.alloc(0), fileName: "resume.txt" })).rejects.toBeInstanceOf(
      ExtractionError
    );
  });

  it("caps extracted text length", async () => {
    const huge = "word ".repeat(50_000); // ~250k chars
    const r = await extractText({ pastedText: huge });
    expect(r.text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);
  });
});
