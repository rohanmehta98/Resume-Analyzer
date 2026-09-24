"use client";

import { ArrowDown, PenLine, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton, EmptyState, Panel, Pill } from "@/components/dashboard/shared";
import type { AnalyzeResponse } from "@/lib/types";

export function ImproveTab({ data, onRetry }: { data: AnalyzeResponse; onRetry: () => void }) {
  const { analysis: a, partial } = data;

  if (partial && !a.bulletRewrites.length && !a.professionalSummary) {
    return (
      <div className="space-y-6">
        <EmptyState icon={<PenLine className="h-6 w-6" />} title="Rewrites weren't generated for this run">
          The scoring finished, but the writing pass timed out.
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-run analysis
            </Button>
          </div>
        </EmptyState>
        <WritingIssues data={data} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 space-y-6">
        {(a.headline || a.professionalSummary) && (
          <Panel title="Headline & summary" description="Drop-in replacements for the top of your resume — the part recruiters read first.">
            <div className="space-y-4">
              {a.headline && (
                <Block label="Headline" text={a.headline} />
              )}
              {a.professionalSummary && <Block label="Professional summary" text={a.professionalSummary} />}
            </div>
          </Panel>
        )}

        <Panel
          title="Bullet rewrites"
          description="Your weakest bullets, rewritten. Replace [placeholders] with your real numbers."
        >
          {a.bulletRewrites.length ? (
            <div className="space-y-4">
              {a.bulletRewrites.map((b, i) => (
                <div key={i} className="overflow-hidden rounded-lg border">
                  <div className="bg-muted/40 px-4 py-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
                    <p className="text-sm text-muted-foreground">{b.original}</p>
                  </div>
                  <div className="flex justify-center border-y bg-background py-0.5 text-muted-foreground">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </div>
                  <div className="px-4 py-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-success">Improved</p>
                      <CopyButton text={b.improved} />
                    </div>
                    <p className="text-sm font-medium">{highlightPlaceholders(b.improved)}</p>
                    {b.why && <p className="mt-2 text-xs text-muted-foreground">{b.why}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your bullets are already in good shape — no rewrites needed.</p>
          )}
        </Panel>
      </div>

      <div className="space-y-6 lg:sticky lg:top-20">
        <WritingIssues data={data} />
      </div>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <CopyButton text={text} />
      </div>
      <p className="text-sm leading-relaxed">{highlightPlaceholders(text)}</p>
    </div>
  );
}

/** Deterministic writing checks — exact phrases found in the resume. */
function WritingIssues({ data }: { data: AnalyzeResponse }) {
  const s = data.signals;
  const rows: { label: string; value: string; ok: boolean; hint: string }[] = [
    {
      label: "Action-verb bullets",
      value: `${Math.round(s.actionVerbRatio * 100)}%`,
      ok: s.actionVerbRatio >= 0.6,
      hint: "Start every bullet with a strong past-tense verb.",
    },
    {
      label: "Quantified bullets",
      value: `${Math.round(s.quantificationRatio * 100)}%`,
      ok: s.quantificationRatio >= 0.4,
      hint: "Aim for numbers in at least half your bullets.",
    },
    {
      label: "Avg. bullet length",
      value: s.avgBulletWords ? `${s.avgBulletWords} words` : "—",
      ok: s.avgBulletWords === 0 || (s.avgBulletWords >= 8 && s.avgBulletWords <= 28),
      hint: "12–25 words reads best in a skim.",
    },
    {
      label: "Passive voice",
      value: String(s.passiveVoiceCount),
      ok: s.passiveVoiceCount <= 2,
      hint: "“Was responsible for” → “Led”.",
    },
    {
      label: "Pronouns (I/me/my)",
      value: String(s.firstPersonCount),
      ok: s.firstPersonCount <= 2,
      hint: "Resumes are written without pronouns.",
    },
  ];

  const phrases = [...new Set([...s.weakPhrases, ...s.buzzwordsFound])];

  return (
    <Panel title="Writing quality" description="Measured directly from your text.">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </div>
            <Pill tone={r.ok ? "success" : "warning"} className="shrink-0 tabular-nums">
              {r.value}
            </Pill>
          </li>
        ))}
      </ul>
      {phrases.length > 0 && (
        <div className="mt-4 space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Weak or overused phrases to replace</p>
          <div className="flex flex-wrap gap-1.5">
            {phrases.map((p) => (
              <Pill key={p} tone="danger">
                “{p}”
              </Pill>
            ))}
          </div>
        </div>
      )}
      {s.repeatedVerbs.length > 0 && (
        <div className="mt-4 space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Repeated opening verbs — vary these</p>
          <div className="flex flex-wrap gap-1.5">
            {s.repeatedVerbs.map((v) => (
              <Pill key={v.verb}>
                {v.verb} ×{v.count}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Visually mark [placeholders] the candidate must fill in. */
function highlightPlaceholders(text: string) {
  const parts = text.split(/(\[[^\]]{1,40}\])/g);
  return parts.map((p, i) =>
    /^\[[^\]]+\]$/.test(p) ? (
      <mark key={i} className="rounded bg-warning/20 px-1 text-foreground">
        {p}
      </mark>
    ) : (
      p
    )
  );
}
