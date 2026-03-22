/**
 * Pipeline step: Seed global skills.
 *
 * Idempotent — seeds the doc type's predefined skills into the database.
 * Reads: pCtx.docType.seedSkills
 * Writes: nothing in state (DB side-effect only)
 */

import type { PipelineStep, PipelineContext, StepResult } from "../types.js";
import { seedGlobalSkills } from "../../skills/seeds.js";

export const seedSkillsStep: PipelineStep = {
  id: "seed_skills",
  name: "Seed Global Skills",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    await seedGlobalSkills(pCtx.ctx.db, pCtx.docType.seedSkills);
    return { status: "completed", message: "Global skills seeded" };
  },
};
