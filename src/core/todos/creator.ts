/**
 * Todo Creator — inserts todo records from detected data gaps.
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
