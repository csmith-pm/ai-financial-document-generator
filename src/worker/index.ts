import type { QueueProvider } from "../core/providers.js";
import type { EngineContext } from "../core/context.js";
import { orchestrateBudgetBookGeneration, resumeBudgetBookGeneration } from "../core/orchestrator.js";

export interface WorkerConfig {
  queue: QueueProvider;
  createContext: (tenantId: string) => EngineContext;
}

/**
 * Registers BullMQ job handlers for budget book generation.
 */
export function startWorker(config: WorkerConfig): void {
  const { queue, createContext } = config;

  queue.process("generate-budget-book", async (payload) => {
    const { budgetBookId, tenantId } = payload as {
      budgetBookId: string;
      tenantId: string;
    };
    const ctx = createContext(tenantId);
    await orchestrateBudgetBookGeneration(ctx, budgetBookId);
  });

  queue.process("regenerate-budget-book", async (payload) => {
    const { budgetBookId, tenantId } = payload as {
      budgetBookId: string;
      tenantId: string;
    };
    const ctx = createContext(tenantId);
    await resumeBudgetBookGeneration(ctx, budgetBookId);
  });
}
