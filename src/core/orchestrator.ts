/**
 * Document Generation Orchestrator.
 *
 * Generic entry point that loads a document, resolves its type from the
 * registry, and runs the default pipeline.
 *
 * The pipeline consists of these steps:
 * 1. Seed global skills (idempotent)
 * 2. Analyze prior document for style
 * 3. Fetch/parse document data
 * 4. Detect data gaps → create todos
 * 5. Generate sections (parallel/sequential/structural)
 * 6. Render charts + persist sections
 * 7. Review and iterate (loop with revision)
 * 8. Render final output (PDF)
 * 9. Finalize (set status based on open todos)
 *
 */

import { eq } from "drizzle-orm";
import {
  documents,
  documentSections,
  documentReviews,
  documentJobs,
} from "../db/schema.js";
import type { EngineContext } from "./context.js";
import { defaultRegistry } from "./doc-type-registry.js";
import { runPipeline, buildDefaultPipeline } from "./pipeline/index.js";

// ─── Generic Orchestration ───────────────────────────────────────────────

/**
 * Orchestrate document generation for any document type.
 *
 * Loads the document record, resolves its type from the registry,
 * then runs the default pipeline of steps.
 */
export async function orchestrateDocumentGeneration(
  ctx: EngineContext,
  documentId: string
): Promise<void> {
  // Load document record
  const [doc] = await ctx.db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  // Resolve document type from registry
  if (!doc.docType) {
    throw new Error(`Document ${documentId} has no docType set`);
  }
  const docType = defaultRegistry.get(doc.docType);
  const fiscalYear = doc.fiscalYear ?? new Date().getFullYear();

  // Run the default pipeline
  const pipeline = buildDefaultPipeline();
  await runPipeline(ctx, docType, documentId, pipeline, {
    document: doc as unknown as Record<string, unknown>,
    fiscalYear,
    maxIterations: doc.maxIterations ?? 3,
  });
}

// ─── Generic Resume ──────────────────────────────────────────────────────

/**
 * Resume document generation after user addresses todos.
 *
 * Cleans up previous generation artifacts and re-runs the full pipeline
 * with updated data and accumulated skills.
 */
export async function resumeDocumentGeneration(
  ctx: EngineContext,
  documentId: string
): Promise<void> {
  const [doc] = await ctx.db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  if (
    doc.status !== "completed" &&
    doc.status !== "completed_with_todos" &&
    doc.status !== "failed"
  ) {
    throw new Error(
      `Cannot regenerate document in status "${doc.status}"`
    );
  }

  // Clean up previous generation artifacts
  await ctx.db
    .delete(documentSections)
    .where(eq(documentSections.documentId, documentId));
  await ctx.db
    .delete(documentReviews)
    .where(eq(documentReviews.documentId, documentId));
  await ctx.db
    .delete(documentJobs)
    .where(eq(documentJobs.documentId, documentId));

  // Reset document state
  await ctx.db
    .update(documents)
    .set({
      status: "draft",
      currentIteration: 0,
      generatedPdfS3Key: null,
      webPreviewData: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  // Run full generation again (with updated data + accumulated skills)
  await orchestrateDocumentGeneration(ctx, documentId);
}
