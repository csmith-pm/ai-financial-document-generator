import type { QueueProvider } from "../core/providers.js";
import type { EngineContext } from "../core/context.js";
import {
  orchestrateDocumentGeneration,
  resumeDocumentGeneration,
} from "../core/orchestrator.js";

export interface WorkerConfig {
  queue: QueueProvider;
  createContext: (tenantId: string) => EngineContext;
}

/**
 * Registers job handlers for document generation.
 */
export function startWorker(config: WorkerConfig): void {
  const { queue, createContext } = config;

  queue.process("generate-document", async (payload) => {
    const { documentId, tenantId } = payload as {
      documentId: string;
      tenantId: string;
    };
    const ctx = createContext(tenantId);
    await orchestrateDocumentGeneration(ctx, documentId);
  });

  queue.process("regenerate-document", async (payload) => {
    const { documentId, tenantId } = payload as {
      documentId: string;
      tenantId: string;
    };
    const ctx = createContext(tenantId);
    await resumeDocumentGeneration(ctx, documentId);
  });
}
