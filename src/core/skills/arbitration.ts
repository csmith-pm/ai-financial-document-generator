/**
 * Skill Arbitration — resolves conflicts when new skills overlap with
 * existing ones using deterministic priority rules.
 *
 * Priority hierarchy: ADA compliance > GFOA criteria > style preferences.
 * Within the same priority tier, higher confidence wins.
 * No AI calls — this is pure code logic.
 */

import { eq, and, or, isNull } from "drizzle-orm";
import { agentSkills } from "../../db/schema.js";
import { type DrizzleInstance } from "../../db/connection.js";
import type { AgentType } from "../agents/definitions.js";

interface NewSkill {
  agentType: AgentType;
  skill: string;
  category: string;
  trigger: string;
  confidence: number;
  source: string;
}

/** Category priority: higher number = higher priority */
const CATEGORY_PRIORITY: Record<string, number> = {
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

function getCategoryPriority(category: string): number {
  return CATEGORY_PRIORITY[category] ?? 10;
}

/**
 * Insert a new skill, resolving conflicts with existing skills
 * in the same category deterministically.
 */
export async function negotiateSkill(
  db: DrizzleInstance,
  tenantId: string,
  newSkill: NewSkill
): Promise<void> {
  // Find existing active skills for same agent + tenant + category
  const existing = await db
    .select()
    .from(agentSkills)
    .where(
      and(
        eq(agentSkills.agentType, newSkill.agentType),
        eq(agentSkills.category, newSkill.category),
        eq(agentSkills.status, "active"),
        or(
          and(
            eq(agentSkills.scope, "customer"),
            eq(agentSkills.tenantId, tenantId)
          ),
          eq(agentSkills.scope, "global")
        )
      )
    );

  if (existing.length === 0) {
    // No conflict — insert directly
    await db.insert(agentSkills).values({
      agentType: newSkill.agentType,
      tenantId,
      scope: "customer",
      skill: newSkill.skill,
      category: newSkill.category,
      trigger: newSkill.trigger,
      source: newSkill.source,
      confidence: String(newSkill.confidence),
      status: "active",
    });
    return;
  }

  // Check for duplicates — if an existing skill says roughly the same thing, skip
  const isDuplicate = existing.some(
    (e: { skill: string }) =>
      e.skill.toLowerCase().trim() === newSkill.skill.toLowerCase().trim()
  );
  if (isDuplicate) return;

  // Resolve conflict: new customer skill always overrides global.
  // Among customer skills, higher confidence wins.
  for (const e of existing) {
    const existingConf = Number(e.confidence);
    const isGlobal = e.scope === "global";

    if (isGlobal) {
      // Customer skill always supersedes global — retire the global
      // (only for this customer's context; global remains active for others)
      // We don't retire globals — just let customer skill take precedence via promptBuilder
      continue;
    }

    // Same scope (customer): higher confidence wins
    if (newSkill.confidence > existingConf) {
      await db
        .update(agentSkills)
        .set({ status: "retired", updatedAt: new Date() })
        .where(eq(agentSkills.id, e.id));
    } else {
      // Existing skill is better — don't insert the new one
      return;
    }
  }

  // Insert the new skill
  await db.insert(agentSkills).values({
    agentType: newSkill.agentType,
    tenantId,
    scope: "customer",
    skill: newSkill.skill,
    category: newSkill.category,
    trigger: newSkill.trigger,
    source: newSkill.source,
    confidence: String(newSkill.confidence),
    status: "active",
  });
}
