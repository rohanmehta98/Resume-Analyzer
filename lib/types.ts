import type { Analysis, Verdict } from "./schema";
import type { Signals, Ats } from "./signals";
import type { ExtractSource } from "./extract";
import type { CareerFieldId, Seniority, SectionWeights } from "./careers";

export interface CareerContext {
  field: CareerFieldId;
  label: string;
  seniority: Seniority;
  /** 0-1; how clearly the field was detected (0 when the user chose it). */
  confidence: number;
  weights: SectionWeights;
  priorities: string[];
  expectsPortfolio: boolean;
}

/** Shape returned by POST /api/analyze on success. Shared by route + client. */
export interface AnalyzeResponse {
  ok: true;
  analysis: Analysis;
  verdict: Verdict;
  signals: Signals;
  ats: Ats;
  career: CareerContext;
  hasJobDescription: boolean;
  /** The inputs used, so writing tools and re-analysis can reuse them. */
  input: { targetRole: string; jobDescription: string };
  resumeText: string;
  /** True when the content pass (rewrites, interview prep) failed and was skipped. */
  partial: boolean;
  meta: {
    model: string;
    fileName: string;
    source: ExtractSource;
    analyzedAt: string;
    durationMs: number;
  };
}

export interface ErrorResponse {
  error: string;
}
