/**
 * Pipeline types — generic interfaces for the document generation pipeline.
 *
 * The pipeline is a sequential list of steps. Each step receives a shared
 * PipelineContext that carries engine context, the document type definition,
 * and mutable state for inter-step communication.
 */

import type { EngineContext } from "../context.js";
import type { DocumentTypeDefinition, SectionOutput, SectionTypeSpec } from "../doc-type.js";
import type { StyleAnalysis, DocumentIndex, PriorSectionContent } from "../types.js";

// ─── Pipeline State ──────────────────────────────────────────────────────

/**
 * Mutable shared state bag passed between pipeline steps.
 * Each step documents which fields it reads and writes.
 */
export interface PipelineState {
  /** The loaded document record from the database (set by executor before steps run) */
  document: Record<string, unknown> | null;
  /** Style analysis from prior document (set by analyze-style step) */
  styleAnalysis: StyleAnalysis | null;
  /** Structured index of prior document sections (set by index-prior-document step) */
  documentIndex: DocumentIndex | null;
  /** Extracted content from prior document sections, keyed by sectionType (set by extract-prior-content step) */
  priorContent: Map<string, PriorSectionContent>;
  /** Effective section list — merged from doc type + prior PDF index (set by merge-section-list step) */
  effectiveSections: SectionTypeSpec[];
  /** Parsed document data matching the doc type's schema (set by fetch-data step) */
  documentData: unknown;
  /** Generated sections (set by generate-sections, updated by revise) */
  sections: SectionOutput[];
  /** Fiscal year for the document */
  fiscalYear: number;
  /** Review results keyed by reviewer ID (set by review-and-iterate step) */
  reviewResults: Map<string, unknown>;
  /** Current review iteration (managed by review-and-iterate step) */
  iteration: number;
  /** Max iterations for the review loop */
  maxIterations: number;
  /** Previous scores keyed by reviewer ID (managed by review-and-iterate step) */
  previousScores: Map<string, number | null>;
}

// ─── Pipeline Context ────────────────────────────────────────────────────

/**
 * Full context passed to each pipeline step.
 */
export interface PipelineContext {
  /** Engine-level context (db, ai, storage, data, tenantId, config) */
  ctx: EngineContext;
  /** The document type definition for this document */
  docType: DocumentTypeDefinition;
  /** The database ID of the document being generated */
  documentId: string;
  /** Mutable state shared between steps */
  state: PipelineState;
}

// ─── Step Result ─────────────────────────────────────────────────────────

export interface StepResult {
  status: "completed" | "skipped";
  message?: string;
}

// ─── Pipeline Step ───────────────────────────────────────────────────────

export interface PipelineStep {
  /** Unique step identifier, e.g. "seed_skills", "generate_sections" */
  id: string;
  /** Human-readable display name for job tracking / logging */
  name: string;
  /** Execute the step. May read/write pCtx.state. */
  execute(pCtx: PipelineContext): Promise<StepResult>;
}
