import { describe, it, expect } from "vitest";

// ─── Validation Backward Compatibility ────────────────────────────────

describe("validation backward compatibility", () => {
  it("createBookSchema is an alias for createDocumentSchema", async () => {
    const mod = await import("../../src/api/validation.js");
    expect(mod.createBookSchema).toBe(mod.createDocumentSchema);
  });

  it("bookIdParamSchema is an alias for documentIdParamSchema", async () => {
    const mod = await import("../../src/api/validation.js");
    expect(mod.bookIdParamSchema).toBe(mod.documentIdParamSchema);
  });

  it("bookIdWithTodoParamSchema still works", async () => {
    const mod = await import("../../src/api/validation.js");
    const result = mod.bookIdWithTodoParamSchema.parse({
      bookId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.bookId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("createBookSchema still accepts valid input", async () => {
    const mod = await import("../../src/api/validation.js");
    const result = mod.createBookSchema.parse({
      title: "Test Book",
      fiscalYear: 2026,
    });
    expect(result.title).toBe("Test Book");
    expect(result.docType).toBe("budget_book");
  });
});

// ─── Books Routes Backward Compatibility ──────────────────────────────

describe("books routes backward compatibility", () => {
  it("exports booksRoutes function", async () => {
    const mod = await import("../../src/api/routes/books.js");
    expect(mod.booksRoutes).toBeTypeOf("function");
  });

  it("exports BooksRouteDeps interface (module loads)", async () => {
    const mod = await import("../../src/api/routes/books.js");
    expect(mod).toBeDefined();
  });
});

// ─── Todos Routes Backward Compatibility ──────────────────────────────

describe("todos routes backward compatibility", () => {
  it("exports todosRoutes function", async () => {
    const mod = await import("../../src/api/routes/todos.js");
    expect(mod.todosRoutes).toBeTypeOf("function");
  });
});

// ─── Engine Factory Backward Compatibility ────────────────────────────

describe("engine factory backward compatibility", () => {
  it("exports createDocumentEngine from index", async () => {
    const mod = await import("../../src/index.js");
    expect(typeof mod.createDocumentEngine).toBe("function");
  });

  it("exports createBudgetBookEngine as alias for createDocumentEngine", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.createBudgetBookEngine).toBe(mod.createDocumentEngine);
  });

  it("exports DocumentEngine type (module loads)", async () => {
    const mod = await import("../../src/index.js");
    expect(mod).toBeDefined();
  });
});

// ─── Worker Backward Compatibility ────────────────────────────────────

describe("worker backward compatibility", () => {
  it("exports startWorker function", async () => {
    const mod = await import("../../src/worker/index.js");
    expect(mod.startWorker).toBeTypeOf("function");
  });
});
