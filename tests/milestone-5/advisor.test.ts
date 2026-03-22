import { describe, it, expect } from "vitest";

describe("todos/advisor", () => {
  it("exports handleTodoChat function", async () => {
    const mod = await import("../../src/core/todos/advisor.js");
    expect(mod.handleTodoChat).toBeTypeOf("function");
  });

  it("is re-exported from todos/index", async () => {
    const mod = await import("../../src/core/todos/index.js");
    expect(mod.handleTodoChat).toBeTypeOf("function");
  });
});
