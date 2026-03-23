/**
 * Pipeline module — re-exports types, executor, steps, and default pipeline.
 */

export type {
  PipelineStep,
  PipelineContext,
  PipelineState,
  StepResult,
} from "./types.js";

export {
  runPipeline,
  createInitialState,
  updateBookStatus,
  updateJobStatus,
} from "./executor.js";

// Steps
export { seedSkillsStep } from "./steps/seed-skills.js";
export { analyzeStyleStep } from "./steps/analyze-style.js";
export { indexPriorDocumentStep } from "./steps/index-prior-document.js";
export { extractPriorContentStep } from "./steps/extract-prior-content.js";
export { mergeSectionListStep } from "./steps/merge-section-list.js";
export { fetchDataStep } from "./steps/fetch-data.js";
export { detectGapsStep } from "./steps/detect-gaps.js";
export { generateSectionsStep } from "./steps/generate-sections.js";
export { renderChartsStep } from "./steps/render-charts.js";
export { reviewAndIterateStep } from "./steps/review-and-iterate.js";
export { renderOutputStep } from "./steps/render-output.js";
export { finalizeStep } from "./steps/finalize.js";

// ─── Default Pipeline ───────────────────────────────────────────────────

import type { PipelineStep } from "./types.js";
import { seedSkillsStep } from "./steps/seed-skills.js";
import { analyzeStyleStep } from "./steps/analyze-style.js";
import { indexPriorDocumentStep } from "./steps/index-prior-document.js";
import { extractPriorContentStep } from "./steps/extract-prior-content.js";
import { mergeSectionListStep } from "./steps/merge-section-list.js";
import { fetchDataStep } from "./steps/fetch-data.js";
import { detectGapsStep } from "./steps/detect-gaps.js";
import { generateSectionsStep } from "./steps/generate-sections.js";
import { renderChartsStep } from "./steps/render-charts.js";
import { reviewAndIterateStep } from "./steps/review-and-iterate.js";
import { renderOutputStep } from "./steps/render-output.js";
import { finalizeStep } from "./steps/finalize.js";

/**
 * Build the default document generation pipeline.
 *
 * Steps:
 *  1. Seed skills (idempotent)
 *  2. Analyze prior document for style (colors, typography, layout)
 *  3. Index prior document structure (TOC, section mapping)
 *  4. Extract prior content (narrative, tables, charts per section)
 *  5. Merge section list (combine standard + custom sections from prior PDF)
 *  6. Fetch/parse document data
 *  7. Detect data gaps → create todos
 *  8. Generate sections (rewrite from prior + new data, or generate from scratch)
 *  9. Render charts + persist sections
 * 10. Review and iterate (loop with revision)
 * 11. Render final output (PDF)
 * 12. Finalize (set status based on open todos)
 */
export function buildDefaultPipeline(): PipelineStep[] {
  return [
    seedSkillsStep,
    analyzeStyleStep,
    indexPriorDocumentStep,
    extractPriorContentStep,
    mergeSectionListStep,
    fetchDataStep,
    detectGapsStep,
    generateSectionsStep,
    renderChartsStep,
    reviewAndIterateStep,
    renderOutputStep,
    finalizeStep,
  ];
}
