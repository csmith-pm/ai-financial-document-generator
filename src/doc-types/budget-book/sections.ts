/**
 * Budget Book Section Types — defines sections, data slicing,
 * and prompt construction for municipal budget books.
 *
 * Extracted from src/core/orchestrator.ts.
 */

import type { BudgetBookData } from "./data-types.js";
import type { StyleAnalysis, PriorSectionContent } from "../../core/types.js";
import type { SectionTypeSpec } from "../../core/doc-type.js";

export const SECTION_TYPES = [
  "executive_summary",
  "community_profile",
  "revenue_summary",
  "expenditure_summary",
  "personnel_summary",
  "capital_summary",
  "multi_year_outlook",
  "appendix",
  "cover",
  "toc",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/** Section type specs with ordering, parallelism, and structural flags. */
export const SECTION_TYPE_SPECS: SectionTypeSpec[] = [
  { id: "executive_summary", name: "Executive Summary", order: 1, parallel: true, structural: false },
  { id: "community_profile", name: "Community Profile", order: 2, parallel: true, structural: false },
  { id: "revenue_summary", name: "Revenue Summary", order: 3, parallel: true, structural: false },
  { id: "expenditure_summary", name: "Expenditure Summary", order: 4, parallel: true, structural: false },
  { id: "personnel_summary", name: "Personnel Summary", order: 5, parallel: true, structural: false },
  { id: "capital_summary", name: "Capital Summary", order: 6, parallel: true, structural: false },
  { id: "multi_year_outlook", name: "Multi-Year Outlook", order: 7, parallel: true, structural: false },
  { id: "appendix", name: "Appendix", order: 8, parallel: false, structural: false },
  { id: "cover", name: "Cover", order: 0, parallel: false, structural: true },
  { id: "toc", name: "Table of Contents", order: 9, parallel: false, structural: true },
];

/**
 * Slice budget data to just the fields relevant to a given section type.
 */
export function getSectionData(
  sectionType: string,
  data: BudgetBookData
): Record<string, unknown> {
  switch (sectionType) {
    case "executive_summary":
      return {
        executiveSummary: data.executiveSummary,
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
      };
    case "community_profile":
      return { communityProfile: data.communityProfile };
    case "revenue_summary":
      return { revenueDetail: data.revenueDetail, fiscalYear: data.fiscalYear };
    case "expenditure_summary":
      return {
        expenditureByDepartment: data.expenditureByDepartment,
        fiscalYear: data.fiscalYear,
      };
    case "personnel_summary":
      return {
        personnelDetail: data.personnelDetail,
        fiscalYear: data.fiscalYear,
      };
    case "capital_summary":
      return { capitalDetail: data.capitalProjects, fiscalYear: data.fiscalYear };
    case "multi_year_outlook":
      return {
        multiYearProjections: data.multiYearProjections,
        executiveSummary: data.executiveSummary,
        fiscalYear: data.fiscalYear,
      };
    case "appendix":
      return {
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
      };
    case "cover":
      return {
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
      };
    case "toc":
      return { fiscalYear: data.fiscalYear };
    default:
      return { fiscalYear: data.fiscalYear };
  }
}

/**
 * Build the user prompt for generating a budget book section.
 *
 * When priorContent is available, the Creator operates as a rewriter —
 * preserving tone, structure, and level of detail from the prior year
 * while updating all financial data.
 */
export function getSectionPrompt(
  sectionType: string,
  data: BudgetBookData,
  styleAnalysis: StyleAnalysis | null,
  priorContent?: PriorSectionContent | null
): string {
  const dataSlice = getSectionData(sectionType, data);

  // Full style guidance (all fields, not just 3)
  let styleGuidance = "";
  if (styleAnalysis) {
    styleGuidance = `\n\nStyle guidance from prior-year document:
- Tone: ${styleAnalysis.narrativeTone}
- Overall style: ${styleAnalysis.overallStyle}
- Chart types: ${styleAnalysis.chartTypes.join(", ")}
- Heading style: ${styleAnalysis.typography.headingStyle}
- Body style: ${styleAnalysis.typography.bodyStyle}
- Layout: ${styleAnalysis.layout.columnCount} column(s), page numbers ${styleAnalysis.layout.pageNumberPlacement}
- Colors: primary ${styleAnalysis.colorScheme.primary}, accent ${styleAnalysis.colorScheme.accent}`;
  }

  // If we have prior content, use the rewriter pattern
  if (priorContent && priorContent.narrative) {
    const priorNarrative = priorContent.narrative.length > 3000
      ? priorContent.narrative.slice(0, 3000) + "\n[... truncated for length]"
      : priorContent.narrative;

    const priorTables = priorContent.tables.length > 0
      ? `\n\nPrior-year tables:\n${JSON.stringify(priorContent.tables.slice(0, 3), null, 2)}`
      : "";

    const priorCharts = priorContent.chartDescriptions.length > 0
      ? `\n\nPrior-year charts:\n${priorContent.chartDescriptions.map((c) => `- ${c.type}: ${c.title} — ${c.description}`).join("\n")}`
      : "";

    const priorFindings = priorContent.keyFindings.length > 0
      ? `\n\nPrior-year key points:\n${priorContent.keyFindings.map((f) => `- ${f}`).join("\n")}`
      : "";

    return `REWRITE the "${sectionType}" section for FY${data.fiscalYear} municipal budget book for ${data.communityProfile.name}.

Below is last year's version of this section. Preserve the tone, structure, level of detail, and narrative approach. Update ALL financial data, dollar amounts, percentages, and year-over-year comparisons using the new budget data provided.${styleGuidance}

=== PRIOR YEAR SECTION ===
${priorNarrative}${priorTables}${priorCharts}${priorFindings}
=== END PRIOR YEAR ===

New budget data for FY${data.fiscalYear}:
${JSON.stringify(dataSlice, null, 2)}

Respond with JSON matching this structure:
{
  "sectionType": "${sectionType}",
  "title": "Section Title",
  "narrativeContent": "Professional prose preserving prior year's style but with updated numbers...",
  "tableData": [{"header": true, "cells": ["Col1", "Col2"]}, {"cells": ["val1", "val2"]}],
  "chartConfigs": [{"type": "bar|pie|line|stacked-bar|grouped-bar", "title": "...", "categoryKey": "...", "dataKeys": ["..."], "width": 800, "height": 400, "data": [...]}]
}`;
  }

  // Fallback: generate from scratch (no prior content available)
  const base = `Generate the "${sectionType}" section for a FY${data.fiscalYear} municipal budget book for ${data.communityProfile.name}.${styleGuidance}`;

  return `${base}\n\nRelevant data:\n${JSON.stringify(dataSlice, null, 2)}\n\nRespond with JSON matching this structure:\n{\n  "sectionType": "${sectionType}",\n  "title": "Section Title",\n  "narrativeContent": "Professional prose with specific dollar amounts...",\n  "tableData": [{"header": true, "cells": ["Col1", "Col2"]}, {"cells": ["val1", "val2"]}],\n  "chartConfigs": [{"type": "bar|pie|line|stacked-bar|grouped-bar", "title": "...", "categoryKey": "...", "dataKeys": ["..."], "width": 800, "height": 400, "data": [...]}]\n}`;
}
