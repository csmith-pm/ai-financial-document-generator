#!/usr/bin/env node

/**
 * Background worker entry point.
 *
 * Connects to Redis, registers BullMQ job handlers, and processes
 * budget book generation jobs asynchronously.
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
  async getBudgetData(): Promise<BudgetBookData> {
    throw new Error("No DataProvider configured. Use the upload path.");
  },
};

const engine = createBudgetBookEngine({
  connectionString: requireEnv("DATABASE_URL"),
  ai,
  storage,
  data: noopDataProvider,
  queue,
  maxIterations: parseInt(process.env.MAX_ITERATIONS ?? "3", 10),
  chartsEnabled: process.env.CHARTS_ENABLED !== "false",
  defaultModel: process.env.DEFAULT_MODEL,
});

engine.startWorker();

console.log("Budget Book Engine worker started, waiting for jobs...");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, shutting down worker...`);
    await engine.shutdown();
    process.exit(0);
  });
}
