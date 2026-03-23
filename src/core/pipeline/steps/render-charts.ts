/**
 * Pipeline step: Render charts and persist sections to database.
 *
 * For each generated section, renders chart images and inserts the section
 * row into the database with chart S3 keys.
 *
 * Reads: pCtx.state.sections, pCtx.docType.storagePrefix
 * Writes: DB side-effect (inserts section rows)
 */

import type { PipelineStep, PipelineContext, StepResult } from "../types.js";
import type { SectionOutput } from "../../doc-type.js";
import type { EngineContext } from "../../context.js";
import { documentSections } from "../../../db/schema.js";
import { renderChartsForSection } from "../../chartRenderer.js";
import { updateJobStatus } from "../executor.js";

// ── Chart Rendering Helper ───────────────────────────────────────────────

export async function renderAndUploadCharts(
  ctx: EngineContext,
  section: SectionOutput,
  documentId: string,
  storagePrefix: string,
  suffix: string = ""
): Promise<string[]> {
  const s3Keys: string[] = [];
  if (section.chartConfigs.length === 0) return s3Keys;

  try {
    const chartBuffers = await renderChartsForSection(section.chartConfigs);
    for (let j = 0; j < chartBuffers.length; j++) {
      const buf = chartBuffers[j];
      if (!buf) continue;
      const key = `${ctx.tenantId}/${storagePrefix}/${documentId}/charts/${section.sectionType}-${j}${suffix}.png`;
      await ctx.storage.upload(key, buf, "image/png");
      s3Keys.push(key);
    }
  } catch (chartErr) {
    console.warn(
      `[pipeline] Chart rendering failed for ${section.sectionType}, continuing:`,
      chartErr
    );
  }
  return s3Keys;
}

// ── Pipeline Step ────────────────────────────────────────────────────────

export const renderChartsStep: PipelineStep = {
  id: "render_charts",
  name: "Render Charts",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;

    // Skip when Composer agent handles visuals via LayoutSpec
    if (docType.composerAgentType && state.layoutSpec) {
      return { status: "skipped", message: "Visuals handled by Composer agent via LayoutSpec" };
    }

    const allSectionSpecs = docType.sectionTypes;

    await updateJobStatus(
      ctx.db,
      documentId,
      "render_charts",
      "running",
      0,
      "Rendering charts..."
    );

    for (const section of state.sections) {
      const s3Keys = await renderAndUploadCharts(
        ctx,
        section,
        documentId,
        docType.storagePrefix
      );

      await ctx.db.insert(documentSections).values({
        documentId,
        tenantId: ctx.tenantId,
        sectionType: section.sectionType,
        sectionOrder: allSectionSpecs.findIndex(
          (s) => s.id === section.sectionType
        ),
        title: section.title,
        narrativeContent: section.narrativeContent,
        tableData: section.tableData,
        chartConfigs:
          section.chartConfigs as unknown as Record<string, unknown>[],
        chartImageS3Keys: s3Keys,
      });
    }

    await updateJobStatus(
      ctx.db,
      documentId,
      "render_charts",
      "completed",
      100,
      "Charts rendered"
    );

    return { status: "completed", message: "Charts rendered and sections persisted" };
  },
};
