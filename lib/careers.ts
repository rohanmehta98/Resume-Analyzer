/**
 * Career intelligence: deterministic detection of the candidate's career field
 * and seniority, plus the field-specific rubric fed to the AI. Different careers
 * are judged on different things (a nurse on licensure and patient load, a
 * designer on portfolio, a seller on quota attainment), so a single generic
 * rubric produces generic feedback. This module is plain code — reproducible and
 * testable — and the AI layer builds on top of it.
 */

export type CareerFieldId =
  | "software"
  | "data"
  | "product"
  | "design"
  | "marketing"
  | "sales"
  | "finance"
  | "healthcare"
  | "education"
  | "legal"
  | "engineering"
  | "operations"
  | "hr"
  | "customer"
  | "trades"
  | "research"
  | "general";

export type Seniority = "Student / Entry" | "Early career" | "Mid-level" | "Senior" | "Lead / Manager" | "Executive";

/** Relative weight of each section in the overall score for a field. Sums to 1. */
export interface SectionWeights {
  experience: number;
  impact: number;
  skills: number;
  relevance: number;
  clarity: number;
  education: number;
}

export interface CareerProfile {
  id: CareerFieldId;
  label: string;
  /** Signals scanned in role / JD / resume text to detect the field. */
  patterns: RegExp[];
  /** What hiring managers in this field look for first. */
  priorities: string[];
  /** Metrics that make achievements credible in this field. */
  metrics: string[];
  /** Credentials that matter (licenses, certifications). */
  credentials: string[];
  /** Whether a portfolio / public work link is expected. */
  expectsPortfolio: boolean;
  weights: SectionWeights;
}

const W = (e: number, i: number, s: number, r: number, c: number, ed: number): SectionWeights => ({
  experience: e,
  impact: i,
  skills: s,
  relevance: r,
  clarity: c,
  education: ed,
});

export const CAREER_PROFILES: Record<CareerFieldId, CareerProfile> = {
  software: {
    id: "software",
    label: "Software Engineering",
    patterns: [
      /\b(software|backend|back-end|frontend|front-end|full[- ]?stack|devops|sre|site reliability|mobile|ios|android)\b/i,
      /\b(engineer|developer|programmer)\b/i,
      /\b(javascript|typescript|python|java|golang|rust|c\+\+|react|node\.?js|kubernetes|docker|aws|microservices?)\b/i,
    ],
    priorities: [
      "Scope and complexity of systems built (scale, users, traffic, data volume)",
      "Technical ownership: design decisions, architecture, reliability",
      "Measurable engineering outcomes: latency, uptime, cost, deploy frequency, bugs",
      "Modern, relevant stack shown in context (not just a skills list)",
    ],
    metrics: ["latency / performance %", "uptime / incidents", "users or requests served", "cost savings", "build/deploy time", "test coverage"],
    credentials: ["cloud certifications (AWS/GCP/Azure)", "Kubernetes (CKA/CKAD)"],
    expectsPortfolio: true,
    weights: W(0.24, 0.24, 0.18, 0.16, 0.12, 0.06),
  },
  data: {
    id: "data",
    label: "Data & Analytics",
    patterns: [
      /\b(data scientist|data analyst|data engineer|analytics|machine learning|ml engineer|ai engineer|business intelligence|bi developer|statistic)/i,
      /\b(sql|pandas|tableau|power bi|looker|spark|airflow|dbt|tensorflow|pytorch|scikit|regression|a\/b test)/i,
    ],
    priorities: [
      "Business decisions driven by the analysis or model — not just the technique",
      "Model/pipeline performance and scale (accuracy, data volume, freshness)",
      "Tooling depth: SQL, Python/R, BI, cloud data stack",
      "Communication of insights to stakeholders",
    ],
    metrics: ["revenue or cost impact of insights", "model accuracy/AUC lift", "data volume (rows, TB)", "pipeline runtime", "dashboard adoption"],
    credentials: ["cloud data certifications", "Tableau / Power BI certifications"],
    expectsPortfolio: true,
    weights: W(0.22, 0.24, 0.2, 0.16, 0.12, 0.06),
  },
  product: {
    id: "product",
    label: "Product Management",
    patterns: [/\b(product manager|product owner|product lead|head of product|roadmap|go-to-market|product strategy|pm\b)/i],
    priorities: [
      "Outcomes of shipped products (adoption, revenue, retention, NPS)",
      "Cross-functional leadership across engineering, design, and business",
      "Strategy and prioritization: discovery, roadmap, trade-offs",
      "Data-informed decisions and experimentation",
    ],
    metrics: ["revenue / ARR", "adoption & activation", "retention / churn", "conversion", "NPS / CSAT", "time-to-market"],
    credentials: ["CSPO / PSPO", "Pragmatic Institute"],
    expectsPortfolio: false,
    weights: W(0.24, 0.26, 0.12, 0.18, 0.14, 0.06),
  },
  design: {
    id: "design",
    label: "Design & Creative",
    patterns: [
      /\b(designer|ux|ui\b|user experience|user interface|graphic|visual design|product design|art director|creative director|illustrat|motion|brand design|copywriter|video editor|photograph)/i,
      /\b(figma|sketch|adobe|photoshop|illustrator|after effects|indesign|prototyp)/i,
    ],
    priorities: [
      "A portfolio link — the single most important item for creative roles",
      "Process: research, iteration, and how design decisions were validated",
      "Outcomes of the work (conversion, usability, engagement, awards)",
      "Tool fluency and collaboration with product/engineering or clients",
    ],
    metrics: ["conversion / engagement lift", "usability test results", "task completion time", "projects / clients delivered", "awards, publications"],
    credentials: ["portfolio", "NN/g UX certification"],
    expectsPortfolio: true,
    weights: W(0.22, 0.2, 0.18, 0.18, 0.16, 0.06),
  },
  marketing: {
    id: "marketing",
    label: "Marketing & Communications",
    patterns: [
      /\b(marketing|seo|sem|content strateg|social media|brand manager|growth|demand gen|public relations|\bpr\b|communications|campaign|copywrit)/i,
      /\b(google ads|hubspot|marketo|ga4|google analytics|ctr|cac|roas)\b/i,
    ],
    priorities: [
      "Campaign results tied to pipeline or revenue",
      "Channel expertise and budget ownership",
      "Growth metrics: traffic, leads, conversion, CAC, ROAS",
      "Brand and content work with measurable reach",
    ],
    metrics: ["leads / MQLs / pipeline", "ROAS / CAC", "traffic growth %", "conversion rate", "budget managed", "engagement / reach"],
    credentials: ["Google Ads / Analytics", "HubSpot", "Meta Blueprint"],
    expectsPortfolio: false,
    weights: W(0.22, 0.26, 0.14, 0.18, 0.14, 0.06),
  },
  sales: {
    id: "sales",
    label: "Sales & Business Development",
    patterns: [
      /\b(sales|account executive|business development|bdr|sdr|account manager|territory|quota|closing|pipeline|partnerships|key account)/i,
      /\b(salesforce|crm|b2b|saas sales|prospect)/i,
    ],
    priorities: [
      "Quota attainment and ranking versus peers — the first thing sales leaders check",
      "Deal size, sales cycle, and segment (SMB / mid-market / enterprise)",
      "Pipeline generation and new-logo wins",
      "Tools and methodology (CRM, MEDDIC, Challenger, SPIN)",
    ],
    metrics: ["% of quota", "revenue closed", "deal size / ACV", "pipeline generated", "win rate", "rank on team"],
    credentials: ["Salesforce certifications", "sales methodology training"],
    expectsPortfolio: false,
    weights: W(0.24, 0.3, 0.1, 0.16, 0.14, 0.06),
  },
  finance: {
    id: "finance",
    label: "Finance & Accounting",
    patterns: [
      /\b(accountant|accounting|finance|financial analyst|fp&a|audit|auditor|tax|controller|bookkeep|treasury|investment|banking|cfa|cpa|acca|equity research|underwrit)/i,
      /\b(gaap|ifrs|reconciliation|forecasting|budgeting|financial model|sap|quickbooks|netsuite)/i,
    ],
    priorities: [
      "Accuracy, compliance, and control improvements",
      "Scale of financials handled (budget size, portfolio value, entities)",
      "Process improvements: close-cycle time, automation, audit results",
      "Professional credentials (CPA, CFA, ACCA, CMA)",
    ],
    metrics: ["budget / AUM managed", "close time reduction", "cost savings", "forecast accuracy", "audit findings", "error reduction"],
    credentials: ["CPA", "CFA", "ACCA", "CMA", "FRM"],
    expectsPortfolio: false,
    weights: W(0.24, 0.22, 0.16, 0.16, 0.12, 0.1),
  },
  healthcare: {
    id: "healthcare",
    label: "Healthcare & Medical",
    patterns: [
      /\b(nurse|nursing|rn\b|lpn|physician|doctor|medical|clinical|patient|hospital|pharmac|therap|dental|paramedic|emt\b|caregiver|healthcare|radiolog|surgeon|midwife)/i,
      /\b(bls|acls|pals|ehr|emr|epic|cerner|hipaa|icu|er\b|triage)/i,
    ],
    priorities: [
      "Active licensure and certifications — often a hard screening requirement",
      "Clinical settings, specialties, and patient populations served",
      "Patient load, acuity, and outcomes (safety, satisfaction, readmission)",
      "Systems and compliance (EHR platforms, HIPAA, protocols)",
    ],
    metrics: ["patients per shift", "patient satisfaction scores", "error / readmission reduction", "unit size (beds)", "protocol compliance %"],
    credentials: ["RN / license number & state", "BLS", "ACLS", "PALS", "specialty certifications"],
    expectsPortfolio: false,
    weights: W(0.28, 0.14, 0.18, 0.16, 0.12, 0.12),
  },
  education: {
    id: "education",
    label: "Education & Training",
    patterns: [/\b(teacher|teaching|tutor|lecturer|professor|instructor|educator|curriculum|classroom|school|student outcomes|trainer|instructional design|principal)/i],
    priorities: [
      "Student outcomes (test scores, pass rates, growth) and class sizes",
      "Subjects, grade levels, and teaching methods",
      "Curriculum development and initiatives led",
      "Certification / teaching licence",
    ],
    metrics: ["student performance improvement", "pass rates", "class size", "students taught", "programs launched"],
    credentials: ["teaching license / certification", "B.Ed / M.Ed", "TEFL / CELTA"],
    expectsPortfolio: false,
    weights: W(0.26, 0.18, 0.14, 0.16, 0.12, 0.14),
  },
  legal: {
    id: "legal",
    label: "Legal",
    patterns: [/\b(attorney|lawyer|legal|paralegal|counsel|litigation|contracts?|compliance|solicitor|barrister|juris|bar admission|law clerk)/i],
    priorities: [
      "Practice areas and matter types handled",
      "Bar admissions / jurisdictions",
      "Outcomes: cases, deals, contract value, risk reduced",
      "Precise, error-free writing — the resume is itself a writing sample",
    ],
    metrics: ["matters handled", "deal / contract value", "settlements or verdicts", "turnaround time", "compliance findings"],
    credentials: ["bar admission", "JD / LLB / LLM", "paralegal certificate"],
    expectsPortfolio: false,
    weights: W(0.28, 0.18, 0.14, 0.16, 0.14, 0.1),
  },
  engineering: {
    id: "engineering",
    label: "Engineering (Mech / Civil / Electrical)",
    patterns: [
      /\b(mechanical|civil|electrical|structural|chemical|manufacturing|industrial|aerospace|automotive|process) engineer/i,
      /\b(autocad|solidworks|catia|ansys|matlab|plc|scada|six sigma|lean|pe license|eit\b|hvac|cad)\b/i,
    ],
    priorities: [
      "Projects: scope, budget, and your technical role",
      "Standards, safety, and quality outcomes",
      "Tools (CAD, simulation) and methods (Lean, Six Sigma)",
      "Licensure (PE / EIT / Chartered)",
    ],
    metrics: ["project budget", "cost / waste reduction", "yield or efficiency %", "safety incidents", "on-time delivery"],
    credentials: ["PE / EIT / Chartered Engineer", "Six Sigma", "PMP"],
    expectsPortfolio: false,
    weights: W(0.26, 0.22, 0.18, 0.14, 0.1, 0.1),
  },
  operations: {
    id: "operations",
    label: "Operations & Supply Chain",
    patterns: [/\b(operations|supply chain|logistics|procurement|warehouse|inventory|project manager|program manager|scrum master|pmp|fulfillment|sourcing|planning)/i],
    priorities: [
      "Efficiency and cost outcomes of processes owned",
      "Scale: budget, volume, sites, teams",
      "Delivery: projects on time and on budget",
      "Methods and systems (ERP, Lean, Agile, PMP)",
    ],
    metrics: ["cost savings", "cycle / lead time", "on-time delivery %", "inventory accuracy", "budget managed", "team size"],
    credentials: ["PMP", "CSCP / CPIM", "Six Sigma", "Scrum"],
    expectsPortfolio: false,
    weights: W(0.26, 0.26, 0.12, 0.16, 0.12, 0.08),
  },
  hr: {
    id: "hr",
    label: "Human Resources & Recruiting",
    patterns: [/\b(human resources|\bhr\b|recruiter|recruiting|talent acquisition|people operations|hrbp|payroll|benefits|onboarding|employee relations|l&d)/i],
    priorities: [
      "Hiring volume, time-to-fill, and quality of hire",
      "Retention, engagement, and program outcomes",
      "Employment law, compliance, and HRIS systems",
      "Partnership with leadership",
    ],
    metrics: ["hires / requisitions", "time-to-fill", "retention / attrition %", "engagement scores", "employees supported"],
    credentials: ["SHRM-CP / SCP", "PHR / SPHR", "CIPD"],
    expectsPortfolio: false,
    weights: W(0.26, 0.22, 0.14, 0.16, 0.14, 0.08),
  },
  customer: {
    id: "customer",
    label: "Customer Service & Hospitality",
    patterns: [/\b(customer service|customer support|customer success|call center|hospitality|hotel|restaurant|retail|cashier|front desk|barista|server|store manager|guest)/i],
    priorities: [
      "Customer satisfaction and resolution metrics",
      "Volume handled and service standards met",
      "Reliability, promotions, and extra responsibility",
      "Systems used (POS, CRM, ticketing)",
    ],
    metrics: ["CSAT / NPS", "tickets or customers per day", "resolution time", "sales / upsell", "retention"],
    credentials: ["food safety", "industry certifications"],
    expectsPortfolio: false,
    weights: W(0.28, 0.2, 0.14, 0.16, 0.14, 0.08),
  },
  trades: {
    id: "trades",
    label: "Skilled Trades & Technical",
    patterns: [/\b(electrician|plumber|carpenter|welder|mechanic|technician|hvac tech|machinist|construction|foreman|apprentice|journeyman|driver|cdl|forklift|maintenance)/i],
    priorities: [
      "Licences, certifications, and safety record",
      "Equipment, tools, and systems worked on",
      "Types of jobs and scale (residential / commercial / industrial)",
      "Reliability, efficiency, and quality of work",
    ],
    metrics: ["jobs completed", "safety record (days without incident)", "time / cost savings", "equipment uptime"],
    credentials: ["trade licence", "OSHA 10/30", "CDL", "EPA certification"],
    expectsPortfolio: false,
    weights: W(0.3, 0.16, 0.2, 0.14, 0.1, 0.1),
  },
  research: {
    id: "research",
    label: "Research & Academia",
    patterns: [/\b(research|researcher|phd|postdoc|scientist|laboratory|publications?|peer[- ]reviewed|grant|thesis|dissertation|principal investigator)/i],
    priorities: [
      "Publications, citations, and conference presentations",
      "Grants and funding secured",
      "Research methods and technical expertise",
      "Teaching, mentoring, and collaboration",
    ],
    metrics: ["publications / citations", "grant funding", "datasets / experiments", "students mentored"],
    credentials: ["PhD / MSc", "specialized lab techniques"],
    expectsPortfolio: false,
    weights: W(0.22, 0.2, 0.18, 0.14, 0.1, 0.16),
  },
  general: {
    id: "general",
    label: "General",
    patterns: [],
    priorities: [
      "Clear career narrative aligned with the target role",
      "Quantified achievements rather than duties",
      "Relevant skills shown in context",
      "Clean, scannable structure",
    ],
    metrics: ["money saved or earned", "time saved", "volume handled", "people led", "% improvement"],
    credentials: ["relevant certifications"],
    expectsPortfolio: false,
    weights: W(0.24, 0.22, 0.16, 0.16, 0.14, 0.08),
  },
};

export const CAREER_FIELD_OPTIONS = (Object.values(CAREER_PROFILES) as CareerProfile[])
  .filter((p) => p.id !== "general")
  .map((p) => ({ id: p.id, label: p.label }));

export function isCareerFieldId(v: string): v is CareerFieldId {
  return Object.prototype.hasOwnProperty.call(CAREER_PROFILES, v);
}

/**
 * Detect the career field from the target role, job description, and resume.
 * The role and JD describe where the candidate is going, so they are weighted
 * above the resume (which describes where they have been — e.g. career changers).
 */
export function detectCareerField(input: { resumeText: string; targetRole?: string; jobDescription?: string }): {
  field: CareerFieldId;
  confidence: number;
} {
  const role = (input.targetRole || "").slice(0, 200);
  const jd = (input.jobDescription || "").slice(0, 8000);
  // The top of a resume (headline, summary, recent title) is the strongest resume signal.
  const head = input.resumeText.slice(0, 1500);
  const body = input.resumeText.slice(0, 20000);

  const scores = new Map<CareerFieldId, number>();
  for (const p of Object.values(CAREER_PROFILES)) {
    if (!p.patterns.length) continue;
    let s = 0;
    for (const re of p.patterns) {
      if (role && re.test(role)) s += 6;
      s += Math.min(countMatches(jd, re), 6) * 1.5;
      s += Math.min(countMatches(head, re), 4) * 1.5;
      s += Math.min(countMatches(body, re), 10) * 0.5;
    }
    scores.set(p.id, s);
  }

  let best: CareerFieldId = "general";
  let bestScore = 0;
  let total = 0;
  for (const [id, s] of scores) {
    total += s;
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  // Too weak a signal to trust — fall back to the general rubric.
  if (bestScore < 3) return { field: "general", confidence: 0 };
  return { field: best, confidence: Math.round((bestScore / Math.max(total, 1)) * 100) / 100 };
}

function countMatches(text: string, re: RegExp): number {
  if (!text) return 0;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let n = 0;
  while (g.exec(text) !== null) {
    if (++n >= 50) break;
  }
  return n;
}

/**
 * Estimate seniority from total experience and the most senior title found.
 * Titles win when they clearly signal level; years fill in the rest.
 */
export function detectSeniority(input: { resumeText: string; targetRole?: string; yearsExperience: number }): Seniority {
  const head = input.resumeText.slice(0, 3000);
  // Many individual-contributor titles contain "manager" (Product Manager,
  // Account Manager…) — strip those so they don't read as people management.
  const titles = `${input.targetRole || ""}\n${head}`.replace(
    /\b(product|project|program|account|case|community|social media|content|office|property|marketing|brand|relationship|territory|category|campaign|release)\s+manager\b/gi,
    "$1 role"
  );
  const y = input.yearsExperience;

  if (/\b(chief|ceo|cto|cfo|coo|cmo|vp\b|vice president|svp|evp|managing director|general manager|partner)\b/i.test(titles) && y >= 8)
    return "Executive";
  if (/\b(director|head of|lead|manager|principal|staff|supervisor|superintendent)\b/i.test(titles) && y >= 5)
    return "Lead / Manager";
  if (/\b(senior|sr\.?|specialist ii|iii)\b/i.test(titles) && y >= 3) return "Senior";
  if (/\b(intern|internship|student|graduate|trainee|apprentice|fresher)\b/i.test(head) && y < 2) return "Student / Entry";

  if (y >= 12) return "Lead / Manager";
  if (y >= 6) return "Senior";
  if (y >= 3) return "Mid-level";
  if (y >= 1) return "Early career";
  return "Student / Entry";
}

/** Seniority shifts what matters: early careers lean on education and projects,
 *  senior ones on impact and scope. Returns adjusted weights (still sum to 1). */
export function adjustWeightsForSeniority(w: SectionWeights, s: Seniority): SectionWeights {
  const adj = { ...w };
  if (s === "Student / Entry") {
    adj.education += 0.08;
    adj.experience -= 0.06;
    adj.impact -= 0.02;
  } else if (s === "Lead / Manager" || s === "Executive") {
    adj.impact += 0.04;
    adj.experience += 0.02;
    adj.education -= Math.min(adj.education - 0.02, 0.06);
  }
  const sum = Object.values(adj).reduce((a, b) => a + b, 0);
  (Object.keys(adj) as (keyof SectionWeights)[]).forEach((k) => (adj[k] = Math.round((adj[k] / sum) * 1000) / 1000));
  return adj;
}
