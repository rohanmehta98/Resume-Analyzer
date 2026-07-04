import type { Analysis, Verdict } from "./schema";
import type { Signals, Ats } from "./signals";
import type { ExtractSource } from "./extract";

/** Shape returned by POST /api/analyze on success. Shared by route + client. */
export interface AnalyzeResponse {
  ok: true;
  analysis: Analysis;
  verdict: Verdict;
  signals: Signals;
  ats: Ats;
  hasJobDescription: boolean;
  resumeText: string;
  meta: {
    model: string;
    fileName: string;
    source: ExtractSource;
    analyzedAt: string;
  };
}

export interface ErrorResponse {
  error: string;
}
