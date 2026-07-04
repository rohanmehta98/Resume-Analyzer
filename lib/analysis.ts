import type { Analysis } from "./schema";

/** Clamp/round every score the model returns to an integer in [0, 100].
 *  (The Zod schema intentionally omits numeric bounds so Groq's strict schema
 *  mode accepts it, so we enforce the range here instead.) */
export function clampAnalysis(a: Analysis): Analysis {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
  const s = a.sectionScores;
  return {
    ...a,
    overallScore: clamp(a.overallScore),
    matchScore: clamp(a.matchScore),
    sectionScores: {
      experience: { ...s.experience, score: clamp(s.experience.score) },
      skills: { ...s.skills, score: clamp(s.skills.score) },
      impact: { ...s.impact, score: clamp(s.impact.score) },
      clarity: { ...s.clarity, score: clamp(s.clarity.score) },
      education: { ...s.education, score: clamp(s.education.score) },
    },
    recommendations: a.recommendations.map((r) => ({ ...r, priority: normalizePriority(r.priority) })),
  };
}

/** Coerce any model priority value to one of High | Medium | Low. */
export function normalizePriority(p: string): "High" | "Medium" | "Low" {
  const s = String(p || "").toLowerCase();
  if (s.startsWith("h") || s.includes("critical") || s.includes("urgent")) return "High";
  if (s.startsWith("l")) return "Low";
  return "Medium";
}
