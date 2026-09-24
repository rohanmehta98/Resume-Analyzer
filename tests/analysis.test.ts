import { describe, it, expect } from "vitest";
import {
  buildAnalysis,
  clamp,
  clarityCeiling,
  impactCeiling,
  normalizeImportance,
  normalizePriority,
  normalizeStatus,
  requirementCoverage,
  weightedScore,
} from "@/lib/analysis";
import { computeSignals } from "@/lib/signals";
import { CAREER_PROFILES } from "@/lib/careers";
import type { Assessment, Content } from "@/lib/schema";

const RESUME = [
  "Jane Doe",
  "Senior Software Engineer",
  "jane@example.com | (555) 123-4567",
  "EXPERIENCE",
  "Acme Corp - Senior Software Engineer (2020 - Present)",
  "- Led migration of a monolith to microservices, reducing p95 latency by 40%",
  "- Built a CI/CD pipeline with Docker and Kubernetes that cut deploy time from 2 hours to 15 minutes",
  "- Responsible for the payments service",
  "SKILLS",
  "TypeScript, Node.js, React, AWS, PostgreSQL",
  "EDUCATION",
  "B.S. Computer Science, State University",
].join("\n");

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  const section = { score: 70, insight: "x" };
  return {
    candidateName: "Jane Doe",
    currentTitle: "Senior Software Engineer",
    detectedRole: "Senior Software Engineer",
    overallScore: 70,
    summary: "ok",
    matchScore: 70,
    potentialScore: 82,
    sectionScores: {
      experience: { ...section },
      impact: { ...section },
      skills: { ...section },
      relevance: { ...section },
      clarity: { ...section },
      education: { ...section },
    },
    strengths: ["a"],
    weaknesses: ["b"],
    keywords: { matched: [], missing: [] },
    requirements: [],
    recommendations: [],
    redFlags: [],
    ...overrides,
  };
}

function content(overrides: Partial<Content> = {}): Content {
  return {
    professionalSummary: "Summary",
    headline: "Headline",
    bulletRewrites: [],
    skillsToAdd: [],
    interviewQuestions: [],
    careerTips: [],
    ...overrides,
  };
}

const signals = computeSignals(RESUME);
const weights = CAREER_PROFILES.software.weights;
const build = (a: Partial<Assessment> = {}, c: Partial<Content> | null = {}, hasJobDescription = false) =>
  buildAnalysis({
    assessment: assessment(a),
    content: c === null ? null : content(c),
    resumeText: RESUME,
    signals,
    weights,
    hasJobDescription,
  });

describe("clamp", () => {
  it("rounds and bounds to 0-100, treating junk as 0", () => {
    expect(clamp(150)).toBe(100);
    expect(clamp(-5)).toBe(0);
    expect(clamp(72.6)).toBe(73);
    expect(clamp(NaN)).toBe(0);
    expect(clamp("80")).toBe(80);
    expect(clamp(undefined)).toBe(0);
  });
});

describe("buildAnalysis scoring", () => {
  it("blends the model's overall with the weighted section average", () => {
    // All sections 70 → weighted 70; AI overall 90 → 0.5*90 + 0.5*70 = 80.
    const a = build({ overallScore: 90 });
    expect(a.aiOverallScore).toBe(90);
    expect(a.overallScore).toBe(80);
  });

  it("caps impact by the measured quantification signal", () => {
    const weak = computeSignals("- Worked on things\n- Helped the team\n- Did tasks\n".repeat(5));
    const a = buildAnalysis({
      assessment: assessment({
        sectionScores: { ...assessment().sectionScores, impact: { score: 95, insight: "great" } },
      }),
      content: null,
      resumeText: RESUME,
      signals: weak,
      weights,
      hasJobDescription: false,
    });
    expect(a.sectionScores.impact.score).toBe(impactCeiling(weak));
    expect(a.sectionScores.impact.score).toBeLessThan(95);
  });

  it("never lets potential fall below overall or jump more than 25", () => {
    expect(build({ overallScore: 70, potentialScore: 40 }).potentialScore).toBe(build({ overallScore: 70 }).overallScore);
    const big = build({ overallScore: 70, potentialScore: 100 });
    expect(big.potentialScore - big.overallScore).toBeLessThanOrEqual(25);
  });

  it("blends match with requirement coverage and verified keywords when a JD is given", () => {
    const a = build(
      {
        matchScore: 100,
        keywords: { matched: ["TypeScript"], missing: ["Go"] },
        requirements: [
          { requirement: "TypeScript", importance: "Must-have", status: "Met", evidence: "" },
          { requirement: "Go", importance: "Must-have", status: "Missing", evidence: "" },
        ],
      },
      {},
      true
    );
    // 0.4*100 + 0.35*50 + 0.25*50 = 70
    expect(a.matchScore).toBe(70);
  });

  it("drops requirements when there is no job description", () => {
    const a = build({ requirements: [{ requirement: "X", importance: "Must-have", status: "Met", evidence: "" }] });
    expect(a.requirements).toEqual([]);
  });
});

describe("buildAnalysis verification", () => {
  it("re-files hallucinated keyword matches as missing and vice versa", () => {
    const a = build({ keywords: { matched: ["Kubernetes", "Terraform"], missing: ["React", "GraphQL"] } });
    expect(a.keywords.matched).toEqual(expect.arrayContaining(["Kubernetes", "React"]));
    expect(a.keywords.missing).toEqual(expect.arrayContaining(["Terraform", "GraphQL"]));
    expect(a.keywords.coverage).toBe(0.5);
  });

  it("drops rewrites whose original bullet isn't in the resume", () => {
    const a = build(
      {},
      {
        bulletRewrites: [
          { original: "Responsible for the payments service", improved: "Owned the payments service…", why: "" },
          { original: "Invented a time machine for the CEO", improved: "Built…", why: "" },
        ],
      }
    );
    expect(a.bulletRewrites).toHaveLength(1);
    expect(a.bulletRewrites[0]!.original).toMatch(/payments/);
  });

  it("returns empty content fields when the content pass failed", () => {
    const a = build({}, null);
    expect(a.bulletRewrites).toEqual([]);
    expect(a.professionalSummary).toBe("");
    expect(a.overallScore).toBeGreaterThan(0);
  });

  it("normalizes, sorts, and ids recommendations", () => {
    const a = build({
      recommendations: [
        { priority: "low", category: "format", title: "Tidy", detail: "d" },
        { priority: "critical", category: "Impact", title: "Quantify", detail: "d" },
        { priority: "High", category: "", title: "", detail: "dropped (no title)" },
      ],
    });
    expect(a.recommendations.map((r) => r.priority)).toEqual(["High", "Low"]);
    expect(a.recommendations[0]!.category).toBe("Impact");
    expect(a.recommendations[1]!.category).toBe("Format");
    expect(new Set(a.recommendations.map((r) => r.id)).size).toBe(2);
  });

  it("dedupes list items and falls back to 'Candidate' for a blank name", () => {
    const a = build({ candidateName: "  ", strengths: ["Good", "good", " ", "Other"] });
    expect(a.candidateName).toBe("Candidate");
    expect(a.strengths).toEqual(["Good", "Other"]);
  });
});

describe("helpers", () => {
  it("weights sections", () => {
    const s = { score: 0 };
    const sections = { experience: { score: 100 }, impact: s, skills: s, relevance: s, clarity: s, education: s };
    expect(weightedScore(sections, weights)).toBeCloseTo(weights.experience * 100, 5);
  });

  it("counts must-haves double and partial as half", () => {
    expect(
      requirementCoverage([
        { importance: "Must-have", status: "Met" },
        { importance: "Nice-to-have", status: "Partial" },
        { importance: "Nice-to-have", status: "Missing" },
      ])
    ).toBeCloseTo((2 + 0.5) / 4 * 100, 5);
    expect(requirementCoverage([])).toBe(0);
  });

  it("lowers the clarity ceiling for buzzwords and pronouns", () => {
    const clean = computeSignals(RESUME.replace("Responsible for", "Owned"));
    const messy = computeSignals(RESUME + "\nI am a team player and results-driven self-starter. My passion is my work, I think.");
    expect(clarityCeiling(messy)).toBeLessThan(clarityCeiling(clean));
  });

  it("normalizes enums", () => {
    expect(normalizePriority("critical")).toBe("High");
    expect(normalizePriority("medium")).toBe("Medium");
    expect(normalizePriority("whatever")).toBe("Medium");
    expect(normalizePriority("low")).toBe("Low");
    expect(normalizeStatus("Met")).toBe("Met");
    expect(normalizeStatus("partially")).toBe("Partial");
    expect(normalizeStatus("no")).toBe("Missing");
    expect(normalizeImportance("Nice-to-have")).toBe("Nice-to-have");
    expect(normalizeImportance("preferred")).toBe("Nice-to-have");
    expect(normalizeImportance("required")).toBe("Must-have");
  });
});
