/**
 * DocumentTypeDefinition — generic interface that every document type
 * (budget book, ACFR, PAFR, etc.) must implement.
 *
 * The engine core is document-type-agnostic. All doc-type-specific
 * behaviour is provided through this interface.
 */

import type { ZodSchema } from "zod";
import type { AiProvider, StorageProvider } from "./providers.js";
import type { StyleAnalysis } from "./types.js";
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
  id: string;
  agentType: string;
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
    style: StyleAnalysis | null
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

  /** Agent type used for conversational todo chat */
  advisorAgentType: string;

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
}
