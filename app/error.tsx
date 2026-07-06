"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Catches render/runtime errors so users see a
 *  branded recovery screen instead of Next.js's bare default. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // `error` is already sanitized by Next in production (message replaced with a
    // generic string + digest); safe to log for debugging.
    console.error("[app] render error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        An unexpected error occurred. Please try again — your resume is never stored, so nothing was lost.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Start over
        </Button>
      </div>
    </main>
  );
}
