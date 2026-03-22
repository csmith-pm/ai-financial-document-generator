/**
 * PAFR Review Types — Popular Reporting Award review result shapes.
 *
 * Includes both TypeScript interfaces and Zod schemas for runtime validation.
 */

import { z } from "zod";

// ─── PAFR Quality Review Types + Schema ──────────────────────────────────

export interface PafrScore {
  category: string;
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

export interface PafrRecommendation {
  section: string;
  priority: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
}

export interface PafrReviewResult {
  scores: PafrScore[];
  totalScore: number;
  passed: boolean;
  recommendations: PafrRecommendation[];
}

export const pafrReviewResultSchema = z.object({
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

// ─── Re-export shared ADA types (same schema as budget-book) ─────────────

export {
  adaReviewResultSchema,
  type AdaReviewResult,
  type AdaIssue,
} from "../budget-book/review-types.js";
