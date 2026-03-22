/**
 * PAFR Category Priority — skill priority hierarchy.
 *
 * ADA compliance > citizen engagement > Popular Reporting criteria > visual design > style.
 */

/** Category priority: higher number = higher priority */
export const PAFR_CATEGORY_PRIORITY: Record<string, number> = {
  // ADA / accessibility — highest priority
  accessibility: 30,
  accessibility_criteria: 30,
  wcag_patterns: 30,

  // Citizen engagement — high priority
  plain_language: 25,
  content_quality: 25,

  // Popular Reporting criteria — medium-high priority
  review_criteria: 20,
  scoring_calibration: 20,
  financial_highlights: 20,

  // Visual design — medium priority
  visual_design: 15,
  chart_design: 15,
  demographic_presentation: 15,

  // Advisory / general — lowest
  advisory: 5,
  municipal_finance: 5,
};
