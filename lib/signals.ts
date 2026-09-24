/**
 * Deterministic ("no-AI-needed") analysis of a resume's structure and quality.
 * Everything here is plain code so the numbers are reproducible and trustworthy;
 * the AI layer only adds qualitative judgment on top of these hard signals.
 *
 * Every regex runs on bounded input (the whole text is capped at MAX_TEXT_CHARS
 * and per-line patterns only see lines capped at MAX_LINE_CHARS), and patterns
 * use bounded quantifiers, so no input can trigger catastrophic backtracking.
 */

import { MAX_TEXT_CHARS } from "./constants";

export interface EmploymentGap {
  from: string;
  to: string;
  months: number;
}

export interface Timeline {
  /** Total non-overlapping experience, in years (one decimal). */
  yearsExperience: number;
  /** Number of dated positions found outside the education section. */
  roleCount: number;
  avgTenureMonths: number;
  /** Gaps of 6+ months between positions (and before today, if not currently employed). */
  gaps: EmploymentGap[];
  /** Completed positions shorter than 12 months. */
  shortStints: number;
  currentlyEmployed: boolean;
}

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
  /** Weak, duty-focused openers ("helped", "worked on", …) found in the text. */
  weakPhrases: string[];
  passiveVoiceCount: number;
  /** Action verbs used to open 3+ bullets — repetition reads as lazy. */
  repeatedVerbs: { verb: string; count: number }[];
  avgBulletWords: number;
  /** Bullets over 35 words — too long to skim. */
  longBullets: number;
  /** Share of odd/unreadable characters — a proxy for bad PDF text extraction. */
  garbledRatio: number;
  timeline: Timeline;
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

const MAX_LINE_CHARS = 400;

/** Strong verbs across careers — tech, clinical, teaching, sales, trades, creative. */
const ACTION_VERBS = new Set(
  (
    "led managed built created designed developed launched delivered drove owned " +
    "improved increased reduced grew scaled optimized automated streamlined implemented " +
    "shipped architected engineered spearheaded established founded initiated coordinated " +
    "directed oversaw mentored trained analyzed researched negotiated closed generated " +
    "boosted accelerated cut saved won achieved exceeded transformed migrated refactored " +
    "deployed resolved diagnosed " +
    // broader professional verbs
    "administered assessed audited authored budgeted coached collaborated consolidated " +
    "consulted converted cultivated decreased defined doubled tripled earned educated " +
    "enhanced evaluated executed expanded facilitated forecasted guided headed hired " +
    "identified influenced instructed integrated introduced investigated maintained " +
    "maximized minimized modernized monitored operated orchestrated organized partnered " +
    "performed pioneered planned presented prioritized produced programmed promoted " +
    "published recruited redesigned reengineered restructured revamped secured sold " +
    "simplified sourced standardized supervised taught tested treated tripled unified " +
    "upgraded validated wrote prospected acquired onboarded curated illustrated " +
    "photographed edited filmed composed installed repaired inspected fabricated " +
    "welded assembled calibrated troubleshot counseled advocated drafted litigated " +
    "prepared reconciled modeled measured reported conducted served handled processed " +
    "championed captured compiled completed contributed created cut delivered"
  ).split(/\s+/)
);

/** Duty-focused openers that hide impact. */
const WEAK_PHRASES = [
  "responsible for",
  "duties included",
  "helped",
  "helped with",
  "worked on",
  "assisted with",
  "assisted in",
  "participated in",
  "involved in",
  "tasked with",
  "in charge of",
  "was part of",
];

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
  "go-getter", "self-starter", "results-driven", "results driven", "synergy", "think outside the box",
  "responsible for", "duties included", "dynamic professional", "proven track record",
  "excellent communication skills", "passionate about", "fast learner", "works well under pressure",
];

const BULLET_RE = /^([•\-*▪◦‣·●○■□➢➤►–])\s+/;

export function computeSignals(input: string, now: Date = new Date()): Signals {
  // Bound the input so every regex below runs on a fixed, small ceiling of text.
  const text = input.length > MAX_TEXT_CHARS ? input.slice(0, MAX_TEXT_CHARS) : input;
  const lines = text.split("\n").map((l) => l.trim().slice(0, MAX_LINE_CHARS));
  const nonEmptyLines = lines.filter((l) => l.length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Bounded quantifiers keep this linear: an unbounded `+` before `@` backtracks
  // O(n^2) on a long token with no `@` (a one-line paste DoS). Real local parts
  // are <=64 chars and domains <=255, so bounding costs no real matches.
  const hasEmail = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,255}\.[a-z]{2,24}/i.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{7,20}\d)/.test(text);
  const hasLinkedIn = /linkedin\.com\//i.test(text);
  const hasGitHub = /github\.com\//i.test(text);
  // Linear URL scan (no variable-width lookahead — avoids O(n^2) / ReDoS).
  const urls = text.match(/\b(?:https?:\/\/|www\.)\S{1,200}/gi) || [];
  const hasWebsite =
    urls.some((u) => !/(?:linkedin|github)\.com/i.test(u)) ||
    /\b(behance\.net|dribbble\.com|portfolio\.|\.dev\b|\.design\b|\.io\/)/i.test(text);

  const bulletLines = nonEmptyLines.filter((l) => BULLET_RE.test(l));
  const bulletCount = bulletLines.length;
  const hasNumber = (s: string) => /(\d[\d,.]*\s*%|[$€£₹]\s*\d|\b\d[\d,.]*\b)/.test(s);
  const quantifiedLines = nonEmptyLines.filter(hasNumber);

  const impactBase = bulletCount > 0 ? bulletLines : nonEmptyLines;
  const quantifiedInBase = impactBase.filter(hasNumber).length;
  const quantificationRatio = impactBase.length ? quantifiedInBase / impactBase.length : 0;

  const firstWord = (l: string) =>
    (l.replace(BULLET_RE, "").split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
  const actionVerbLines = impactBase.filter((l) => ACTION_VERBS.has(firstWord(l))).length;
  const actionVerbRatio = impactBase.length ? actionVerbLines / impactBase.length : 0;

  const verbCounts = new Map<string, number>();
  for (const l of bulletLines) {
    const v = firstWord(l);
    if (ACTION_VERBS.has(v)) verbCounts.set(v, (verbCounts.get(v) || 0) + 1);
  }
  const repeatedVerbs = [...verbCounts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([verb, count]) => ({ verb: capitalize(verb), count }));

  const bulletWordCounts = bulletLines.map((l) => l.replace(BULLET_RE, "").split(/\s+/).filter(Boolean).length);
  const avgBulletWords = bulletWordCounts.length
    ? Math.round(bulletWordCounts.reduce((a, b) => a + b, 0) / bulletWordCounts.length)
    : 0;
  const longBullets = bulletWordCounts.filter((n) => n > 35).length;

  const sections = {} as Signals["sections"];
  (Object.keys(SECTION_PATTERNS) as (keyof Signals["sections"])[]).forEach((name) => {
    const pattern = SECTION_PATTERNS[name];
    sections[name] =
      nonEmptyLines.some((l) => l.length <= 60 && pattern.test(l)) || pattern.test(text.slice(0, 1500));
  });

  const lowerText = text.toLowerCase();
  const buzzwordsFound = BUZZWORDS.filter((b) => lowerText.includes(b));
  const weakPhrases = WEAK_PHRASES.filter((p) => new RegExp(`(^|[\\s•\\-*])${p}\\b`, "i").test(lowerText)).filter(
    // "helped with" implies "helped" — keep only the most specific form.
    (p, _, all) => !all.some((o) => o !== p && o.startsWith(p + " "))
  );
  const firstPersonCount = (text.match(/\b(i|me|my|myself)\b/gi) || []).length;
  const passiveVoiceCount = (text.match(/\b(?:was|were|been|being|is|are)\s{1,3}\w{2,20}ed\b/gi) || []).length;
  const estimatedPages = Math.max(1, Math.round(wordCount / 500));
  const longParagraphs = nonEmptyLines.filter((l) => l.split(/\s+/).length > 45).length;

  // Characters a clean text extraction wouldn't produce (replacement chars,
  // private-use glyphs, control codes) — high values mean the PDF is unparseable.
  const garbled = (text.match(/[�-\u0000-\u0008\u000E-\u001F]/g) || []).length;
  const garbledRatio = text.length ? round(garbled / text.length) : 0;

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
    weakPhrases,
    passiveVoiceCount,
    repeatedVerbs,
    avgBulletWords,
    longBullets,
    garbledRatio,
    timeline: computeTimeline(lines, now),
  };
}

/* ------------------------------ experience timeline ------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// One date: "Jan 2020", "January, 2020", "01/2020", "1.2020", or "2020".
const DATE = String.raw`(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]{0,6}\.?,?\s{0,3}(?:19|20)\d{2}|\d{1,2}\s{0,2}[/.\-]\s{0,2}(?:19|20)\d{2}|(?:19|20)\d{2})`;
const PRESENT = String.raw`(?:present|current|currently|now|today|ongoing|date)`;
const RANGE_RE = new RegExp(`(${DATE})\\s{0,3}(?:-|–|—|to|until|through|till)\\s{0,3}(${DATE}|${PRESENT})`, "gi");

const EDU_HEADING = /^(education|academic|academics|qualifications|education\s*&\s*\w+|academic background)\b/i;
const OTHER_HEADING =
  /^(experience|work experience|professional experience|employment|work history|career|projects?|skills|certifications?|volunteer|leadership|achievements|awards|publications|summary|profile)\b/i;
const EDU_LINE = /\b(university|college|school|institute|academy|bachelor|master|b\.?s\.?c?|m\.?s\.?c?|b\.?a\.?|m\.?b\.?a|ph\.?d|degree|diploma|gpa|b\.?tech|m\.?tech|coursework)\b/i;

function parseMonthIndex(raw: string, isEnd: boolean): number | null {
  const s = raw.toLowerCase().trim();
  const year = s.match(/(19|20)\d{2}/);
  if (!year) return null;
  const y = Number(year[0]);
  const named = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (named) return y * 12 + MONTHS[named[1]!]!;
  const numeric = s.match(/^(\d{1,2})\s*[/.\-]/);
  if (numeric) {
    const m = Number(numeric[1]) - 1;
    if (m >= 0 && m <= 11) return y * 12 + m;
  }
  // Year only: treat as starting in January; an end year as mid-year so a
  // "2019 – 2021" role reads as ~2.5 years rather than 2 or 3.
  return y * 12 + (isEnd ? 5 : 0);
}

function fmtMonth(idx: number): string {
  return `${MONTH_NAMES[((idx % 12) + 12) % 12]} ${Math.floor(idx / 12)}`;
}

export function computeTimeline(lines: string[], now: Date = new Date()): Timeline {
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const ranges: { start: number; end: number; current: boolean }[] = [];
  let inEducation = false;

  for (const line of lines) {
    if (!line) continue;
    const bare = line.replace(/[:\s]+$/, "");
    if (bare.length <= 40) {
      if (EDU_HEADING.test(bare)) inEducation = true;
      else if (OTHER_HEADING.test(bare)) inEducation = false;
    }
    if (inEducation || EDU_LINE.test(line)) continue;

    RANGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RANGE_RE.exec(line)) !== null) {
      const start = parseMonthIndex(m[1]!, false);
      const isCurrent = new RegExp(`^${PRESENT}$`, "i").test(m[2]!.trim());
      const end = isCurrent ? nowIdx : parseMonthIndex(m[2]!, true);
      if (start === null || end === null) continue;
      // Reject nonsense ranges (reversed, in the future, or implausibly long).
      if (end < start || start > nowIdx || end - start > 50 * 12) continue;
      ranges.push({ start, end: Math.min(end, nowIdx), current: isCurrent });
      if (ranges.length >= 40) break;
    }
  }

  if (!ranges.length) {
    return { yearsExperience: 0, roleCount: 0, avgTenureMonths: 0, gaps: [], shortStints: 0, currentlyEmployed: false };
  }

  const durations = ranges.map((r) => Math.max(1, r.end - r.start));
  const shortStints = ranges.filter((r, i) => !r.current && durations[i]! < 12).length;

  // Merge overlapping ranges for total experience and gap detection.
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  const totalMonths = merged.reduce((a, r) => a + Math.max(1, r.end - r.start), 0);

  const gaps: EmploymentGap[] = [];
  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i]!.start - merged[i - 1]!.end;
    if (gap >= 6) gaps.push({ from: fmtMonth(merged[i - 1]!.end), to: fmtMonth(merged[i]!.start), months: gap });
  }
  const currentlyEmployed = ranges.some((r) => r.current);
  const lastEnd = merged[merged.length - 1]!.end;
  if (!currentlyEmployed && nowIdx - lastEnd >= 6) {
    gaps.push({ from: fmtMonth(lastEnd), to: "Present", months: nowIdx - lastEnd });
  }

  return {
    yearsExperience: Math.round((totalMonths / 12) * 10) / 10,
    roleCount: ranges.length,
    avgTenureMonths: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    gaps: gaps.slice(0, 6),
    shortStints,
    currentlyEmployed,
  };
}

/* ----------------------------------- ATS checks ----------------------------------- */

/**
 * Deterministic ATS-style checks + score. When a JD is provided, the caller
 * folds a keyword-coverage check in via `appendKeywordCheck`.
 */
export function computeAtsChecks(signals: Signals): Ats {
  const { contact, sections, wordCount, quantificationRatio, bulletCount, timeline, firstPersonCount, garbledRatio } =
    signals;

  const checks: AtsCheck[] = [
    {
      id: "parseable",
      label: "Machine-readable text",
      pass: garbledRatio < 0.01,
      detail:
        garbledRatio < 0.01
          ? "Text extracted cleanly — parsers can read it."
          : "Some characters didn't extract cleanly. Avoid icons, unusual fonts, and text inside images.",
    },
    {
      id: "contact",
      label: "Contact information",
      pass: contact.hasEmail && contact.hasPhone,
      detail:
        contact.hasEmail && contact.hasPhone
          ? "Email and phone number detected."
          : `Missing ${[!contact.hasEmail && "email", !contact.hasPhone && "phone number"].filter(Boolean).join(" and ")} — put it in the body, not a header/footer.`,
    },
    {
      id: "sections",
      label: "Standard sections",
      pass: sections.experience && sections.education && sections.skills,
      detail:
        sections.experience && sections.education && sections.skills
          ? "Experience, Education, and Skills sections found."
          : `Add clear headings for ${[!sections.experience && "Experience", !sections.education && "Education", !sections.skills && "Skills"].filter(Boolean).join(", ")} so parsers can map them.`,
    },
    {
      id: "dates",
      label: "Dated work history",
      pass: timeline.roleCount > 0,
      detail:
        timeline.roleCount > 0
          ? `${timeline.roleCount} dated position${timeline.roleCount === 1 ? "" : "s"} found (~${timeline.yearsExperience} yrs).`
          : "No date ranges detected. Use a consistent format like “Jan 2021 – Present”.",
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
    {
      id: "voice",
      label: "Professional voice",
      pass: firstPersonCount <= 2,
      detail:
        firstPersonCount <= 2
          ? "No first-person pronouns."
          : `${firstPersonCount} uses of “I/me/my” — drop pronouns and start bullets with a verb.`,
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
