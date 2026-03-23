/**
 * Pipeline executor — runs a list of PipelineSteps sequentially.
 *
 * Handles:
 * - Sequential execution in order
 * - Job status updates (maps step IDs to job rows)
 * - Error handling (marks failed jobs, sets document status to "failed")
 * - Logging of step completion
 */

import { eq, and } from "drizzle-orm";
import {
  documents,
  documentJobs,
  documentStatusEnum,
} from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { EngineContext } from "../context.js";
import type { DocumentTypeDefinition, SectionOutput } from "../doc-type.js";
import type { PipelineStep, PipelineContext, PipelineState } from "./types.js";

// ─── Status Helpers ──────────────────────────────────────────────────────

type BookStatus = (typeof documentStatusEnum.enumValues)[number];

export async function updateBookStatus(
  db: DrizzleInstance,
  documentId: string,
  status: BookStatus
): Promise<void> {
  await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

export async function updateJobStatus(
  db: DrizzleInstance,
  documentId: string,
  jobType: string,
  status: string,
  progress: number,
  message: string,
  error?: string
): Promise<void> {
  const now = new Date();
  const startedAt = status === "running" && progress === 0 ? now : null;
  const completedAt =
    status === "completed" || status === "failed" ? now : null;

  const setFields: Record<string, unknown> = {
    status,
    progress,
    message,
    error: error ?? null,
  };
  if (startedAt) setFields.startedAt = startedAt;
  if (completedAt) setFields.completedAt = completedAt;

  await db
    .update(documentJobs)
    .set(setFields)
    .where(
      and(
        eq(documentJobs.documentId, documentId),
        eq(documentJobs.jobType, jobType)
      )
    );
}

// ─── Pipeline State Factory ──────────────────────────────────────────────

export function createInitialState(overrides?: Partial<PipelineState>): PipelineState {
  return {
    document: null,
    styleAnalysis: null,
    documentIndex: null,
    priorContent: new Map(),
    effectiveSections: [],
    documentData: null,
    sections: [],
    fiscalYear: new Date().getFullYear(),
    reviewResults: new Map(),
    iteration: 0,
    maxIterations: 3,
    previousScores: new Map(),
    ...overrides,
  };
}

// ─── Pipeline Executor ───────────────────────────────────────────────────

/**
 * Runs a list of pipeline steps sequentially.
 *
 * Each step receives the shared PipelineContext. If a step throws,
 * the document status is set to "failed" and any running jobs are
 * marked as failed.
 */
export async function runPipeline(
  ctx: EngineContext,
  docType: DocumentTypeDefinition,
  documentId: string,
  steps: PipelineStep[],
  initialState?: Partial<PipelineState>
): Promise<void> {
  const pCtx: PipelineContext = {
    ctx,
    docType,
    documentId,
    state: createInitialState(initialState),
  };

  try {
    for (const step of steps) {
      // Auto-mark step as running
      await updateJobStatus(ctx.db, documentId, step.id, "running", 0, `Running ${step.name}...`);

      const result = await step.execute(pCtx);

      // Auto-mark step as completed (steps may have already updated progress internally)
      const msg = result.message ?? (result.status === "skipped" ? "Skipped" : `${step.name} complete`);
      await updateJobStatus(ctx.db, documentId, step.id, "completed", 100, msg);

      if (result.status === "skipped") {
        console.log(
          `[pipeline] Step "${step.id}" skipped: ${result.message ?? "no reason given"}`
        );
      }
    }
  } catch (error) {
    const cause = error instanceof Error && error.cause
      ? ` | Cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`
      : "";
    const message =
      (error instanceof Error ? error.message : "Unknown error") + cause;

    // Set document status to failed
    await updateBookStatus(pCtx.ctx.db, documentId, "failed");

    // Mark any running jobs as failed
    await pCtx.ctx.db
      .update(documentJobs)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(documentJobs.documentId, documentId),
          eq(documentJobs.status, "running")
        )
      );

    throw error;
  }
}
