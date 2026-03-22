import { describe, it, expect } from "vitest";
import {
  createDocumentSchema,
  documentIdParamSchema,
  todoIdParamSchema,
  sendMessageSchema,
  updateTodoStatusSchema,
} from "../../src/api/validation.js";

describe("createDocumentSchema", () => {
  it("accepts valid input", () => {
    const result = createDocumentSchema.parse({
      docType: "budget_book",
      title: "FY2026 Budget Book",
      fiscalYear: 2026,
    });
    expect(result.title).toBe("FY2026 Budget Book");
    expect(result.fiscalYear).toBe(2026);
    expect(result.docType).toBe("budget_book");
    expect(result.dataSource).toBe("module"); // default
    expect(result.maxIterations).toBe(3); // default
  });

  it("accepts all optional fields", () => {
    const result = createDocumentSchema.parse({
      docType: "pafr",
      title: "Test Book",
      fiscalYear: 2026,
      dataSource: "upload",
      worksheetId: "ws-123",
      versionId: "v-1",
      maxIterations: 5,
    });
    expect(result.dataSource).toBe("upload");
    expect(result.worksheetId).toBe("ws-123");
    expect(result.maxIterations).toBe(5);
  });

  it("rejects missing title", () => {
    expect(() =>
      createDocumentSchema.parse({ docType: "budget_book", fiscalYear: 2026 })
    ).toThrow();
  });

  it("rejects missing docType", () => {
    expect(() =>
      createDocumentSchema.parse({ title: "Test", fiscalYear: 2026 })
    ).toThrow();
  });

  it("rejects invalid fiscal year", () => {
    expect(() =>
      createDocumentSchema.parse({ docType: "budget_book", title: "Test", fiscalYear: 1999 })
    ).toThrow();
  });

  it("rejects invalid dataSource", () => {
    expect(() =>
      createDocumentSchema.parse({
        docType: "budget_book",
        title: "Test",
        fiscalYear: 2026,
        dataSource: "invalid",
      })
    ).toThrow();
  });

  it("rejects maxIterations out of range", () => {
    expect(() =>
      createDocumentSchema.parse({
        docType: "budget_book",
        title: "Test",
        fiscalYear: 2026,
        maxIterations: 0,
      })
    ).toThrow();
    expect(() =>
      createDocumentSchema.parse({
        docType: "budget_book",
        title: "Test",
        fiscalYear: 2026,
        maxIterations: 11,
      })
    ).toThrow();
  });
});

describe("documentIdParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = documentIdParamSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects non-UUID", () => {
    expect(() => documentIdParamSchema.parse({ id: "not-a-uuid" })).toThrow();
  });
});

describe("todoIdParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = todoIdParamSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});

describe("sendMessageSchema", () => {
  it("accepts valid message", () => {
    const result = sendMessageSchema.parse({ message: "Hello" });
    expect(result.message).toBe("Hello");
  });

  it("rejects empty message", () => {
    expect(() => sendMessageSchema.parse({ message: "" })).toThrow();
  });
});

describe("updateTodoStatusSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["open", "in_progress", "resolved", "skipped"]) {
      const result = updateTodoStatusSchema.parse({ status });
      expect(result.status).toBe(status);
    }
  });

  it("rejects invalid status", () => {
    expect(() =>
      updateTodoStatusSchema.parse({ status: "completed" })
    ).toThrow();
  });
});
