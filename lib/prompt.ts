import type { Signals } from "./signals";

const MAX_RESUME_CHARS = 14_000;
const MAX_JD_CHARS = 6_000;

function clip(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n…[truncated]" : text;
}

export const ANALYSIS_SYSTEM = [
  "You are ResumeIQ — a world-class hiring expert combining three lenses:",
  "(1) a senior technical recruiter who has screened 50,000+ resumes and knows the 6-second skim,",
  "(2) an ATS engineer who knows exactly how parsers tokenize and rank resumes, and",
  "(3) a professional resume writer who rewrites bullets into quantified, high-signal impact statements.",
  "You are precise, honest, and specific — never generic. Every judgment cites something concrete in THIS resume.",
  "You do not flatter. If a resume is weak, you say why and exactly how to fix it. You reason carefully and score rigorously against the rubric.",
].join(" ");

export function buildAnalysisPrompt(p: {
  resumeText: string;
  signals: Signals;
  targetRole?: string;
  jobDescription?: string;
}): string {
  const { resumeText, signals, targetRole, jobDescription } = p;
  const hasJD = Boolean(jobDescription && jobDescription.trim());

  const jdBlock = hasJD
    ? `TARGET JOB DESCRIPTION:\n"""\n${clip(jobDescription!, MAX_JD_CHARS)}\n"""`
    : "TARGET JOB DESCRIPTION: (none provided — evaluate against typical expectations for the target role)";

  return `Analyze the resume below.

TARGET ROLE: ${targetRole?.trim() || "(infer the most likely role from the resume)"}

${jdBlock}

DETERMINISTIC SIGNALS (already computed from the file — treat these as ground truth; do not recount):
${JSON.stringify(signals, null, 2)}

RESUME TEXT:
"""
${clip(resumeText, MAX_RESUME_CHARS)}
"""

How to evaluate (think through each before scoring):
1. First impression: in a 6-second skim, is the target role obvious, is seniority clear, and do 2-3 standout achievements jump out?
2. Impact: are accomplishments quantified (%, $, scale, time) and framed as outcomes, not duties? Weak "responsible for…" phrasing is a major deduction.
3. Relevance: how well does the content map to the target role / job description? Missing must-have skills hurt more than missing nice-to-haves.
4. ATS parsability: standard sections, real keywords in context (not a stuffed list), clean structure.
5. Craft: strong action verbs, no clichés/buzzwords, no first-person, tight and consistent.

Scoring calibration (0-100, be discriminating — do NOT inflate):
- 90-100: exceptional; top ~5% — quantified, tightly targeted, zero filler.
- 80-89: strong; interview-ready with minor polish.
- 65-79: solid but clearly improvable (most decent resumes).
- 50-64: needs real work; vague, under-quantified, or off-target.
- <50: major gaps a recruiter would reject on.

Consistency requirements (non-negotiable):
- sectionScores.impact must track the deterministic quantificationRatio (${signals.quantificationRatio}) and actionVerbRatio (${signals.actionVerbRatio}). Low ratios ⇒ low impact score.
- sectionScores.clarity must be penalized by buzzwordsFound (${signals.buzzwordsFound.length}), firstPersonCount (${signals.firstPersonCount}), and longParagraphs (${signals.longParagraphs}).
- ${hasJD ? "Base keyword and matchScore analysis STRICTLY on the job description." : "No JD provided: base matchScore on fit against standard expectations for the target role."}
- matchScore must be consistent with the matched/missing keyword split (more matched, fewer missing ⇒ higher matchScore).
- "matched" keywords must actually appear in the resume; "missing" must be relevant to the role/JD and genuinely absent.

Output quality bar:
- Every strength, weakness, and recommendation must reference specific content from THIS resume — no generic advice that could apply to any resume.
- recommendations: order by real impact; the #1 item should be the single change that most raises this candidate's chances.
- bulletRewrites: pick 3-5 of the WEAKEST real bullets and rewrite them dramatically stronger — quantified, action-led, outcome-focused. "original" must be copied verbatim from the resume; if the resume genuinely has no weak bullets, rewrite the least-quantified ones.
- potentialScore: the realistic overallScore this resume would reach if the top 2-3 recommendations were applied. Motivating but honest — always ≥ overallScore, rarely more than ~20 points above it.
- interviewQuestions: the pointed questions a sharp interviewer would actually ask THIS candidate based on their claims and gaps.
- redFlags: only real concerns (unexplained gaps, job-hopping, inconsistencies, missing must-haves) — empty array if none. Do not invent.`;
}

export const CHAT_SYSTEM =
  "You are ResumeIQ, a sharp and friendly resume coach. Help the user improve the specific resume shared below. Be concise and practical: give concrete rewrites and examples rather than generic advice. When you suggest a bullet, show the improved version. If asked something unrelated to their resume or job search, gently steer back. Use short paragraphs or bullet lists — no long essays.";

export function buildChatSystem(resumeText: string, context?: string): string {
  const resume = `The user's resume:\n"""\n${clip(resumeText, MAX_RESUME_CHARS)}\n"""`;
  return `${CHAT_SYSTEM}\n\n${resume}${context ? `\n\n${context}` : ""}`;
}
