"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { clearHistory, removeFromHistory, type HistoryEntry } from "@/lib/history";
import { scoreTextClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RecentAnalyses({ entries, onOpen }: { entries: HistoryEntry[]; onOpen: (e: HistoryEntry) => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Recent analyses</CardTitle>
          <CardDescription>Saved in this browser only.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => window.confirm("Clear all saved analyses from this browser?") && clearHistory()}
        >
          Clear
        </Button>
      </CardHeader>
      <CardContent className="px-2">
        <ul className="space-y-0.5">
          {entries.map((e) => (
            <li key={e.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpen(e)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 pr-9 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold tabular-nums",
                    scoreTextClass(e.score)
                  )}
                >
                  {e.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.candidateName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {e.role} · {relativeTime(e.id)}
                  </span>
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove analysis of ${e.candidateName}`}
                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => removeFromHistory(e.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
