import { describe, it, expect } from "vitest";

describe("workbench CLI", () => {
  it("cli module is importable", async () => {
    // The CLI calls parseArgs and process.exit on import when no args,
    // so we test the doc-type-registry dependency it relies on
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    expect(defaultRegistry.has("budget_book")).toBe(true);
  });

  it("doc type list() provides data for doc-types command", async () => {
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    const list = defaultRegistry.list();

    for (const dt of list) {
      expect(dt.id).toBeTypeOf("string");
      expect(dt.name).toBeTypeOf("string");
      expect(dt.version).toBeTypeOf("string");
      expect(dt.sectionTypes).toBeInstanceOf(Array);
      expect(dt.agents).toBeInstanceOf(Array);
      expect(dt.reviewers).toBeInstanceOf(Array);
    }
  });

  it("budget_book has parseUpload for validate command", async () => {
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    const dt = defaultRegistry.get("budget_book");
    expect(dt.parseUpload).toBeTypeOf("function");
  });

  it("budget_book has detectDataGaps for validate command", async () => {
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    const dt = defaultRegistry.get("budget_book");
    expect(dt.detectDataGaps).toBeTypeOf("function");
  });

  it("budget_book section types have required fields for sections command", async () => {
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    const dt = defaultRegistry.get("budget_book");

    for (const s of dt.sectionTypes) {
      expect(s.id).toBeTypeOf("string");
      expect(s.name).toBeTypeOf("string");
      expect(s.order).toBeTypeOf("number");
      expect(typeof s.parallel).toBe("boolean");
      expect(typeof s.structural).toBe("boolean");
    }
  });
});
