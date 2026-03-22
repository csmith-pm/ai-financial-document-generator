/**
 * Todo Creator — inserts todo records from detected data gaps
 * and GFOA review recommendations.
 *
 * Generic createTodosFromDataGaps stays here.
 * Budget-book-specific createTodosFromGfoaReview is re-exported
 * from doc-types/budget-book/todo-factory.ts.
 */

import { documentTodos } from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { DetectedGap } from "../doc-type.js";

/**
 * Create todos from detected data gaps (generic — works for any doc type).
 */
export async function createTodosFromDataGaps(
  db: DrizzleInstance,
  documentId: string,
  tenantId: string,
  gaps: DetectedGap[]
): Promise<void> {
  for (const gap of gaps) {
    await db.insert(documentTodos).values({
      documentId,
      tenantId,
      category: gap.category,
      title: gap.title,
      description: gap.description,
      sectionType: gap.sectionType,
      status: "open",
      priority: gap.priority,
    });
  }
}

// Re-export budget-book-specific todo creator for backward compatibility
export { createTodosFromGfoaReview } from "../../doc-types/budget-book/todo-factory.js";
