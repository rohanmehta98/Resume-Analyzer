"use client";

import type { AnalyzeResponse } from "./types";

/**
 * Analysis history kept in the user's own browser (localStorage). Nothing is
 * sent to a server. Every access is wrapped because storage can be disabled,
 * full, or unavailable (private mode), and the app must work without it.
 */

const KEY = "resumeiq:history:v2";
const PLAN_PREFIX = "resumeiq:plan:";
const MAX_ENTRIES = 10;

export interface HistoryEntry {
  id: string;
  savedAt: string;
  candidateName: string;
  role: string;
  field: string;
  score: number;
  matchScore: number | null;
  fileName: string;
  data: AnalyzeResponse;
}

const EVENT = "resumeiq:history";

/** useSyncExternalStore subscription: fires on our own writes and other tabs'. */
export function subscribeHistory(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Raw snapshot (a string, so it's referentially stable between reads). */
export function getHistorySnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseHistory(raw: string): HistoryEntry[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e && e.data && e.data.analysis && e.data.career) : [];
  } catch {
    return [];
  }
}

export function loadHistory(): HistoryEntry[] {
  return parseHistory(getHistorySnapshot());
}

function notify() {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function saveToHistory(data: AnalyzeResponse): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: data.meta.analyzedAt,
    savedAt: new Date().toISOString(),
    candidateName: data.analysis.candidateName,
    role: data.analysis.detectedRole,
    field: data.career.label,
    score: data.analysis.overallScore,
    matchScore: data.hasJobDescription ? data.analysis.matchScore : null,
    fileName: data.meta.fileName,
    data,
  };
  let list = [entry, ...loadHistory().filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
  // On quota errors, drop the oldest entries until it fits.
  while (list.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      notify();
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  return [];
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const list = loadHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.removeItem(PLAN_PREFIX + id);
  } catch {
    /* ignore */
  }
  notify();
  return list;
}

export function clearHistory(): void {
  try {
    for (const e of loadHistory()) localStorage.removeItem(PLAN_PREFIX + e.id);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notify();
}

/** The most recent earlier analysis of the same candidate, for score deltas. */
export function previousFor(data: AnalyzeResponse, history: HistoryEntry[]): HistoryEntry | null {
  const name = data.analysis.candidateName.trim().toLowerCase();
  if (!name || name === "candidate") return null;
  const current = Date.parse(data.meta.analyzedAt);
  return (
    history
      .filter((e) => e.id !== data.meta.analyzedAt && Date.parse(e.id) < current)
      .find((e) => e.candidateName.trim().toLowerCase() === name) || null
  );
}

/* ----------------------- action-plan checklist (per analysis) ----------------------- */

export function loadPlan(analysisId: string): string[] {
  try {
    const raw = localStorage.getItem(PLAN_PREFIX + analysisId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function savePlan(analysisId: string, done: string[]): void {
  try {
    localStorage.setItem(PLAN_PREFIX + analysisId, JSON.stringify(done));
  } catch {
    /* ignore */
  }
}
