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
 * 1. Seed skills (idempotent)
 * 2. Analyze prior document for style
 * 3. Fetch/parse document data
 * 4. Detect data gaps → create todos
 * 5. Generate sections (parallel/sequential/structural)
 * 6. Render charts + persist sections
 * 7. Review and iterate (loop with revision)
 * 8. Render final output (PDF)
 * 9. Finalize (set status based on open todos)
 */
export function buildDefaultPipeline(): PipelineStep[] {
  return [
    seedSkillsStep,
    analyzeStyleStep,
    fetchDataStep,
    detectGapsStep,
    generateSectionsStep,
    renderChartsStep,
    reviewAndIterateStep,
    renderOutputStep,
    finalizeStep,
  ];
}
