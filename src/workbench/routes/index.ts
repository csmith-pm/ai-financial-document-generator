/**
 * Workbench route registration — mounts all dev-only routes
 * under the /workbench prefix.
 */

import type { FastifyInstance } from "fastify";
import type { DrizzleInstance } from "../../db/connection.js";
import type { AiProvider } from "../../core/providers.js";
import { runSectionRoutes } from "./run-section.js";
import { iterationsRoutes } from "./iterations.js";
import { skillsRoutes } from "./skills.js";
import { uploadTestDataRoutes } from "./upload-test-data.js";
import { docTypesRoutes } from "./doc-types.js";

export interface WorkbenchRouteDeps {
  db: DrizzleInstance;
  ai: AiProvider;
}

export async function workbenchRoutes(
  app: FastifyInstance,
  deps: WorkbenchRouteDeps
): Promise<void> {
  await runSectionRoutes(app, { db: deps.db, ai: deps.ai });
  await iterationsRoutes(app, { db: deps.db });
  await skillsRoutes(app, { db: deps.db });
  await uploadTestDataRoutes(app, { ai: deps.ai });
  await docTypesRoutes(app);
}
