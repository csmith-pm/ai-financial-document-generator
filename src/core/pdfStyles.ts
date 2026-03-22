/**
 * Re-export shim — PDF styles now live in doc-types/budget-book/pdf/styles.ts.
 * This file maintains backward compatibility for all existing imports.
 */

export {
  getColorsFromAnalysis,
  createBudgetBookStyles,
  type BudgetBookColors,
} from "../doc-types/budget-book/pdf/styles.js";
