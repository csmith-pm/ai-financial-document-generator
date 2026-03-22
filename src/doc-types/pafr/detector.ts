/**
 * PAFR Data Gap Detector — inspects PafrData for missing
 * or thin data and produces todo items.
 */

import type { PafrData } from "./data-types.js";
import type { DetectedGap } from "../../core/doc-type.js";

/**
 * Analyze PAFR data for gaps and produce todo items.
 */
export function detectDataGaps(data: PafrData): DetectedGap[] {
  const gaps: DetectedGap[] = [];

  // Revenue breakdown
  if (data.revenueBySource.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No revenue breakdown available",
      description:
        "The PAFR has no revenue sources listed. A breakdown of where money comes from (property tax, sales tax, fees, etc.) is essential for the Revenue Overview section and Popular Reporting Award scoring.",
      sectionType: "revenue_overview",
      priority: "high",
    });
  }

  // Expenditure breakdown
  if (data.expenditureByFunction.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No expenditure breakdown available",
      description:
        "The PAFR has no expenditure functions listed. A breakdown of where money goes (public safety, infrastructure, parks, etc.) is essential for the Expenditure Overview section.",
      sectionType: "expenditure_overview",
      priority: "high",
    });
  }

  // Fund balance
  if (data.fundBalance.beginning === 0 && data.fundBalance.ending === 0) {
    gaps.push({
      category: "data_gap",
      title: "No fund balance data",
      description:
        "Fund balance (savings) data is missing. Showing the community's financial position helps readers understand fiscal health and is important for Financial Content scoring.",
      sectionType: "financial_highlights",
      priority: "medium",
    });
  }

  // Community profile
  if (!data.communityProfile.name || data.communityProfile.name === "Municipality") {
    gaps.push({
      category: "clarification",
      title: "Community profile not configured",
      description:
        "The community name is not set or is the default. Update the profile with the actual municipality name, population, and demographic details for the Community at a Glance section.",
      sectionType: "demographic_profile",
      priority: "high",
    });
  }

  // Demographics
  if (data.demographicHighlights.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No demographic highlights",
      description:
        "No demographic data points are available. Community demographics (population growth, median income, employment rate, etc.) make the report more relatable and engaging.",
      sectionType: "demographic_profile",
      priority: "medium",
    });
  }

  // Key metrics
  if (data.keyMetrics.length === 0) {
    gaps.push({
      category: "clarification",
      title: "No key metrics defined",
      description:
        "No financial key metrics are set. Adding 3-5 headline metrics (e.g., bond rating, per-capita spending, tax rate) significantly improves the Financial Highlights section.",
      sectionType: "financial_highlights",
      priority: "medium",
    });
  }

  // Leadership message
  if (!data.leadershipMessage) {
    gaps.push({
      category: "clarification",
      title: "No leadership message provided",
      description:
        "A letter from the mayor, city manager, or finance director personalizes the report and improves Reader Appeal scoring. Consider providing a brief message.",
      sectionType: "letter_from_leadership",
      priority: "low",
    });
  }

  return gaps;
}
