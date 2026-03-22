/**
 * Workbench route: run a single section generation in isolation.
 *
 * POST /workbench/run-section
 *
 * Stateless — no DB write, returns raw AI output for rapid iteration.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DrizzleInstance } from "../../db/connection.js";
import type { AiProvider } from "../../core/providers.js";
import { defaultRegistry } from "../../core/doc-type-registry.js";
import { buildAgentPrompt } from "../../core/agents/promptBuilder.js";
import type { SectionOutput } from "../../core/doc-type.js";

const runSectionSchema = z.object({
  docType: z.string().min(1),
  sectionType: z.string().min(1),
  tenantId: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

export interface RunSectionDeps {
  db: DrizzleInstance;
  ai: AiProvider;
}

export async function runSectionRoutes(
  app: FastifyInstance,
  deps: RunSectionDeps
): Promise<void> {
  const { db, ai } = deps;

  app.post("/workbench/run-section", async (request, reply) => {
    const body = runSectionSchema.parse(request.body);

    if (!defaultRegistry.has(body.docType)) {
      reply.status(400).send({ error: `Unknown document type: "${body.docType}"` });
      return;
    }

    const docType = defaultRegistry.get(body.docType);

    // Validate section type exists
    const sectionSpec = docType.sectionTypes.find((s) => s.id === body.sectionType);
    if (!sectionSpec) {
      reply.status(400).send({
        error: `Unknown section type: "${body.sectionType}"`,
        available: docType.sectionTypes.map((s) => s.id),
      });
      return;
    }

    // Use provided data or empty object — caller is expected to provide data
    const data = body.data ?? {};

    // Find the creator agent (first non-reviewer, non-advisor agent)
    const creatorAgent = docType.agents.find(
      (a) => !a.type.includes("reviewer") && !a.type.includes("advisor")
    );
    if (!creatorAgent) {
      reply.status(500).send({ error: "No creator agent found for this doc type" });
      return;
    }

    const systemPrompt = await buildAgentPrompt(db, creatorAgent.type, body.tenantId, creatorAgent.baseSystemPrompt);
    const userPrompt = docType.getSectionPrompt(body.sectionType, data, null);

    const result = await ai.callJson<SectionOutput>(systemPrompt, userPrompt, {
      maxTokens: creatorAgent.maxTokens,
      temperature: creatorAgent.temperature,
    });

    return {
      section: result.data,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
      },
      prompts: {
        system: systemPrompt,
        user: userPrompt,
      },
    };
  });
}
