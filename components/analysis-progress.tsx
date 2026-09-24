"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Approximate timings for the real pipeline: extraction and deterministic
// checks are near-instant; the two parallel AI passes take most of the time.
const STEPS: { label: string; at: number }[] = [
  { label: "Reading the document", at: 0 },
  { label: "Measuring structure, dates, and writing quality", at: 700 },
  { label: "Detecting career field and seniority", at: 1400 },
  { label: "Scoring against the role", at: 2200 },
  { label: "Writing rewrites and interview prep", at: 3200 },
];

export function AnalysisProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(t);
  }, []);

  const active = STEPS.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);

  return (
    <Card className="mx-auto w-full max-w-lg duration-300 animate-in fade-in-0" aria-live="polite" aria-busy="true">
      <CardContent className="space-y-5 py-2">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Analyzing resume</p>
          <span className="text-xs tabular-nums text-muted-foreground">{(elapsed / 1000).toFixed(0)}s</span>
        </div>
        <ol className="space-y-3">
          {STEPS.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    done && "border-success bg-success text-success-foreground",
                    current && "border-primary text-primary"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : current ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                </span>
                <span className={cn(done || current ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        {elapsed > 20_000 && (
          <p className="text-xs text-muted-foreground">Longer resumes can take up to a minute.</p>
        )}
      </CardContent>
    </Card>
  );
}
