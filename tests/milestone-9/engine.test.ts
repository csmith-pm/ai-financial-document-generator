import { describe, it, expect } from "vitest";

describe("createDocumentEngine", () => {
  it("exports createDocumentEngine function", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createDocumentEngine).toBeTypeOf("function");
  });

  it("re-exports AnthropicAiProvider", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.AnthropicAiProvider).toBeTypeOf("function");
  });

  it("re-exports S3StorageProvider", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.S3StorageProvider).toBeTypeOf("function");
  });

  it("re-exports LocalStorageProvider", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.LocalStorageProvider).toBeTypeOf("function");
  });

  it("re-exports ExcelDataProvider", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.ExcelDataProvider).toBeTypeOf("function");
  });

  it("re-exports BullMQQueueProvider", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.BullMQQueueProvider).toBeTypeOf("function");
  });

  it("re-exports schema tables", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.documents).toBeDefined();
    expect(mod.documentSections).toBeDefined();
    expect(mod.documentReviews).toBeDefined();
    expect(mod.documentJobs).toBeDefined();
    expect(mod.agentSkills).toBeDefined();
    expect(mod.documentTodos).toBeDefined();
    expect(mod.documentTodoMessages).toBeDefined();
  });
});
