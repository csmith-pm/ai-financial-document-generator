/**
 * Pipeline step: Review and iterate.
 *
 * Runs all reviewers in parallel, extracts skills, creates todos on first
 * iteration, then checks termination conditions. If not done, revises
 * sections and re-renders charts before looping.
 *
 * The internal logic is decomposed into clearly named helper functions
 * that are exported for independent testing.
 *
 * Reads: pCtx.state.sections, pCtx.state.documentData, pCtx.state.styleAnalysis
 * Writes: pCtx.state.sections (updated by revision), pCtx.state.reviewResults
 */

import { eq, and } from "drizzle-orm";
import {
  documents,
  documentReviews,
  documentSections,
} from "../../../db/schema.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";
import type {
  DocumentTypeDefinition,
  ReviewerSpec,
  SectionOutput,
} from "../../doc-type.js";
import { buildAgentPrompt } from "../../agents/index.js";
import { updateBookStatus, updateJobStatus } from "../executor.js";
import {
  extractSkillsFromGfoaReview,
  extractSkillsFromAdaReview,
} from "../../skills/extractor.js";
import { createTodosFromGfoaReview } from "../../todos/creator.js";
import type { GfoaReviewResult, AdaReviewResult } from "../../../doc-types/budget-book/review-types.js";
import { renderAndUploadCharts } from "./render-charts.js";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ReviewRunResult {
  reviewerSpec: ReviewerSpec;
  result: unknown;
}

export interface ReviewRow {
  id: string;
  reviewerSpec: ReviewerSpec;
  result: unknown;
}

// ─── Helper: Run all reviewers in parallel ───────────────────────────────

export async function runAllReviewers(
  pCtx: PipelineContext,
  sections: SectionOutput[]
): Promise<ReviewRunResult[]> {
  const { ctx, docType } = pCtx;

  const reviewPromises = docType.reviewers.map(async (spec) => {
    const systemPrompt = await buildAgentPrompt(
      ctx.db,
      spec.agentType,
      ctx.tenantId
    );
    const definition = docType.getAgent(spec.agentType);
    const userPrompt = spec.buildReviewPrompt(sections);

    const aiResult = await ctx.ai.callJson(systemPrompt, userPrompt, {
      maxTokens: definition.maxTokens,
      temperature: definition.temperature,
    });

    await ctx.ai.logUsage?.(
      ctx.tenantId,
      spec.agentType,
      aiResult.inputTokens,
      aiResult.outputTokens,
      aiResult.model
    );

    return { reviewerSpec: spec, result: aiResult.data };
  });

  return Promise.all(reviewPromises);
}

// ─── Helper: Save review results to DB ───────────────────────────────────

export async function saveReviewResults(
  pCtx: PipelineContext,
  results: ReviewRunResult[],
  iteration: number
): Promise<ReviewRow[]> {
  const rows: ReviewRow[] = [];

  for (const { reviewerSpec, result } of results) {
    const score = reviewerSpec.getScore(result);
    const passed = reviewerSpec.isPassed(result);
    const recommendations = reviewerSpec.getRecommendations(result);

    const [row] = await pCtx.ctx.db
      .insert(documentReviews)
      .values({
        documentId: pCtx.documentId,
        tenantId: pCtx.ctx.tenantId,
        reviewerType: reviewerSpec.id,
        iteration,
        overallScore: score != null ? String(score) : null,
        passed,
        report: result as unknown as Record<string, unknown>,
        recommendations,
      })
      .returning({ id: documentReviews.id });

    const statusMessage = score != null
      ? `${reviewerSpec.id.toUpperCase()} score: ${score} — ${passed ? "PASSED" : "needs improvement"}`
      : `${reviewerSpec.id.toUpperCase()}: ${passed ? "PASSED" : "issues found"}`;

    await updateJobStatus(
      pCtx.ctx.db,
      pCtx.documentId,
      `${reviewerSpec.id}_review`,
      "completed",
      100,
      statusMessage
    );

    rows.push({ id: row!.id, reviewerSpec, result });
  }

  return rows;
}

// ─── Helper: Extract skills from review results ─────────────────────────

export async function extractSkillsFromResults(
  pCtx: PipelineContext,
  reviewRows: ReviewRow[]
): Promise<void> {
  try {
    for (const row of reviewRows) {
      // Dispatch to the correct extraction function based on reviewer ID
      if (row.reviewerSpec.id === "gfoa") {
        await extractSkillsFromGfoaReview(
          pCtx.ctx.db,
          pCtx.ctx.ai,
          pCtx.ctx.tenantId,
          row.result as GfoaReviewResult,
          row.id
        );
      } else if (row.reviewerSpec.id === "ada") {
        await extractSkillsFromAdaReview(
          pCtx.ctx.db,
          pCtx.ctx.ai,
          pCtx.ctx.tenantId,
          row.result as AdaReviewResult,
          row.id
        );
      }
    }
  } catch (skillErr) {
    console.warn(
      "[pipeline] Skill extraction failed (non-fatal):",
      skillErr
    );
  }
}

// ─── Helper: Create todos from first iteration reviews ───────────────────

export async function createFirstIterationTodos(
  pCtx: PipelineContext,
  reviewRows: ReviewRow[]
): Promise<void> {
  for (const row of reviewRows) {
    if (row.reviewerSpec.id === "gfoa") {
      const recs = row.reviewerSpec.getRecommendations(row.result);
      if (recs.length > 0) {
        await createTodosFromGfoaReview(
          pCtx.ctx.db,
          pCtx.documentId,
          pCtx.ctx.tenantId,
          row.result as GfoaReviewResult,
          row.id
        );
      }
    }
  }
}

// ─── Helper: Check termination conditions ────────────────────────────────

export function checkTermination(
  docType: DocumentTypeDefinition,
  results: ReviewRunResult[],
  iteration: number,
  maxIterations: number,
  previousScores: Map<string, number | null>
): { shouldStop: boolean; reason?: string } {
  // Build results map for the doc type
  const resultsMap = new Map<string, { passed: boolean; score: number | null }>();
  for (const { reviewerSpec, result } of results) {
    resultsMap.set(reviewerSpec.id, {
      passed: reviewerSpec.isPassed(result),
      score: reviewerSpec.getScore(result),
    });
  }

  // Check if all pass
  const allPassed = [...resultsMap.values()].every((r) => r.passed);
  if (allPassed) {
    return { shouldStop: true, reason: "All reviewers passed" };
  }

  // Don't revise on the last iteration
  if (iteration >= maxIterations) {
    return { shouldStop: true, reason: "Max iterations reached" };
  }

  // Use doc type's custom termination logic if available
  if (docType.shouldContinueIterating) {
    const shouldContinue = docType.shouldContinueIterating(
      resultsMap,
      iteration,
      previousScores
    );
    if (!shouldContinue) {
      return { shouldStop: true, reason: "Doc type termination condition met" };
    }
  }

  return { shouldStop: false };
}

// ─── Helper: Revise sections from feedback ───────────────────────────────

export async function reviseSectionsFromFeedback(
  pCtx: PipelineContext,
  results: ReviewRunResult[]
): Promise<SectionOutput[]> {
  const { ctx, docType, state } = pCtx;
  const revisedSections: SectionOutput[] = [];

  for (const section of state.sections) {
    // Gather feedback from all reviewers for this section
    const feedbackByReviewer = new Map<string, string[]>();
    let hasFeedback = false;

    for (const { reviewerSpec, result } of results) {
      const feedback = reviewerSpec.getFeedbackForSection(
        result,
        section.sectionType
      );
      feedbackByReviewer.set(reviewerSpec.id, feedback);
      if (feedback.length > 0) hasFeedback = true;
    }

    if (hasFeedback && docType.buildRevisionPrompt) {
      const { systemPromptSuffix, userPrompt } = docType.buildRevisionPrompt(
        section,
        feedbackByReviewer,
        state.documentData,
        state.styleAnalysis
      );

      const creatorAgent = docType.getAgent("bb_creator");
      const basePrompt = await buildAgentPrompt(
        ctx.db,
        "bb_creator",
        ctx.tenantId
      );

      const aiResult = await ctx.ai.callJson<SectionOutput>(
        `${basePrompt}${systemPromptSuffix}`,
        userPrompt,
        { maxTokens: creatorAgent.maxTokens, temperature: 0.3 }
      );

      await ctx.ai.logUsage?.(
        ctx.tenantId,
        `bb_creator_revise_${section.sectionType}`,
        aiResult.inputTokens,
        aiResult.outputTokens,
        aiResult.model
      );

      revisedSections.push(aiResult.data);
    } else {
      revisedSections.push(section);
    }
  }

  return revisedSections;
}

// ─── Helper: Re-render charts after revision ─────────────────────────────

export async function reRenderRevisedCharts(
  pCtx: PipelineContext,
  revisedSections: SectionOutput[],
  iteration: number
): Promise<void> {
  const { ctx, docType, documentId } = pCtx;

  for (const section of revisedSections) {
    const s3Keys = await renderAndUploadCharts(
      ctx,
      section,
      documentId,
      docType.storagePrefix,
      `-rev${iteration}`
    );

    await ctx.db
      .update(documentSections)
      .set({
        narrativeContent: section.narrativeContent,
        tableData: section.tableData,
        chartConfigs:
          section.chartConfigs as unknown as Record<string, unknown>[],
        chartImageS3Keys: s3Keys,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentSections.documentId, documentId),
          eq(documentSections.sectionType, section.sectionType)
        )
      );
  }
}

// ─── Pipeline Step ───────────────────────────────────────────────────────

export const reviewAndIterateStep: PipelineStep = {
  id: "review_and_iterate",
  name: "Review and Iterate",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;

    await updateBookStatus(ctx.db, documentId, "reviewing");

    let iteration = 0;
    const maxIterations = state.maxIterations;

    while (iteration < maxIterations) {
      iteration++;
      state.iteration = iteration;

      await ctx.db
        .update(documents)
        .set({ currentIteration: iteration })
        .where(eq(documents.id, documentId));

      // Start review jobs
      for (const reviewer of docType.reviewers) {
        await updateJobStatus(
          ctx.db,
          documentId,
          `${reviewer.id}_review`,
          "running",
          0,
          `${reviewer.id.toUpperCase()} review — iteration ${iteration}...`
        );
      }

      // Run all reviewers in parallel
      const results = await runAllReviewers(pCtx, state.sections);

      // Save results to DB
      const reviewRows = await saveReviewResults(pCtx, results, iteration);

      // Store in pipeline state
      for (const { reviewerSpec, result } of results) {
        state.reviewResults.set(reviewerSpec.id, result);
      }

      // Extract skills (non-fatal)
      await extractSkillsFromResults(pCtx, reviewRows);

      // Create todos on first iteration
      if (iteration === 1) {
        await createFirstIterationTodos(pCtx, reviewRows);
      }

      // Check termination
      const termination = checkTermination(
        docType,
        results,
        iteration,
        maxIterations,
        state.previousScores
      );

      // Update previous scores before checking termination
      for (const { reviewerSpec, result } of results) {
        state.previousScores.set(
          reviewerSpec.id,
          reviewerSpec.getScore(result)
        );
      }

      if (termination.shouldStop) {
        return {
          status: "completed",
          message: `${termination.reason} after ${iteration} iteration(s)`,
        };
      }

      // Revise sections
      await updateBookStatus(ctx.db, documentId, "revision");
      await updateJobStatus(
        ctx.db,
        documentId,
        "revise_sections",
        "running",
        0,
        `Revising sections — iteration ${iteration}...`
      );

      const revisedSections = await reviseSectionsFromFeedback(pCtx, results);
      state.sections = revisedSections;

      // Re-render charts for revised sections
      await reRenderRevisedCharts(pCtx, revisedSections, iteration);

      await updateJobStatus(
        ctx.db,
        documentId,
        "revise_sections",
        "completed",
        100,
        "Revisions applied"
      );
    }

    return {
      status: "completed",
      message: `Review loop completed after ${iteration} iteration(s)`,
    };
  },
};
