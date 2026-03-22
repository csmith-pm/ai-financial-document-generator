import { describe, it, expect } from "vitest";

// ─── Generic Document Routes ──────────────────────────────────────────

describe("generic document routes", () => {
  it("exports documentRoutes function", async () => {
    const mod = await import("../../src/api/routes/documents.js");
    expect(mod.documentRoutes).toBeTypeOf("function");
  });

  it("exports DocumentRouteDeps interface (module loads)", async () => {
    const mod = await import("../../src/api/routes/documents.js");
    expect(mod).toBeDefined();
  });
});

// ─── Validation Schemas ───────────────────────────────────────────────

describe("generic validation schemas", () => {
  it("exports createDocumentSchema", async () => {
    const mod = await import("../../src/api/validation.js");
    expect(mod.createDocumentSchema).toBeDefined();
  });

  it("exports documentIdParamSchema", async () => {
    const mod = await import("../../src/api/validation.js");
    expect(mod.documentIdParamSchema).toBeDefined();
  });

  it("exports documentIdWithTodoParamSchema", async () => {
    const mod = await import("../../src/api/validation.js");
    expect(mod.documentIdWithTodoParamSchema).toBeDefined();
  });

  it("createDocumentSchema accepts valid input", async () => {
    const { createDocumentSchema } = await import("../../src/api/validation.js");
    const result = createDocumentSchema.parse({
      title: "FY2026 Budget Book",
      fiscalYear: 2026,
    });
    expect(result.title).toBe("FY2026 Budget Book");
    expect(result.fiscalYear).toBe(2026);
    expect(result.docType).toBe("budget_book"); // default
    expect(result.dataSource).toBe("module"); // default
    expect(result.maxIterations).toBe(3); // default
  });

  it("createDocumentSchema accepts custom docType", async () => {
    const { createDocumentSchema } = await import("../../src/api/validation.js");
    const result = createDocumentSchema.parse({
      title: "ACFR 2026",
      fiscalYear: 2026,
      docType: "acfr",
    });
    expect(result.docType).toBe("acfr");
  });

  it("documentIdParamSchema validates UUID", async () => {
    const { documentIdParamSchema } = await import("../../src/api/validation.js");
    const result = documentIdParamSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("documentIdParamSchema rejects non-UUID", async () => {
    const { documentIdParamSchema } = await import("../../src/api/validation.js");
    expect(() => documentIdParamSchema.parse({ id: "not-a-uuid" })).toThrow();
  });

  it("documentIdWithTodoParamSchema validates UUID", async () => {
    const { documentIdWithTodoParamSchema } = await import("../../src/api/validation.js");
    const result = documentIdWithTodoParamSchema.parse({
      documentId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.documentId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});

// ─── Server Registration ──────────────────────────────────────────────

describe("server", () => {
  it("exports createServer function", async () => {
    const mod = await import("../../src/api/server.js");
    expect(mod.createServer).toBeTypeOf("function");
  });
});
