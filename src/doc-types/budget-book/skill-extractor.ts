/**
 * Budget Book Skill Extractor — extracts learnings from GFOA and ADA reviews
 * as structured skills for budget book agents.
 */

import { type AiProvider } from "../../core/providers.js";
import { type DrizzleInstance } from "../../db/connection.js";
import { negotiateSkill } from "../../core/skills/arbitration.js";
import { pruneSkills } from "../../core/skills/pruning.js";
import type { GfoaReviewResult, AdaReviewResult } from "./review-types.js";

interface ExtractedSkill {
  targetAgent: string;
  skill: string;
  category: string;
  trigger: string;
  confidence: number;
}

interface ExtractionResult {
  learnings: ExtractedSkill[];
}

const EXTRACTION_SYSTEM_PROMPT = `You are a learning extraction agent. Given review results, extract 3-5 actionable learnings that would improve future document generation.

Each learning must be:
- Specific and prescriptive (not vague guidance)
- Actionable by the target agent in future iterations
- Grounded in evidence from the review

Output valid JSON matching this schema:
{
  "learnings": [
    {
      "targetAgent": "bb_creator" | "bb_reviewer" | "ada_reviewer",
      "skill": "Concise instruction for the agent",
      "category": "e.g. revenue_formatting, chart_design, gfoa_criteria, accessibility",
      "trigger": "When this skill applies, e.g. 'generating revenue_summary section'",
      "confidence": 0.70-0.95
    }
  ]
}`;

/**
 * Extract skills from a GFOA review result.
 */
export async function extractSkillsFromGfoaReview(
  db: DrizzleInstance,
  ai: AiProvider,
  tenantId: string,
  review: GfoaReviewResult,
  reviewId: string
): Promise<void> {
  if (review.recommendations.length === 0) return;

  const userPrompt = `GFOA Review Results:
- Total Score: ${review.totalScore}/180 (${review.passed ? "PASSED" : "NOT PASSED"})
- Low-scoring categories: ${review.scores.filter((s) => s.awardedPoints < s.maxPoints * 0.6).map((s) => `${s.category}: ${s.awardedPoints}/${s.maxPoints} — ${s.feedback}`).join("\n  ")}
- Recommendations (${review.recommendations.length} total):
${review.recommendations.map((r) => `  [${r.priority}] ${r.section}: ${r.issue} → ${r.suggestion}`).join("\n")}

Extract learnings that would help the content creator agent produce higher-scoring content next time. Also extract any self-improvement learnings for the reviewer itself (e.g., criteria it should check more carefully).`;

  const result = await ai.callJson<ExtractionResult>(
    EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 2048, temperature: 0.2 }
  );

  await ai.logUsage?.(
    tenantId,
    "skill_extraction_gfoa",
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  for (const learning of result.data.learnings) {
    await negotiateSkill(db, tenantId, {
      agentType: learning.targetAgent,
      skill: learning.skill,
      category: learning.category,
      trigger: learning.trigger,
      confidence: learning.confidence,
      source: `gfoa_review:${reviewId}`,
    });
  }

  await pruneSkills(db, "bb_creator", tenantId);
  await pruneSkills(db, "bb_reviewer", tenantId);
}

/**
 * Extract skills from an ADA review result.
 */
export async function extractSkillsFromAdaReview(
  db: DrizzleInstance,
  ai: AiProvider,
  tenantId: string,
  review: AdaReviewResult,
  reviewId: string
): Promise<void> {
  const allIssues = [...review.pdfIssues, ...review.webIssues];
  if (allIssues.length === 0) return;

  const userPrompt = `ADA/WCAG 2.1 AA Review Results:
- Passed: ${review.passed}
- PDF Issues (${review.pdfIssues.length}):
${review.pdfIssues.map((i) => `  [${i.severity}] ${i.rule}: ${i.description} → ${i.fix}`).join("\n")}
- Web Issues (${review.webIssues.length}):
${review.webIssues.map((i) => `  [${i.severity}] ${i.rule}: ${i.description} → ${i.fix}`).join("\n")}

Extract learnings that would help the content creator agent produce more accessible content. Also extract self-improvement learnings for the accessibility reviewer (patterns to check more carefully).`;

  const result = await ai.callJson<ExtractionResult>(
    EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 2048, temperature: 0.2 }
  );

  await ai.logUsage?.(
    tenantId,
    "skill_extraction_ada",
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  for (const learning of result.data.learnings) {
    await negotiateSkill(db, tenantId, {
      agentType: learning.targetAgent,
      skill: learning.skill,
      category: learning.category,
      trigger: learning.trigger,
      confidence: learning.confidence,
      source: `ada_review:${reviewId}`,
    });
  }

  await pruneSkills(db, "bb_creator", tenantId);
  await pruneSkills(db, "ada_reviewer", tenantId);
}
