import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, getClientIp, __resetRateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimit());
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60_000).ok).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 60_000);
    const blocked = rateLimit("k", 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
    expect(rateLimit("a", 5, 60_000).ok).toBe(false);
    expect(rateLimit("b", 5, 60_000).ok).toBe(true);
  });

  it("re-opens the window after it expires (does not lock out forever)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(rateLimit("k", 2, 1000).ok).toBe(true);
    expect(rateLimit("k", 2, 1000).ok).toBe(true);
    expect(rateLimit("k", 2, 1000).ok).toBe(false); // 3rd blocked within window
    vi.advanceTimersByTime(1001); // window elapses
    const after = rateLimit("k", 2, 1000);
    expect(after.ok).toBe(true); // allowed again, count restarted
  });
});

describe("getClientIp", () => {
  it("prefers the platform-set x-real-ip over x-forwarded-for", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("uses the LAST x-forwarded-for entry (not the spoofable leftmost)", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when no IP headers are present", () => {
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});
