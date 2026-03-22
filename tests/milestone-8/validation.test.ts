import { describe, it, expect } from "vitest";
import {
  createBookSchema,
  bookIdParamSchema,
  todoIdParamSchema,
  sendMessageSchema,
  updateTodoStatusSchema,
} from "../../src/api/validation.js";

describe("createBookSchema", () => {
  it("accepts valid input", () => {
    const result = createBookSchema.parse({
      title: "FY2026 Budget Book",
      fiscalYear: 2026,
    });
    expect(result.title).toBe("FY2026 Budget Book");
    expect(result.fiscalYear).toBe(2026);
    expect(result.dataSource).toBe("module"); // default
    expect(result.maxIterations).toBe(3); // default
  });

  it("accepts all optional fields", () => {
    const result = createBookSchema.parse({
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
      createBookSchema.parse({ fiscalYear: 2026 })
    ).toThrow();
  });

  it("rejects invalid fiscal year", () => {
    expect(() =>
      createBookSchema.parse({ title: "Test", fiscalYear: 1999 })
    ).toThrow();
  });

  it("rejects invalid dataSource", () => {
    expect(() =>
      createBookSchema.parse({
        title: "Test",
        fiscalYear: 2026,
        dataSource: "invalid",
      })
    ).toThrow();
  });

  it("rejects maxIterations out of range", () => {
    expect(() =>
      createBookSchema.parse({
        title: "Test",
        fiscalYear: 2026,
        maxIterations: 0,
      })
    ).toThrow();
    expect(() =>
      createBookSchema.parse({
        title: "Test",
        fiscalYear: 2026,
        maxIterations: 11,
      })
    ).toThrow();
  });
});

describe("bookIdParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = bookIdParamSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects non-UUID", () => {
    expect(() => bookIdParamSchema.parse({ id: "not-a-uuid" })).toThrow();
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
