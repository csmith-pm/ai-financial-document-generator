import { describe, it, expect } from "vitest";

describe("createBudgetBookEngine", () => {
  it("exports createBudgetBookEngine function", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createBudgetBookEngine).toBeTypeOf("function");
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
    expect(mod.budgetBooks).toBeDefined();
    expect(mod.budgetBookSections).toBeDefined();
    expect(mod.budgetBookReviews).toBeDefined();
    expect(mod.budgetBookJobs).toBeDefined();
    expect(mod.agentSkills).toBeDefined();
    expect(mod.budgetBookTodos).toBeDefined();
    expect(mod.budgetBookTodoMessages).toBeDefined();
  });
});
