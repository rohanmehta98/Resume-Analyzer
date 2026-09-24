"use client";

import { ArrowDownRight, ArrowUpRight, Briefcase, GraduationCap, Info, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScoreRing } from "@/components/score-ring";
import { Meter, Pill } from "@/components/dashboard/shared";
import { scoreColorVar, scoreTextClass, verdictClasses } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalyzeResponse } from "@/lib/types";
import type { HistoryEntry } from "@/lib/history";

export function ScoreSummary({ data, previous }: { data: AnalyzeResponse; previous: HistoryEntry | null }) {
  const { analysis: a, verdict, ats, career, hasJobDescription, signals } = data;
  const delta = previous ? a.overallScore - previous.score : null;
  const years = signals.timeline.yearsExperience;
  const gain = a.potentialScore - a.overallScore;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col-reverse gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", verdictClasses(verdict))}>
                {verdict}
              </span>
              <Pill tone="primary">
                <Briefcase className="h-3 w-3" /> {career.label}
              </Pill>
              <Pill>
                <GraduationCap className="h-3 w-3" /> {career.seniority}
                {years > 0 && ` · ${years} yrs`}
              </Pill>
            </div>
            <div>
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{a.candidateName}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {a.currentTitle && a.currentTitle.toLowerCase() !== a.detectedRole.toLowerCase() ? (
                  <>
                    {a.currentTitle} <span aria-hidden>→</span>{" "}
                  </>
                ) : null}
                <span className="font-medium text-foreground">{a.detectedRole}</span>
              </p>
            </div>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{a.summary}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {gain > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 font-medium text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Can reach {a.potentialScore} (+{gain}) with the action plan
                </span>
              )}
              {delta !== null && delta !== 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium",
                    delta > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  )}
                >
                  {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {delta > 0 ? "+" : ""}
                  {delta} since last analysis
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 self-center">
            <ScoreRing score={a.overallScore} caption="Overall" size={152} />
            <ScoreMethod data={data} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="ATS readiness"
          value={ats.score}
          hint={`${ats.checks.filter((c) => c.pass).length} of ${ats.checks.length} checks passed`}
        />
        <Kpi
          label={hasJobDescription ? "Job match" : "Role fit"}
          value={a.matchScore}
          hint={
            hasJobDescription
              ? `${a.requirements.filter((r) => r.status === "Met").length} of ${a.requirements.length} requirements met`
              : `Against typical ${a.detectedRole} expectations`
          }
        />
        <Kpi
          label="Keyword coverage"
          value={Math.round(a.keywords.coverage * 100)}
          suffix="%"
          hint={`${a.keywords.matched.length} of ${a.keywords.matched.length + a.keywords.missing.length} key terms found`}
        />
        <Kpi
          label="Quantified impact"
          value={Math.round(signals.quantificationRatio * 100)}
          suffix="%"
          hint="Achievements with a number"
          tone={signals.quantificationRatio >= 0.5 ? 85 : signals.quantificationRatio >= 0.25 ? 68 : 45}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  suffix = "",
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  suffix?: string;
  /** Score used for color when `value` isn't itself a 0-100 quality score. */
  tone?: number;
}) {
  const colorScore = tone ?? value;
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums", scoreTextClass(colorScore))}>
          {value}
          <span className="text-sm font-medium text-muted-foreground">{suffix || "/100"}</span>
        </p>
        <Meter value={value} className="h-1.5" color={scoreColorVar(colorScore)} />
        <p className="truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

/** Explains how the overall score is computed — transparency builds trust. */
function ScoreMethod({ data }: { data: AnalyzeResponse }) {
  const w = data.career.weights;
  const rows: [string, number][] = [
    ["Experience", w.experience],
    ["Impact", w.impact],
    ["Skills", w.skills],
    ["Relevance", w.relevance],
    ["Clarity", w.clarity],
    ["Education", w.education],
  ];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
          />
        }
      >
        <Info className="h-3 w-3" /> How it&apos;s scored
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="mb-1.5 font-medium">
          50% expert judgment + 50% section scores weighted for {data.career.label} ({data.career.seniority}):
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {rows.map(([k, v]) => (
            <span key={k} className="flex justify-between gap-2">
              <span>{k}</span>
              <span className="tabular-nums">{Math.round(v * 100)}%</span>
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
