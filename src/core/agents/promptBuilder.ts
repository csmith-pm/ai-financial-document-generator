/**
 * Prompt Builder — assembles agent system prompts with accumulated skills.
 *
 * Loads base prompt from agent definition, then injects global + tenant
 * skills ranked by confidence. Tenant skills override global skills in
 * the same category.
 */

import { eq, and, or, isNull, desc } from "drizzle-orm";
import { agentSkills } from "../../db/schema.js";
import { type DrizzleInstance } from "../../db/connection.js";
import { getAgentDefinition } from "./definitions.js";

interface LoadedSkill {
  id: string;
  skill: string;
  category: string;
  trigger: string | null;
  confidence: string;
  scope: string;
}

const MAX_SKILLS_PER_PROMPT = 15;

/**
 * Build the full system prompt for an agent, including accumulated skills.
 */
export async function buildAgentPrompt(
  db: DrizzleInstance,
  agentType: string,
  tenantId: string
): Promise<string> {
  const definition = getAgentDefinition(agentType as import("./definitions.js").AgentType);

  // Load active skills for this agent: global + tenant-specific
  const rows: LoadedSkill[] = await db
    .select({
      id: agentSkills.id,
      skill: agentSkills.skill,
      category: agentSkills.category,
      trigger: agentSkills.trigger,
      confidence: agentSkills.confidence,
      scope: agentSkills.scope,
    })
    .from(agentSkills)
    .where(
      and(
        eq(agentSkills.agentType, agentType),
        eq(agentSkills.status, "active"),
        or(
          eq(agentSkills.scope, "global"),
          and(
            eq(agentSkills.scope, "customer"),
            eq(agentSkills.tenantId, tenantId)
          )
        )
      )
    )
    .orderBy(desc(agentSkills.confidence))
    .limit(100); // Over-fetch to allow dedup

  // Tenant skills override global skills in the same category
  const skillsByCategory = new Map<string, LoadedSkill>();
  for (const row of rows) {
    const existing = skillsByCategory.get(row.category);
    if (!existing) {
      skillsByCategory.set(row.category, row);
    } else if (row.scope === "customer" && existing.scope === "global") {
      // Tenant overrides global
      skillsByCategory.set(row.category, row);
    } else if (
      row.scope === existing.scope &&
      Number(row.confidence) > Number(existing.confidence)
    ) {
      // Same scope: higher confidence wins
      skillsByCategory.set(row.category, row);
    }
  }

  // Take top N by confidence
  const selectedSkills = [...skillsByCategory.values()]
    .sort((a, b) => Number(b.confidence) - Number(a.confidence))
    .slice(0, MAX_SKILLS_PER_PROMPT);

  if (selectedSkills.length === 0) {
    return definition.baseSystemPrompt;
  }

  // Format skills as a guidelines section
  const skillLines = selectedSkills.map((s, i) => {
    const triggerNote = s.trigger ? ` (when: ${s.trigger})` : "";
    return `${i + 1}. [${s.category}]${triggerNote} ${s.skill}`;
  });

  return `${definition.baseSystemPrompt}

## Learned Guidelines

The following guidelines have been learned from prior reviews and iterations. Follow them when applicable:

${skillLines.join("\n")}`;
}
