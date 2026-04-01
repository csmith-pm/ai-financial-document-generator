/**
 * PAFR Reviewer Specs — Popular Reporting Award and ADA reviewer definitions.
 */

import type { ReviewerSpec, SectionOutput } from "../../core/doc-type.js";
import {
  pafrReviewResultSchema,
  adaReviewResultSchema,
  type PafrReviewResult,
  type PafrRecommendation,
  type AdaReviewResult,
  type AdaIssue,
} from "./review-types.js";

// ─── PAFR Quality Reviewer ──────────────────────────────────────────────

export const PAFR_QUALITY_REVIEWER: ReviewerSpec = {
  id: "pafr_quality",
  agentType: "pafr_reviewer",
  resultSchema: pafrReviewResultSchema,

  buildReviewPrompt(sections: SectionOutput[]): string {
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

    return `Review this Popular Annual Financial Report with ${sections.length} sections.\n\nSection content:\n${JSON.stringify(condensed, null, 2)}\n\nScore against PAFR quality criteria. Output format:\n{\n  "scores": [{"category": "...", "maxPoints": N, "awardedPoints": N, "feedback": "..."}],\n  "totalScore": N,\n  "passed": true/false,\n  "recommendations": [{"section": "...", "priority": "high|medium|low", "issue": "...", "suggestion": "..."}]\n}`;
  },

  isPassed(result: unknown): boolean {
    return (result as PafrReviewResult).passed;
  },

  getScore(result: unknown): number | null {
    return (result as PafrReviewResult).totalScore;
  },

  getRecommendations(result: unknown): Record<string, unknown>[] {
    return (result as PafrReviewResult).recommendations as unknown as Record<string, unknown>[];
  },

  getFeedbackForSection(result: unknown, sectionType: string): string[] {
    const pafrResult = result as PafrReviewResult;
    return pafrResult.recommendations
      .filter((r: PafrRecommendation) => r.section === sectionType)
      .map(
        (r: PafrRecommendation) =>
          `[${r.priority}] ${r.issue}: ${r.suggestion}`
      );
  },
};

// ─── ADA Reviewer (PAFR-specific prompts) ───────────────────────────────

export const PAFR_ADA_REVIEWER: ReviewerSpec = {
  id: "ada",
  agentType: "ada_reviewer",
  resultSchema: adaReviewResultSchema,

  buildReviewPrompt(sections: SectionOutput[]): string {
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

    return `Check accessibility (WCAG 2.1 AA) for this Popular Annual Financial Report with ${sections.length} sections.\n\nPAFRs often include infographics and visual elements — pay special attention to alt text for visual content.\n\nSection content:\n${JSON.stringify(condensed, null, 2)}\n\nOutput format:\n{\n  "pdfIssues": [{"rule": "WCAG X.X.X Name", "severity": "critical|major|minor", "location": "...", "description": "...", "fix": "..."}],\n  "webIssues": [{"rule": "WCAG X.X.X Name", "severity": "critical|major|minor", "location": "...", "description": "...", "fix": "..."}],\n  "passed": true/false\n}`;
  },

  isPassed(result: unknown): boolean {
    return (result as AdaReviewResult).passed;
  },

  getScore(_result: unknown): number | null {
    return null; // ADA reviews are pass/fail
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

export const PAFR_REVIEWERS: ReviewerSpec[] = [
  PAFR_QUALITY_REVIEWER,
  PAFR_ADA_REVIEWER,
];
