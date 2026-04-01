/**
 * Pipeline step: Extract content from prior document sections.
 *
 * Uses the DocumentIndex (from index-prior-document step) to extract
 * narrative, tables, and chart descriptions from each section of the
 * prior-year PDF. Skipped if no index or the doc type doesn't implement
 * extractPriorContent().
 *
 * Reads: pCtx.state.document (priorYearPdfS3Key), pCtx.state.documentIndex
 * Writes: pCtx.state.priorContent
 */

import { updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

export const extractPriorContentStep: PipelineStep = {
  id: "extract_prior_content",
  name: "Extract Prior Content",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;
    const doc = state.document;
    const priorPdfKey = doc?.priorYearPdfS3Key as string | null | undefined;

    if (!priorPdfKey || !state.documentIndex || !docType.extractPriorContent) {
      await updateJobStatus(
        ctx.db, documentId, "extract_prior_content",
        "completed", 100, "Skipped — no index or extractor not available"
      );
      return { status: "skipped", message: "No prior content to extract" };
    }

    await updateJobStatus(
      ctx.db, documentId, "extract_prior_content",
      "running", 0, "Extracting content from prior document sections..."
    );

    state.priorContent = await docType.extractPriorContent(
      ctx.ai, ctx.storage, ctx.tenantId, priorPdfKey, state.documentIndex
    );

    await updateJobStatus(
      ctx.db, documentId, "extract_prior_content",
      "completed", 100,
      `Extracted content from ${state.priorContent.size} sections`
    );

    return {
      status: "completed",
      message: `${state.priorContent.size} sections extracted`,
    };
  },
};
