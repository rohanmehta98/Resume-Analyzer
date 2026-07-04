import { describe, it, expect } from "vitest";
import { computeSignals, computeAtsChecks, appendKeywordCheck } from "@/lib/signals";
import { MAX_TEXT_CHARS } from "@/lib/constants";

const RESUME = [
  "Jane Doe",
  "Senior Software Engineer",
  "jane.doe@email.com | (555) 123-4567 | linkedin.com/in/janedoe | github.com/janedoe",
  "SUMMARY",
  "Results-driven engineer and team player responsible for building scalable systems.",
  "EXPERIENCE",
  "Acme Corp - Senior Software Engineer (2020-2024)",
  "- Led migration of a monolith to microservices, reducing p95 latency by 40%",
  "- Built a CI/CD pipeline that cut deploy time from 2 hours to 15 minutes",
  "- Managed a team of 5 engineers and mentored 3 junior developers",
  "- Responsible for the payments service",
  "SKILLS",
  "JavaScript, TypeScript, Node.js, React, AWS, Docker, Kubernetes, PostgreSQL",
  "EDUCATION",
  "B.S. Computer Science, State University (2016)",
].join("\n");

describe("computeSignals", () => {
  const s = computeSignals(RESUME);

  it("detects contact channels", () => {
    expect(s.contact.hasEmail).toBe(true);
    expect(s.contact.hasPhone).toBe(true);
    expect(s.contact.hasLinkedIn).toBe(true);
    expect(s.contact.hasGitHub).toBe(true);
  });

  it("counts words and bullets", () => {
    expect(s.wordCount).toBeGreaterThan(50);
    expect(s.bulletCount).toBe(4);
  });

  it("computes exact quantification and action-verb ratios", () => {
    // 4 bullets: Led(40%)=quantified+verb, Built(2h→15m)=quantified+verb,
    // Managed(5/3)=quantified+verb, "Responsible for…"=neither → 3/4 = 0.75 each.
    expect(s.quantificationRatio).toBe(0.75);
    expect(s.actionVerbRatio).toBe(0.75);
  });

  it("detects standard sections", () => {
    expect(s.sections.experience).toBe(true);
    expect(s.sections.education).toBe(true);
    expect(s.sections.skills).toBe(true);
    expect(s.sections.summary).toBe(true);
  });

  it("flags cliché buzzwords", () => {
    expect(s.buzzwordsFound).toContain("team player");
    expect(s.buzzwordsFound).toContain("results-driven");
    expect(s.buzzwordsFound).toContain("responsible for");
  });

  it("finds no website when only linkedin/github links exist", () => {
    expect(s.contact.hasWebsite).toBe(false);
  });

  it("detects a real portfolio website", () => {
    const withSite = computeSignals(RESUME + "\nPortfolio: https://janedoe.dev");
    expect(withSite.contact.hasWebsite).toBe(true);
  });

  it("bounds adversarial input via the length cap (ReDoS-safe, deterministic)", () => {
    // This payload made the old lookahead regex run O(n^2). The input cap makes
    // the work bounded regardless of size: signals on the huge string must equal
    // signals on the same string truncated to the cap.
    const evil = "https://a ".repeat(120_000) + "linkedin.com";
    expect(evil.length).toBeGreaterThan(MAX_TEXT_CHARS);
    const start = Date.now();
    const full = computeSignals(evil);
    expect(Date.now() - start).toBeLessThan(2000); // generous guard against a hang
    expect(full).toEqual(computeSignals(evil.slice(0, MAX_TEXT_CHARS)));
  });

  it("handles empty input without throwing", () => {
    const empty = computeSignals("");
    expect(empty.wordCount).toBe(0);
    expect(empty.quantificationRatio).toBe(0);
  });
});

describe("computeAtsChecks", () => {
  it("produces a 0-100 score with all pass/fail checks", () => {
    const ats = computeAtsChecks(computeSignals(RESUME));
    expect(ats.score).toBeGreaterThanOrEqual(0);
    expect(ats.score).toBeLessThanOrEqual(100);
    expect(ats.checks.every((c) => typeof c.pass === "boolean")).toBe(true);
    expect(ats.checks.map((c) => c.id)).toContain("contact");
  });
});

describe("appendKeywordCheck", () => {
  const base = computeAtsChecks(computeSignals(RESUME));

  it("passes at exactly the 60% coverage threshold", () => {
    const ats = appendKeywordCheck(base, 6, 4); // 60%
    expect(ats.checks.find((c) => c.id === "keywords")?.pass).toBe(true);
  });

  it("fails just below the threshold (50%)", () => {
    const ats = appendKeywordCheck(base, 5, 5); // 50%
    expect(ats.checks.find((c) => c.id === "keywords")?.pass).toBe(false);
  });

  it("passes well above and fails well below", () => {
    expect(appendKeywordCheck(base, 7, 3).checks.find((c) => c.id === "keywords")?.pass).toBe(true);
    expect(appendKeywordCheck(base, 3, 7).checks.find((c) => c.id === "keywords")?.pass).toBe(false);
  });

  it("handles zero keywords without dividing by zero", () => {
    const ats = appendKeywordCheck(base, 0, 0);
    expect(ats.checks.find((c) => c.id === "keywords")?.pass).toBe(false);
    expect(Number.isFinite(ats.score)).toBe(true);
  });
});
