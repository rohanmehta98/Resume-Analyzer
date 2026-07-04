/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * IMPORTANT: state lives in the function instance's memory, so on serverless it
 * is best-effort (per-instance, resets on cold start). It blunts casual abuse
 * of the public AI routes but is NOT a substitute for a shared limiter. For real
 * production use Vercel Firewall rate rules or @upstash/ratelimit (see README).
 */

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
