/**
 * Budget Book Review Types — GFOA and ADA review result shapes.
 *
 * Includes both TypeScript interfaces and Zod schemas for runtime validation.
 */

import { z } from "zod";

// ─── GFOA Types + Schema ────────────────────────────────────────────────

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

export const gfoaReviewResultSchema = z.object({
  scores: z.array(
    z.object({
      category: z.string(),
      maxPoints: z.number(),
      awardedPoints: z.number(),
      feedback: z.string(),
    })
  ),
  totalScore: z.number(),
  passed: z.boolean(),
  recommendations: z.array(
    z.object({
      section: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      issue: z.string(),
      suggestion: z.string(),
    })
  ),
});

// ─── ADA Types + Schema ─────────────────────────────────────────────────

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

const adaIssueSchema = z.object({
  rule: z.string(),
  severity: z.enum(["critical", "major", "minor"]),
  location: z.string(),
  description: z.string(),
  fix: z.string(),
});

export const adaReviewResultSchema = z.object({
  pdfIssues: z.array(adaIssueSchema),
  webIssues: z.array(adaIssueSchema),
  passed: z.boolean(),
});
