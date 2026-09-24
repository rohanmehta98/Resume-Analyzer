"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AlertCircle, FileCheck2, ListChecks, MessagesSquare, PenLine, Target } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm, type AnalyzeInput } from "@/components/upload-form";
import { AnalysisProgress } from "@/components/analysis-progress";
import { RecentAnalyses } from "@/components/recent-analyses";
import { Dashboard, type RerunInput } from "@/components/dashboard/dashboard";
import { getHistorySnapshot, parseHistory, saveToHistory, subscribeHistory, type HistoryEntry } from "@/lib/history";
import type { AnalyzeResponse, ErrorResponse } from "@/lib/types";

const FEATURES = [
  { icon: FileCheck2, title: "Calibrated score", body: "Weighted for the candidate's field and seniority, with ATS checks." },
  { icon: Target, title: "Job match", body: "Requirement-by-requirement fit and verified keyword coverage." },
  { icon: ListChecks, title: "Action plan", body: "Prioritized fixes you can check off as you go." },
  { icon: PenLine, title: "Rewrites", body: "Stronger bullets, summary, cover letter, and LinkedIn copy." },
  { icon: MessagesSquare, title: "Interview prep", body: "Likely questions with answer guidance and a practice coach." },
];

export function Analyzer() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [tab, setTab] = useState("overview");

  const historyRaw = useSyncExternalStore(subscribeHistory, getHistorySnapshot, () => "");
  const history = useMemo(() => parseHistory(historyRaw), [historyRaw]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.aiConfigured)))
      .catch(() => {});
  }, []);

  async function request(fd: FormData): Promise<AnalyzeResponse> {
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    const payload = (await res.json().catch(() => ({}))) as AnalyzeResponse | ErrorResponse;
    if (!res.ok || !("ok" in payload)) {
      throw new Error(("error" in payload && payload.error) || "Analysis failed. Please try again.");
    }
    return payload;
  }

  async function handleAnalyze(input: AnalyzeInput) {
    const fd = new FormData();
    if (input.mode === "upload") {
      if (!input.file) return;
      fd.append("file", input.file);
    } else {
      fd.append("pastedText", input.pastedText);
    }
    if (input.targetRole.trim()) fd.append("targetRole", input.targetRole.trim());
    if (input.jobDescription.trim()) fd.append("jobDescription", input.jobDescription.trim());
    if (input.careerField && input.careerField !== "auto") fd.append("careerField", input.careerField);

    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const result = await request(fd);
      saveToHistory(result);
      setTab("overview");
      setData(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /** Re-analyze the same resume text (e.g. with a job description added). */
  async function handleRerun(input: RerunInput) {
    if (!data || rerunning) return;
    const fd = new FormData();
    fd.append("pastedText", data.resumeText);
    fd.append("sourceName", data.meta.fileName);
    if (input.targetRole) fd.append("targetRole", input.targetRole);
    if (input.jobDescription) fd.append("jobDescription", input.jobDescription);
    // Keep a field the user explicitly chose; otherwise let detection re-run
    // (a new job description may point to a different field).
    if (data.career.confidence === 1) fd.append("careerField", data.career.field);

    setRerunning(true);
    const toastId = toast.loading(input.jobDescription ? "Matching against the job description…" : "Re-running analysis…");
    try {
      const result = await request(fd);
      saveToHistory(result);
      setData(result);
      toast.success("Analysis updated", { id: toastId });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed. Please try again.", { id: toastId });
    } finally {
      setRerunning(false);
    }
  }

  function openFromHistory(entry: HistoryEntry) {
    setTab("overview");
    setData(entry.data);
    window.scrollTo({ top: 0 });
  }

  function reset() {
    setData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="w-full">
      {!configured && (
        <div className="mx-auto mb-6 flex max-w-3xl items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
          <p>
            <span className="font-semibold">Setup needed:</span> the AI service isn&apos;t configured. Add a{" "}
            <code className="rounded bg-warning/20 px-1 py-0.5 font-mono text-xs">GROQ_API_KEY</code> to{" "}
            <code className="rounded bg-warning/20 px-1 py-0.5 font-mono text-xs">.env.local</code> and restart the server.
          </p>
        </div>
      )}

      {data ? (
        <Dashboard
          key={data.meta.analyzedAt}
          data={data}
          history={history}
          onNew={reset}
          onRerun={handleRerun}
          rerunning={rerunning}
          tab={tab}
          onTabChange={setTab}
        />
      ) : (
        <>
          {loading && <AnalysisProgress />}
          {/* Kept mounted while loading so a failed request doesn't lose the user's input. */}
          <div className={loading ? "hidden" : "duration-500 animate-in fade-in-0"}>
            <div className="mb-8 max-w-2xl">
              <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Resume analysis for any career</h1>
              <p className="mt-3 text-pretty text-base text-muted-foreground">
                Scores, job match, rewrites, and interview prep — judged by the standards of the candidate&apos;s own field
                and level, from nursing to engineering to sales.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <UploadForm loading={loading} onAnalyze={handleAnalyze} />
              <div className="space-y-6">
                {history.length > 0 && <RecentAnalyses entries={history} onOpen={openFromHistory} />}
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-base">What&apos;s included</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3.5">
                      {FEATURES.map((f) => (
                        <li key={f.title} className="flex gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <f.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{f.title}</span>
                            <span className="block text-xs text-muted-foreground">{f.body}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
