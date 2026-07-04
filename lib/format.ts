import type { Verdict } from "./schema";

/** Verdict is derived from the score so the badge can never contradict it. */
export function verdictFromScore(score: number): Verdict {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Solid";
  return "Needs work";
}

export type ScoreTier = "great" | "good" | "fair" | "poor";

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/** CSS color value for inline styles (e.g. SVG stroke, meter fill). */
export function scoreColorVar(score: number): string {
  switch (scoreTier(score)) {
    case "great":
      return "var(--success)";
    case "good":
      return "var(--info)";
    case "fair":
      return "var(--warning)";
    default:
      return "var(--destructive)";
  }
}

/** Tailwind text color class. */
export function scoreTextClass(score: number): string {
  switch (scoreTier(score)) {
    case "great":
      return "text-success";
    case "good":
      return "text-info";
    case "fair":
      return "text-warning";
    default:
      return "text-destructive";
  }
}

export function verdictClasses(verdict: Verdict): string {
  switch (verdict) {
    case "Strong":
      return "bg-success/10 text-success border-success/30";
    case "Solid":
      return "bg-info/10 text-info border-info/30";
    default:
      return "bg-warning/10 text-warning border-warning/40";
  }
}
