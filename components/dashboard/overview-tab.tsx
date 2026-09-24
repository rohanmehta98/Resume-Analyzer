"use client";

import { useState } from "react";
import { AlertTriangle, Check, CircleCheck, CircleDashed, X } from "lucide-react";

import { Meter, Panel, Pill } from "@/components/dashboard/shared";
import { loadPlan, savePlan } from "@/lib/history";
import { scoreTextClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalyzeResponse } from "@/lib/types";
import type { SectionKey } from "@/lib/schema";

const SECTION_LABELS: Record<SectionKey, string> = {
  experience: "Experience",
  impact: "Impact & metrics",
  skills: "Skills & tools",
  relevance: "Role relevance",
  clarity: "Clarity & format",
  education: "Education & credentials",
};

export function OverviewTab({ data }: { data: AnalyzeResponse }) {
  const { analysis: a } = data;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 space-y-6">
        <ActionPlan data={data} />
        <SectionBreakdown data={data} />
        <div className="grid gap-6 sm:grid-cols-2">
          <BulletList title="Strengths" items={a.strengths} tone="success" />
          <BulletList title="Gaps to address" items={a.weaknesses} tone="warning" />
        </div>
        {a.redFlags.length > 0 && (
          <Panel
            title={
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Recruiter concerns
              </span>
            }
            description="What a screener may question — address these proactively."
            className="ring-destructive/30"
          >
            <ul className="space-y-2">
              {a.redFlags.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  {f}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <div className="space-y-6 lg:sticky lg:top-20">
        <AtsChecks data={data} />
        <Timeline data={data} />
        <FieldFocus data={data} />
      </div>
    </div>
  );
}

/* ---------------------------------- action plan ---------------------------------- */

function ActionPlan({ data }: { data: AnalyzeResponse }) {
  const recs = data.analysis.recommendations;
  const id = data.meta.analyzedAt;
  // The dashboard only renders client-side (after an analysis is fetched or
  // opened from history) and is keyed per analysis, so reading storage in the
  // initializer is safe — there is no server render to mismatch.
  const [done, setDone] = useState<string[]>(() => loadPlan(id));

  function toggle(recId: string) {
    setDone((prev) => {
      const next = prev.includes(recId) ? prev.filter((x) => x !== recId) : [...prev, recId];
      savePlan(id, next);
      return next;
    });
  }

  const completed = recs.filter((r) => done.includes(r.id)).length;
  const pct = recs.length ? Math.round((completed / recs.length) * 100) : 0;

  return (
    <Panel
      title="Action plan"
      description="Ranked by impact on your chances. Check items off as you fix them."
      action={
        recs.length > 0 && (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {completed}/{recs.length} done
          </span>
        )
      }
    >
      {recs.length > 0 && <Meter value={pct} className="mb-4 h-1.5" color="var(--primary)" />}
      <ol className="space-y-2">
        {recs.map((r, i) => {
          const isDone = done.includes(r.id);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => toggle(r.id)}
                aria-pressed={isDone}
                className={cn(
                  "group flex w-full gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isDone && "bg-muted/40"
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CircleCheck className="h-5 w-5 text-success" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm font-semibold", isDone && "text-muted-foreground line-through")}>
                      {i + 1}. {r.title}
                    </span>
                    <Pill tone={r.priority === "High" ? "danger" : r.priority === "Medium" ? "warning" : "neutral"} className="px-2 py-0 text-[10px] uppercase tracking-wide">
                      {r.priority}
                    </Pill>
                    <span className="text-[11px] text-muted-foreground">{r.category}</span>
                  </span>
                  <span className={cn("block text-sm text-muted-foreground", isDone && "opacity-60")}>{r.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ------------------------------- section breakdown ------------------------------- */

function SectionBreakdown({ data }: { data: AnalyzeResponse }) {
  const { analysis: a, career } = data;
  const keys = (Object.keys(SECTION_LABELS) as SectionKey[]).sort((x, y) => career.weights[y] - career.weights[x]);
  return (
    <Panel
      title="Section scores"
      description={`Weighted for ${career.label} at ${career.seniority.toLowerCase()} level — higher-weight sections count more.`}
    >
      <div className="space-y-5">
        {keys.map((key) => {
          const s = a.sectionScores[key];
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {SECTION_LABELS[key]}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    weight {Math.round(career.weights[key] * 100)}%
                  </span>
                </span>
                <span className={cn("text-sm font-bold tabular-nums", scoreTextClass(s.score))}>{s.score}</span>
              </div>
              <Meter value={s.score} />
              {s.insight && <p className="text-sm text-muted-foreground">{s.insight}</p>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function BulletList({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  return (
    <Panel title={title}>
      {items.length ? (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  tone === "success" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-strong"
                )}
              >
                {tone === "success" ? <Check className="h-2.5 w-2.5" /> : <span className="text-[10px] font-bold">!</span>}
              </span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">None noted.</p>
      )}
    </Panel>
  );
}

/* ------------------------------------ sidebar ------------------------------------ */

function AtsChecks({ data }: { data: AnalyzeResponse }) {
  const { ats } = data;
  return (
    <Panel
      title="ATS checks"
      description="How applicant tracking systems will parse this file."
      action={<span className={cn("text-sm font-bold tabular-nums", scoreTextClass(ats.score))}>{ats.score}%</span>}
      contentClassName="space-y-3"
    >
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
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium leading-tight">{c.label}</p>
            <p className="text-xs text-muted-foreground">{c.detail}</p>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function Timeline({ data }: { data: AnalyzeResponse }) {
  const t = data.signals.timeline;
  const s = data.signals;
  return (
    <Panel title="Career & document stats">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Experience" value={t.yearsExperience ? `${t.yearsExperience} yrs` : "—"} />
        <Stat label="Dated roles" value={t.roleCount || "—"} />
        <Stat label="Avg. tenure" value={t.avgTenureMonths ? formatMonths(t.avgTenureMonths) : "—"} />
        <Stat label="Words · pages" value={`${s.wordCount} · ${s.estimatedPages}`} />
      </div>
      {t.gaps.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Employment gaps (6+ months)</p>
          {t.gaps.map((g, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-warning/10 px-2.5 py-1.5 text-xs">
              <span>
                {g.from} – {g.to}
              </span>
              <span className="font-medium text-warning-strong">{formatMonths(g.months)}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">A one-line note (study, caregiving, freelance) removes the question.</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(
          [
            ["Email", s.contact.hasEmail],
            ["Phone", s.contact.hasPhone],
            ["LinkedIn", s.contact.hasLinkedIn],
            ["GitHub", s.contact.hasGitHub],
            ["Portfolio", s.contact.hasWebsite],
          ] as const
        ).map(([label, present]) => (
          <Pill key={label} tone={present ? "success" : "neutral"}>
            {present ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {label}
          </Pill>
        ))}
      </div>
    </Panel>
  );
}

function FieldFocus({ data }: { data: AnalyzeResponse }) {
  const { career, signals } = data;
  return (
    <Panel title={`What ${career.label} recruiters check first`}>
      <ul className="space-y-2">
        {career.priorities.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs text-primary">{i + 1}</span>
            {p}
          </li>
        ))}
      </ul>
      {career.expectsPortfolio && !signals.contact.hasWebsite && (
        <p className="mt-3 rounded-md bg-warning/10 px-2.5 py-2 text-xs text-warning-strong">
          No portfolio or project link found — expected for this field.
        </p>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatMonths(m: number): string {
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r ? `${y}y ${r}m` : `${y} yr${y > 1 ? "s" : ""}`;
}
