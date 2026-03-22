/**
 * Budget Book Global Skill Seeds — starter skills for budget book agents.
 *
 * Extracted from src/core/skills/seeds.ts.
 */

import type { SeedSkill } from "../../core/doc-type.js";

export const GLOBAL_SEEDS: SeedSkill[] = [
  // BB_Creator — content quality
  {
    agentType: "bb_creator",
    skill: "Always include specific dollar amounts and year-over-year percentage changes in narrative text. Never use vague language like 'increased significantly'.",
    category: "content_quality",
    trigger: "generating any narrative section",
    confidence: 0.95,
  },
  {
    agentType: "bb_creator",
    skill: "Revenue sections must include per-capita revenue calculations and 3-year trend comparisons for each major revenue source.",
    category: "revenue_formatting",
    trigger: "generating revenue_summary section",
    confidence: 0.90,
  },
  {
    agentType: "bb_creator",
    skill: "Expenditure sections should break down spending by department AND by function, with variance explanations for any changes exceeding 5%.",
    category: "expenditure_formatting",
    trigger: "generating expenditure_summary section",
    confidence: 0.90,
  },
  {
    agentType: "bb_creator",
    skill: "Personnel sections must include FTE counts by department, total compensation breakdown (salary vs benefits), and year-over-year headcount changes.",
    category: "personnel_formatting",
    trigger: "generating personnel_summary section",
    confidence: 0.90,
  },
  {
    agentType: "bb_creator",
    skill: "Capital sections should list each project with estimated cost, funding source, expected timeline, and impact on operating budget.",
    category: "capital_formatting",
    trigger: "generating capital_summary section",
    confidence: 0.85,
  },
  {
    agentType: "bb_creator",
    skill: "The executive summary must address community priorities, key budget drivers, and the overall fiscal outlook in the first three paragraphs.",
    category: "gfoa_criteria",
    trigger: "generating executive_summary section",
    confidence: 0.95,
  },
  {
    agentType: "bb_creator",
    skill: "Every chart must include an altText field with a plain-language description of the data trend shown, suitable for screen readers.",
    category: "accessibility",
    trigger: "generating chartConfigs for any section",
    confidence: 0.95,
  },
  {
    agentType: "bb_creator",
    skill: "Use at least two data visualization types per section (bar, line, pie, stacked-bar). Avoid using the same chart type for all sections.",
    category: "chart_design",
    trigger: "generating chartConfigs for any section",
    confidence: 0.80,
  },
  {
    agentType: "bb_creator",
    skill: "Multi-year outlook must include at least 3 years of projections with revenue, expenditure, and fund balance for each year.",
    category: "gfoa_criteria",
    trigger: "generating multi_year_outlook section",
    confidence: 0.90,
  },

  // BB_Reviewer — scoring calibration
  {
    agentType: "bb_reviewer",
    skill: "Score the 'Community Priorities' category based on whether the budget explicitly connects spending to stated community goals or strategic plan priorities.",
    category: "scoring_calibration",
    trigger: "scoring Community Priorities category",
    confidence: 0.90,
  },
  {
    agentType: "bb_reviewer",
    skill: "The 'Long-Term Outlook' category requires multi-year projections with assumptions stated. A single-year budget with no projections should score 5 or below out of 20.",
    category: "scoring_calibration",
    trigger: "scoring Long-Term Outlook category",
    confidence: 0.90,
  },
  {
    agentType: "bb_reviewer",
    skill: "For the 'Value' category, look for cost-per-service metrics, efficiency measures, or performance indicators. Narrative-only sections without metrics score low.",
    category: "review_criteria",
    trigger: "scoring Value category",
    confidence: 0.85,
  },

  // ADA_Reviewer — accessibility patterns
  {
    agentType: "ada_reviewer",
    skill: "Tables must use proper header rows (th elements) and include scope attributes. Check that table data is not conveyed using merged cells.",
    category: "accessibility_criteria",
    trigger: "reviewing table structures",
    confidence: 0.95,
  },
  {
    agentType: "ada_reviewer",
    skill: "Color contrast for text on backgrounds must meet WCAG AA minimum: 4.5:1 for normal text, 3:1 for large text. Check all specified hex color values.",
    category: "wcag_patterns",
    trigger: "reviewing color specifications",
    confidence: 0.95,
  },
];
