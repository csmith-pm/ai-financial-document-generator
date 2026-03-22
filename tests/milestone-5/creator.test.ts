import { describe, it, expect } from "vitest";

describe("todos/creator", () => {
  it("exports createTodosFromDataGaps function", async () => {
    const mod = await import("../../src/core/todos/creator.js");
    expect(mod.createTodosFromDataGaps).toBeTypeOf("function");
  });

  it("exports createTodosFromGfoaReview function", async () => {
    const mod = await import("../../src/core/todos/creator.js");
    expect(mod.createTodosFromGfoaReview).toBeTypeOf("function");
  });

  it("both are re-exported from todos/index", async () => {
    const mod = await import("../../src/core/todos/index.js");
    expect(mod.createTodosFromDataGaps).toBeTypeOf("function");
    expect(mod.createTodosFromGfoaReview).toBeTypeOf("function");
  });
});
