/**
 * Pipeline step: Finalize document status.
 *
 * Checks for open todos and sets the final document status:
 * - "completed_with_todos" if there are unresolved action items
 * - "completed" if everything is resolved
 *
 * Reads: nothing from state
 * Writes: DB side-effect (updates document status)
 */

import { eq, and } from "drizzle-orm";
import { documentTodos } from "../../../db/schema.js";
import { updateBookStatus, updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

export const finalizeStep: PipelineStep = {
  id: "finalize",
  name: "Finalize",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, documentId } = pCtx;

    await updateJobStatus(
      ctx.db,
      documentId,
      "finalize",
      "running",
      0,
      "Finalizing..."
    );

    const openTodos = await ctx.db
      .select({ id: documentTodos.id })
      .from(documentTodos)
      .where(
        and(
          eq(documentTodos.documentId, documentId),
          eq(documentTodos.status, "open")
        )
      )
      .limit(1);

    const finalStatus =
      openTodos.length > 0 ? "completed_with_todos" : "completed";
    await updateBookStatus(ctx.db, documentId, finalStatus);

    const message =
      finalStatus === "completed_with_todos"
        ? "Document generated — action items need attention"
        : "Document generation complete";

    await updateJobStatus(
      ctx.db,
      documentId,
      "finalize",
      "completed",
      100,
      message
    );

    return { status: "completed", message };
  },
};
