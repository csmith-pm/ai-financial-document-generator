/**
 * Pipeline step: Compose sections into LayoutSpecs using the Composer agent.
 *
 * Takes the Creator's structured output (narratives, tables, chart configs)
 * and produces a declarative LayoutSpec for each section — referencing
 * components from the Component Library by ID + props.
 *
 * Skipped when the doc type has no composerAgentType defined (backward compat).
 *
 * Reads: pCtx.state.sections, pCtx.state.styleAnalysis, pCtx.state.priorContent
 * Writes: pCtx.state.layoutSpec, pCtx.state.componentRegistry
 */

import { z } from "zod";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";
import type { SectionOutput } from "../../doc-type.js";
import type { PriorSectionContent } from "../../types.js";
import type { LayoutEntry, SectionLayoutSpec, DocumentLayoutSpec, ComponentStyles } from "../../components/types.js";
import { defaultComponentRegistry, ComponentRegistry } from "../../components/registry.js";
import { createComponent, loadCustomComponents } from "../../components/creator.js";
import { buildAgentPrompt } from "../../agents/index.js";
import { updateJobStatus } from "../executor.js";

// ─── LayoutEntry schema for validating AI output ────────────────────────

const layoutEntrySchema = z.object({
  componentId: z.string(),
  props: z.record(z.unknown()),
  order: z.number(),
  pageBreakBefore: z.boolean().optional(),
  pageBreakAfter: z.boolean().optional(),
});

const layoutSpecResponseSchema = z.array(layoutEntrySchema);

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Build the user prompt for the Composer agent given a section's content.
 */
function buildComposerPrompt(
  section: SectionOutput,
  priorContent: PriorSectionContent | undefined,
  availableComponents: string[]
): string {
  const parts: string[] = [];

  parts.push(`=== Section: ${section.title} (type: ${section.sectionType}) ===\n`);

  parts.push("AVAILABLE COMPONENTS:");
  parts.push(availableComponents.join(", "));
  parts.push("");

  parts.push("CONTENT FROM CREATOR:");
  if (section.narrativeContent) {
    parts.push(`Narrative (${section.narrativeContent.length} chars):`);
    parts.push(section.narrativeContent.slice(0, 2000));
    if (section.narrativeContent.length > 2000) parts.push("... [truncated]");
    parts.push("");
  }

  if (section.tableData?.length > 0) {
    parts.push(`Table data: ${section.tableData.length} rows`);
    parts.push(JSON.stringify(section.tableData.slice(0, 3), null, 2));
    if (section.tableData.length > 3) parts.push(`... and ${section.tableData.length - 3} more rows`);
    parts.push("");
  }

  if (section.chartConfigs?.length > 0) {
    parts.push(`Charts: ${section.chartConfigs.length} chart(s)`);
    for (const chart of section.chartConfigs) {
      parts.push(JSON.stringify({
        type: chart.type,
        title: chart.title,
        dataKeys: chart.dataKeys,
        categoryKey: chart.categoryKey,
        dataPointCount: chart.data.length,
      }));
    }
    parts.push("");
  }

  if (priorContent) {
    parts.push("PRIOR YEAR VISUAL STRUCTURE:");
    if (priorContent.chartDescriptions?.length > 0) {
      parts.push(`Charts in prior year: ${priorContent.chartDescriptions.map((c) => `${c.type}: ${c.title}`).join(", ")}`);
    }
    if (priorContent.tables?.length > 0) {
      parts.push(`Tables in prior year: ${priorContent.tables.length}`);
    }
    parts.push(`Prior narrative length: ${priorContent.narrative?.length ?? 0} chars`);
    parts.push("");
  }

  parts.push("Produce a JSON array of LayoutEntry objects. Output ONLY valid JSON.");

  return parts.join("\n");
}

// ─── Pipeline Step ──────────────────────────────────────────────────────

export const composeSectionsStep: PipelineStep = {
  id: "compose_sections",
  name: "Compose Sections",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;

    // Skip if no composer agent configured (backward compat)
    if (!docType.composerAgentType) {
      return { status: "skipped", message: "No composerAgentType configured" };
    }

    await updateJobStatus(ctx.db, documentId, "compose_sections", "running", 0, "Composing section layouts...");

    // Load component registry — built-ins + any custom from DB
    await import("../../components/built-in/index.js");
    const registry = defaultComponentRegistry;
    state.componentRegistry = registry;

    // Load custom (AI-generated) components from DB
    const customLoaded = await loadCustomComponents(ctx.db, registry, ctx.tenantId);
    if (customLoaded > 0) {
      console.log(`[compose] Loaded ${customLoaded} custom component(s) from DB`);
    }

    const availableComponents = registry.list().map((c) => `${c.id} (${c.category})`);

    // Get the Composer agent
    const composerAgent = docType.getAgent(docType.composerAgentType);
    const systemPrompt = await buildAgentPrompt(
      ctx.db,
      docType.composerAgentType,
      ctx.tenantId,
      composerAgent.baseSystemPrompt
    );

    const sectionLayouts: SectionLayoutSpec[] = [];
    const totalSections = state.sections.length;
    let completed = 0;
    let missingCount = 0;

    for (const section of state.sections) {
      const priorContent = state.priorContent.get(section.sectionType);
      const userPrompt = buildComposerPrompt(section, priorContent, availableComponents);

      try {
        const result = await ctx.ai.callJson<LayoutEntry[]>(systemPrompt, userPrompt, {
          maxTokens: composerAgent.maxTokens,
          temperature: composerAgent.temperature,
        });

        await ctx.ai.logUsage?.(
          ctx.tenantId,
          `composer_${section.sectionType}`,
          result.inputTokens,
          result.outputTokens,
          result.model
        );

        // Validate and clean entries
        const rawEntries = Array.isArray(result.data) ? result.data : [];
        const validEntries: LayoutEntry[] = [];

        for (const entry of rawEntries) {
          const parsed = layoutEntrySchema.safeParse(entry);
          if (!parsed.success) continue;

          const e = parsed.data;

          if (e.componentId === "__missing__") {
            missingCount++;
            // Try to create the missing component on the fly
            const description = String(e.props?.description ?? "Unknown visual element");
            try {
              const newId = await createComponent(ctx.ai, ctx.db, registry, description, ctx.tenantId);
              console.log(`[compose] Created new component "${newId}" for: ${description.slice(0, 80)}`);
              validEntries.push({ ...e, componentId: newId });
            } catch (createErr) {
              console.warn(`[compose] Failed to create component: ${createErr}`);
              validEntries.push(e); // Keep __missing__ as fallback
            }
          } else if (registry.has(e.componentId)) {
            // Validate props against component schema
            const comp = registry.get(e.componentId);
            const propsResult = comp.propsSchema.safeParse(e.props);
            if (propsResult.success) {
              validEntries.push({ ...e, props: propsResult.data as Record<string, unknown> });
            } else {
              // Props don't match — still include but with raw props
              console.warn(`[compose] Props validation failed for ${e.componentId} in ${section.sectionType}: ${propsResult.error.message}`);
              validEntries.push(e);
            }
          } else {
            console.warn(`[compose] Unknown component "${e.componentId}" in ${section.sectionType}`);
          }
        }

        sectionLayouts.push({
          sectionType: section.sectionType,
          title: section.title,
          entries: validEntries.sort((a, b) => a.order - b.order),
        });
      } catch (err) {
        console.error(`[compose] Failed to compose ${section.sectionType}:`, err);
        // On failure, create a simple fallback layout from the structured data
        const fallbackEntries: LayoutEntry[] = [];
        let order = 1;

        if (section.narrativeContent) {
          fallbackEntries.push({
            componentId: "narrative-block",
            props: { text: section.narrativeContent },
            order: order++,
          });
        }
        if (section.tableData?.length > 0) {
          fallbackEntries.push({
            componentId: "financial-table",
            props: { rows: section.tableData },
            order: order++,
          });
        }
        for (const chart of section.chartConfigs || []) {
          const chartId = `${chart.type}-chart`.replace("stacked-bar", "stacked-bar");
          fallbackEntries.push({
            componentId: registry.has(chartId) ? chartId : "bar-chart",
            props: {
              title: chart.title,
              chartType: chart.type,
              data: chart.data,
              dataKeys: chart.dataKeys,
              categoryKey: chart.categoryKey,
            },
            order: order++,
          });
        }

        sectionLayouts.push({
          sectionType: section.sectionType,
          title: section.title,
          entries: fallbackEntries,
        });
      }

      completed++;
      const progress = Math.round((completed / totalSections) * 100);
      await updateJobStatus(ctx.db, documentId, "compose_sections", "running", progress,
        `Composed ${completed}/${totalSections} sections`);
    }

    state.layoutSpec = { sections: sectionLayouts };

    const message = missingCount > 0
      ? `${sectionLayouts.length} sections composed (${missingCount} missing components)`
      : `${sectionLayouts.length} sections composed`;

    return { status: "completed", message };
  },
};
