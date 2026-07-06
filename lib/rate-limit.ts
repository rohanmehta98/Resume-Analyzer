/**
 * Rate limiting for the public AI routes.
 *
 * `checkRateLimit` is the entry point routes should call. When an Upstash Redis /
 * Vercel KV store is configured (via env vars) it uses a durable, cross-instance
 * sliding-window limiter that survives instance churn and IP-distributed traffic.
 * When no store is configured (local dev, or before you provision one) it falls
 * back to the in-memory `rateLimit` below — best-effort, per-instance — so the app
 * still works everywhere. A Redis outage also degrades to in-memory rather than
 * failing the request.
 *
 * The in-memory limiter is intentionally NOT a substitute for a shared one; for
 * production also add a Vercel Firewall rate rule + a hard Groq spend cap.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit = 20, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > MAX_BUCKETS) sweep(now);
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

function sweep(now: number) {
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
  // Hard cap: if a flood of still-active keys keeps us over the limit, evict the
  // oldest entries (Map preserves insertion order) so memory stays bounded.
  if (buckets.size > MAX_BUCKETS) {
    let excess = buckets.size - MAX_BUCKETS;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (--excess <= 0) break;
    }
  }
}

/* -------- durable (cross-instance) limiter, used when a store is configured -------- */

/** Upstash/KV REST client, or null when no store env vars are present. Supports
 *  both Upstash-native and Vercel KV-compatible variable names. */
function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = makeRedis();
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowSec: number): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${limit}:${windowSec}`;
  let rl = limiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "ratelimit",
      analytics: false,
    });
    limiters.set(cacheKey, rl);
  }
  return rl;
}

/**
 * Rate-limit `key`. Uses the durable store when configured, otherwise the
 * in-memory limiter. Never throws: a store error degrades to in-memory so a
 * Redis hiccup can't take the app down.
 */
export async function checkRateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): Promise<RateLimitResult> {
  const windowSec = Math.max(1, Math.round(windowMs / 1000));
  const limiter = getLimiter(limit, windowSec);
  if (!limiter) return rateLimit(key, limit, windowMs);
  try {
    const res = await limiter.limit(key);
    if (res.success) return { ok: true, retryAfterSec: 0 };
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}

/** True when a durable store is wired up (surfaced by /api/health for ops). */
export function hasDurableRateLimit(): boolean {
  return redis !== null;
}

/**
 * Best-effort client IP. Prefers the platform-set `x-real-ip` (Vercel sets this
 * to the true connecting IP). We do NOT trust the leftmost `x-forwarded-for`
 * token — it's client-controllable, so keying on it would let an attacker bypass
 * the limit by rotating the header. If only XFF is present, use the LAST entry
 * (appended by the nearest trusted proxy).
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!;
  }
  return "unknown";
}

/** Test-only: clear all buckets. */
export function __resetRateLimit() {
  buckets.clear();
}
