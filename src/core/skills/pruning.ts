/**
 * Skill Pruning — enforces a cap on active skills per agent + tenant.
 *
 * When the count exceeds MAX_SKILLS, the oldest and lowest-confidence
 * skills are retired.
 */

import { eq, and, asc } from "drizzle-orm";
import { agentSkills } from "../../db/schema.js";
import { type DrizzleInstance } from "../../db/connection.js";
const MAX_SKILLS_PER_AGENT_CUSTOMER = 30;

/**
 * Prune excess active skills for a given agent + tenant.
 * Retires lowest-confidence, then oldest skills.
 */
export async function pruneSkills(
  db: DrizzleInstance,
  agentType: string,
  tenantId: string,
  maxSkills: number = MAX_SKILLS_PER_AGENT_CUSTOMER
): Promise<number> {
  const activeSkills = await db
    .select({ id: agentSkills.id })
    .from(agentSkills)
    .where(
      and(
        eq(agentSkills.agentType, agentType),
        eq(agentSkills.tenantId, tenantId),
        eq(agentSkills.scope, "customer"),
        eq(agentSkills.status, "active")
      )
    )
    .orderBy(asc(agentSkills.confidence), asc(agentSkills.createdAt));

  if (activeSkills.length <= maxSkills) {
    return 0;
  }

  const toRetire = activeSkills.slice(0, activeSkills.length - maxSkills);

  for (const skill of toRetire) {
    await db
      .update(agentSkills)
      .set({ status: "retired", updatedAt: new Date() })
      .where(eq(agentSkills.id, skill.id));
  }

  return toRetire.length;
}
