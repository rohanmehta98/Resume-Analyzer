/**
 * Deterministic ("no-AI-needed") analysis of a resume's structure and quality.
 * Everything here is plain code so the numbers are reproducible and trustworthy;
 * the AI layer only adds qualitative judgment on top of these hard signals.
 */

export interface Signals {
  wordCount: number;
  lineCount: number;
  estimatedPages: number;
  contact: {
    hasEmail: boolean;
    hasPhone: boolean;
    hasLinkedIn: boolean;
    hasGitHub: boolean;
    hasWebsite: boolean;
  };
  bulletCount: number;
  quantifiedLineCount: number;
  quantificationRatio: number;
  actionVerbRatio: number;
  sections: Record<"summary" | "experience" | "education" | "skills" | "projects" | "certifications", boolean>;
  buzzwordsFound: string[];
  firstPersonCount: number;
  longParagraphs: number;
}

export interface AtsCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface Ats {
  checks: AtsCheck[];
  score: number;
}

const ACTION_VERBS = new Set(
  (
    "led managed built created designed developed launched delivered drove owned " +
    "improved increased reduced grew scaled optimized automated streamlined implemented " +
    "shipped architected engineered spearheaded established founded initiated coordinated " +
    "directed oversaw mentored trained analyzed researched negotiated closed generated " +
    "boosted accelerated cut saved won achieved exceeded transformed migrated refactored " +
    "deployed resolved diagnosed"
  ).split(" ")
);

const SECTION_PATTERNS: Record<keyof Signals["sections"], RegExp> = {
  summary: /\b(summary|profile|objective|about me)\b/i,
  experience: /\b(experience|employment|work history|professional background|career)\b/i,
  education: /\b(education|academic|qualifications|degree)\b/i,
  skills: /\b(skills|technical skills|competencies|technologies|tech stack)\b/i,
  projects: /\b(projects|portfolio|selected work)\b/i,
  certifications: /\b(certifications?|licen[cs]es?|credentials)\b/i,
};

const BUZZWORDS = [
  "team player", "hard working", "hard-working", "detail oriented", "detail-oriented",
  "go-getter", "self-starter", "results-driven", "synergy", "think outside the box",
  "responsible for", "duties included", "dynamic professional",
];

import { MAX_TEXT_CHARS } from "./constants";

export function computeSignals(input: string): Signals {
  // Bound the input so every regex below runs on a fixed, small ceiling of text.
  const text = input.length > MAX_TEXT_CHARS ? input.slice(0, MAX_TEXT_CHARS) : input;
  const lines = text.split("\n").map((l) => l.trim());
  const nonEmptyLines = lines.filter((l) => l.length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Bounded quantifiers keep this linear: an unbounded `+` before `@` backtracks
  // O(n^2) on a long token with no `@` (a one-line paste DoS). Real local parts
  // are <=64 chars and domains <=255, so bounding costs no real matches.
  const hasEmail = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,255}\.[a-z]{2,24}/i.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  const hasLinkedIn = /linkedin\.com\//i.test(text);
  const hasGitHub = /github\.com\//i.test(text);
  // Linear URL scan (no variable-width lookahead — avoids O(n^2) / ReDoS).
  const urls = text.match(/\bhttps?:\/\/\S+/gi) || [];
  const hasWebsite = urls.some((u) => !/(?:linkedin|github)\.com/i.test(u));

  const bulletLines = nonEmptyLines.filter((l) => /^([•\-*▪◦‣·])\s+/.test(l));
  const bulletCount = bulletLines.length;
  const hasNumber = (s: string) => /(\d[\d,.]*\s*%|\$\s*\d|\b\d[\d,.]*\b)/.test(s);
  const quantifiedLines = nonEmptyLines.filter(hasNumber);

  const impactBase = bulletCount > 0 ? bulletLines : nonEmptyLines;
  const quantifiedInBase = impactBase.filter(hasNumber).length;
  const quantificationRatio = impactBase.length ? quantifiedInBase / impactBase.length : 0;

  const startsWithActionVerb = (l: string) => {
    const first = l.replace(/^([•\-*▪◦‣·])\s*/, "").split(/\s+/)[0] || "";
    return ACTION_VERBS.has(first.toLowerCase().replace(/[^a-z]/g, ""));
  };
  const actionVerbLines = impactBase.filter(startsWithActionVerb).length;
  const actionVerbRatio = impactBase.length ? actionVerbLines / impactBase.length : 0;

  const sections = {} as Signals["sections"];
  (Object.keys(SECTION_PATTERNS) as (keyof Signals["sections"])[]).forEach((name) => {
    const pattern = SECTION_PATTERNS[name];
    sections[name] =
      nonEmptyLines.some((l) => l.length <= 60 && pattern.test(l)) || pattern.test(text.slice(0, 1500));
  });

  const lowerText = text.toLowerCase();
  const buzzwordsFound = BUZZWORDS.filter((b) => lowerText.includes(b));
  const firstPersonCount = (text.match(/\b(i|me|my|myself)\b/gi) || []).length;
  const estimatedPages = Math.max(1, Math.round(wordCount / 500));
  const longParagraphs = nonEmptyLines.filter((l) => l.split(/\s+/).length > 45).length;

  return {
    wordCount,
    lineCount: nonEmptyLines.length,
    estimatedPages,
    contact: { hasEmail, hasPhone, hasLinkedIn, hasGitHub, hasWebsite },
    bulletCount,
    quantifiedLineCount: quantifiedLines.length,
    quantificationRatio: round(quantificationRatio),
    actionVerbRatio: round(actionVerbRatio),
    sections,
    buzzwordsFound,
    firstPersonCount,
    longParagraphs,
  };
}

/**
 * Deterministic ATS-style checks + score. When a JD is provided, the caller
 * folds a keyword-coverage check in via `appendKeywordCheck`.
 */
export function computeAtsChecks(signals: Signals): Ats {
  const { contact, sections, wordCount, quantificationRatio, bulletCount } = signals;

  const checks: AtsCheck[] = [
    {
      id: "contact",
      label: "Contact information",
      pass: contact.hasEmail && contact.hasPhone,
      detail:
        contact.hasEmail && contact.hasPhone
          ? "Email and phone number detected."
          : "Add a professional email and phone number near the top.",
    },
    {
      id: "sections",
      label: "Standard sections",
      pass: sections.experience && sections.education && sections.skills,
      detail:
        sections.experience && sections.education && sections.skills
          ? "Experience, Education, and Skills sections found."
          : "Use clear headings for Experience, Education, and Skills so parsers can map them.",
    },
    {
      id: "length",
      label: "Appropriate length",
      pass: wordCount >= 350 && wordCount <= 1200,
      detail:
        wordCount < 350
          ? `Only ~${wordCount} words — add more detail on impact and scope.`
          : wordCount > 1200
          ? `~${wordCount} words is long — tighten toward 1-2 pages.`
          : `~${wordCount} words — a healthy length.`,
    },
    {
      id: "bullets",
      label: "Bulleted achievements",
      pass: bulletCount >= 5,
      detail:
        bulletCount >= 5
          ? `${bulletCount} bullet points detected.`
          : "Use bullet points for accomplishments instead of dense paragraphs.",
    },
    {
      id: "quantified",
      label: "Quantified impact",
      pass: quantificationRatio >= 0.25,
      detail:
        quantificationRatio >= 0.25
          ? `${Math.round(quantificationRatio * 100)}% of achievements include numbers.`
          : "Quantify results with metrics (%, $, time saved, scale) in more bullets.",
    },
  ];

  return scoreChecks(checks);
}

export function appendKeywordCheck(ats: Ats, matched: number, missing: number): Ats {
  const total = matched + missing;
  const coverage = total ? matched / total : 0;
  const checks: AtsCheck[] = [
    ...ats.checks,
    {
      id: "keywords",
      label: "Job-description keyword match",
      pass: coverage >= 0.6,
      detail:
        total === 0
          ? "No comparable keywords were extracted from the job description."
          : `${matched} of ${total} key terms matched (${Math.round(coverage * 100)}%).`,
    },
  ];
  return scoreChecks(checks);
}

function scoreChecks(checks: AtsCheck[]): Ats {
  const passed = checks.filter((c) => c.pass).length;
  return { checks, score: Math.round((passed / checks.length) * 100) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
