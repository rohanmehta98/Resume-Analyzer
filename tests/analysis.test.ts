import { describe, it, expect } from "vitest";
import { clampAnalysis, normalizePriority } from "@/lib/analysis";
import type { Analysis } from "@/lib/schema";

function make(overrides: Partial<Analysis> = {}): Analysis {
  const section = { score: 70, insight: "x" };
  return {
    candidateName: "Jane",
    detectedRole: "Engineer",
    overallScore: 70,
    summary: "ok",
    matchScore: 70,
    sectionScores: {
      experience: { ...section },
      skills: { ...section },
      impact: { ...section },
      clarity: { ...section },
      education: { ...section },
    },
    strengths: ["a"],
    weaknesses: ["b"],
    keywords: { matched: [], missing: [] },
    recommendations: [],
    bulletRewrites: [],
    interviewQuestions: [],
    redFlags: [],
    ...overrides,
  };
}

describe("clampAnalysis", () => {
  it("clamps out-of-range scores into 0-100", () => {
    const a = clampAnalysis(make({ overallScore: 150, matchScore: -20 }));
    expect(a.overallScore).toBe(100);
    expect(a.matchScore).toBe(0);
  });

  it("rounds fractional scores to integers", () => {
    const a = clampAnalysis(make({ overallScore: 73.6 }));
    expect(a.overallScore).toBe(74);
    expect(Number.isInteger(a.overallScore)).toBe(true);
  });

  it("clamps every section score", () => {
    const a = clampAnalysis(
      make({
        sectionScores: {
          experience: { score: 999, insight: "" },
          skills: { score: -5, insight: "" },
          impact: { score: 50.4, insight: "" },
          clarity: { score: 88, insight: "" },
          education: { score: NaN as unknown as number, insight: "" },
        },
      })
    );
    expect(a.sectionScores.experience.score).toBe(100);
    expect(a.sectionScores.skills.score).toBe(0);
    expect(a.sectionScores.impact.score).toBe(50);
    expect(a.sectionScores.clarity.score).toBe(88);
    expect(a.sectionScores.education.score).toBe(0); // NaN -> 0
  });

  it("preserves non-score fields", () => {
    const a = clampAnalysis(make({ candidateName: "Bob", strengths: ["x", "y"] }));
    expect(a.candidateName).toBe("Bob");
    expect(a.strengths).toEqual(["x", "y"]);
  });

  it("normalizes recommendation priorities to High/Medium/Low", () => {
    const a = clampAnalysis(
      make({
        recommendations: [
          { priority: "critical", title: "t", detail: "d" },
          { priority: "medium", title: "t", detail: "d" },
          { priority: "whatever", title: "t", detail: "d" },
        ],
      })
    );
    expect(a.recommendations.map((r) => r.priority)).toEqual(["High", "Medium", "Medium"]);
  });
});

describe("normalizePriority", () => {
  it("maps common variants", () => {
    expect(normalizePriority("High")).toBe("High");
    expect(normalizePriority("high")).toBe("High");
    expect(normalizePriority("Critical")).toBe("High");
    expect(normalizePriority("urgent")).toBe("High");
    expect(normalizePriority("Low")).toBe("Low");
    expect(normalizePriority("Medium")).toBe("Medium");
    expect(normalizePriority("")).toBe("Medium");
    expect(normalizePriority("something odd")).toBe("Medium");
  });
});
