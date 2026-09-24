import type {
  Analysis,
  Assessment,
  Content,
  Importance,
  Priority,
  RequirementStatus,
  SectionKey,
} from "./schema";
import { SECTION_KEYS } from "./schema";
import type { Signals } from "./signals";
import type { SectionWeights } from "./careers";
import { quoteAppearsIn, verifyKeywords } from "./keywords";

/**
 * Turn the two raw AI outputs into the analysis the user sees. This is where
 * the "strong logic" lives: the model's numbers are clamped, cross-checked
 * against the deterministic signals, verified against the resume text, and
 * blended into calibrated scores. Pure function — fully unit-tested.
 */
export function buildAnalysis(p: {
  assessment: Assessment;
  content: Content | null;
  resumeText: string;
  signals: Signals;
  weights: SectionWeights;
  hasJobDescription: boolean;
}): Analysis {
  const { assessment: a, content: c, resumeText, signals, weights, hasJobDescription } = p;

  // 1. Section scores: clamp, then apply evidence-based ceilings so the AI can't
  //    rate impact or clarity above what the measurable signals support.
  const sectionScores = {} as Analysis["sectionScores"];
  for (const key of SECTION_KEYS) {
    const s = a.sectionScores?.[key];
    sectionScores[key] = { score: clamp(s?.score), insight: text(s?.insight) };
  }
  sectionScores.impact.score = Math.min(sectionScores.impact.score, impactCeiling(signals));
  sectionScores.clarity.score = Math.min(sectionScores.clarity.score, clarityCeiling(signals));

  // 2. Overall: half the model's holistic judgment, half the field-weighted
  //    section average. Blending damps run-to-run noise and makes the number
  //    explainable (the weights are shown in the UI).
  const aiOverallScore = clamp(a.overallScore);
  const overallScore = clamp(0.5 * aiOverallScore + 0.5 * weightedScore(sectionScores, weights));

  // 3. Keywords: verified against the actual resume text.
  const keywords = verifyKeywords(resumeText, {
    matched: list(a.keywords?.matched, 30),
    missing: list(a.keywords?.missing, 30),
  });

  // 4. Requirements (JD only).
  const requirements = hasJobDescription
    ? (a.requirements || [])
        .map((r) => ({
          requirement: text(r.requirement),
          importance: normalizeImportance(r.importance),
          status: normalizeStatus(r.status),
          evidence: text(r.evidence),
        }))
        .filter((r) => r.requirement)
        .slice(0, 14)
    : [];

  // 5. Match: blend the model's estimate with deterministic coverage.
  const aiMatch = clamp(a.matchScore);
  const kwTotal = keywords.matched.length + keywords.missing.length;
  const kwPct = keywords.coverage * 100;
  let matchScore: number;
  if (hasJobDescription && requirements.length) {
    matchScore = clamp(0.4 * aiMatch + 0.35 * requirementCoverage(requirements) + 0.25 * kwPct);
  } else if (kwTotal > 0) {
    matchScore = clamp(0.6 * aiMatch + 0.4 * kwPct);
  } else {
    matchScore = aiMatch;
  }

  // 6. Potential: never below current, never an unrealistic jump.
  const potentialScore = Math.min(100, overallScore + 25, Math.max(overallScore, clamp(a.potentialScore)));

  // 7. Recommendations: normalized, stable ids (for the action-plan checklist), priority-sorted.
  const recommendations = (a.recommendations || [])
    .map((r, i) => ({
      id: `${i}-${slug(text(r.title))}`,
      priority: normalizePriority(r.priority),
      category: normalizeCategory(r.category),
      title: text(r.title),
      detail: text(r.detail),
    }))
    .filter((r) => r.title && r.detail)
    .sort((x, y) => priorityRank(x.priority) - priorityRank(y.priority))
    .slice(0, 8);

  // 8. Rewrites: drop any whose "original" isn't actually in the resume.
  const bulletRewrites = (c?.bulletRewrites || [])
    .map((b) => ({ original: text(b.original), improved: text(b.improved), why: text(b.why) }))
    .filter((b) => b.original && b.improved && b.original !== b.improved && quoteAppearsIn(resumeText, b.original))
    .slice(0, 6);

  return {
    candidateName: text(a.candidateName) || "Candidate",
    currentTitle: text(a.currentTitle),
    detectedRole: text(a.detectedRole),
    overallScore,
    aiOverallScore,
    summary: text(a.summary),
    matchScore,
    potentialScore,
    sectionScores,
    strengths: list(a.strengths, 6),
    weaknesses: list(a.weaknesses, 6),
    keywords,
    requirements,
    recommendations,
    redFlags: list(a.redFlags, 6),
    professionalSummary: text(c?.professionalSummary),
    headline: text(c?.headline),
    bulletRewrites,
    skillsToAdd: (c?.skillsToAdd || [])
      .map((s) => ({ skill: text(s.skill), reason: text(s.reason) }))
      .filter((s) => s.skill)
      .slice(0, 8),
    interviewQuestions: (c?.interviewQuestions || [])
      .map((q) => ({ question: text(q.question), focus: text(q.focus), tip: text(q.tip) }))
      .filter((q) => q.question)
      .slice(0, 8),
    careerTips: list(c?.careerTips, 5),
  };
}

/* ------------------------------- scoring helpers ------------------------------- */

export function clamp(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));
}

/** Highest credible impact score given measured quantification and verb use. */
export function impactCeiling(s: Signals): number {
  return Math.round(Math.max(55, Math.min(100, 45 + 70 * s.quantificationRatio + 15 * s.actionVerbRatio)));
}

/** Highest credible clarity score given measured writing problems. */
export function clarityCeiling(s: Signals): number {
  const penalty =
    Math.min(s.buzzwordsFound.length * 3, 12) +
    Math.min(s.weakPhrases.length * 2, 8) +
    (s.firstPersonCount > 2 ? 5 : 0) +
    Math.min(s.longParagraphs, 4) * 2 +
    Math.min(s.longBullets, 4);
  return Math.max(40, 100 - penalty);
}

export function weightedScore(sections: Record<SectionKey, { score: number }>, w: SectionWeights): number {
  let total = 0;
  let wsum = 0;
  for (const k of SECTION_KEYS) {
    total += sections[k].score * w[k];
    wsum += w[k];
  }
  return wsum ? total / wsum : 0;
}

/** Share of JD requirements met, with must-haves counting double and partial as half. */
export function requirementCoverage(reqs: { importance: Importance; status: RequirementStatus }[]): number {
  let got = 0;
  let max = 0;
  for (const r of reqs) {
    const w = r.importance === "Must-have" ? 2 : 1;
    max += w;
    got += w * (r.status === "Met" ? 1 : r.status === "Partial" ? 0.5 : 0);
  }
  return max ? (got / max) * 100 : 0;
}

/* ------------------------------ normalization ------------------------------ */

/** Coerce any model priority value to one of High | Medium | Low. */
export function normalizePriority(p: unknown): Priority {
  const s = String(p || "").toLowerCase();
  if (s.startsWith("h") || s.includes("critical") || s.includes("urgent")) return "High";
  if (s.startsWith("l")) return "Low";
  return "Medium";
}

export function normalizeStatus(s: unknown): RequirementStatus {
  const v = String(s || "").toLowerCase();
  if (v.startsWith("met") || v === "yes" || v.includes("fully")) return "Met";
  if (v.startsWith("part") || v.includes("some")) return "Partial";
  return "Missing";
}

export function normalizeImportance(s: unknown): Importance {
  const v = String(s || "").toLowerCase();
  return v.includes("nice") || v.includes("prefer") || v.includes("bonus") || v.includes("optional")
    ? "Nice-to-have"
    : "Must-have";
}

const CATEGORIES = ["Impact", "Keywords", "Skills", "Experience", "Format", "Credentials", "Content"];
function normalizeCategory(c: unknown): string {
  const v = String(c || "").trim().toLowerCase();
  return CATEGORIES.find((x) => x.toLowerCase() === v) || "Content";
}

function priorityRank(p: Priority) {
  return p === "High" ? 0 : p === "Medium" ? 1 : 2;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function list(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const t = text(item);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
