/**
 * BudgetBookDocType — the DocumentTypeDefinition implementation
 * for municipal budget books.
 *
 * Assembles all budget-book-specific pieces into a single definition
 * that the engine can look up at runtime via the document type registry.
 */

import type { DocumentTypeDefinition, SectionOutput, ReviewerSpec } from "../../core/doc-type.js";
import type { AiProvider, StorageProvider } from "../../core/providers.js";
import type { StyleAnalysis, DocumentIndex, PriorSectionContent } from "../../core/types.js";
import type { DrizzleInstance } from "../../db/connection.js";

import type { BudgetBookData } from "./data-types.js";
import { budgetBookDataSchema } from "./data-types.js";
import {
  AGENT_TYPES,
  AGENT_DEFINITIONS,
  type AgentDefinition,
  type AgentType,
} from "./agents.js";
import { SECTION_TYPE_SPECS, getSectionData, getSectionPrompt } from "./sections.js";
import { BUDGET_BOOK_REVIEWERS } from "./reviewers.js";
import { GLOBAL_SEEDS } from "./seeds.js";
import { CATEGORY_PRIORITY } from "./category-priority.js";
import { detectDataGaps } from "./detector.js";
import { renderBudgetBookPdf } from "./pdf/renderer.js";
import { analyzePriorYearPdf } from "./pdf/analyzer.js";
import { indexPriorBudgetBook } from "./pdf/indexer.js";
import { extractPriorBudgetBookContent } from "./pdf/extractor.js";
import { parseExcelBudget } from "./excel-parser.js";
import {
  extractSkillsFromGfoaReview,
  extractSkillsFromAdaReview,
} from "./skill-extractor.js";
import { createTodosFromGfoaReview } from "./todo-factory.js";
import type { GfoaReviewResult, AdaReviewResult } from "./review-types.js";

export const budgetBookDocType: DocumentTypeDefinition<BudgetBookData> = {
  id: "budget_book",
  name: "Municipal Budget Book",
  version: "1.0.0",

  // ── Data ──────────────────────────────────────────────────────────────
  dataSchema: budgetBookDataSchema,

  async parseUpload(
    ai: AiProvider,
    buffer: Buffer,
    params: Record<string, unknown>
  ): Promise<BudgetBookData> {
    const fiscalYear =
      typeof params.fiscalYear === "number"
        ? params.fiscalYear
        : new Date().getFullYear();
    return parseExcelBudget(ai, buffer, fiscalYear);
  },

  // ── Sections ──────────────────────────────────────────────────────────
  sectionTypes: SECTION_TYPE_SPECS,

  getSectionData(sectionType: string, data: BudgetBookData): Record<string, unknown> {
    return getSectionData(sectionType, data);
  },

  getSectionPrompt(
    sectionType: string,
    data: BudgetBookData,
    style: StyleAnalysis | null,
    priorContent?: PriorSectionContent | null
  ): string {
    return getSectionPrompt(sectionType, data, style, priorContent);
  },

  // ── Agents ────────────────────────────────────────────────────────────
  agents: Object.values(AGENT_DEFINITIONS),

  getAgent(type: string): AgentDefinition {
    if (!AGENT_TYPES.includes(type as AgentType)) {
      throw new Error(`Unknown budget book agent type: "${type}"`);
    }
    return AGENT_DEFINITIONS[type as AgentType];
  },

  // ── Reviews ───────────────────────────────────────────────────────────
  reviewers: BUDGET_BOOK_REVIEWERS,

  // ── Skills ────────────────────────────────────────────────────────────
  seedSkills: GLOBAL_SEEDS,
  categoryPriority: CATEGORY_PRIORITY,

  // ── Data Gaps ─────────────────────────────────────────────────────────
  detectDataGaps(data: BudgetBookData) {
    return detectDataGaps(data);
  },

  // ── Agent Types ────────────────────────────────────────────────────────
  creatorAgentType: "bb_creator",
  advisorAgentType: "bb_advisor",

  // ── Iteration Control ───────────────────────────────────────────────
  storagePrefix: "budget-books",

  // ── Skill Extraction ──────────────────────────────────────────────
  async extractSkillsFromReview(
    db: DrizzleInstance,
    ai: AiProvider,
    tenantId: string,
    reviewerSpec: ReviewerSpec,
    result: unknown,
    reviewId: string
  ): Promise<void> {
    if (reviewerSpec.id === "gfoa") {
      await extractSkillsFromGfoaReview(db, ai, tenantId, result as GfoaReviewResult, reviewId);
    } else if (reviewerSpec.id === "ada") {
      await extractSkillsFromAdaReview(db, ai, tenantId, result as AdaReviewResult, reviewId);
    }
  },

  // ── Todo Creation from Reviews ────────────────────────────────────
  async createTodosFromReview(
    db: DrizzleInstance,
    documentId: string,
    tenantId: string,
    reviewerSpec: ReviewerSpec,
    result: unknown,
    reviewId: string
  ): Promise<void> {
    if (reviewerSpec.id === "gfoa") {
      await createTodosFromGfoaReview(db, documentId, tenantId, result as GfoaReviewResult, reviewId);
    }
  },

  buildRevisionPrompt(
    section: SectionOutput,
    feedbackByReviewer: Map<string, string[]>,
    data: unknown,
    style: StyleAnalysis | null
  ) {
    const gfoaFeedback = feedbackByReviewer.get("gfoa") ?? [];
    const adaFeedback = feedbackByReviewer.get("ada") ?? [];

    const systemPromptSuffix =
      "\n\nYou are revising an existing section based on reviewer feedback. " +
      "Make targeted improvements to address the specific issues raised. " +
      "Maintain the same overall structure and data. " +
      "Respond with valid JSON in the same format as the original section.";

    const sectionData = getSectionData(section.sectionType, data as BudgetBookData);
    const userPrompt =
      `Original section:\n${JSON.stringify(section, null, 2)}\n\n` +
      `GFOA feedback for this section:\n${gfoaFeedback.join("\n")}\n\n` +
      `ADA feedback for this section:\n${adaFeedback.join("\n")}\n\n` +
      `Budget data context:\n${JSON.stringify(sectionData, null, 2)}`;

    return { systemPromptSuffix, userPrompt };
  },

  shouldContinueIterating(
    results: Map<string, { passed: boolean; score: number | null }>,
    iteration: number,
    previousScores: Map<string, number | null>
  ): boolean {
    // Stop if all reviewers pass
    const allPassed = [...results.values()].every((r) => r.passed);
    if (allPassed) return false;

    // Plateau detection: stop if GFOA score didn't improve after 2+ iterations
    const gfoaResult = results.get("gfoa");
    const previousGfoaScore = previousScores.get("gfoa");
    if (
      iteration >= 2 &&
      gfoaResult?.score != null &&
      previousGfoaScore != null &&
      gfoaResult.score <= previousGfoaScore
    ) {
      console.log(
        `[budget-book] Score plateau detected (${previousGfoaScore} → ${gfoaResult.score}). Stopping iterations.`
      );
      return false;
    }

    return true;
  },

  // ── Rendering ─────────────────────────────────────────────────────────
  async renderPdf(
    sections: SectionOutput[],
    data: BudgetBookData,
    style: StyleAnalysis | null,
    charts: Map<string, Buffer[]>
  ): Promise<Buffer> {
    // Map SectionOutput to the renderer's SectionContent shape
    const sectionContents = sections.map((s) => ({
      sectionType: s.sectionType,
      title: s.title,
      narrativeContent: s.narrativeContent,
      tableData: s.tableData,
      chartConfigs: s.chartConfigs as unknown as Record<string, unknown>[],
    }));
    return renderBudgetBookPdf(sectionContents, data, style, charts);
  },

  async analyzePriorDocument(
    ai: AiProvider,
    storage: StorageProvider,
    tenantId: string,
    s3Key: string
  ): Promise<StyleAnalysis> {
    return analyzePriorYearPdf(ai, storage, tenantId, s3Key);
  },

  async indexPriorDocument(
    ai: AiProvider,
    storage: StorageProvider,
    tenantId: string,
    s3Key: string
  ): Promise<DocumentIndex> {
    return indexPriorBudgetBook(ai, storage, tenantId, s3Key);
  },

  async extractPriorContent(
    ai: AiProvider,
    storage: StorageProvider,
    tenantId: string,
    s3Key: string,
    index: DocumentIndex
  ): Promise<Map<string, PriorSectionContent>> {
    return extractPriorBudgetBookContent(ai, storage, tenantId, s3Key, index);
  },
};
