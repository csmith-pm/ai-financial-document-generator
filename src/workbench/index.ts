/**
 * Workbench — a superset of the production server that layers
 * dev-only routes for agent training and iteration inspection.
 *
 * Routes are mounted at /workbench/* with no auth middleware.
 */

import type { FastifyInstance } from "fastify";
import type {
  AiProvider,
  StorageProvider,
  DataProvider,
  QueueProvider,
} from "../core/providers.js";
import { createPool, createDb } from "../db/connection.js";
import { createServer } from "../api/server.js";
import { workbenchRoutes } from "./routes/index.js";

// Ensure doc types are registered
import "../doc-types/index.js";

export interface WorkbenchOptions {
  connectionString: string;
  ai: AiProvider;
  storage: StorageProvider;
  data: DataProvider;
  queue: QueueProvider;
  corsOrigin?: string | string[];
}

export interface Workbench {
  /** Start the workbench server (production + dev routes) */
  start(port?: number): Promise<FastifyInstance>;
  /** Gracefully shut down */
  shutdown(): Promise<void>;
}

export function createWorkbench(options: WorkbenchOptions): Workbench {
  const pool = createPool(options.connectionString);
  const db = createDb(pool);

  return {
    async start(port = 4100): Promise<FastifyInstance> {
      // Create the production server (includes /api routes + health)
      const app = await createServer({
        db,
        ai: options.ai,
        storage: options.storage,
        queue: options.queue,
        corsOrigin: options.corsOrigin,
      });

      // Layer workbench routes (no auth required)
      await workbenchRoutes(app, { db, ai: options.ai });

      await app.listen({ port, host: "0.0.0.0" });
      return app;
    },

    async shutdown(): Promise<void> {
      await pool.end();
    },
  };
}
