/**
 * Global Skill Seeds — generic seeding mechanism.
 *
 * The seed data itself lives in each doc type module.
 * This file provides the generic seedGlobalSkills function
 * and re-exports GLOBAL_SEEDS from budget-book for backward compat.
 */

import { eq } from "drizzle-orm";
import { agentSkills } from "../../db/schema.js";
import { type DrizzleInstance } from "../../db/connection.js";
import type { SeedSkill } from "../doc-type.js";

// Re-export budget-book seeds for backward compatibility
export { GLOBAL_SEEDS } from "../../doc-types/budget-book/seeds.js";

/**
 * Seed global skills. Idempotent — checks for existing globals before inserting.
 *
 * @param db - database instance
 * @param seeds - optional explicit seed list; if omitted, uses budget-book seeds
 */
export async function seedGlobalSkills(
  db: DrizzleInstance,
  seeds?: SeedSkill[]
): Promise<number> {
  // Lazy import to avoid circular deps when no seeds passed
  const seedList =
    seeds ??
    (await import("../../doc-types/budget-book/seeds.js")).GLOBAL_SEEDS;

  // Check if globals already exist
  const existingGlobals = await db
    .select({ id: agentSkills.id })
    .from(agentSkills)
    .where(eq(agentSkills.scope, "global"))
    .limit(1);

  if (existingGlobals.length > 0) {
    return 0; // Already seeded
  }

  let inserted = 0;
  for (const seed of seedList) {
    await db.insert(agentSkills).values({
      agentType: seed.agentType,
      tenantId: null,
      scope: "global",
      skill: seed.skill,
      category: seed.category,
      trigger: seed.trigger,
      source: "seed",
      confidence: String(seed.confidence),
      status: "active",
    });
    inserted++;
  }

  return inserted;
}
