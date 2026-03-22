/**
 * Pipeline step: Fetch document data.
 *
 * Loads structured data for the document, either from an uploaded file
 * (parsed via docType.parseUpload) or from the data provider.
 *
 * Reads: pCtx.state.document (dataSource, uploadedDataS3Key, worksheetId)
 * Writes: pCtx.state.documentData
 */

import { updateBookStatus, updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

export const fetchDataStep: PipelineStep = {
  id: "fetch_data",
  name: "Fetch Document Data",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;
    const doc = state.document;

    await updateBookStatus(ctx.db, documentId, "generating");
    await updateJobStatus(
      ctx.db,
      documentId,
      "generate_sections",
      "running",
      0,
      "Fetching document data..."
    );

    const dataSource = doc?.dataSource as string | undefined;
    const uploadedKey = doc?.uploadedDataS3Key as string | null | undefined;
    const worksheetId = doc?.worksheetId as string | null | undefined;

    if (dataSource === "upload" && uploadedKey && docType.parseUpload) {
      const buffer = await ctx.storage.getObject(uploadedKey);
      state.documentData = await docType.parseUpload(ctx.ai, buffer, {
        fiscalYear: state.fiscalYear,
      });
    } else if (worksheetId) {
      state.documentData = await ctx.data.getBudgetData(
        ctx.tenantId,
        worksheetId,
        state.fiscalYear
      );
    } else {
      throw new Error(
        "Document has no data source: no worksheet and no uploaded file"
      );
    }

    return { status: "completed", message: "Document data loaded" };
  },
};
