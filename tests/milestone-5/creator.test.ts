import { describe, it, expect } from "vitest";

describe("todos/creator", () => {
  it("exports createTodosFromDataGaps function", async () => {
    const mod = await import("../../src/core/todos/creator.js");
    expect(mod.createTodosFromDataGaps).toBeTypeOf("function");
  });

  it("does not export budget-book-specific createTodosFromGfoaReview", async () => {
    const mod = await import("../../src/core/todos/creator.js");
    expect((mod as any).createTodosFromGfoaReview).toBeUndefined();
  });

  it("createTodosFromDataGaps is re-exported from todos/index", async () => {
    const mod = await import("../../src/core/todos/index.js");
    expect(mod.createTodosFromDataGaps).toBeTypeOf("function");
  });
});
