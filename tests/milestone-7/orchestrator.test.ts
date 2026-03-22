import { describe, it, expect } from "vitest";

describe("orchestrator", () => {
  it("exports orchestrateDocumentGeneration function", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.orchestrateDocumentGeneration).toBeTypeOf("function");
  });

  it("exports resumeDocumentGeneration function", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.resumeDocumentGeneration).toBeTypeOf("function");
  });

  it("orchestrateDocumentGeneration accepts (ctx, documentId)", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.orchestrateDocumentGeneration.length).toBe(2);
  });

  it("resumeDocumentGeneration accepts (ctx, documentId)", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.resumeDocumentGeneration.length).toBe(2);
  });
});

describe("orchestrator internal types compile correctly", () => {
  it("module imports successfully", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod).toBeDefined();
  });

  it("imports all dependencies without error", async () => {
    const orchestrator = await import("../../src/core/orchestrator.js");
    const context = await import("../../src/core/context.js");
    const providers = await import("../../src/core/providers.js");
    expect(orchestrator).toBeDefined();
    expect(context).toBeDefined();
    expect(providers).toBeDefined();
  });
});
