import { z } from "zod";

/**
 * Schema for the AI's qualitative analysis. This is what `generateObject`
 * validates against, so the model is constrained to return exactly this shape.
 *
 * Deliberate design choices (from review findings):
 *  - Every section score is REQUIRED, so no section can be silently omitted and
 *    rendered as a misleading 0.
 *  - `verdict` is NOT requested from the model — it's derived from the score in
 *    code so the badge can never contradict the number.
 *  - `matchScore` is here but only shown when a job description is provided.
 *
 * NOTE: no numeric min/max or array minItems/maxItems constraints are used.
 * Groq's strict json_schema (constrained-decoding) mode rejects those keywords,
 * which would break every analysis. Ranges/counts are guided by the prompt +
 * `.describe()` and enforced/clamped in code after generation (see route).
 */

const score = z.number().describe("Integer 0-100.");

const sectionScore = z.object({
  score,
  insight: z.string().describe("One concrete sentence on this section, specific to this resume."),
});

export const analysisSchema = z.object({
  candidateName: z.string().describe("Best guess of the candidate's name, or 'Candidate' if unknown."),
  detectedRole: z.string().describe("The role this resume best fits."),
  overallScore: score.describe("Holistic 0-100. Reserve 85+ for genuinely strong, quantified, targeted resumes; most resumes are 55-75."),
  summary: z.string().describe("2-3 sentence recruiter's-eye verdict, specific to this resume."),
  matchScore: score.describe("0-100 fit against the job description if provided, else fit against typical expectations for the target role."),
  sectionScores: z.object({
    experience: sectionScore,
    skills: sectionScore,
    impact: sectionScore.describe("Reflect the deterministic quantificationRatio and actionVerbRatio signals."),
    clarity: sectionScore.describe("Penalize buzzwords, first-person pronouns, and long paragraphs from the signals."),
    education: sectionScore,
  }),
  strengths: z.array(z.string()).describe("3-5 specific strengths grounded in the resume."),
  weaknesses: z.array(z.string()).describe("3-5 specific weaknesses or gaps grounded in the resume."),
  keywords: z.object({
    matched: z.array(z.string()).describe("Relevant keywords actually present in the resume."),
    missing: z.array(z.string()).describe("Important keywords for the role/JD that are absent."),
  }),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["High", "Medium", "Low"]),
        title: z.string(),
        detail: z.string().describe("A specific, actionable fix referencing this resume's content."),
      })
    )
    .describe("3-8 prioritized, specific recommendations."),
  bulletRewrites: z
    .array(
      z.object({
        original: z.string().describe("A weak bullet copied verbatim from the resume."),
        improved: z.string().describe("A stronger, quantified, action-led rewrite."),
        why: z.string().describe("What changed and why it's better."),
      })
    )
    .describe("3-5 rewrites of the weakest real bullets."),
  interviewQuestions: z.array(z.string()).describe("4-6 questions a recruiter would likely ask this candidate."),
  redFlags: z.array(z.string()).describe("Gaps, inconsistencies, or concerns a recruiter would notice. Empty array if none."),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type Verdict = "Strong" | "Solid" | "Needs work";
