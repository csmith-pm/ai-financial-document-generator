/**
 * Pipeline step: Merge section list from doc type + prior document index.
 *
 * Combines the doc type's hardcoded section specs with sections discovered
 * in the prior PDF's table of contents. Custom sections (unmapped in the
 * prior PDF) are added as new entries so the full prior document structure
 * is reproduced.
 *
 * Reads: pCtx.docType.sectionTypes, pCtx.state.documentIndex
 * Writes: pCtx.state.effectiveSections
 */

import type { SectionTypeSpec } from "../../doc-type.js";
import { updateJobStatus } from "../executor.js";
import type { PipelineStep, PipelineContext, StepResult } from "../types.js";

/**
 * Convert a section name to a safe ID: "Organizational Chart" → "custom_organizational_chart"
 */
function nameToId(name: string): string {
  return "custom_" + name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export const mergeSectionListStep: PipelineStep = {
  id: "merge_section_list",
  name: "Merge Section List",

  async execute(pCtx: PipelineContext): Promise<StepResult> {
    const { ctx, docType, documentId, state } = pCtx;
    const index = state.documentIndex;

    if (!index || index.sections.length === 0) {
      // No prior document index — use doc type's standard sections
      state.effectiveSections = [...docType.sectionTypes];
      return {
        status: "skipped",
        message: `Using ${docType.sectionTypes.length} standard sections (no prior document index)`,
      };
    }

    await updateJobStatus(
      ctx.db, documentId, "merge_section_list",
      "running", 0, "Merging section list from prior document..."
    );

    const standardById = new Map(docType.sectionTypes.map((s) => [s.id, s]));
    const usedStandardIds = new Set<string>();
    const merged: SectionTypeSpec[] = [];

    // Walk through prior PDF sections in order — preserves the prior document's structure
    for (let i = 0; i < index.sections.length; i++) {
      const priorSection = index.sections[i]!;

      if (priorSection.mappedSectionType) {
        // Mapped to a standard section — use the standard spec but with prior PDF ordering
        const standard = standardById.get(priorSection.mappedSectionType);
        if (standard) {
          merged.push({
            ...standard,
            order: i,
          });
          usedStandardIds.add(standard.id);
        }
      } else {
        // Custom section from prior PDF — create a new spec
        const customId = nameToId(priorSection.name);
        merged.push({
          id: customId,
          name: priorSection.name,
          order: i,
          parallel: true,
          structural: false,
        });
      }
    }

    // Add any standard sections not found in the prior PDF (structural ones like cover/toc)
    for (const standard of docType.sectionTypes) {
      if (!usedStandardIds.has(standard.id)) {
        merged.push({
          ...standard,
          order: merged.length,
        });
      }
    }

    // Sort by order
    merged.sort((a, b) => a.order - b.order);

    state.effectiveSections = merged;

    const customCount = merged.filter((s) => s.id.startsWith("custom_")).length;
    const standardCount = merged.length - customCount;

    return {
      status: "completed",
      message: `${merged.length} sections: ${standardCount} standard + ${customCount} custom from prior PDF`,
    };
  },
};
