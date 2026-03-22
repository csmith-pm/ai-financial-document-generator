import { describe, it, expect } from "vitest";
import {
  GFOA_REVIEWER,
  ADA_REVIEWER,
  BUDGET_BOOK_REVIEWERS,
} from "../../src/doc-types/budget-book/reviewers.js";
import type { SectionOutput } from "../../src/core/doc-type.js";
import type {
  GfoaReviewResult,
  AdaReviewResult,
} from "../../src/doc-types/budget-book/review-types.js";
import {
  gfoaReviewResultSchema,
  adaReviewResultSchema,
} from "../../src/doc-types/budget-book/review-types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────

const mockSections: SectionOutput[] = [
  {
    sectionType: "revenue_summary",
    title: "Revenue Summary",
    narrativeContent: "The city's total revenue for FY2026 is projected at $50M...",
    tableData: [{ source: "Property Tax", amount: 30000000 }],
    chartConfigs: [],
  },
  {
    sectionType: "expenditure_summary",
    title: "Expenditure Summary",
    narrativeContent: "Total expenditures are budgeted at $48M...",
    tableData: [{ department: "Police", amount: 12000000 }],
    chartConfigs: [],
  },
];

const mockGfoaResult: GfoaReviewResult = {
  scores: [
    { category: "Policy Document", maxPoints: 20, awardedPoints: 18, feedback: "Strong policy narrative" },
    { category: "Financial Plan", maxPoints: 20, awardedPoints: 15, feedback: "Needs multi-year outlook" },
  ],
  totalScore: 130,
  passed: true,
  recommendations: [
    { section: "revenue_summary", priority: "medium", issue: "Missing trend analysis", suggestion: "Add 3-year revenue trend" },
    { section: "expenditure_summary", priority: "high", issue: "No per-capita figures", suggestion: "Add per-capita comparison" },
    { section: "revenue_summary", priority: "low", issue: "Font size too small", suggestion: "Use 11pt minimum" },
  ],
};

const mockAdaResult: AdaReviewResult = {
  pdfIssues: [
    { rule: "WCAG 1.1.1 Non-text Content", severity: "critical", location: "revenue summary chart", description: "Chart lacks alt text", fix: "Add descriptive alt text" },
  ],
  webIssues: [
    { rule: "WCAG 1.4.3 Contrast", severity: "major", location: "expenditure summary table", description: "Low contrast text", fix: "Use 4.5:1 ratio" },
  ],
  passed: false,
};

// ─── GFOA Reviewer Tests ─────────────────────────────────────────────────

describe("GFOA ReviewerSpec", () => {
  it("has correct id and agentType", () => {
    expect(GFOA_REVIEWER.id).toBe("gfoa");
    expect(GFOA_REVIEWER.agentType).toBe("bb_reviewer");
  });

  it("builds a review prompt with section summary", () => {
    const prompt = GFOA_REVIEWER.buildReviewPrompt(mockSections);
    expect(prompt).toContain("Review this budget book with 2 sections");
    expect(prompt).toContain("revenue_summary");
    expect(prompt).toContain("expenditure_summary");
    expect(prompt).toContain("Output format:");
  });

  it("resultSchema validates valid GFOA result", () => {
    const result = gfoaReviewResultSchema.safeParse(mockGfoaResult);
    expect(result.success).toBe(true);
  });

  it("resultSchema rejects invalid GFOA result", () => {
    const result = gfoaReviewResultSchema.safeParse({ totalScore: "not a number" });
    expect(result.success).toBe(false);
  });

  it("isPassed returns the passed flag", () => {
    expect(GFOA_REVIEWER.isPassed(mockGfoaResult)).toBe(true);
    expect(GFOA_REVIEWER.isPassed({ ...mockGfoaResult, passed: false })).toBe(false);
  });

  it("getScore returns totalScore", () => {
    expect(GFOA_REVIEWER.getScore(mockGfoaResult)).toBe(130);
  });

  it("getRecommendations returns recommendations array", () => {
    const recs = GFOA_REVIEWER.getRecommendations(mockGfoaResult);
    expect(recs).toHaveLength(3);
    expect(recs[0]).toHaveProperty("section", "revenue_summary");
  });

  it("getFeedbackForSection filters by section type", () => {
    const revenueFeedback = GFOA_REVIEWER.getFeedbackForSection(mockGfoaResult, "revenue_summary");
    expect(revenueFeedback).toHaveLength(2);
    expect(revenueFeedback[0]).toContain("Missing trend analysis");
    expect(revenueFeedback[1]).toContain("Font size too small");

    const expenditureFeedback = GFOA_REVIEWER.getFeedbackForSection(mockGfoaResult, "expenditure_summary");
    expect(expenditureFeedback).toHaveLength(1);
    expect(expenditureFeedback[0]).toContain("No per-capita figures");
  });

  it("getFeedbackForSection returns empty for unmentioned section", () => {
    const feedback = GFOA_REVIEWER.getFeedbackForSection(mockGfoaResult, "capital_summary");
    expect(feedback).toEqual([]);
  });
});

// ─── ADA Reviewer Tests ──────────────────────────────────────────────────

describe("ADA ReviewerSpec", () => {
  it("has correct id and agentType", () => {
    expect(ADA_REVIEWER.id).toBe("ada");
    expect(ADA_REVIEWER.agentType).toBe("ada_reviewer");
  });

  it("builds a review prompt with sections", () => {
    const prompt = ADA_REVIEWER.buildReviewPrompt(mockSections);
    expect(prompt).toContain("Check accessibility");
    expect(prompt).toContain("WCAG");
    expect(prompt).toContain("pdfIssues");
  });

  it("resultSchema validates valid ADA result", () => {
    const result = adaReviewResultSchema.safeParse(mockAdaResult);
    expect(result.success).toBe(true);
  });

  it("isPassed returns the passed flag", () => {
    expect(ADA_REVIEWER.isPassed(mockAdaResult)).toBe(false);
    expect(ADA_REVIEWER.isPassed({ ...mockAdaResult, passed: true })).toBe(true);
  });

  it("getScore returns null (ADA is pass/fail)", () => {
    expect(ADA_REVIEWER.getScore(mockAdaResult)).toBeNull();
  });

  it("getRecommendations combines pdf and web issues", () => {
    const recs = ADA_REVIEWER.getRecommendations(mockAdaResult);
    expect(recs).toHaveLength(2);
  });

  it("getFeedbackForSection filters by location match", () => {
    const revenueFeedback = ADA_REVIEWER.getFeedbackForSection(mockAdaResult, "revenue_summary");
    expect(revenueFeedback).toHaveLength(1);
    expect(revenueFeedback[0]).toContain("WCAG 1.1.1");
    expect(revenueFeedback[0]).toContain("Chart lacks alt text");

    const expenditureFeedback = ADA_REVIEWER.getFeedbackForSection(mockAdaResult, "expenditure_summary");
    expect(expenditureFeedback).toHaveLength(1);
    expect(expenditureFeedback[0]).toContain("WCAG 1.4.3");
  });

  it("getFeedbackForSection returns empty for unmentioned section", () => {
    const feedback = ADA_REVIEWER.getFeedbackForSection(mockAdaResult, "capital_summary");
    expect(feedback).toEqual([]);
  });
});

// ─── Combined ────────────────────────────────────────────────────────────

describe("BUDGET_BOOK_REVIEWERS", () => {
  it("exports both reviewers", () => {
    expect(BUDGET_BOOK_REVIEWERS).toHaveLength(2);
    expect(BUDGET_BOOK_REVIEWERS.map((r) => r.id)).toEqual(["gfoa", "ada"]);
  });
});
