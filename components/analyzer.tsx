"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, AlertCircle, Download, Sparkles, ShieldCheck, Target, MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadForm, type AnalyzeInput } from "@/components/upload-form";
import { ResultsDashboard } from "@/components/results-dashboard";
import { ChatPanel } from "@/components/chat-panel";
import type { AnalyzeResponse, ErrorResponse } from "@/lib/types";

const LOADING_STEPS = [
  "Extracting text…",
  "Scanning structure & keywords…",
  "Scoring against the role…",
  "Writing recommendations…",
];

export function Analyzer() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [configured, setConfigured] = useState(true);
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.aiConfigured)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) return;
    // step is reset to 0 in handleAnalyze (an event handler) before loading flips.
    timer.current = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1800);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loading]);

  async function handleAnalyze(input: AnalyzeInput) {
    const fd = new FormData();
    if (input.mode === "upload") {
      if (!input.file) return;
      fd.append("file", input.file);
    } else {
      fd.append("pastedText", input.pastedText);
    }
    if (input.targetRole) fd.append("targetRole", input.targetRole);
    if (input.jobDescription) fd.append("jobDescription", input.jobDescription);

    setStep(0);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const payload = (await res.json().catch(() => ({}))) as AnalyzeResponse | ErrorResponse;
      if (!res.ok || !("ok" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Analysis failed. Please try again.");
      }
      setData(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="w-full">
      {!configured && (
        <div className="mx-auto mb-6 flex max-w-2xl items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">Setup needed:</span> the AI service isn&apos;t configured. Add a free{" "}
            <code className="rounded bg-warning/20 px-1 py-0.5 font-mono text-xs">GROQ_API_KEY</code> to your{" "}
            <code className="rounded bg-warning/20 px-1 py-0.5 font-mono text-xs">.env.local</code> file and restart.
          </p>
        </div>
      )}

      {!data ? (
        <div className="relative">
          {/* decorative glow */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-28 -z-10 flex justify-center overflow-hidden">
            <div className="h-72 w-[46rem] max-w-[92vw] rounded-full bg-primary/20 blur-[100px] dark:bg-primary/25" />
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center duration-700 animate-in fade-in-0 slide-in-from-bottom-3">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI-powered resume analysis
                <span aria-hidden className="text-border">·</span>
                Free &amp; private
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                Let&apos;s analyze the next candidate.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                Upload a resume for an instant, recruiter-grade breakdown — ATS score, keyword match, section grades, and
                the exact rewrites that get interviews.
              </p>
            </div>

            <div className="duration-700 animate-in fade-in-0 slide-in-from-bottom-4 [animation-delay:120ms] [animation-fill-mode:both]">
              <UploadForm loading={loading} onAnalyze={handleAnalyze} />
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 duration-700 animate-in fade-in-0 [animation-delay:260ms] [animation-fill-mode:both] sm:grid-cols-4">
              {[
                { icon: ShieldCheck, label: "ATS score" },
                { icon: Target, label: "Keyword match" },
                { icon: Sparkles, label: "Bullet rewrites" },
                { icon: MessagesSquare, label: "AI chat coach" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-card/50 p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <f.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              No sign-up · Processed in memory · Nothing is stored
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 duration-500 animate-in fade-in-0">
          <div className="flex items-center justify-between print:hidden">
            <p className="text-sm text-muted-foreground">
              Analysis of <span className="font-medium text-foreground">{data.meta.fileName}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> New analysis
              </Button>
            </div>
          </div>
          <ResultsDashboard data={data} />
          <ChatPanel key={data.meta.analyzedAt} resumeText={data.resumeText} weaknesses={data.analysis.weaknesses} />
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-xl">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-semibold">Analyzing your resume</p>
              <p className="mt-1 text-sm text-muted-foreground">{LOADING_STEPS[step]}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
