/**
 * Budget Book Skill Extraction Prompts — GFOA and ADA-specific
 * user prompts for skill extraction from reviews.
 *
 * Extracted from src/core/skills/extractor.ts.
 */

import type { GfoaReviewResult, AdaReviewResult } from "./review-types.js";

/**
 * Build the user prompt for extracting skills from a GFOA review.
 */
export function buildGfoaExtractionPrompt(review: GfoaReviewResult): string {
  return `GFOA Review Results:
- Total Score: ${review.totalScore}/180 (${review.passed ? "PASSED" : "NOT PASSED"})
- Low-scoring categories: ${review.scores.filter((s) => s.awardedPoints < s.maxPoints * 0.6).map((s) => `${s.category}: ${s.awardedPoints}/${s.maxPoints} — ${s.feedback}`).join("\n  ")}
- Recommendations (${review.recommendations.length} total):
${review.recommendations.map((r) => `  [${r.priority}] ${r.section}: ${r.issue} → ${r.suggestion}`).join("\n")}

Extract learnings that would help the BB_Creator agent produce higher-scoring content next time. Also extract any self-improvement learnings for the BB_Reviewer itself (e.g., criteria it should check more carefully).`;
}

/**
 * Build the user prompt for extracting skills from an ADA review.
 */
export function buildAdaExtractionPrompt(review: AdaReviewResult): string {
  return `ADA/WCAG 2.1 AA Review Results:
- Passed: ${review.passed}
- PDF Issues (${review.pdfIssues.length}):
${review.pdfIssues.map((i) => `  [${i.severity}] ${i.rule}: ${i.description} → ${i.fix}`).join("\n")}
- Web Issues (${review.webIssues.length}):
${review.webIssues.map((i) => `  [${i.severity}] ${i.rule}: ${i.description} → ${i.fix}`).join("\n")}

Extract learnings that would help the BB_Creator agent produce more accessible content. Also extract self-improvement learnings for the ADA_Reviewer (patterns to check more carefully).`;
}
