import { describe, it, expect } from "vitest";

describe("todos routes", () => {
  it("exports todosRoutes function", async () => {
    const mod = await import("../../src/api/routes/todos.js");
    expect(mod.todosRoutes).toBeTypeOf("function");
  });

  it("exports TodosRouteDeps interface (module loads)", async () => {
    const mod = await import("../../src/api/routes/todos.js");
    expect(mod).toBeDefined();
  });
});
