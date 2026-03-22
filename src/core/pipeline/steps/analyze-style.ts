/**
 * Pipeline step: Analyze prior document for style.
 *
 * If the document has a prior-year PDF and the doc type supports style analysis,
 * calls the doc type's analyzePriorDocument method and stores the result.
 *
 * Reads: pCtx.state.document (priorYearPdfS3Key)
 * Writes: pCtx.state.styleAnalysis
 */

import { eq } from "drizzle-orm";
import { documents } from "../../../db/schema.js";
import { updateBookStatus, updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

export const analyzeStyleStep: PipelineStep = {
  id: "analyze_prior_pdf",
  name: "Analyze Prior Document",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;
    const doc = state.document;

    await updateBookStatus(ctx.db, documentId, "analyzing");
    await updateJobStatus(
      ctx.db,
      documentId,
      "analyze_prior_pdf",
      "running",
      0,
      "Analyzing prior-year document..."
    );

    const priorPdfKey = doc?.priorYearPdfS3Key as string | null | undefined;

    if (priorPdfKey && docType.analyzePriorDocument) {
      state.styleAnalysis = await docType.analyzePriorDocument(
        ctx.ai,
        ctx.storage,
        ctx.tenantId,
        priorPdfKey
      );

      await ctx.db
        .update(documents)
        .set({
          styleAnalysis:
            state.styleAnalysis as unknown as Record<string, unknown>,
        })
        .where(eq(documents.id, documentId));
    }

    await updateJobStatus(
      ctx.db,
      documentId,
      "analyze_prior_pdf",
      "completed",
      100,
      "Style analysis complete"
    );

    return {
      status: priorPdfKey ? "completed" : "skipped",
      message: priorPdfKey ? "Style analysis complete" : "No prior document to analyze",
    };
  },
};
