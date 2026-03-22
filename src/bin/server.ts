#!/usr/bin/env node

/**
 * API server entry point.
 *
 * Reads configuration from environment variables, wires up providers,
 * and starts the Fastify HTTP server.
 */

import { createBudgetBookEngine } from "../index.js";
import { AnthropicAiProvider } from "../providers/anthropic.js";
import { S3StorageProvider } from "../providers/s3.js";
import { LocalStorageProvider } from "../providers/local-storage.js";
import { BullMQQueueProvider } from "../providers/bullmq.js";
import type { DataProvider, BudgetBookData } from "../core/providers.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// --- Build providers from env ---

const ai = new AnthropicAiProvider({
  apiKey: requireEnv("ANTHROPIC_API_KEY"),
  defaultModel: process.env.DEFAULT_MODEL,
});

const useS3 = !!process.env.S3_BUCKET;
const storage = useS3
  ? new S3StorageProvider({
      bucket: process.env.S3_BUCKET!,
      region: process.env.AWS_REGION ?? "us-east-1",
    })
  : new LocalStorageProvider({ baseDir: process.env.LOCAL_STORAGE_DIR ?? "./storage" });

const queue = new BullMQQueueProvider({
  redisUrl: requireEnv("REDIS_URL"),
});

// DataProvider is a no-op at the server level — the orchestrator fetches data
// via upload parsing or the DataProvider passed at generation time.
// For standalone mode, generation always uses the "upload" path.
const noopDataProvider: DataProvider = {
  async getBudgetData(): Promise<BudgetBookData> {
    throw new Error(
      "No DataProvider configured. Use the upload path (POST /api/books/:id/budget-file) or provide a DataProvider implementation."
    );
  },
};

// --- Start engine ---

const port = parseInt(process.env.PORT ?? "4000", 10);

const engine = createBudgetBookEngine({
  connectionString: requireEnv("DATABASE_URL"),
  ai,
  storage,
  data: noopDataProvider,
  queue,
  corsOrigin: process.env.CORS_ORIGIN,
  maxIterations: parseInt(process.env.MAX_ITERATIONS ?? "3", 10),
  chartsEnabled: process.env.CHARTS_ENABLED !== "false",
  defaultModel: process.env.DEFAULT_MODEL,
});

// Register worker handlers on the same process for simplicity.
// For production, run the worker separately via `pnpm worker`.
engine.startWorker();

const app = await engine.startServer(port);

console.log(`Budget Book Engine API listening on port ${port}`);

// Graceful shutdown
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, shutting down...`);
    await app.close();
    await engine.shutdown();
    process.exit(0);
  });
}
