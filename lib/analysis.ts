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
  };
}
