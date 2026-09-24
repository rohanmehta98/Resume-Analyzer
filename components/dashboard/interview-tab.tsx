"use client";

import { useState } from "react";
import { ChevronDown, Lightbulb, MessageSquare, MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import type { AnalyzeResponse } from "@/lib/types";

export function InterviewTab({ data, onPractice }: { data: AnalyzeResponse; onPractice: (prompt: string) => void }) {
  const { analysis: a, career } = data;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0">
        <Panel
          title="Likely interview questions"
          description="Based on what your resume claims — and what it leaves out."
        >
          {a.interviewQuestions.length ? (
            <ul className="divide-y rounded-lg border">
              {a.interviewQuestions.map((q, i) => {
                const isOpen = open === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="mt-0.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 space-y-1">
                        <span className="block text-sm font-medium">{q.question}</span>
                        {q.focus && <span className="block text-xs text-muted-foreground">Probing: {q.focus}</span>}
                      </span>
                      <ChevronDown
                        className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform print:hidden", isOpen && "rotate-180")}
                      />
                    </button>
                    {/* Always rendered for print; toggled on screen. */}
                    <div className={cn("px-4 pb-4 pl-11", !isOpen && "hidden print:block")}>
                      {q.tip && (
                        <div className="flex gap-2 rounded-md bg-primary/5 p-3 text-sm">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p className="text-muted-foreground">{q.tip}</p>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 print:hidden"
                        onClick={() =>
                          onPractice(
                            `Mock interview: ask me "${q.question}" then wait for my answer and give feedback using the STAR method.`
                          )
                        }
                      >
                        <MessageSquare className="mr-2 h-3.5 w-3.5" /> Practice with the coach
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title="No interview questions for this run">
              Re-run the analysis to generate interview prep.
            </EmptyState>
          )}
        </Panel>
      </div>

      <div className="space-y-6 lg:sticky lg:top-20">
        <Panel title={`${career.label} tips`} description={`For a ${career.seniority.toLowerCase()} candidate.`}>
          {a.careerTips.length ? (
            <ul className="space-y-3">
              {a.careerTips.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No additional tips.</p>
          )}
        </Panel>
        <Panel title="Answer framework">
          <dl className="space-y-2 text-sm">
            {[
              ["Situation", "One line of context."],
              ["Task", "What you owned."],
              ["Action", "What you did — the bulk of the answer."],
              ["Result", "The measurable outcome, then what you learned."],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-20 shrink-0 font-medium">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
