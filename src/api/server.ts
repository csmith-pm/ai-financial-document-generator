import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { DrizzleInstance } from "../db/connection.js";
import type {
  AiProvider,
  StorageProvider,
  QueueProvider,
} from "../core/providers.js";
import { authMiddleware } from "./middleware/auth.js";
import { healthRoutes } from "./routes/health.js";
import { documentRoutes } from "./routes/documents.js";

export interface ServerConfig {
  db: DrizzleInstance;
  ai: AiProvider;
  storage: StorageProvider;
  queue: QueueProvider;
  corsOrigin?: string | string[];
}

export async function createServer(config: ServerConfig) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin ?? true,
  });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  // Auth middleware for /api routes
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api")) {
      await authMiddleware(request, reply);
    }
  });

  // Register routes
  await healthRoutes(app);

  await documentRoutes(app, {
    db: config.db,
    ai: config.ai,
    storage: config.storage,
    queue: config.queue,
  });

  return app;
}
