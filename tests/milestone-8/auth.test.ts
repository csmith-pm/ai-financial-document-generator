import { describe, it, expect } from "vitest";

describe("auth middleware", () => {
  it("exports authMiddleware function", async () => {
    const mod = await import("../../src/api/middleware/auth.js");
    expect(mod.authMiddleware).toBeTypeOf("function");
  });

  it("authMiddleware is an async function with 2 params", async () => {
    const mod = await import("../../src/api/middleware/auth.js");
    expect(mod.authMiddleware.length).toBe(2);
  });
});
