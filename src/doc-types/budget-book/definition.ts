/**
 * BudgetBookDocType — the DocumentTypeDefinition implementation
 * for municipal budget books.
 *
 * Assembles all budget-book-specific pieces into a single definition
 * that the engine can look up at runtime via the document type registry.
 */

import type { DocumentTypeDefinition } from "../../core/doc-type.js";
import type { AiProvider, StorageProvider } from "../../core/providers.js";
import type { StyleAnalysis } from "../../core/types.js";
import type { SectionOutput } from "../../core/doc-type.js";

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
import { parseExcelBudget } from "./excel-parser.js";

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
    style: StyleAnalysis | null
  ): string {
    return getSectionPrompt(sectionType, data, style);
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

  // ── Advisors ──────────────────────────────────────────────────────────
  advisorAgentType: "bb_advisor",

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
};
