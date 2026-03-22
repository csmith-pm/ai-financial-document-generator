import { describe, it, expect } from "vitest";
import { PAFR_REVIEWERS } from "../../src/doc-types/pafr/reviewers.js";
import { pafrReviewResultSchema } from "../../src/doc-types/pafr/review-types.js";
import type { SectionOutput } from "../../src/core/doc-type.js";

const SAMPLE_SECTIONS: SectionOutput[] = [
  {
    sectionType: "financial_highlights",
    title: "Financial Highlights",
    narrativeContent: "The city ended FY2026 with a strong financial position.",
    tableData: [],
    chartConfigs: [],
  },
];

describe("PAFR Reviewers", () => {
  it("has 2 reviewers: pafr_quality and ada", () => {
    expect(PAFR_REVIEWERS).toHaveLength(2);
    expect(PAFR_REVIEWERS[0].id).toBe("pafr_quality");
    expect(PAFR_REVIEWERS[1].id).toBe("ada");
  });

  it("pafr_quality reviewer uses pafr_reviewer agent", () => {
    expect(PAFR_REVIEWERS[0].agentType).toBe("pafr_reviewer");
  });

  it("ada reviewer uses ada_reviewer agent", () => {
    expect(PAFR_REVIEWERS[1].agentType).toBe("ada_reviewer");
  });

  it("pafr_quality buildReviewPrompt includes section data", () => {
    const prompt = PAFR_REVIEWERS[0].buildReviewPrompt(SAMPLE_SECTIONS);
    expect(prompt).toContain("financial_highlights");
    expect(prompt).toContain("Popular Annual Financial Report");
  });

  it("ada buildReviewPrompt mentions PAFR context", () => {
    const prompt = PAFR_REVIEWERS[1].buildReviewPrompt(SAMPLE_SECTIONS);
    expect(prompt).toContain("Popular Annual Financial Report");
    expect(prompt).toContain("infographics");
  });

  it("pafr_quality isPassed returns true when passed", () => {
    expect(PAFR_REVIEWERS[0].isPassed({ passed: true, totalScore: 80, scores: [], recommendations: [] })).toBe(true);
  });

  it("pafr_quality isPassed returns false when not passed", () => {
    expect(PAFR_REVIEWERS[0].isPassed({ passed: false, totalScore: 40, scores: [], recommendations: [] })).toBe(false);
  });

  it("pafr_quality getScore returns totalScore", () => {
    expect(PAFR_REVIEWERS[0].getScore({ totalScore: 75, passed: true, scores: [], recommendations: [] })).toBe(75);
  });

  it("ada getScore returns null (pass/fail only)", () => {
    expect(PAFR_REVIEWERS[1].getScore({ passed: true, pdfIssues: [], webIssues: [] })).toBeNull();
  });

  it("pafr_quality getRecommendations returns recommendations array", () => {
    const recs = PAFR_REVIEWERS[0].getRecommendations({
      passed: false,
      totalScore: 50,
      scores: [],
      recommendations: [
        { section: "revenue_overview", priority: "high", issue: "Missing context", suggestion: "Add comparisons" },
      ],
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toHaveProperty("section", "revenue_overview");
  });

  it("pafr_quality getFeedbackForSection filters by section", () => {
    const result = {
      passed: false,
      totalScore: 50,
      scores: [],
      recommendations: [
        { section: "revenue_overview", priority: "high", issue: "Too technical", suggestion: "Simplify language" },
        { section: "demographic_profile", priority: "medium", issue: "Missing data", suggestion: "Add population" },
      ],
    };
    const feedback = PAFR_REVIEWERS[0].getFeedbackForSection(result, "revenue_overview");
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toContain("Too technical");
    expect(feedback[0]).toContain("Simplify language");
  });

  it("review result schema validates correct data", () => {
    const valid = {
      scores: [{ category: "Reader Appeal", maxPoints: 25, awardedPoints: 20, feedback: "Good" }],
      totalScore: 80,
      passed: true,
      recommendations: [],
    };
    expect(pafrReviewResultSchema.safeParse(valid).success).toBe(true);
  });

  it("review result schema rejects invalid data", () => {
    expect(pafrReviewResultSchema.safeParse({ totalScore: "bad" }).success).toBe(false);
  });
});
