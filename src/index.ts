import type { FastifyInstance } from "fastify";
import type {
  AiProvider,
  StorageProvider,
  DataProvider,
  QueueProvider,
  EngineConfig,
} from "./core/providers.js";
import type { EngineContext } from "./core/context.js";
import { createPool, createDb } from "./db/connection.js";
import { createServer } from "./api/server.js";
import { startWorker } from "./worker/index.js";
import {
  orchestrateDocumentGeneration,
  orchestrateBudgetBookGeneration,
  resumeBudgetBookGeneration,
} from "./core/orchestrator.js";

// Register document types (side-effect import)
import "./doc-types/index.js";

// Re-export core types for consumers
export type { AiProvider, StorageProvider, DataProvider, QueueProvider, EngineConfig } from "./core/providers.js";
export type { EngineContext } from "./core/context.js";
export type { BudgetBookData } from "./core/providers.js";
export type { StyleAnalysis } from "./core/types.js";
export type { DocumentTypeDefinition, SectionOutput, ReviewerSpec } from "./core/doc-type.js";
export type { PipelineStep, PipelineContext, PipelineState, StepResult } from "./core/pipeline/types.js";
export { defaultRegistry } from "./doc-types/index.js";
export { orchestrateDocumentGeneration, resumeDocumentGeneration } from "./core/orchestrator.js";
export { buildDefaultPipeline, runPipeline } from "./core/pipeline/index.js";

// Re-export provider implementations
export { AnthropicAiProvider } from "./providers/anthropic.js";
export { S3StorageProvider } from "./providers/s3.js";
export { LocalStorageProvider } from "./providers/local-storage.js";
export { ExcelDataProvider } from "./providers/excel-data.js";
export { BullMQQueueProvider } from "./providers/bullmq.js";

// Re-export schema for migrations
export * from "./db/schema.js";

export interface BudgetBookEngine {
  generate(budgetBookId: string, tenantId: string): Promise<void>;
  startServer(port?: number): Promise<FastifyInstance>;
  startWorker(): void;
  shutdown(): Promise<void>;
}

export interface CreateEngineOptions {
  connectionString: string;
  ai: AiProvider;
  storage: StorageProvider;
  data: DataProvider;
  queue: QueueProvider;
  corsOrigin?: string | string[];
  defaultModel?: string;
  maxIterations?: number;
  chartsEnabled?: boolean;
}

export function createBudgetBookEngine(
  options: CreateEngineOptions
): BudgetBookEngine {
  const pool = createPool(options.connectionString);
  const db = createDb(pool);

  function createContext(tenantId: string): EngineContext {
    return {
      db,
      ai: options.ai,
      storage: options.storage,
      data: options.data,
      tenantId,
      config: {
        maxIterations: options.maxIterations ?? 3,
        chartsEnabled: options.chartsEnabled ?? true,
        defaultModel: options.defaultModel ?? "claude-sonnet-4-20250514",
      },
    };
  }

  return {
    async generate(budgetBookId: string, tenantId: string): Promise<void> {
      const ctx = createContext(tenantId);
      await orchestrateBudgetBookGeneration(ctx, budgetBookId);
    },

    async startServer(port = 4000): Promise<FastifyInstance> {
      const app = await createServer({
        db,
        ai: options.ai,
        storage: options.storage,
        queue: options.queue,
        corsOrigin: options.corsOrigin,
      });
      await app.listen({ port, host: "0.0.0.0" });
      return app;
    },

    startWorker(): void {
      startWorker({
        queue: options.queue,
        createContext,
      });
    },

    async shutdown(): Promise<void> {
      await pool.end();
    },
  };
}
