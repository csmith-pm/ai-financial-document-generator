/**
 * Re-export shim — data gap detection now lives in doc-types/budget-book/detector.ts.
 * This file maintains backward compatibility for all existing imports.
 */

export { detectDataGaps } from "../../doc-types/budget-book/detector.js";
export type { DetectedGap } from "../doc-type.js";
