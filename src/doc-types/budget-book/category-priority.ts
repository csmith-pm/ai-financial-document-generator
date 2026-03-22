/**
 * Budget Book Category Priority — skill priority hierarchy.
 *
 * ADA compliance > GFOA criteria > formatting > advisory.
 * Extracted from src/core/skills/arbitration.ts.
 */

/** Category priority: higher number = higher priority */
export const CATEGORY_PRIORITY: Record<string, number> = {
  // ADA / accessibility — highest priority
  accessibility: 30,
  accessibility_criteria: 30,
  wcag_patterns: 30,
  chart_accessibility: 30,

  // GFOA criteria — high priority
  gfoa_criteria: 20,
  review_criteria: 20,
  scoring_calibration: 20,
  content_quality: 20,

  // Formatting / style — lower priority
  revenue_formatting: 10,
  expenditure_formatting: 10,
  personnel_formatting: 10,
  capital_formatting: 10,
  chart_design: 10,
  narrative_style: 10,

  // Advisory / general — lowest
  advisory: 5,
  municipal_finance: 5,
};
