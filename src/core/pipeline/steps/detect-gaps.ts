/**
 * Pipeline step: Detect data gaps and create todos.
 *
 * Non-blocking — gaps create todos but generation continues with available data.
 *
 * Reads: pCtx.state.documentData
 * Writes: nothing in state (DB side-effect: creates todos)
 */

import type { PipelineStep, PipelineContext, StepResult } from "../types.js";
import { createTodosFromDataGaps } from "../../todos/creator.js";

export const detectGapsStep: PipelineStep = {
  id: "detect_gaps",
  name: "Detect Data Gaps",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;

    const dataGaps = docType.detectDataGaps(state.documentData);

    if (dataGaps.length > 0) {
      await createTodosFromDataGaps(
        ctx.db,
        documentId,
        ctx.tenantId,
        dataGaps
      );
      console.log(
        `[pipeline] Created ${dataGaps.length} data gap todo(s) — continuing generation with available data`
      );
    }

    return {
      status: dataGaps.length > 0 ? "completed" : "skipped",
      message:
        dataGaps.length > 0
          ? `${dataGaps.length} data gap(s) detected`
          : "No data gaps found",
    };
  },
};
