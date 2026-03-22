/**
 * Workbench route: list registered document types with their configs.
 *
 * GET /workbench/doc-types
 */

import type { FastifyInstance } from "fastify";
import { defaultRegistry } from "../../core/doc-type-registry.js";

export async function docTypesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workbench/doc-types", async (_request, _reply) => {
    const docTypes = defaultRegistry.list().map((dt) => ({
      id: dt.id,
      name: dt.name,
      version: dt.version,
      sectionTypes: dt.sectionTypes,
      agents: dt.agents.map((a) => ({
        name: a.name,
        type: a.type,
        role: a.role,
        temperature: a.temperature,
        maxTokens: a.maxTokens,
      })),
      reviewers: dt.reviewers.map((r) => ({
        id: r.id,
        agentType: r.agentType,
      })),
      seedSkillCount: dt.seedSkills.length,
      storagePrefix: dt.storagePrefix,
      advisorAgentType: dt.advisorAgentType,
      hasParseUpload: !!dt.parseUpload,
      hasRenderPdf: !!dt.renderPdf,
      hasAnalyzePriorDocument: !!dt.analyzePriorDocument,
    }));

    return { docTypes };
  });
}
