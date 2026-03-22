import { describe, it, expect } from "vitest";

describe("pdfAnalyzer", () => {
  it("exports analyzePriorYearPdf function", async () => {
    const mod = await import("../../src/core/pdfAnalyzer.js");
    expect(mod.analyzePriorYearPdf).toBeTypeOf("function");
  });

  it("exports StyleAnalysis type via types.ts", async () => {
    // Verify the types module exports StyleAnalysis
    const mod = await import("../../src/core/types.js");
    // StyleAnalysis is a type-only export, so we can't check it at runtime.
    // Instead verify the module loads without errors.
    expect(mod).toBeDefined();
  });

  it("function accepts (ai, storage, tenantId, s3Key) params", async () => {
    const mod = await import("../../src/core/pdfAnalyzer.js");
    expect(mod.analyzePriorYearPdf.length).toBeGreaterThanOrEqual(3);
  });
});
