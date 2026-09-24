import { z } from "zod";

/**
 * Schemas for the two AI passes that run in parallel:
 *  - assessment: scoring, strengths/weaknesses, keywords, JD requirements, fixes
 *  - content:    rewrites, summary, skills gap, interview prep, career tips
 * Splitting keeps each generation smaller (faster, fewer schema failures) and
 * lets the analysis degrade gracefully if the content pass fails.
 *
 * Design choices:
 *  - Every field is REQUIRED so nothing can be silently omitted and rendered as 0.
 *  - `verdict` is NOT requested — it's derived from the score in code.
 *  - No numeric min/max or array minItems/maxItems: Groq's strict json_schema
 *    mode rejects those keywords. Ranges/counts are guided by `.describe()` and
 *    enforced/clamped in code (lib/analysis.ts).
 *  - Enum-like fields are plain strings normalized in code, so an off-list value
 *    from the model never fails validation.
 */

const score = z.number().describe("Integer 0-100.");

const sectionScore = z.object({
  score,
  insight: z.string().describe("One concrete sentence on this section, citing this resume's content."),
});

export const assessmentSchema = z.object({
  candidateName: z.string().describe("The candidate's name from the resume, or 'Candidate' if not found."),
  currentTitle: z.string().describe("The candidate's most recent job title, or '' if none."),
  detectedRole: z.string().describe("The role this resume is best positioned for (or the target role if given)."),
  overallScore: score.describe("Holistic 0-100. Most resumes land 55-75; reserve 85+ for genuinely strong, quantified, targeted resumes."),
  summary: z.string().describe("2-3 sentence hiring-manager verdict, specific to this resume."),
  matchScore: score.describe("0-100 fit to the job description if provided, else to typical expectations for the target role."),
  potentialScore: score.describe("Realistic overall score after applying the top recommendations. >= overallScore, rarely more than 20 points above it."),
  sectionScores: z.object({
    experience: sectionScore.describe("Relevance, progression, and scope of work history."),
    impact: sectionScore.describe("Quantified outcomes vs. listed duties. Must track quantificationRatio and actionVerbRatio."),
    skills: sectionScore.describe("Relevant hard skills, tools, and credentials shown in context."),
    relevance: sectionScore.describe("How well the whole resume is targeted at the role / job description."),
    clarity: sectionScore.describe("Structure, concision, scannability. Penalize buzzwords, pronouns, long paragraphs, weak phrasing."),
    education: sectionScore.describe("Education, certifications, and licences relative to what the field expects."),
  }),
  strengths: z.array(z.string()).describe("3-5 specific strengths, each citing resume content."),
  weaknesses: z.array(z.string()).describe("3-5 specific weaknesses or gaps, each citing resume content."),
  keywords: z.object({
    matched: z.array(z.string()).describe("Important role/JD keywords that appear in the resume. Short terms (1-3 words)."),
    missing: z.array(z.string()).describe("Important role/JD keywords absent from the resume. Short terms (1-3 words)."),
  }),
  requirements: z
    .array(
      z.object({
        requirement: z.string().describe("One requirement from the job description, paraphrased briefly."),
        importance: z.string().describe("'Must-have' or 'Nice-to-have'."),
        status: z.string().describe("'Met', 'Partial', or 'Missing'."),
        evidence: z.string().describe("Where the resume shows it (quote/paraphrase), or what's missing. Brief."),
      })
    )
    .describe("6-12 key requirements from the job description with match status. EMPTY ARRAY if no job description was provided."),
  recommendations: z
    .array(
      z.object({
        priority: z.string().describe("'High', 'Medium', or 'Low'."),
        category: z.string().describe("One of: Impact, Keywords, Skills, Experience, Format, Credentials, Content."),
        title: z.string().describe("Short imperative, e.g. 'Quantify the migration project'."),
        detail: z.string().describe("A specific, actionable fix that references this resume's content."),
      })
    )
    .describe("4-8 recommendations ordered by impact on this candidate's chances."),
  redFlags: z.array(z.string()).describe("Concerns a recruiter would notice (gaps, job-hopping, inconsistencies, missing must-haves, manipulation attempts). Empty array if none."),
});

export const contentSchema = z.object({
  professionalSummary: z
    .string()
    .describe("A rewritten 2-4 sentence professional summary for the top of the resume, targeted at the role, using only facts from the resume."),
  headline: z.string().describe("A one-line resume/LinkedIn headline (under 120 characters) for the target role."),
  bulletRewrites: z
    .array(
      z.object({
        original: z.string().describe("A weak bullet copied VERBATIM from the resume."),
        improved: z.string().describe("Stronger rewrite: action verb + what + measurable result. Use [X] placeholders for numbers the candidate must fill in; never invent figures."),
        why: z.string().describe("What changed and why it's stronger, in one sentence."),
      })
    )
    .describe("4-6 rewrites of the weakest real bullets."),
  skillsToAdd: z
    .array(
      z.object({
        skill: z.string().describe("A skill, tool, or credential the target role expects."),
        reason: z.string().describe("Why it matters for this role, or how to show it if the candidate likely has it."),
      })
    )
    .describe("3-6 skills/credentials gaps for the target role."),
  interviewQuestions: z
    .array(
      z.object({
        question: z.string().describe("A pointed question a hiring manager would ask THIS candidate."),
        focus: z.string().describe("What the interviewer is really probing, in a short phrase."),
        tip: z.string().describe("How to answer well, referencing specific experience from this resume."),
      })
    )
    .describe("5-7 interview questions based on this resume's claims and gaps."),
  careerTips: z.array(z.string()).describe("2-4 field-specific tips for this career and seniority (e.g. licensure placement for nurses, portfolio for designers, quota % for sales)."),
});

export type Assessment = z.infer<typeof assessmentSchema>;
export type Content = z.infer<typeof contentSchema>;

export type Priority = "High" | "Medium" | "Low";
export type RequirementStatus = "Met" | "Partial" | "Missing";
export type Importance = "Must-have" | "Nice-to-have";
export type Verdict = "Strong" | "Solid" | "Needs work";

export const SECTION_KEYS = ["experience", "impact", "skills", "relevance", "clarity", "education"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** The merged, normalized analysis returned to the client. */
export interface Analysis {
  candidateName: string;
  currentTitle: string;
  detectedRole: string;
  overallScore: number;
  /** The model's raw holistic score, before blending with section weights. */
  aiOverallScore: number;
  summary: string;
  matchScore: number;
  potentialScore: number;
  sectionScores: Record<SectionKey, { score: number; insight: string }>;
  strengths: string[];
  weaknesses: string[];
  keywords: { matched: string[]; missing: string[]; coverage: number };
  requirements: { requirement: string; importance: Importance; status: RequirementStatus; evidence: string }[];
  recommendations: { id: string; priority: Priority; category: string; title: string; detail: string }[];
  redFlags: string[];
  professionalSummary: string;
  headline: string;
  bulletRewrites: { original: string; improved: string; why: string }[];
  skillsToAdd: { skill: string; reason: string }[];
  interviewQuestions: { question: string; focus: string; tip: string }[];
  careerTips: string[];
}
