"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, IdCard, ListChecks, Loader2, Mail, RefreshCw, Square, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown, stripMarkdown } from "@/components/markdown";
import { CopyButton, EmptyState, Panel } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import type { GenerateKind, GenerateTone } from "@/lib/prompt";
import type { AnalyzeResponse } from "@/lib/types";

const TOOLS: { kind: GenerateKind; label: string; description: string; icon: typeof FileText }[] = [
  { kind: "cover-letter", label: "Cover letter", description: "Tailored to the role, under 320 words", icon: FileText },
  { kind: "tailored-bullets", label: "Tailored bullets", description: "Recent roles rewritten for this job", icon: ListChecks },
  { kind: "linkedin", label: "LinkedIn profile", description: "Headline and About section", icon: IdCard },
  { kind: "outreach", label: "Recruiter message", description: "Short note to a hiring manager", icon: Mail },
];

const TONES: GenerateTone[] = ["professional", "confident", "warm", "concise"];

export function ToolsTab({ data }: { data: AnalyzeResponse }) {
  const [kind, setKind] = useState<GenerateKind>("cover-letter");
  const [tone, setTone] = useState<GenerateTone>("professional");
  const [company, setCompany] = useState("");
  const [outputs, setOutputs] = useState<Partial<Record<GenerateKind, string>>>({});
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const output = outputs[kind] ?? "";
  const tool = TOOLS.find((t) => t.kind === kind)!;

  async function generate() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setOutputs((o) => ({ ...o, [kind]: "" }));
    const target = kind;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          kind: target,
          tone,
          company,
          resumeText: data.resumeText,
          targetRole: data.input.targetRole || data.analysis.detectedRole,
          jobDescription: data.input.jobDescription,
        }),
      });
      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Generation failed. Please try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutputs((o) => ({ ...o, [target]: text }));
      }
      if (!text.trim()) throw new Error("The model returned an empty response. Please try again.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  function download() {
    const blob = new Blob([stripMarkdown(output)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tool.label.toLowerCase().replace(/\s+/g, "-")}-${data.analysis.candidateName.toLowerCase().replace(/\W+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start print:hidden">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1" role="radiogroup" aria-label="Document type">
          {TOOLS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="radio"
              aria-checked={kind === t.kind}
              onClick={() => setKind(t.kind)}
              disabled={busy}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                kind === t.kind ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <t.icon className={cn("mt-0.5 h-4 w-4 shrink-0", kind === t.kind ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.description}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="tool-company">Company</Label>
            <Input
              id="tool-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Optional"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tone</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  aria-pressed={tone === t}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                    tone === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {!data.hasJobDescription && (
            <p className="text-xs text-muted-foreground">
              Tip: add a job description in the Job match tab for more tailored output.
            </p>
          )}
        </div>
      </div>

      <Panel
        title={tool.label}
        description={`Grounded in your resume${data.hasJobDescription ? " and the job description" : ""}. Review before sending.`}
        action={
          output && !busy ? (
            <div className="flex items-center gap-1">
              <CopyButton text={stripMarkdown(output)} />
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" onClick={download}>
                <Download className="h-3.5 w-3.5" /> .txt
              </Button>
            </div>
          ) : null
        }
      >
        {output ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <Markdown text={output} />
            {busy && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" aria-hidden />}
          </div>
        ) : (
          <EmptyState icon={<WandSparkles className="h-6 w-6" />} title={busy ? "Writing…" : `Generate a ${tool.label.toLowerCase()}`}>
            {busy ? "This usually takes a few seconds." : tool.description + "."}
          </EmptyState>
        )}
        <div className="mt-4 flex gap-2">
          {busy ? (
            <Button variant="outline" onClick={stop}>
              <Square className="mr-2 h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button onClick={generate}>
              {output ? <RefreshCw className="mr-2 h-4 w-4" /> : <WandSparkles className="mr-2 h-4 w-4" />}
              {output ? "Regenerate" : "Generate"}
            </Button>
          )}
          {busy && !output && <Loader2 className="h-5 w-5 animate-spin self-center text-muted-foreground" />}
        </div>
      </Panel>
    </div>
  );
}
