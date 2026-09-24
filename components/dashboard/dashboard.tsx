"use client";

import { useCallback, useState } from "react";
import { Download, FileText, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/components/chat-panel";
import { ScoreSummary } from "@/components/dashboard/score-summary";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { MatchTab } from "@/components/dashboard/match-tab";
import { ImproveTab } from "@/components/dashboard/improve-tab";
import { InterviewTab } from "@/components/dashboard/interview-tab";
import { ToolsTab } from "@/components/dashboard/tools-tab";
import { previousFor, type HistoryEntry } from "@/lib/history";
import type { AnalyzeResponse } from "@/lib/types";

export interface RerunInput {
  targetRole: string;
  jobDescription: string;
}

export function Dashboard({
  data,
  history,
  onNew,
  onRerun,
  rerunning,
  tab,
  onTabChange,
}: {
  data: AnalyzeResponse;
  history: HistoryEntry[];
  onNew: () => void;
  onRerun: (input: RerunInput) => void;
  rerunning: boolean;
  /** Controlled by the parent so the active tab survives a re-run. */
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const clearSeed = useCallback(() => setChatSeed(null), []);

  const a = data.analysis;
  const previous = previousFor(data, history);
  const chatContext = [
    `Target role: ${data.input.targetRole || a.detectedRole}.`,
    `Field: ${data.career.label}; level: ${data.career.seniority}.`,
    `Overall score ${a.overallScore}/100.`,
    a.weaknesses.length ? `Known gaps: ${a.weaknesses.slice(0, 3).join("; ")}.` : "",
  ]
    .join(" ")
    .slice(0, 1000);

  function practice(prompt: string) {
    setChatSeed(prompt);
    setChatOpen(true);
  }

  const analyzedAt = new Date(data.meta.analyzedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium text-foreground">{data.meta.fileName}</span>
          <span aria-hidden>·</span>
          <time dateTime={data.meta.analyzedAt} className="shrink-0">
            {analyzedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
            {analyzedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </time>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRerun({ targetRole: data.input.targetRole, jobDescription: data.input.jobDescription })}
            disabled={rerunning}
          >
            <RefreshCw className={rerunning ? "mr-2 h-3.5 w-3.5 animate-spin" : "mr-2 h-3.5 w-3.5"} /> Re-run
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export PDF
          </Button>
          <Button size="sm" onClick={onNew}>
            <Plus className="mr-2 h-3.5 w-3.5" /> New analysis
          </Button>
        </div>
      </div>

      {data.partial && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm print:hidden">
          Scores are complete, but rewrites and interview prep didn&apos;t finish this time. Use <strong>Re-run</strong> to generate them.
        </p>
      )}

      <ScoreSummary data={data} previous={previous} />

      <Tabs value={tab} onValueChange={(v) => onTabChange(String(v))} className="gap-5">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:hidden">
          <TabsList variant="line" className="h-10 w-max min-w-full justify-start gap-1 border-b">
            <TabsTrigger value="overview" className="flex-none px-3">
              Overview
            </TabsTrigger>
            <TabsTrigger value="match" className="flex-none px-3">
              Job match
              {data.hasJobDescription && <Count>{a.matchScore}</Count>}
            </TabsTrigger>
            <TabsTrigger value="improve" className="flex-none px-3">
              Improve
              {a.bulletRewrites.length > 0 && <Count>{a.bulletRewrites.length}</Count>}
            </TabsTrigger>
            <TabsTrigger value="interview" className="flex-none px-3">
              Interview prep
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex-none px-3">
              Writing tools
            </TabsTrigger>
          </TabsList>
        </div>

        {/* keepMounted so every panel prints and per-tab state (generated
            documents, expanded questions) survives switching tabs. */}
        <TabsContent value="overview" keepMounted>
          <PrintHeading>Overview</PrintHeading>
          <OverviewTab data={data} />
        </TabsContent>
        <TabsContent value="match" keepMounted>
          <PrintHeading>Job match</PrintHeading>
          <MatchTab data={data} onRunWithJob={onRerun} running={rerunning} />
        </TabsContent>
        <TabsContent value="improve" keepMounted>
          <PrintHeading>Improvements</PrintHeading>
          <ImproveTab
            data={data}
            onRetry={() => onRerun({ targetRole: data.input.targetRole, jobDescription: data.input.jobDescription })}
          />
        </TabsContent>
        <TabsContent value="interview" keepMounted>
          <PrintHeading>Interview prep</PrintHeading>
          <InterviewTab data={data} onPractice={practice} />
        </TabsContent>
        <TabsContent value="tools" keepMounted className="print:hidden">
          <ToolsTab data={data} />
        </TabsContent>
      </Tabs>

      <ChatPanel
        resumeText={data.resumeText}
        context={chatContext}
        open={chatOpen}
        onOpenChange={setChatOpen}
        seed={chatSeed}
        onSeedConsumed={clearSeed}
      />
    </div>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}

function PrintHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 mt-8 hidden text-lg font-semibold print:block">{children}</h2>;
}
