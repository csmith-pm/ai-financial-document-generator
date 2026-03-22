import type { QueueProvider } from "../core/providers.js";
import type { EngineContext } from "../core/context.js";
import {
  orchestrateDocumentGeneration,
  resumeDocumentGeneration,
  orchestrateBudgetBookGeneration,
  resumeBudgetBookGeneration,
} from "../core/orchestrator.js";

export interface WorkerConfig {
  queue: QueueProvider;
  createContext: (tenantId: string) => EngineContext;
}

/**
 * Registers job handlers for document generation.
 *
 * Handles both generic job names ("generate-document", "regenerate-document")
 * and legacy budget-book-specific names for backward compatibility.
 */
export function startWorker(config: WorkerConfig): void {
  const { queue, createContext } = config;

  // Generic document generation
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

  // Backward-compatible legacy job names
  queue.process("generate-budget-book", async (payload) => {
    const { budgetBookId, documentId, tenantId } = payload as {
      budgetBookId?: string;
      documentId?: string;
      tenantId: string;
    };
    const id = documentId ?? budgetBookId!;
    const ctx = createContext(tenantId);
    await orchestrateBudgetBookGeneration(ctx, id);
  });

  queue.process("regenerate-budget-book", async (payload) => {
    const { budgetBookId, documentId, tenantId } = payload as {
      budgetBookId?: string;
      documentId?: string;
      tenantId: string;
    };
    const id = documentId ?? budgetBookId!;
    const ctx = createContext(tenantId);
    await resumeBudgetBookGeneration(ctx, id);
  });
}
