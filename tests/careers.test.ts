import { describe, it, expect } from "vitest";
import { adjustWeightsForSeniority, CAREER_PROFILES, detectCareerField, detectSeniority } from "@/lib/careers";

describe("detectCareerField", () => {
  it.each([
    ["ICU Registered Nurse", "Provided care for 6 patients per shift in a 24-bed ICU. BLS, ACLS certified. Epic EHR.", "healthcare"],
    ["Backend Engineer", "Built microservices in Go and Python on Kubernetes and AWS.", "software"],
    ["Account Executive", "Closed $2.1M in new business at 128% of quota using Salesforce.", "sales"],
    ["Staff Accountant", "Month-end close, reconciliations, GAAP reporting in NetSuite. CPA candidate.", "finance"],
    ["High School Math Teacher", "Taught algebra to 150 students; improved pass rates by 18%. Curriculum design.", "education"],
    ["Product Designer", "Led UX research and prototyping in Figma; portfolio at janedoe.design.", "design"],
    ["Electrician", "Journeyman electrician, commercial wiring, OSHA 30, licensed.", "trades"],
  ])("detects %s", (role, text, expected) => {
    expect(detectCareerField({ resumeText: text, targetRole: role }).field).toBe(expected);
  });

  it("weights the target role over the resume (career changers)", () => {
    const resume = "Teacher. Taught 5th grade classroom for 6 years. Curriculum development.";
    expect(detectCareerField({ resumeText: resume, targetRole: "Instructional Designer" }).field).toBe("education");
    expect(detectCareerField({ resumeText: resume, targetRole: "Data Analyst (SQL, Tableau)" }).field).toBe("data");
  });

  it("falls back to general on weak signal", () => {
    expect(detectCareerField({ resumeText: "Hello world, some text without a field." }).field).toBe("general");
  });
});

describe("detectSeniority", () => {
  it("uses titles and years", () => {
    expect(detectSeniority({ resumeText: "Summer intern at Acme", yearsExperience: 0.3 })).toBe("Student / Entry");
    expect(detectSeniority({ resumeText: "Analyst", yearsExperience: 4 })).toBe("Mid-level");
    expect(detectSeniority({ resumeText: "Senior Analyst", yearsExperience: 5 })).toBe("Senior");
    expect(detectSeniority({ resumeText: "Engineering Manager", yearsExperience: 9 })).toBe("Lead / Manager");
    expect(detectSeniority({ resumeText: "VP of Sales", yearsExperience: 15 })).toBe("Executive");
  });

  it("treats IC titles containing 'manager' as individual contributors", () => {
    expect(detectSeniority({ resumeText: "Senior Product Manager", yearsExperience: 6.4 })).toBe("Senior");
    expect(detectSeniority({ resumeText: "Account Manager", yearsExperience: 4 })).toBe("Mid-level");
  });

  it("doesn't grant a senior title without the years to back it", () => {
    expect(detectSeniority({ resumeText: "Senior Associate", yearsExperience: 1 })).toBe("Early career");
  });
});

describe("weights", () => {
  it("every profile's weights sum to 1", () => {
    for (const p of Object.values(CAREER_PROFILES)) {
      const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("seniority adjustments stay normalized and shift emphasis", () => {
    const base = CAREER_PROFILES.software.weights;
    const entry = adjustWeightsForSeniority(base, "Student / Entry");
    const exec = adjustWeightsForSeniority(base, "Executive");
    expect(Object.values(entry).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(Object.values(exec).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(entry.education).toBeGreaterThan(base.education);
    expect(exec.impact).toBeGreaterThan(base.impact);
  });
});
