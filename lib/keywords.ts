/**
 * Deterministic keyword verification. The AI proposes which role/JD keywords are
 * matched vs. missing; this module checks each claim against the actual resume
 * text, so a hallucinated "match" is moved to missing (and a keyword the model
 * wrongly called missing is moved to matched). What the user sees is verified.
 */

/** Normalize a term for comparison: lowercase, unify separators and punctuation. */
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common equivalent spellings so "Node.js" matches "NodeJS", "CI/CD" matches "CICD", etc.
const ALIASES: Record<string, string[]> = {
  "node.js": ["nodejs", "node js", "node"],
  "react.js": ["react", "reactjs"],
  "vue.js": ["vue", "vuejs"],
  "next.js": ["nextjs"],
  javascript: ["js", "ecmascript"],
  typescript: ["ts"],
  "ci cd": ["cicd", "ci/cd", "continuous integration", "continuous delivery", "continuous deployment"],
  kubernetes: ["k8s"],
  postgresql: ["postgres", "psql"],
  "amazon web services": ["aws"],
  aws: ["amazon web services"],
  "google cloud": ["gcp", "google cloud platform"],
  gcp: ["google cloud", "google cloud platform"],
  "machine learning": ["ml"],
  "artificial intelligence": ["ai"],
  "user experience": ["ux"],
  "user interface": ["ui"],
  "search engine optimization": ["seo"],
  "customer relationship management": ["crm"],
  "key performance indicators": ["kpis", "kpi"],
  "project management": ["project manager", "managed projects"],
  "a b testing": ["ab testing", "a/b testing", "split testing", "experimentation"],
  excel: ["microsoft excel", "ms excel", "spreadsheets"],
  "power bi": ["powerbi"],
  "registered nurse": ["rn"],
  "basic life support": ["bls"],
  "advanced cardiovascular life support": ["acls"],
  "electronic health records": ["ehr", "emr", "electronic medical records"],
  "certified public accountant": ["cpa"],
  "profit and loss": ["p&l", "p and l"],
  "stakeholder management": ["stakeholders", "stakeholder"],
  "cross functional": ["cross-functional", "crossfunctional"],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build the list of surface forms we accept for a keyword. */
function variants(term: string): string[] {
  const t = normalizeTerm(term);
  const out = new Set<string>([t]);
  out.add(t.replace(/-/g, " "));
  out.add(t.replace(/[-\s]/g, ""));
  out.add(t.replace(/\.js$/, "js"));
  out.add(t.replace(/\.js$/, ""));
  // Simple plural/singular.
  if (t.endsWith("s") && t.length > 4) out.add(t.slice(0, -1));
  else out.add(t + "s");
  for (const [k, vs] of Object.entries(ALIASES)) {
    if (k === t || vs.includes(t)) {
      out.add(k);
      vs.forEach((v) => out.add(v));
    }
  }
  return [...out].filter((v) => v.length >= 1);
}

/**
 * Is `term` present in `haystack` (already passed through `normalizeTerm`)?
 * Uses word boundaries so "java" doesn't match "javascript" and "go" doesn't
 * match "google". Very short terms (≤2 chars, e.g. "R", "C#") require exact
 * token boundaries.
 */
export function containsTerm(normalizedHaystack: string, term: string): boolean {
  for (const v of variants(term)) {
    if (!v) continue;
    const re = new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(v)}($|[^a-z0-9+#])`, "i");
    if (re.test(normalizedHaystack)) return true;
  }
  return false;
}

/**
 * Verify the AI's matched/missing claims against the resume text.
 * Deduplicates, drops empty/overlong entries, and re-files each keyword by
 * whether it actually appears.
 */
export function verifyKeywords(
  resumeText: string,
  claimed: { matched: string[]; missing: string[] }
): { matched: string[]; missing: string[]; coverage: number } {
  const hay = normalizeTerm(resumeText.slice(0, 60_000));
  const seen = new Set<string>();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const raw of [...claimed.matched, ...claimed.missing]) {
    const term = String(raw || "").trim();
    if (!term || term.length > 60) continue;
    const key = normalizeTerm(term);
    if (seen.has(key)) continue;
    seen.add(key);
    (containsTerm(hay, term) ? matched : missing).push(term);
  }

  const total = matched.length + missing.length;
  return { matched, missing, coverage: total ? Math.round((matched.length / total) * 100) / 100 : 0 };
}

/**
 * Does `quote` appear (approximately) in the resume? Used to drop bullet
 * rewrites whose "original" was invented rather than copied. Compares on
 * normalized alphanumerics and accepts a strong token overlap for minor
 * extraction differences (hyphenation, punctuation, line breaks).
 */
export function quoteAppearsIn(resumeText: string, quote: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").trim();
  const q = norm(quote);
  if (q.length < 12) return false;
  const hay = norm(resumeText);
  if (hay.includes(q)) return true;
  // Fall back to token overlap against the hay's vocabulary.
  const qTokens = q.split(" ").filter((t) => t.length > 2);
  if (qTokens.length < 3) return false;
  const hayTokens = new Set(hay.split(" "));
  const hit = qTokens.filter((t) => hayTokens.has(t)).length;
  return hit / qTokens.length >= 0.8;
}
