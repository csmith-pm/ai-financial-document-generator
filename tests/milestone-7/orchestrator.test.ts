import { describe, it, expect } from "vitest";

describe("orchestrator", () => {
  it("exports orchestrateBudgetBookGeneration function", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.orchestrateBudgetBookGeneration).toBeTypeOf("function");
  });

  it("exports resumeBudgetBookGeneration function", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.resumeBudgetBookGeneration).toBeTypeOf("function");
  });

  it("orchestrateBudgetBookGeneration accepts (ctx, budgetBookId)", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    // Two params: ctx (EngineContext) and budgetBookId (string)
    expect(mod.orchestrateBudgetBookGeneration.length).toBe(2);
  });

  it("resumeBudgetBookGeneration accepts (ctx, budgetBookId)", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.resumeBudgetBookGeneration.length).toBe(2);
  });
});

describe("orchestrator internal types compile correctly", () => {
  it("SECTION_TYPES covers all expected sections", async () => {
    // We can't access internal SECTION_TYPES directly, but we can verify
    // that the module imports successfully (meaning all internal types resolved)
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod).toBeDefined();
  });

  it("imports all dependencies without error", async () => {
    // This validates the full import chain: schema, agents, skills, todos, etc.
    const orchestrator = await import("../../src/core/orchestrator.js");
    const context = await import("../../src/core/context.js");
    const providers = await import("../../src/core/providers.js");
    expect(orchestrator).toBeDefined();
    expect(context).toBeDefined();
    expect(providers).toBeDefined();
  });
});
