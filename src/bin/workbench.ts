#!/usr/bin/env node

/**
 * Workbench entry point.
 *
 * Starts the production API server plus dev-only /workbench routes
 * for agent training and iteration inspection.
 */

import { createWorkbench } from "../workbench/index.js";
import { AnthropicAiProvider } from "../providers/anthropic.js";
import { S3StorageProvider } from "../providers/s3.js";
import { LocalStorageProvider } from "../providers/local-storage.js";
import { BullMQQueueProvider } from "../providers/bullmq.js";
import type { DataProvider } from "../core/providers.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

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

const noopDataProvider: DataProvider = {
  async getDocumentData(): Promise<unknown> {
    throw new Error("No DataProvider configured. Use the upload path.");
  },
};

const port = parseInt(process.env.PORT ?? "4100", 10);

const workbench = createWorkbench({
  connectionString: requireEnv("DATABASE_URL"),
  ai,
  storage,
  data: noopDataProvider,
  queue,
  corsOrigin: process.env.CORS_ORIGIN,
});

const app = await workbench.start(port);

console.log(`Workbench listening on port ${port}`);
console.log(`  Production API: http://localhost:${port}/api/documents`);
console.log(`  Workbench:      http://localhost:${port}/workbench/doc-types`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, shutting down...`);
    await app.close();
    await workbench.shutdown();
    process.exit(0);
  });
}
