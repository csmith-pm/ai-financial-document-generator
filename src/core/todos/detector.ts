/**
 * Data Gap Detector — inspects BudgetBookData for missing or thin data
 * and produces todo items that tell the user what to provide.
 */

import type { BudgetBookData } from "../providers.js";

export interface DetectedGap {
  category: "data_gap" | "clarification";
  title: string;
  description: string;
  sectionType: string | null;
  priority: "high" | "medium" | "low";
}

/**
 * Analyze budget data for gaps and produce todo items.
 */
export function detectDataGaps(data: BudgetBookData): DetectedGap[] {
  const gaps: DetectedGap[] = [];

  // Revenue data
  if (data.revenueDetail.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No revenue data found",
      description:
        "The budget has no revenue line items for the selected fiscal year. Revenue data is critical for GFOA scoring — the Revenue category (20 points) cannot score well without it. Upload a revenue schedule or ensure trial balance data includes revenue accounts.",
      sectionType: "revenue_summary",
      priority: "high",
    });
  } else if (data.revenueDetail.length < 3) {
    gaps.push({
      category: "clarification",
      title: "Limited revenue detail",
      description:
        `Only ${data.revenueDetail.length} revenue line(s) found. GFOA expects a breakdown by major revenue source (property tax, sales tax, fees, intergovernmental, etc.). Consider adding more detailed revenue categories.`,
      sectionType: "revenue_summary",
      priority: "medium",
    });
  }

  // Expenditure data
  if (data.expenditureByDepartment.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No expenditure data found",
      description:
        "No expenditure line items found for the selected fiscal year. Expenditure breakdowns by department are essential for the Department (15 points) and Program (15 points) GFOA categories.",
      sectionType: "expenditure_summary",
      priority: "high",
    });
  }

  // Personnel data
  if (data.personnelDetail.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No personnel data linked",
      description:
        "No personnel positions found. The Personnel category (15 points) requires FTE counts, salary breakdowns, and benefit costs by department. Link a personnel scenario or upload a staffing summary.",
      sectionType: "personnel_summary",
      priority: "medium",
    });
  }

  // Capital data
  if (data.capitalProjects.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No capital projects found",
      description:
        "No capital improvement projects found. The Capital category (15 points) requires a project list with costs, funding sources, and timelines. Link capital requests or upload a CIP schedule.",
      sectionType: "capital_summary",
      priority: "medium",
    });
  }

  // Multi-year projections
  if (data.multiYearProjections.length === 0) {
    gaps.push({
      category: "data_gap",
      title: "No multi-year projections available",
      description:
        "No forecast or multi-year budget data found. The Long-Term Outlook category (20 points) is one of the highest-weighted GFOA criteria and requires at least 3 years of revenue and expenditure projections. Create a forecast scenario or upload projection data.",
      sectionType: "multi_year_outlook",
      priority: "high",
    });
  } else if (data.multiYearProjections.length < 3) {
    gaps.push({
      category: "clarification",
      title: "Fewer than 3 years of projections",
      description:
        `Only ${data.multiYearProjections.length} year(s) of projection data available. GFOA recommends at least 3-5 years for the Long-Term Outlook category.`,
      sectionType: "multi_year_outlook",
      priority: "medium",
    });
  }

  // Community profile
  if (!data.communityProfile.name || data.communityProfile.name === "Municipality") {
    gaps.push({
      category: "clarification",
      title: "Community profile not configured",
      description:
        "The community name is not set or is the default 'Municipality'. Update the profile with the actual municipality name, government type, and relevant demographic information for the Community Priorities section.",
      sectionType: "community_profile",
      priority: "high",
    });
  }

  // Executive summary
  if (!data.executiveSummary) {
    gaps.push({
      category: "clarification",
      title: "No executive summary data",
      description:
        "No executive summary or budget message provided. A budget message from the budget officer or city manager would significantly improve the Community Priorities and Budget Process scoring.",
      sectionType: "executive_summary",
      priority: "low",
    });
  }

  return gaps;
}
