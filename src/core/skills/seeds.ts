/**
 * Global Skill Seeds — generic seeding mechanism.
 *
 * The seed data itself lives in each doc type module.
 * This file provides the generic seedGlobalSkills function.
 */

import { eq } from "drizzle-orm";
import { agentSkills } from "../../db/schema.js";
import { type DrizzleInstance } from "../../db/connection.js";
import type { SeedSkill } from "../doc-type.js";

/**
 * Seed global skills. Idempotent — checks for existing globals before inserting.
 *
 * @param db - database instance
 * @param seeds - the seed skills to insert (from the doc type definition)
 */
export async function seedGlobalSkills(
  db: DrizzleInstance,
  seeds: SeedSkill[]
): Promise<number> {
  const seedList = seeds;

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
