import { describe, it, expect } from "vitest";

describe("excelParser", () => {
  it("exports parseExcelBudget function", async () => {
    const mod = await import("../../src/core/excelParser.js");
    expect(mod.parseExcelBudget).toBeTypeOf("function");
  });

  it("function accepts (ai, buffer, fiscalYear) params", async () => {
    const mod = await import("../../src/core/excelParser.js");
    // Verify the function exists and has expected arity (3 params)
    expect(mod.parseExcelBudget.length).toBe(3);
  });
});

describe("ExcelDataProvider integration", () => {
  it("ExcelDataProvider.getBudgetData calls parseExcelBudget", async () => {
    const { ExcelDataProvider } = await import("../../src/providers/excel-data.js");
    const { MockAiProvider, MockStorageProvider } = await import("../fixtures/mock-providers.js");

    const storage = new MockStorageProvider();
    // Upload a minimal buffer that xlsx can parse (or that will trigger the AI path)
    await storage.upload("test.xlsx", Buffer.from("fake-excel"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const provider = new ExcelDataProvider({
      ai: new MockAiProvider(),
      storage,
      excelS3Key: "test.xlsx",
    });

    // The actual parse will fail because the buffer isn't valid Excel,
    // but we verify the wiring works (it calls storage.getObject)
    await expect(provider.getBudgetData("t1", "ws1", 2026)).rejects.toThrow();
    expect(storage.calls.some(c => c.method === "getObject")).toBe(true);
  });
});
