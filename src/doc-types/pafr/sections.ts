/**
 * PAFR Section Types — defines sections, data slicing,
 * and prompt construction for Popular Annual Financial Reports.
 */

import type { PafrData } from "./data-types.js";
import type { StyleAnalysis } from "../../core/types.js";
import type { SectionTypeSpec } from "../../core/doc-type.js";

export const PAFR_SECTION_TYPES = [
  "letter_from_leadership",
  "financial_highlights",
  "revenue_overview",
  "expenditure_overview",
  "demographic_profile",
] as const;

export type PafrSectionType = (typeof PAFR_SECTION_TYPES)[number];

export const PAFR_SECTION_SPECS: SectionTypeSpec[] = [
  { id: "letter_from_leadership", name: "Letter from Leadership", order: 0, parallel: false, structural: true },
  { id: "financial_highlights", name: "Financial Highlights", order: 1, parallel: false, structural: false },
  { id: "revenue_overview", name: "Revenue Overview", order: 2, parallel: true, structural: false },
  { id: "expenditure_overview", name: "Expenditure Overview", order: 3, parallel: true, structural: false },
  { id: "demographic_profile", name: "Community at a Glance", order: 4, parallel: true, structural: false },
];

/**
 * Slice PAFR data to just the fields relevant to a given section type.
 */
export function getSectionData(
  sectionType: string,
  data: PafrData
): Record<string, unknown> {
  switch (sectionType) {
    case "letter_from_leadership":
      return {
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
        keyMetrics: data.keyMetrics,
        leadershipMessage: data.leadershipMessage,
        totalRevenue: data.totalRevenue,
        totalExpenditure: data.totalExpenditure,
      };
    case "financial_highlights":
      return {
        fiscalYear: data.fiscalYear,
        keyMetrics: data.keyMetrics,
        totalRevenue: data.totalRevenue,
        totalExpenditure: data.totalExpenditure,
        fundBalance: data.fundBalance,
      };
    case "revenue_overview":
      return {
        fiscalYear: data.fiscalYear,
        revenueBySource: data.revenueBySource,
        totalRevenue: data.totalRevenue,
      };
    case "expenditure_overview":
      return {
        fiscalYear: data.fiscalYear,
        expenditureByFunction: data.expenditureByFunction,
        totalExpenditure: data.totalExpenditure,
      };
    case "demographic_profile":
      return {
        communityProfile: data.communityProfile,
        demographicHighlights: data.demographicHighlights,
      };
    default:
      return { fiscalYear: data.fiscalYear };
  }
}

/**
 * Build the user prompt for generating a PAFR section.
 */
export function getSectionPrompt(
  sectionType: string,
  data: PafrData,
  styleAnalysis: StyleAnalysis | null
): string {
  const styleGuidance = styleAnalysis
    ? `\n\nStyle guidance from prior-year document:\n- Tone: ${styleAnalysis.narrativeTone}\n- Chart types used: ${styleAnalysis.chartTypes.join(", ")}\n- Overall style: ${styleAnalysis.overallStyle}`
    : "";

  const community = data.communityProfile.name;
  const base = `Generate the "${sectionType}" section for a FY${data.fiscalYear} Popular Annual Financial Report for ${community}.${styleGuidance}\n\nThis is a citizen-facing document — use plain language, avoid jargon, and make financial data accessible to the general public.`;
  const dataSlice = getSectionData(sectionType, data);

  return `${base}\n\nRelevant data:\n${JSON.stringify(dataSlice, null, 2)}\n\nRespond with JSON matching this structure:\n{\n  "sectionType": "${sectionType}",\n  "title": "Section Title",\n  "narrativeContent": "Plain-language prose that highlights key takeaways...",\n  "tableData": [{"header": true, "cells": ["Col1", "Col2"]}, {"cells": ["val1", "val2"]}],\n  "chartConfigs": [{"type": "bar|pie|line|stacked-bar|grouped-bar", "title": "...", "categoryKey": "...", "dataKeys": ["..."], "width": 800, "height": 400, "data": [...]}]\n}`;
}
