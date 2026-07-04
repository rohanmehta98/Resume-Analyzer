"use client";

import { Check, X, Copy, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScoreRing } from "@/components/score-ring";
import { scoreColorVar, scoreTextClass, verdictClasses } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalyzeResponse } from "@/lib/types";

export function ResultsDashboard({ data }: { data: AnalyzeResponse }) {
  const { analysis: a, verdict, signals, ats, hasJobDescription } = data;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className={cn("border font-semibold", verdictClasses(verdict))}>
              {verdict}
            </Badge>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{a.candidateName}</h2>
              <p className="font-medium text-primary">{a.detectedRole}</p>
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">{a.summary}</p>
          </div>
          <ScoreRing score={a.overallScore} caption="Overall" size={148} />
        </CardContent>
      </Card>

      {/* Metric row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Overall score" value={a.overallScore} />
        <MetricCard label="ATS ready" value={ats.score} />
        {hasJobDescription && <MetricCard label="Job match" value={a.matchScore} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* Main column */}
        <div className="space-y-6">
          {/* Section breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Section breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {(
                [
                  ["experience", "Experience"],
                  ["skills", "Skills"],
                  ["impact", "Impact & metrics"],
                  ["clarity", "Clarity & format"],
                  ["education", "Education"],
                ] as const
              ).map(([key, label]) => {
                const s = a.sectionScores[key];
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{label}</span>
                      <span className={cn("text-sm font-bold tabular-nums", scoreTextClass(s.score))}>{s.score}</span>
                    </div>
                    <Meter value={s.score} />
                    <p className="text-sm text-muted-foreground">{s.insight}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Strengths / weaknesses */}
          <div className="grid gap-6 sm:grid-cols-2">
            <ListCard title="Strengths" items={a.strengths} tone="success" />
            <ListCard title="What to improve" items={a.weaknesses} tone="warning" />
          </div>

          {/* Keywords */}
          {(a.keywords.matched.length > 0 || a.keywords.missing.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Keywords{hasJobDescription ? " vs. job description" : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {a.keywords.matched.length > 0 && (
                  <KeywordBlock label={`Matched (${a.keywords.matched.length})`} tone="success" items={a.keywords.matched} />
                )}
                {a.keywords.missing.length > 0 && (
                  <KeywordBlock label={`Missing (${a.keywords.missing.length})`} tone="warning" items={a.keywords.missing} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {a.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...a.recommendations]
                  .sort((x, y) => priorityRank(x.priority) - priorityRank(y.priority))
                  .map((r, i) => (
                    <div key={i} className={cn("rounded-lg border-l-4 bg-muted/40 p-4", priorityBorder(r.priority))}>
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          {r.priority}
                        </Badge>
                        <h4 className="text-sm font-semibold">{r.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.detail}</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Bullet rewrites */}
          {a.bulletRewrites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Suggested bullet rewrites</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {a.bulletRewrites.map((b, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border">
                    <div className="flex gap-3 bg-destructive/5 p-3">
                      <Badge variant="outline" className="h-fit border-destructive/30 text-destructive">Before</Badge>
                      <p className="text-sm text-muted-foreground line-through decoration-destructive/40">{b.original}</p>
                    </div>
                    <div className="flex items-start gap-3 bg-success/5 p-3">
                      <Badge variant="outline" className="h-fit border-success/30 text-success">After</Badge>
                      <p className="flex-1 text-sm">{b.improved}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 print:hidden"
                        aria-label="Copy rewrite"
                        onClick={() => copy(b.improved)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {b.why && (
                      <p className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{b.why}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Interview questions */}
          {a.interviewQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Likely interview questions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2.5">
                  {a.interviewQuestions.map((q, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Red flags */}
          {a.redFlags.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Potential red flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {a.redFlags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-20">
          {/* ATS checks */}
          <Card>
            <CardHeader>
              <CardTitle>ATS checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ats.checks.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      c.pass ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    )}
                  >
                    {c.pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-tight">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Document stats */}
          <Card>
            <CardHeader>
              <CardTitle>Document stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Words" value={signals.wordCount} />
                <Stat label="Est. pages" value={signals.estimatedPages} />
                <Stat label="Bullets" value={signals.bulletCount} />
                <Stat label="Quantified" value={`${Math.round(signals.quantificationRatio * 100)}%`} />
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["Email", signals.contact.hasEmail],
                    ["Phone", signals.contact.hasPhone],
                    ["LinkedIn", signals.contact.hasLinkedIn],
                    ["GitHub", signals.contact.hasGitHub],
                  ] as const
                ).map(([label, present]) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
                      present ? "border-success/30 bg-success/10 text-success" : "border-border text-muted-foreground"
                    )}
                  >
                    {present ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {label}
                  </span>
                ))}
              </div>
              {signals.buzzwordsFound.length > 0 && (
                <p className="text-xs text-warning">
                  Cliché phrases to cut: {signals.buzzwordsFound.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className={cn("text-3xl font-bold tabular-nums", scoreTextClass(value))}>
          {value}
          <span className="text-base font-medium text-muted-foreground">/100</span>
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <Meter value={value} />
      </CardContent>
    </Card>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: scoreColorVar(value) }}
      />
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("text-base", tone === "success" ? "text-success" : "text-warning")}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone === "success" ? "bg-success" : "bg-warning")} />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None noted.</p>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordBlock({ label, items, tone }: { label: string; items: string[]; tone: "success" | "warning" }) {
  return (
    <div className="space-y-2">
      <p className={cn("text-xs font-bold uppercase tracking-wide", tone === "success" ? "text-success" : "text-warning")}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((k, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"
            )}
          >
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function priorityRank(p: "High" | "Medium" | "Low") {
  return p === "High" ? 0 : p === "Medium" ? 1 : 2;
}
function priorityBorder(p: "High" | "Medium" | "Low") {
  return p === "High" ? "border-l-destructive" : p === "Medium" ? "border-l-warning" : "border-l-success";
}

function copy(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Couldn't copy — clipboard unavailable");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Copied to clipboard"))
    .catch(() => toast.error("Couldn't copy"));
}
