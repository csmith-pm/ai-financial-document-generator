/**
 * Budget Book Reviewer Specs — GFOA and ADA reviewer definitions.
 */

import type { ReviewerSpec } from "../../core/doc-type.js";

export const GFOA_REVIEWER: ReviewerSpec = {
  id: "gfoa",
  agentType: "bb_reviewer",
};

export const ADA_REVIEWER: ReviewerSpec = {
  id: "ada",
  agentType: "ada_reviewer",
};

export const BUDGET_BOOK_REVIEWERS: ReviewerSpec[] = [
  GFOA_REVIEWER,
  ADA_REVIEWER,
];
