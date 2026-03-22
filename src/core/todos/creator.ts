/**
 * Todo Creator — inserts todo records from detected data gaps
 * and GFOA review recommendations.
 */

import { budgetBookTodos, type budgetBookSectionTypeEnum } from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { DetectedGap } from "./detector.js";

type SectionTypeEnum = (typeof budgetBookSectionTypeEnum.enumValues)[number] | null;

/**
 * Create todos from detected data gaps.
 */
export async function createTodosFromDataGaps(
  db: DrizzleInstance,
  budgetBookId: string,
  tenantId: string,
  gaps: DetectedGap[]
): Promise<void> {
  for (const gap of gaps) {
    await db.insert(budgetBookTodos).values({
      budgetBookId,
      tenantId,
      category: gap.category,
      title: gap.title,
      description: gap.description,
      sectionType: gap.sectionType as SectionTypeEnum,
      status: "open",
      priority: gap.priority,
    });
  }
}

interface GfoaRecommendation {
  section: string;
  priority: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
}

interface GfoaReviewResult {
  totalScore: number;
  passed: boolean;
  recommendations: GfoaRecommendation[];
}

/** Map reviewer section names to our section type enum values */
function mapSectionType(section: string): SectionTypeEnum {
  const normalized = section.toLowerCase().replace(/[\s-]/g, "_");
  const sectionMap: Record<string, string> = {
    executive_summary: "executive_summary",
    community_profile: "community_profile",
    revenue_summary: "revenue_summary",
    revenue: "revenue_summary",
    expenditure_summary: "expenditure_summary",
    expenditure: "expenditure_summary",
    personnel_summary: "personnel_summary",
    personnel: "personnel_summary",
    capital_summary: "capital_summary",
    capital: "capital_summary",
    multi_year_outlook: "multi_year_outlook",
    multi_year: "multi_year_outlook",
    long_term_outlook: "multi_year_outlook",
    appendix: "appendix",
  };
  return (sectionMap[normalized] as SectionTypeEnum) ?? null;
}

/**
 * Create quality todos from GFOA review recommendations.
 * Only creates todos for high and medium priority recommendations.
 */
export async function createTodosFromGfoaReview(
  db: DrizzleInstance,
  budgetBookId: string,
  tenantId: string,
  review: GfoaReviewResult,
  reviewId: string
): Promise<void> {
  const actionableRecs = review.recommendations.filter(
    (r) => r.priority === "high" || r.priority === "medium"
  );

  for (const rec of actionableRecs) {
    await db.insert(budgetBookTodos).values({
      budgetBookId,
      tenantId,
      category: "quality",
      title: rec.issue.length > 100 ? rec.issue.substring(0, 97) + "..." : rec.issue,
      description: `**Issue:** ${rec.issue}\n\n**Suggestion:** ${rec.suggestion}\n\n*From GFOA review (score: ${review.totalScore}/180)*`,
      sectionType: mapSectionType(rec.section),
      status: "open",
      priority: rec.priority,
      sourceReviewId: reviewId,
    });
  }
}
