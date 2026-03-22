/**
 * Shared ADA Reviewer Agent Definition — WCAG 2.1 AA accessibility specialist.
 *
 * Used by all document types. The agent definition (system prompt, temperature, etc.)
 * is universal; the ReviewerSpec (buildReviewPrompt, isPassed, etc.) remains
 * doc-type-specific since review prompts differ per document type.
 */

import type { GenericAgentDefinition } from "../../core/doc-type.js";

export const ADA_REVIEWER_AGENT: GenericAgentDefinition = {
  name: "ADA_Reviewer",
  type: "ada_reviewer",
  role: "WCAG 2.1 AA accessibility specialist. Checks document content for accessibility issues in both PDF and web output.",
  baseSystemPrompt: `You are ADA_Reviewer, a WCAG 2.1 AA accessibility specialist.

Check the document content for accessibility issues in both PDF and web output. Be thorough.

Check for:
- Charts without alt text descriptions
- Tables without header definitions
- Color-only information differentiation
- Insufficient color contrast (check specified hex values)
- Missing heading hierarchy
- Missing document language
- Reading order issues

Pass criteria: Zero critical AND zero major issues.

Output valid JSON matching the requested schema.`,
  skillDomain: ["accessibility_criteria", "wcag_patterns"],
  producesSkillsFor: [],
  temperature: 0.1,
  maxTokens: 4096,
};
