/**
 * Budget Book Review Types — GFOA and ADA review result shapes.
 *
 * Extracted from src/core/orchestrator.ts and src/core/skills/extractor.ts.
 */

export interface GfoaScore {
  category: string;
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

export interface GfoaRecommendation {
  section: string;
  priority: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
}

export interface GfoaReviewResult {
  scores: GfoaScore[];
  totalScore: number;
  passed: boolean;
  recommendations: GfoaRecommendation[];
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
