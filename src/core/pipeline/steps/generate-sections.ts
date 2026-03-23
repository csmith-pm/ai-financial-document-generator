/**
 * Pipeline step: Generate all sections.
 *
 * Respects section specs from the doc type: parallel, sequential, and structural.
 * Uses the doc type's getSectionPrompt() for per-section AI calls.
 *
 * Reads: pCtx.state.documentData, pCtx.state.styleAnalysis, pCtx.docType.sectionTypes
 * Writes: pCtx.state.sections
 */

import type { PipelineStep, PipelineContext, StepResult } from "../types.js";
import type { SectionOutput, DocumentTypeDefinition } from "../../doc-type.js";
import type { EngineContext } from "../../context.js";
import type { StyleAnalysis, PriorSectionContent } from "../../types.js";
import { buildAgentPrompt } from "../../agents/index.js";
import { updateJobStatus } from "../executor.js";

// ── Section Generation Helper ────────────────────────────────────────────

export async function generateSection(
  ctx: EngineContext,
  docType: DocumentTypeDefinition,
  sectionType: string,
  data: unknown,
  styleAnalysis: StyleAnalysis | null,
  priorContent?: PriorSectionContent | null
): Promise<SectionOutput> {
  const creatorAgent = docType.getAgent(docType.creatorAgentType);
  const systemPrompt = await buildAgentPrompt(
    ctx.db,
    docType.creatorAgentType,
    ctx.tenantId,
    creatorAgent.baseSystemPrompt
  );
  const userPrompt = docType.getSectionPrompt(sectionType, data, styleAnalysis, priorContent);

  const result = await ctx.ai.callJson<SectionOutput>(systemPrompt, userPrompt, {
    maxTokens: creatorAgent.maxTokens,
    temperature: creatorAgent.temperature,
  });

  await ctx.ai.logUsage?.(
    ctx.tenantId,
    `${docType.creatorAgentType}_${sectionType}`,
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  return result.data;
}

// ── Pipeline Step ────────────────────────────────────────────────────────

export const generateSectionsStep: PipelineStep = {
  id: "generate_sections",
  name: "Generate Sections",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;
    const sections: SectionOutput[] = [];
    const allSectionSpecs = state.effectiveSections.length > 0
      ? state.effectiveSections
      : docType.sectionTypes;
    const contentSpecs = allSectionSpecs.filter((s) => !s.structural);
    const structuralSpecs = allSectionSpecs.filter((s) => s.structural);

    const parallelSpecs = contentSpecs.filter((s) => s.parallel);
    const sequentialSpecs = contentSpecs.filter((s) => !s.parallel);

    // Run parallel sections concurrently
    await updateJobStatus(
      ctx.db,
      documentId,
      "generate_sections",
      "running",
      10,
      "Generating data sections in parallel..."
    );

    const parallelResults = await Promise.all(
      parallelSpecs.map((spec) =>
        generateSection(ctx, docType, spec.id, state.documentData, state.styleAnalysis, state.priorContent.get(spec.id))
      )
    );
    sections.push(...parallelResults);

    // Run sequential sections
    for (let i = 0; i < sequentialSpecs.length; i++) {
      const spec = sequentialSpecs[i]!;
      const progress = Math.round(50 + ((i + 1) / sequentialSpecs.length) * 30);
      await updateJobStatus(
        ctx.db,
        documentId,
        "generate_sections",
        "running",
        progress,
        `Generating ${spec.id.replace(/_/g, " ")}...`
      );
      const section = await generateSection(
        ctx,
        docType,
        spec.id,
        state.documentData,
        state.styleAnalysis,
        state.priorContent.get(spec.id)
      );
      sections.push(section);
    }

    // Generate structural sections (cover, toc)
    const structuralResults = await Promise.all(
      structuralSpecs.map((spec) =>
        generateSection(ctx, docType, spec.id, state.documentData, state.styleAnalysis, state.priorContent.get(spec.id))
      )
    );
    sections.push(...structuralResults);

    await updateJobStatus(
      ctx.db,
      documentId,
      "generate_sections",
      "completed",
      100,
      "All sections generated"
    );

    state.sections = sections;

    return {
      status: "completed",
      message: `${sections.length} sections generated`,
    };
  },
};
