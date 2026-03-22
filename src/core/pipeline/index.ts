/**
 * Pipeline module — re-exports types and executor.
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
