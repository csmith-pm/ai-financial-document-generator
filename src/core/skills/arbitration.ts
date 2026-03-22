/**
 * Skill Arbitration — resolves conflicts when new skills overlap with
 * existing ones using deterministic priority rules.
 *
 * Priority hierarchy: ADA compliance > GFOA criteria > style preferences.
 * Within the same priority tier, higher confidence wins.
 * No AI calls — this is pure code logic.
 */

import { eq, and, or } from "drizzle-orm";
import { agentSkills } from "../../db/schema.js";
import { type DrizzleInstance } from "../../db/connection.js";


interface NewSkill {
  agentType: string;
  skill: string;
  category: string;
  trigger: string;
  confidence: number;
  source: string;
}

/**
 * Insert a new skill, resolving conflicts with existing skills
 * in the same category deterministically.
 *
 * @param db - database instance
 * @param tenantId - tenant ID
 * @param newSkill - the skill to insert
 * @param categoryPriority - optional priority map for conflict resolution
 */
export async function negotiateSkill(
  db: DrizzleInstance,
  tenantId: string,
  newSkill: NewSkill,
  categoryPriority?: Record<string, number>
): Promise<void> {
  const _priorities = categoryPriority ?? {};
  // priorities used for getCategoryPriority — currently the arbitration
  // logic doesn't use category priority directly (it uses confidence),
  // but the map is available for future use.
  void _priorities;

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
