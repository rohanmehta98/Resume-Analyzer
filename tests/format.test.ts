import { describe, it, expect } from "vitest";
import { verdictFromScore, scoreTier, scoreColorVar, verdictClasses } from "@/lib/format";

describe("verdictFromScore", () => {
  it("maps score bands to verdicts", () => {
    expect(verdictFromScore(95)).toBe("Strong");
    expect(verdictFromScore(80)).toBe("Strong");
    expect(verdictFromScore(79)).toBe("Solid");
    expect(verdictFromScore(60)).toBe("Solid");
    expect(verdictFromScore(59)).toBe("Needs work");
    expect(verdictFromScore(0)).toBe("Needs work");
  });

  it("keeps verdict and tier consistent across the whole 0-100 range", () => {
    for (let s = 0; s <= 100; s++) {
      // Strong (>=80) must coincide exactly with the 'great' tier (>=80).
      expect(verdictFromScore(s) === "Strong").toBe(scoreTier(s) === "great");
      // 'Needs work' (<60) must never map to a passing color tier.
      if (verdictFromScore(s) === "Needs work") {
        expect(["fair", "poor"]).toContain(scoreTier(s));
      }
    }
  });
});

describe("scoreTier / scoreColorVar", () => {
  it("returns the right tier at boundaries", () => {
    expect(scoreTier(80)).toBe("great");
    expect(scoreTier(65)).toBe("good");
    expect(scoreTier(50)).toBe("fair");
    expect(scoreTier(49)).toBe("poor");
  });

  it("maps every tier to a CSS var", () => {
    expect(scoreColorVar(90)).toBe("var(--success)");
    expect(scoreColorVar(70)).toBe("var(--info)");
    expect(scoreColorVar(55)).toBe("var(--warning)");
    expect(scoreColorVar(30)).toBe("var(--destructive)");
  });
});

describe("verdictClasses", () => {
  it("returns a class string for each verdict", () => {
    expect(verdictClasses("Strong")).toContain("success");
    expect(verdictClasses("Solid")).toContain("info");
    expect(verdictClasses("Needs work")).toContain("warning");
  });
});
