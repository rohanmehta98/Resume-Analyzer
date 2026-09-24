"use client";

import { useState } from "react";
import { CircleCheck, CircleDot, CircleX, Loader2, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton, Meter, Panel, Pill } from "@/components/dashboard/shared";
import { MAX_JD_CHARS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AnalyzeResponse } from "@/lib/types";
import type { RequirementStatus } from "@/lib/schema";

export function MatchTab({
  data,
  onRunWithJob,
  running,
}: {
  data: AnalyzeResponse;
  onRunWithJob: (input: { targetRole: string; jobDescription: string }) => void;
  running: boolean;
}) {
  const { analysis: a, hasJobDescription } = data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 space-y-6">
        {hasJobDescription ? (
          <Requirements data={data} />
        ) : (
          <AddJobDescription data={data} onRun={onRunWithJob} running={running} />
        )}
        <Keywords data={data} />
      </div>
      <div className="space-y-6 lg:sticky lg:top-20">
        <Panel
          title="Skills & credentials to add"
          description={hasJobDescription ? "Asked for by the job, not shown on your resume." : "Commonly expected for this role."}
        >
          {a.skillsToAdd.length ? (
            <ul className="space-y-3">
              {a.skillsToAdd.map((s, i) => (
                <li key={i} className="space-y-0.5">
                  <p className="text-sm font-medium">{s.skill}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No major skill gaps found.</p>
          )}
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Only add skills you genuinely have — interviewers probe every line.
          </p>
        </Panel>
      </div>
    </div>
  );
}

const STATUS_META: Record<RequirementStatus, { icon: typeof CircleCheck; className: string }> = {
  Met: { icon: CircleCheck, className: "text-success" },
  Partial: { icon: CircleDot, className: "text-warning-strong" },
  Missing: { icon: CircleX, className: "text-destructive" },
};

function Requirements({ data }: { data: AnalyzeResponse }) {
  const reqs = [...data.analysis.requirements].sort(
    (x, y) => (x.importance === y.importance ? 0 : x.importance === "Must-have" ? -1 : 1)
  );
  const count = (s: RequirementStatus) => reqs.filter((r) => r.status === s).length;
  const mustMissing = reqs.filter((r) => r.importance === "Must-have" && r.status === "Missing").length;

  return (
    <Panel
      title="Requirement match"
      description={
        mustMissing > 0
          ? `${mustMissing} must-have requirement${mustMissing > 1 ? "s" : ""} not shown — address these first.`
          : "Every must-have requirement is at least partly covered."
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {(["Met", "Partial", "Missing"] as const).map((s) => {
          const Icon = STATUS_META[s].icon;
          return (
            <div key={s} className="rounded-lg bg-muted/50 p-2.5">
              <div className={cn("flex items-center justify-center gap-1.5 text-lg font-bold tabular-nums", STATUS_META[s].className)}>
                <Icon className="h-4 w-4" /> {count(s)}
              </div>
              <div className="text-xs text-muted-foreground">{s}</div>
            </div>
          );
        })}
      </div>
      {reqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clear requirements could be extracted from the job description.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {reqs.map((r, i) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <li key={i} className="flex gap-3 p-3">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} aria-label={r.status} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.requirement}</span>
                    <Pill tone={r.importance === "Must-have" ? "primary" : "neutral"} className="px-2 py-0 text-[10px]">
                      {r.importance}
                    </Pill>
                  </div>
                  {r.evidence && <p className="text-xs text-muted-foreground">{r.evidence}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Keywords({ data }: { data: AnalyzeResponse }) {
  const k = data.analysis.keywords;
  const total = k.matched.length + k.missing.length;
  if (!total) return null;
  return (
    <Panel
      title="Keywords"
      description="Verified against your resume text — the terms ATS filters and recruiters search for."
      action={k.missing.length > 0 && <CopyButton text={k.missing.join(", ")} label="Copy missing" />}
    >
      <div className="mb-4 flex items-center gap-3">
        <Meter value={k.coverage * 100} className="h-2" />
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {k.matched.length}/{total}
        </span>
      </div>
      <div className="space-y-4">
        {k.missing.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing ({k.missing.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {k.missing.map((w) => (
                <Pill key={w} tone="warning">
                  {w}
                </Pill>
              ))}
            </div>
          </div>
        )}
        {k.matched.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Found ({k.matched.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {k.matched.map((w) => (
                <Pill key={w} tone="success">
                  {w}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>
      {k.missing.length > 0 && (
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Work missing terms into real bullets (not just the skills list) — ATS ranking and recruiters both weigh context.
        </p>
      )}
    </Panel>
  );
}

function AddJobDescription({
  data,
  onRun,
  running,
}: {
  data: AnalyzeResponse;
  onRun: (input: { targetRole: string; jobDescription: string }) => void;
  running: boolean;
}) {
  const [role, setRole] = useState(data.input.targetRole || data.analysis.detectedRole);
  const [jd, setJd] = useState("");
  const ready = jd.trim().length >= 80;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Match against a specific job
        </span>
      }
      description="Paste a job posting to see which requirements you meet, which keywords you're missing, and a tailored match score."
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="match-role">Job title</Label>
          <Input id="match-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="match-jd">Job description</Label>
          <Textarea
            id="match-jd"
            value={jd}
            onChange={(e) => setJd(e.target.value.slice(0, MAX_JD_CHARS))}
            placeholder="Paste the full job posting…"
            className="min-h-40 resize-y"
          />
        </div>
        <Button onClick={() => onRun({ targetRole: role.trim(), jobDescription: jd.trim() })} disabled={!ready || running}>
          {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {running ? "Matching…" : "Run job match"}
        </Button>
      </div>
    </Panel>
  );
}
