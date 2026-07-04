import type { Signals } from "./signals";

const MAX_RESUME_CHARS = 14_000;
const MAX_JD_CHARS = 6_000;

function clip(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n…[truncated]" : text;
}

export const ANALYSIS_SYSTEM =
  "You are a senior technical recruiter and certified resume writer with 15 years of experience hiring across tech, finance, and operations. You give specific, honest, actionable feedback — never generic praise. You judge resumes the way a hiring manager skims them in 30 seconds and the way an ATS parses them.";

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

Scoring rules:
- Be discriminating. Reserve 85+ overall for genuinely strong, quantified, well-targeted resumes. Most real resumes land 55-75.
- Your section scores MUST stay consistent with the deterministic signals:
  • sectionScores.impact must track quantificationRatio (${signals.quantificationRatio}) and actionVerbRatio (${signals.actionVerbRatio}). Low ratios ⇒ low impact score.
  • sectionScores.clarity must be penalized by buzzwordsFound (${signals.buzzwordsFound.length}), firstPersonCount (${signals.firstPersonCount}), and longParagraphs (${signals.longParagraphs}).
- ${hasJD ? "Base keyword and matchScore analysis strictly on the job description." : "No JD provided: base matchScore on fit against standard expectations for the target role."}
- matchScore must be consistent with the matched/missing keyword split (more matched, fewer missing ⇒ higher matchScore).
- "matched" keywords must actually appear in the resume; "missing" must be relevant to the role/JD and genuinely absent.
- Recommendations must be concrete and specific to THIS resume (reference real content), not generic advice.
- bulletRewrites: choose 3-5 of the weakest REAL bullet points and rewrite them stronger (quantified, action-led). "original" must be copied verbatim from the resume.`;
}

export const CHAT_SYSTEM =
  "You are ResumeIQ, a sharp and friendly resume coach. Help the user improve the specific resume shared below. Be concise and practical: give concrete rewrites and examples rather than generic advice. When you suggest a bullet, show the improved version. If asked something unrelated to their resume or job search, gently steer back. Use short paragraphs or bullet lists — no long essays.";

export function buildChatSystem(resumeText: string, context?: string): string {
  const resume = `The user's resume:\n"""\n${clip(resumeText, MAX_RESUME_CHARS)}\n"""`;
  return `${CHAT_SYSTEM}\n\n${resume}${context ? `\n\n${context}` : ""}`;
}
