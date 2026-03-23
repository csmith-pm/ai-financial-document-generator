/**
 * Budget Book Reviewer Specs — GFOA and ADA reviewer definitions.
 *
 * Each reviewer implements the full ReviewerSpec interface:
 * prompt construction, result parsing, feedback filtering, and pass logic.
 *
 * Logic moved from src/core/orchestrator.ts lines 141-202 and 635-652.
 */

import type { ReviewerSpec, SectionOutput } from "../../core/doc-type.js";
import {
  gfoaReviewResultSchema,
  adaReviewResultSchema,
  type GfoaReviewResult,
  type GfoaRecommendation,
  type AdaReviewResult,
  type AdaIssue,
} from "./review-types.js";

// ─── GFOA Reviewer ───────────────────────────────────────────────────────

export const GFOA_REVIEWER: ReviewerSpec = {
  id: "gfoa",
  agentType: "bb_reviewer",
  resultSchema: gfoaReviewResultSchema,

  buildReviewPrompt(sections: SectionOutput[]): string {
    // Send condensed per-section content to avoid payload size issues.
    // Each section includes full narrative (capped at 3000 chars), table
    // summary, and chart metadata — enough for meaningful scoring without
    // blowing up the request body.
    const condensed = sections.map((s) => ({
      type: s.sectionType,
      title: s.title,
      narrative: s.narrativeContent.length > 3000
        ? s.narrativeContent.substring(0, 3000) + "… [truncated]"
        : s.narrativeContent,
      tableRowCount: s.tableData.length,
      tableSample: s.tableData.slice(0, 3),
      chartCount: s.chartConfigs.length,
      chartTypes: s.chartConfigs.map((c) => c.type ?? "unknown"),
    }));

    return `Review this budget book with ${sections.length} sections.\n\nSection content:\n${JSON.stringify(condensed, null, 2)}\n\nScore against GFOA Distinguished Budget Presentation Award criteria. Output format:\n{\n  "scores": [{"category": "...", "maxPoints": N, "awardedPoints": N, "feedback": "..."}],\n  "totalScore": N,\n  "passed": true/false,\n  "recommendations": [{"section": "...", "priority": "high|medium|low", "issue": "...", "suggestion": "..."}]\n}`;
  },

  isPassed(result: unknown): boolean {
    return (result as GfoaReviewResult).passed;
  },

  getScore(result: unknown): number | null {
    return (result as GfoaReviewResult).totalScore;
  },

  getRecommendations(result: unknown): Record<string, unknown>[] {
    return (result as GfoaReviewResult).recommendations as unknown as Record<string, unknown>[];
  },

  getFeedbackForSection(result: unknown, sectionType: string): string[] {
    const gfoaResult = result as GfoaReviewResult;
    return gfoaResult.recommendations
      .filter((r: GfoaRecommendation) => r.section === sectionType)
      .map(
        (r: GfoaRecommendation) =>
          `[${r.priority}] ${r.issue}: ${r.suggestion}`
      );
  },
};

// ─── ADA Reviewer ────────────────────────────────────────────────────────

export const ADA_REVIEWER: ReviewerSpec = {
  id: "ada",
  agentType: "ada_reviewer",
  resultSchema: adaReviewResultSchema,

  buildReviewPrompt(sections: SectionOutput[]): string {
    // Condensed payload — full narrative per section (capped), chart alt-text
    // metadata, and table structure. Avoids oversized request bodies.
    const condensed = sections.map((s) => ({
      type: s.sectionType,
      title: s.title,
      narrative: s.narrativeContent.length > 3000
        ? s.narrativeContent.substring(0, 3000) + "… [truncated]"
        : s.narrativeContent,
      tableRowCount: s.tableData.length,
      hasTableHeaders: s.tableData.length > 0,
      chartCount: s.chartConfigs.length,
      charts: s.chartConfigs.map((c) => ({
        type: c.type,
        altText: (c as unknown as Record<string, unknown>).altText ?? null,
      })),
    }));

    return `Check accessibility (WCAG 2.1 AA) for this budget book with ${sections.length} sections:\n${JSON.stringify(condensed, null, 2)}\n\nOutput format:\n{\n  "pdfIssues": [{"rule": "WCAG X.X.X Name", "severity": "critical|major|minor", "location": "...", "description": "...", "fix": "..."}],\n  "webIssues": [{"rule": "WCAG X.X.X Name", "severity": "critical|major|minor", "location": "...", "description": "...", "fix": "..."}],\n  "passed": true/false\n}`;
  },

  isPassed(result: unknown): boolean {
    return (result as AdaReviewResult).passed;
  },

  getScore(_result: unknown): number | null {
    return null; // ADA reviews are pass/fail, no score
  },

  getRecommendations(result: unknown): Record<string, unknown>[] {
    const adaResult = result as AdaReviewResult;
    return [
      ...adaResult.pdfIssues,
      ...adaResult.webIssues,
    ] as unknown as Record<string, unknown>[];
  },

  getFeedbackForSection(result: unknown, sectionType: string): string[] {
    const adaResult = result as AdaReviewResult;
    const sectionLabel = sectionType.replace(/_/g, " ");
    return [
      ...adaResult.pdfIssues.filter((i: AdaIssue) =>
        i.location.toLowerCase().includes(sectionLabel)
      ),
      ...adaResult.webIssues.filter((i: AdaIssue) =>
        i.location.toLowerCase().includes(sectionLabel)
      ),
    ].map(
      (i: AdaIssue) =>
        `[${i.severity}] ${i.rule}: ${i.description} — Fix: ${i.fix}`
    );
  },
};

// ─── Exports ─────────────────────────────────────────────────────────────

export const BUDGET_BOOK_REVIEWERS: ReviewerSpec[] = [
  GFOA_REVIEWER,
  ADA_REVIEWER,
];
