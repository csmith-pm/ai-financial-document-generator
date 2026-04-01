/**
 * Pipeline step: Render final output (PDF).
 *
 * Queries persisted sections from DB, fetches chart images from storage,
 * then calls the doc type's renderPdf method to produce the final document.
 *
 * Reads: pCtx.state.sections, pCtx.state.documentData, pCtx.state.styleAnalysis
 * Writes: DB side-effect (updates document with PDF key and web preview)
 */

import { eq } from "drizzle-orm";
import { documents, documentSections } from "../../../db/schema.js";
import { updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

export const renderOutputStep: PipelineStep = {
  id: "render_pdf",
  name: "Render Output",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;

    await updateJobStatus(
      ctx.db,
      documentId,
      "render_pdf",
      "running",
      0,
      "Rendering final PDF..."
    );

    // Query sections from DB (authoritative, includes revision updates)
    const sectionRows = await ctx.db
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, documentId))
      .orderBy(documentSections.sectionOrder);

    // Fetch chart images from storage
    const chartImages: Map<string, Buffer[]> = new Map();
    for (const row of sectionRows) {
      const keys = (row.chartImageS3Keys as string[]) ?? [];
      if (keys.length > 0) {
        const buffers = await Promise.all(
          keys.map((k: string) => ctx.storage.getObject(k))
        );
        chartImages.set(row.sectionType, buffers);
      }
    }

    // Render via doc type
    const pdfBuffer = docType.renderPdf
      ? await docType.renderPdf(
          state.sections,
          state.documentData,
          state.styleAnalysis,
          chartImages
        )
      : Buffer.from("PDF rendering not supported for this document type");

    // Upload PDF
    const pdfKey = `${ctx.tenantId}/${docType.storagePrefix}/${documentId}/${docType.id}-fy${state.fiscalYear}.pdf`;
    await ctx.storage.upload(pdfKey, pdfBuffer, "application/pdf");

    // Build web preview data — include layoutSpec when available
    const webPreviewData: Record<string, unknown> = {
      sections: state.sections,
    };
    if (state.layoutSpec) {
      webPreviewData.layoutSpec = state.layoutSpec;
    }

    // Update document record
    await ctx.db
      .update(documents)
      .set({
        generatedPdfS3Key: pdfKey,
        webPreviewData,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    await updateJobStatus(
      ctx.db,
      documentId,
      "render_pdf",
      "completed",
      100,
      "PDF rendered and uploaded"
    );

    return { status: "completed", message: "Output rendered" };
  },
};
