/**
 * Workbench route: skill audit trail for a doc type + tenant.
 *
 * GET /workbench/skills/:docType/:tenantId
 */

import type { FastifyInstance } from "fastify";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { agentSkills } from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import { defaultRegistry } from "../../core/doc-type-registry.js";

const paramsSchema = z.object({
  docType: z.string().min(1),
  tenantId: z.string().min(1),
});

export interface SkillsDeps {
  db: DrizzleInstance;
}

export async function skillsRoutes(
  app: FastifyInstance,
  deps: SkillsDeps
): Promise<void> {
  const { db } = deps;

  app.get("/workbench/skills/:docType/:tenantId", async (request, reply) => {
    const { docType: docTypeId, tenantId } = paramsSchema.parse(request.params);

    if (!defaultRegistry.has(docTypeId)) {
      reply.status(400).send({ error: `Unknown document type: "${docTypeId}"` });
      return;
    }

    const docType = defaultRegistry.get(docTypeId);
    const agentTypes = docType.agents.map((a) => a.type);

    // Query skills for all agents in this doc type, scoped to global + tenant
    const allSkills = await db
      .select()
      .from(agentSkills)
      .where(
        and(
          or(
            eq(agentSkills.scope, "global"),
            and(
              eq(agentSkills.scope, "customer"),
              eq(agentSkills.tenantId, tenantId)
            )
          )
        )
      )
      .orderBy(desc(agentSkills.confidence));

    // Filter to only agents belonging to this doc type
    const filtered = allSkills.filter((s) => agentTypes.includes(s.agentType));

    // Group by agent type
    const byAgent: Record<string, typeof filtered> = {};
    for (const skill of filtered) {
      if (!byAgent[skill.agentType]) {
        byAgent[skill.agentType] = [];
      }
      byAgent[skill.agentType].push(skill);
    }

    return {
      docType: docTypeId,
      tenantId,
      agentTypes,
      totalSkills: filtered.length,
      byAgent,
    };
  });
}
