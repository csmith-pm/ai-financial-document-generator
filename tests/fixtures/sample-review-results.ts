/**
 * Sample GFOA and ADA review results for testing.
 */

export interface GfoaScore {
  category: string;
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

export interface GfoaReviewResult {
  scores: GfoaScore[];
  totalScore: number;
  passed: boolean;
  recommendations: Array<{
    section: string;
    priority: "high" | "medium" | "low";
    issue: string;
    suggestion: string;
  }>;
}

export interface AdaIssue {
  rule: string;
  severity: "critical" | "major" | "minor";
  location: string;
  description: string;
  fix: string;
}

export interface AdaReviewResult {
  pdfIssues: AdaIssue[];
  webIssues: AdaIssue[];
  passed: boolean;
}

export const sampleGfoaReview: GfoaReviewResult = {
  scores: [
    { category: "Community Priorities", maxPoints: 20, awardedPoints: 16, feedback: "Good connection to community goals" },
    { category: "Value", maxPoints: 20, awardedPoints: 14, feedback: "Could better articulate value proposition" },
    { category: "Long-Term Outlook", maxPoints: 20, awardedPoints: 18, feedback: "Strong multi-year projections" },
    { category: "Revenue", maxPoints: 20, awardedPoints: 17, feedback: "Detailed revenue breakdown" },
    { category: "Personnel", maxPoints: 15, awardedPoints: 12, feedback: "Missing FTE trend data" },
    { category: "Department", maxPoints: 15, awardedPoints: 11, feedback: "Needs more performance metrics" },
    { category: "Program", maxPoints: 15, awardedPoints: 10, feedback: "Program budgets not clearly linked to outcomes" },
    { category: "Capital", maxPoints: 15, awardedPoints: 13, feedback: "Good project detail" },
    { category: "Budget Process", maxPoints: 10, awardedPoints: 8, feedback: "Process well documented" },
    { category: "Document", maxPoints: 10, awardedPoints: 8, feedback: "Professional formatting" },
  ],
  totalScore: 127,
  passed: true,
  recommendations: [
    { section: "personnel_summary", priority: "high", issue: "Missing FTE trend comparison", suggestion: "Add 3-year FTE trend table" },
    { section: "expenditure_summary", priority: "medium", issue: "No performance metrics", suggestion: "Add key performance indicators per department" },
    { section: "revenue_summary", priority: "low", issue: "Revenue sources could be more visual", suggestion: "Add a revenue sources pie chart" },
  ],
};

export const sampleAdaReview: AdaReviewResult = {
  pdfIssues: [
    { rule: "WCAG 1.1.1", severity: "critical", location: "Revenue chart", description: "Chart missing alt text", fix: "Add descriptive alt text" },
    { rule: "WCAG 1.3.1", severity: "major", location: "Personnel table", description: "Table headers not marked up", fix: "Use <TH> elements" },
  ],
  webIssues: [
    { rule: "WCAG 1.4.3", severity: "minor", location: "Footer text", description: "Insufficient contrast ratio", fix: "Increase contrast to 4.5:1" },
  ],
  passed: false,
};

export const samplePassingAdaReview: AdaReviewResult = {
  pdfIssues: [],
  webIssues: [],
  passed: true,
};
