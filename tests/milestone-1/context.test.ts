import { describe, it, expect } from "vitest";
import type { EngineContext } from "../../src/core/context.js";
import {
  MockAiProvider,
  MockStorageProvider,
  MockDataProvider,
} from "../fixtures/mock-providers.js";

describe("EngineContext", () => {
  it("can be constructed with the expected shape", () => {
    // This is primarily a compile-time test — if the types are wrong,
    // TypeScript will reject this at build time.
    const ctx: EngineContext = {
      db: {} as EngineContext["db"], // Would be a real DrizzleInstance in production
      ai: new MockAiProvider(),
      storage: new MockStorageProvider(),
      data: new MockDataProvider(),
      tenantId: "tenant-123",
      config: {
        maxIterations: 3,
        chartsEnabled: true,
        defaultModel: "claude-sonnet-4-20250514",
      },
    };

    expect(ctx.tenantId).toBe("tenant-123");
    expect(ctx.config.maxIterations).toBe(3);
    expect(ctx.config.chartsEnabled).toBe(true);
    expect(ctx.config.defaultModel).toBe("claude-sonnet-4-20250514");
    expect(ctx.ai).toBeInstanceOf(MockAiProvider);
    expect(ctx.storage).toBeInstanceOf(MockStorageProvider);
    expect(ctx.data).toBeInstanceOf(MockDataProvider);
  });
});
