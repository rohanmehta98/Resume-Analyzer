import { describe, it, expect } from "vitest";
import { containsTerm, normalizeTerm, quoteAppearsIn, verifyKeywords } from "@/lib/keywords";

const hay = normalizeTerm("Built APIs in Node.js and TypeScript. CI/CD with GitHub Actions. Managed AWS infra. Java, R, C#.");

describe("containsTerm", () => {
  it("matches aliases and spelling variants", () => {
    expect(containsTerm(hay, "NodeJS")).toBe(true);
    expect(containsTerm(hay, "node.js")).toBe(true);
    expect(containsTerm(hay, "CI/CD")).toBe(true);
    expect(containsTerm(hay, "Amazon Web Services")).toBe(true);
    expect(containsTerm(hay, "API")).toBe(true); // plural in text
  });

  it("respects word boundaries", () => {
    expect(containsTerm(normalizeTerm("JavaScript developer"), "Java")).toBe(false);
    expect(containsTerm(normalizeTerm("Google Analytics"), "Go")).toBe(false);
    expect(containsTerm(hay, "R")).toBe(true);
    expect(containsTerm(hay, "C#")).toBe(true);
    expect(containsTerm(hay, "Kubernetes")).toBe(false);
  });
});

describe("verifyKeywords", () => {
  it("re-files claims by actual presence and dedupes", () => {
    const r = verifyKeywords("Experienced with Python and SQL.", {
      matched: ["Python", "Spark", "python"],
      missing: ["SQL", "Airflow"],
    });
    expect(r.matched).toEqual(["Python", "SQL"]);
    expect(r.missing).toEqual(["Spark", "Airflow"]);
    expect(r.coverage).toBe(0.5);
  });

  it("handles empty input", () => {
    expect(verifyKeywords("text", { matched: [], missing: [] })).toEqual({ matched: [], missing: [], coverage: 0 });
  });
});

describe("quoteAppearsIn", () => {
  const resume = "- Responsible for managing the\nweekly inventory report for 3 stores.";
  it("accepts verbatim quotes across line breaks and punctuation", () => {
    expect(quoteAppearsIn(resume, "Responsible for managing the weekly inventory report for 3 stores")).toBe(true);
  });
  it("rejects invented quotes and trivially short ones", () => {
    expect(quoteAppearsIn(resume, "Launched a global marketing campaign across 12 countries")).toBe(false);
    expect(quoteAppearsIn(resume, "report")).toBe(false);
  });
});
