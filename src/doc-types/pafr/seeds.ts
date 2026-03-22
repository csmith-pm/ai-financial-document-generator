/**
 * PAFR Global Skill Seeds — starter skills for PAFR agents.
 */

import type { SeedSkill } from "../../core/doc-type.js";

export const PAFR_SEEDS: SeedSkill[] = [
  // PAFR_Creator — plain language and citizen engagement
  {
    agentType: "pafr_creator",
    skill: "Always lead with the key takeaway or headline number before diving into details. Citizens scan documents — put the most important information first.",
    category: "plain_language",
    trigger: "generating any narrative section",
    confidence: 0.95,
  },
  {
    agentType: "pafr_creator",
    skill: "Replace financial jargon with plain equivalents: 'fund balance' → 'savings', 'revenues' → 'money coming in', 'expenditures' → 'money going out'. Add the technical term in parentheses once for reference.",
    category: "plain_language",
    trigger: "generating any narrative section",
    confidence: 0.90,
  },
  {
    agentType: "pafr_creator",
    skill: "Use per-capita comparisons and everyday analogies to contextualize large dollar amounts. Example: '$2.4M in road repairs — about $48 per resident.'",
    category: "financial_highlights",
    trigger: "presenting dollar amounts",
    confidence: 0.90,
  },
  {
    agentType: "pafr_creator",
    skill: "Revenue and expenditure sections should use pie or donut charts showing percentage breakdowns. Include the total dollar amount in the chart title.",
    category: "visual_design",
    trigger: "generating revenue_overview or expenditure_overview sections",
    confidence: 0.85,
  },
  {
    agentType: "pafr_creator",
    skill: "Every chart must include an altText field with a plain-language description of the data trend shown, suitable for screen readers.",
    category: "accessibility",
    trigger: "generating chartConfigs for any section",
    confidence: 0.95,
  },
  {
    agentType: "pafr_creator",
    skill: "The letter from leadership should be warm, personal, and mention 2-3 specific community accomplishments funded by the budget. Avoid generic boilerplate.",
    category: "content_quality",
    trigger: "generating letter_from_leadership section",
    confidence: 0.85,
  },
  {
    agentType: "pafr_creator",
    skill: "Demographic profile should include community fast-facts in a scannable list format with icons or emoji-style indicators for trends (↑ ↓ →).",
    category: "demographic_presentation",
    trigger: "generating demographic_profile section",
    confidence: 0.80,
  },

  // PAFR_Reviewer — scoring calibration
  {
    agentType: "pafr_reviewer",
    skill: "Score 'Reader Appeal' based on whether the report would engage a resident who received it in their mailbox. Professional design and visual variety are essential.",
    category: "scoring_calibration",
    trigger: "scoring Reader Appeal category",
    confidence: 0.90,
  },
  {
    agentType: "pafr_reviewer",
    skill: "Score 'Understandability' by checking for jargon-free language, contextual explanations of numbers, and logical flow from simple to complex topics.",
    category: "scoring_calibration",
    trigger: "scoring Understandability category",
    confidence: 0.90,
  },
  {
    agentType: "pafr_reviewer",
    skill: "For 'Financial Content', verify that the report covers both where money comes from and where it goes, with at least basic year-over-year context.",
    category: "review_criteria",
    trigger: "scoring Financial Content category",
    confidence: 0.85,
  },
];
