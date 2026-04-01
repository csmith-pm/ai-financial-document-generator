/**
 * Pipeline step: Index prior document structure.
 *
 * Reads the prior-year PDF's table of contents and section breaks to build
 * a structured DocumentIndex. Skipped if no prior PDF or the doc type
 * doesn't implement indexPriorDocument().
 *
 * Reads: pCtx.state.document (priorYearPdfS3Key)
 * Writes: pCtx.state.documentIndex
 */

import { updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

export const indexPriorDocumentStep: PipelineStep = {
  id: "index_prior_document",
  name: "Index Prior Document",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;
    const doc = state.document;
    const priorPdfKey = doc?.priorYearPdfS3Key as string | null | undefined;

    if (!priorPdfKey || !docType.indexPriorDocument) {
      await updateJobStatus(
        ctx.db, documentId, "index_prior_document",
        "completed", 100, "Skipped — no prior document or indexer not available"
      );
      return { status: "skipped", message: "No prior document to index" };
    }

    await updateJobStatus(
      ctx.db, documentId, "index_prior_document",
      "running", 0, "Reading prior document structure..."
    );

    state.documentIndex = await docType.indexPriorDocument(
      ctx.ai, ctx.storage, ctx.tenantId, priorPdfKey
    );

    await updateJobStatus(
      ctx.db, documentId, "index_prior_document",
      "completed", 100,
      `Indexed ${state.documentIndex.sections.length} sections`
    );

    return {
      status: "completed",
      message: `${state.documentIndex.sections.length} sections indexed`,
    };
  },
};
