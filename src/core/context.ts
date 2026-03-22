import type { DrizzleInstance } from "../db/connection.js";
import type { AiProvider, StorageProvider, DataProvider } from "./providers.js";

/**
 * Internal context object threaded through all core engine functions.
 * Replaces the old DbContext + customerId pattern.
 */
export interface EngineContext {
  db: DrizzleInstance;
  ai: AiProvider;
  storage: StorageProvider;
  data: DataProvider;
  tenantId: string;
  config: {
    maxIterations: number;
    chartsEnabled: boolean;
    defaultModel: string;
  };
}
