/**
 * PafrDocType — the DocumentTypeDefinition implementation
 * for Popular Annual Financial Reports.
 *
 * Assembles all PAFR-specific pieces into a single definition
 * that the engine can look up at runtime via the document type registry.
 */

import type { DocumentTypeDefinition, SectionOutput, ReviewerSpec } from "../../core/doc-type.js";
import type { AiProvider } from "../../core/providers.js";
import type { StyleAnalysis } from "../../core/types.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { GenericAgentDefinition } from "../../core/doc-type.js";

import type { PafrData } from "./data-types.js";
import { pafrDataSchema } from "./data-types.js";
import { PAFR_AGENTS } from "./agents.js";
import { PAFR_SECTION_SPECS, getSectionData, getSectionPrompt } from "./sections.js";
import { PAFR_REVIEWERS } from "./reviewers.js";
import { PAFR_SEEDS } from "./seeds.js";
import { PAFR_CATEGORY_PRIORITY } from "./category-priority.js";
import { detectDataGaps } from "./detector.js";
import type { PafrReviewResult, PafrRecommendation } from "./review-types.js";
import type { AdaReviewResult, AdaIssue } from "../budget-book/review-types.js";
import { negotiateSkill } from "../../core/skills/arbitration.js";
import { pruneSkills } from "../../core/skills/pruning.js";
import { documentTodos } from "../../db/schema.js";

export const pafrDocType: DocumentTypeDefinition<PafrData> = {
  id: "pafr",
  name: "Popular Annual Financial Report",
  version: "1.0.0",

  // ── Data ──────────────────────────────────────────────────────────────
  dataSchema: pafrDataSchema,

  // ── Sections ──────────────────────────────────────────────────────────
  sectionTypes: PAFR_SECTION_SPECS,

  getSectionData(sectionType: string, data: PafrData): Record<string, unknown> {
    return getSectionData(sectionType, data);
  },

  getSectionPrompt(
    sectionType: string,
    data: PafrData,
    style: StyleAnalysis | null
  ): string {
    return getSectionPrompt(sectionType, data, style);
  },

  // ── Agents ────────────────────────────────────────────────────────────
  agents: PAFR_AGENTS,

  getAgent(type: string): GenericAgentDefinition {
    const agent = PAFR_AGENTS.find((a) => a.type === type);
    if (!agent) {
      throw new Error(`Unknown PAFR agent type: "${type}"`);
    }
    return agent;
  },

  // ── Reviews ───────────────────────────────────────────────────────────
  reviewers: PAFR_REVIEWERS,

  // ── Skills ────────────────────────────────────────────────────────────
  seedSkills: PAFR_SEEDS,
  categoryPriority: PAFR_CATEGORY_PRIORITY,

  // ── Data Gaps ─────────────────────────────────────────────────────────
  detectDataGaps(data: PafrData) {
    return detectDataGaps(data);
  },

  // ── Agent Types ────────────────────────────────────────────────────────
  creatorAgentType: "pafr_creator",
  advisorAgentType: "pafr_advisor",

  // ── Iteration Control ───────────────────────────────────────────────
  storagePrefix: "pafr",

  // ── Skill Extraction ──────────────────────────────────────────────
  async extractSkillsFromReview(
    db: DrizzleInstance,
    ai: AiProvider,
    tenantId: string,
    reviewerSpec: ReviewerSpec,
    result: unknown,
    reviewId: string
  ): Promise<void> {
    if (reviewerSpec.id === "pafr_quality") {
      const pafrResult = result as PafrReviewResult;
      if (pafrResult.recommendations.length === 0) return;

      const userPrompt = `PAFR Popular Reporting Award Review Results:
- Total Score: ${pafrResult.totalScore}/100 (${pafrResult.passed ? "PASSED" : "NOT PASSED"})
- Low-scoring categories: ${pafrResult.scores.filter((s) => s.awardedPoints < s.maxPoints * 0.6).map((s) => `${s.category}: ${s.awardedPoints}/${s.maxPoints} — ${s.feedback}`).join("\n  ")}
- Recommendations (${pafrResult.recommendations.length} total):
${pafrResult.recommendations.map((r: PafrRecommendation) => `  [${r.priority}] ${r.section}: ${r.issue} → ${r.suggestion}`).join("\n")}

Extract learnings that would help the PAFR_Creator agent produce higher-scoring content next time. Also extract any self-improvement learnings for the PAFR_Reviewer itself.`;

      const extractionPrompt = `You are a learning extraction agent. Given review results, extract 3-5 actionable learnings that would improve future PAFR generation.

Each learning must be:
- Specific and prescriptive (not vague guidance)
- Actionable by the target agent in future iterations
- Grounded in evidence from the review

Output valid JSON matching this schema:
{
  "learnings": [
    {
      "targetAgent": "pafr_creator" | "pafr_reviewer",
      "skill": "Concise instruction for the agent",
      "category": "e.g. plain_language, visual_design, content_quality, scoring_calibration",
      "trigger": "When this skill applies, e.g. 'generating revenue_overview section'",
      "confidence": 0.70-0.95
    }
  ]
}`;

      const extracted = await ai.callJson<{
        learnings: Array<{
          targetAgent: string;
          skill: string;
          category: string;
          trigger: string;
          confidence: number;
        }>;
      }>(extractionPrompt, userPrompt, { maxTokens: 2048, temperature: 0.2 });

      await ai.logUsage?.(
        tenantId,
        "skill_extraction_pafr_quality",
        extracted.inputTokens,
        extracted.outputTokens,
        extracted.model
      );

      for (const learning of extracted.data.learnings) {
        await negotiateSkill(db, tenantId, {
          agentType: learning.targetAgent,
          skill: learning.skill,
          category: learning.category,
          trigger: learning.trigger,
          confidence: learning.confidence,
          source: `pafr_quality_review:${reviewId}`,
        });
      }

      await pruneSkills(db, "pafr_creator", tenantId);
      await pruneSkills(db, "pafr_reviewer", tenantId);
    } else if (reviewerSpec.id === "ada") {
      const adaResult = result as AdaReviewResult;
      const allIssues = [...adaResult.pdfIssues, ...adaResult.webIssues];
      if (allIssues.length === 0) return;

      const userPrompt = `ADA/WCAG 2.1 AA Review Results for a PAFR:
- Passed: ${adaResult.passed}
- PDF Issues (${adaResult.pdfIssues.length}):
${adaResult.pdfIssues.map((i: AdaIssue) => `  [${i.severity}] ${i.rule}: ${i.description} → ${i.fix}`).join("\n")}
- Web Issues (${adaResult.webIssues.length}):
${adaResult.webIssues.map((i: AdaIssue) => `  [${i.severity}] ${i.rule}: ${i.description} → ${i.fix}`).join("\n")}

Extract learnings that would help the PAFR_Creator agent produce more accessible content. Also extract self-improvement learnings for the ADA_Reviewer.`;

      const extractionPrompt = `You are a learning extraction agent. Given review results, extract 3-5 actionable learnings that would improve future PAFR accessibility.

Each learning must be:
- Specific and prescriptive (not vague guidance)
- Actionable by the target agent in future iterations
- Grounded in evidence from the review

Output valid JSON matching this schema:
{
  "learnings": [
    {
      "targetAgent": "pafr_creator" | "ada_reviewer",
      "skill": "Concise instruction for the agent",
      "category": "e.g. accessibility, wcag_patterns, accessibility_criteria",
      "trigger": "When this skill applies",
      "confidence": 0.70-0.95
    }
  ]
}`;

      const extracted = await ai.callJson<{
        learnings: Array<{
          targetAgent: string;
          skill: string;
          category: string;
          trigger: string;
          confidence: number;
        }>;
      }>(extractionPrompt, userPrompt, { maxTokens: 2048, temperature: 0.2 });

      await ai.logUsage?.(
        tenantId,
        "skill_extraction_pafr_ada",
        extracted.inputTokens,
        extracted.outputTokens,
        extracted.model
      );

      for (const learning of extracted.data.learnings) {
        await negotiateSkill(db, tenantId, {
          agentType: learning.targetAgent,
          skill: learning.skill,
          category: learning.category,
          trigger: learning.trigger,
          confidence: learning.confidence,
          source: `ada_review:${reviewId}`,
        });
      }

      await pruneSkills(db, "pafr_creator", tenantId);
      await pruneSkills(db, "ada_reviewer", tenantId);
    }
  },

  // ── Todo Creation from Reviews ────────────────────────────────────
  async createTodosFromReview(
    db: DrizzleInstance,
    documentId: string,
    tenantId: string,
    reviewerSpec: ReviewerSpec,
    result: unknown,
    reviewId: string
  ): Promise<void> {
    if (reviewerSpec.id !== "pafr_quality") return;

    const pafrResult = result as PafrReviewResult;
    const actionableRecs = pafrResult.recommendations.filter(
      (r: PafrRecommendation) => r.priority === "high" || r.priority === "medium"
    );

    for (const rec of actionableRecs) {
      await db.insert(documentTodos).values({
        documentId,
        tenantId,
        category: "quality",
        title: rec.issue.length > 100 ? rec.issue.substring(0, 97) + "..." : rec.issue,
        description: `**Issue:** ${rec.issue}\n\n**Suggestion:** ${rec.suggestion}\n\n*From PAFR quality review (score: ${pafrResult.totalScore}/100)*`,
        sectionType: rec.section,
        status: "open",
        priority: rec.priority,
        sourceReviewId: reviewId,
      });
    }
  },

  buildRevisionPrompt(
    section: SectionOutput,
    feedbackByReviewer: Map<string, string[]>,
    data: unknown,
    _style: StyleAnalysis | null
  ) {
    const qualityFeedback = feedbackByReviewer.get("pafr_quality") ?? [];
    const adaFeedback = feedbackByReviewer.get("ada") ?? [];

    const systemPromptSuffix =
      "\n\nYou are revising an existing PAFR section based on reviewer feedback. " +
      "Focus on improving readability, plain language, and visual appeal. " +
      "Address the specific issues raised while keeping content accessible to the general public. " +
      "Respond with valid JSON in the same format as the original section.";

    const sectionData = getSectionData(section.sectionType, data as PafrData);
    const userPrompt =
      `Original section:\n${JSON.stringify(section, null, 2)}\n\n` +
      `Popular Reporting quality feedback:\n${qualityFeedback.join("\n")}\n\n` +
      `ADA feedback:\n${adaFeedback.join("\n")}\n\n` +
      `PAFR data context:\n${JSON.stringify(sectionData, null, 2)}`;

    return { systemPromptSuffix, userPrompt };
  },

  shouldContinueIterating(
    results: Map<string, { passed: boolean; score: number | null }>,
    iteration: number,
    previousScores: Map<string, number | null>
  ): boolean {
    const allPassed = [...results.values()].every((r) => r.passed);
    if (allPassed) return false;

    const qualityResult = results.get("pafr_quality");
    const previousQualityScore = previousScores.get("pafr_quality");
    if (
      iteration >= 2 &&
      qualityResult?.score != null &&
      previousQualityScore != null &&
      qualityResult.score <= previousQualityScore
    ) {
      console.log(
        `[pafr] Score plateau detected (${previousQualityScore} → ${qualityResult.score}). Stopping iterations.`
      );
      return false;
    }

    return true;
  },
};
