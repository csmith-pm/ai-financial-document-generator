/**
 * DocumentTypeDefinition — generic interface that every document type
 * (budget book, ACFR, PAFR, etc.) must implement.
 *
 * The engine core is document-type-agnostic. All doc-type-specific
 * behaviour is provided through this interface.
 */

import type { ZodSchema, ZodType } from "zod";
import type { AiProvider, StorageProvider } from "./providers.js";
import type { StyleAnalysis, DocumentIndex, PriorSectionContent } from "./types.js";
import type { ChartConfig } from "./chartTypes.js";

// ─── Supporting Types ──────────────────────────────────────────────────────

export interface SectionTypeSpec {
  id: string;
  name: string;
  order: number;
  /** Can be generated concurrently with other parallel sections */
  parallel: boolean;
  /** Structural sections (cover, toc) generated after content sections */
  structural: boolean;
}

export interface SectionOutput {
  sectionType: string;
  title: string;
  narrativeContent: string;
  tableData: Record<string, unknown>[];
  chartConfigs: ChartConfig[];
}

export interface GenericAgentDefinition {
  name: string;
  type: string;
  role: string;
  baseSystemPrompt: string;
  skillDomain: string[];
  producesSkillsFor: string[];
  temperature: number;
  maxTokens: number;
}

export interface ReviewerSpec {
  /** Unique reviewer identifier, e.g. "gfoa", "ada" */
  id: string;
  /** Agent type used for this reviewer, e.g. "bb_reviewer", "ada_reviewer" */
  agentType: string;

  /** Build the user prompt for this reviewer given generated sections */
  buildReviewPrompt(sections: SectionOutput[]): string;

  /** Zod schema to validate the AI's review response */
  resultSchema: ZodType;

  /** Determine if the review result indicates a pass */
  isPassed(result: unknown): boolean;

  /** Extract a numeric score from the result, or null if not scored */
  getScore(result: unknown): number | null;

  /** Extract recommendations as generic records for DB storage */
  getRecommendations(result: unknown): Record<string, unknown>[];

  /** Extract feedback strings for a specific section from the review result */
  getFeedbackForSection(result: unknown, sectionType: string): string[];
}

export interface SeedSkill {
  agentType: string;
  skill: string;
  category: string;
  trigger: string;
  confidence: number;
}

export interface DetectedGap {
  category: "data_gap" | "clarification";
  title: string;
  description: string;
  sectionType: string | null;
  priority: "high" | "medium" | "low";
}

// ─── DocumentTypeDefinition ────────────────────────────────────────────────

export interface DocumentTypeDefinition<TData = unknown> {
  /** Unique identifier, e.g. "budget_book", "acfr", "pafr" */
  id: string;
  /** Human-readable display name */
  name: string;
  version: string;

  // ── Data ──────────────────────────────────────────────────────────────

  /** Zod schema for runtime validation of document data */
  dataSchema: ZodSchema<TData>;

  /** Parse an uploaded file (e.g. Excel) into structured document data */
  parseUpload?(
    ai: AiProvider,
    buffer: Buffer,
    params: Record<string, unknown>
  ): Promise<TData>;

  // ── Sections ──────────────────────────────────────────────────────────

  sectionTypes: SectionTypeSpec[];
  getSectionData(sectionType: string, data: TData): Record<string, unknown>;
  getSectionPrompt(
    sectionType: string,
    data: TData,
    style: StyleAnalysis | null,
    priorContent?: PriorSectionContent | null
  ): string;

  // ── Agents ────────────────────────────────────────────────────────────

  agents: GenericAgentDefinition[];
  getAgent(type: string): GenericAgentDefinition;

  // ── Reviews ───────────────────────────────────────────────────────────

  reviewers: ReviewerSpec[];

  // ── Skills ────────────────────────────────────────────────────────────

  seedSkills: SeedSkill[];
  categoryPriority: Record<string, number>;

  // ── Data Gaps ─────────────────────────────────────────────────────────

  detectDataGaps(data: TData): DetectedGap[];

  // ── Advisors ──────────────────────────────────────────────────────────

  /** Agent type used for content generation */
  creatorAgentType: string;

  /** Agent type used for conversational todo chat */
  advisorAgentType: string;

  // ── Iteration Control ───────────────────────────────────────────────

  /** S3 path prefix for this doc type's artifacts, e.g. "budget-books" */
  storagePrefix: string;

  /**
   * Build the revision prompt for a section given reviewer feedback.
   * Returns the system prompt suffix and user prompt for the revision call.
   */
  buildRevisionPrompt?(
    section: SectionOutput,
    feedbackByReviewer: Map<string, string[]>,
    data: unknown,
    style: StyleAnalysis | null
  ): { systemPromptSuffix: string; userPrompt: string };

  /**
   * Determine if the review-revise iteration loop should continue.
   * Called after each review round.
   * Returns true to continue iterating, false to stop.
   * If not implemented, defaults to: stop when all reviewers pass.
   */
  shouldContinueIterating?(
    results: Map<string, { passed: boolean; score: number | null }>,
    iteration: number,
    previousScores: Map<string, number | null>
  ): boolean;

  // ── Skill Extraction ────────────────────────────────────────────────

  /**
   * Extract skills from a review result. Called after each review round.
   * If not implemented, skill extraction is skipped for this doc type.
   */
  extractSkillsFromReview?(
    db: import("../db/connection.js").DrizzleInstance,
    ai: AiProvider,
    tenantId: string,
    reviewerSpec: ReviewerSpec,
    result: unknown,
    reviewId: string
  ): Promise<void>;

  /**
   * Create todos from a review result. Called on the first iteration only.
   * If not implemented, no review-based todos are created.
   */
  createTodosFromReview?(
    db: import("../db/connection.js").DrizzleInstance,
    documentId: string,
    tenantId: string,
    reviewerSpec: ReviewerSpec,
    result: unknown,
    reviewId: string
  ): Promise<void>;

  // ── Rendering ─────────────────────────────────────────────────────────

  renderPdf?(
    sections: SectionOutput[],
    data: TData,
    style: StyleAnalysis | null,
    charts: Map<string, Buffer[]>
  ): Promise<Buffer>;

  analyzePriorDocument?(
    ai: AiProvider,
    storage: StorageProvider,
    tenantId: string,
    s3Key: string
  ): Promise<StyleAnalysis>;

  // ── Prior Document Deep Analysis ─────────────────────────────────────

  /**
   * Index the prior document's table of contents and section structure.
   * Returns a structured map of sections with page ranges.
   */
  indexPriorDocument?(
    ai: AiProvider,
    storage: StorageProvider,
    tenantId: string,
    s3Key: string
  ): Promise<DocumentIndex>;

  /**
   * Extract content from each section of the prior document.
   * Runs per-section using the page ranges from the DocumentIndex.
   */
  extractPriorContent?(
    ai: AiProvider,
    storage: StorageProvider,
    tenantId: string,
    s3Key: string,
    index: DocumentIndex
  ): Promise<Map<string, PriorSectionContent>>;
}
