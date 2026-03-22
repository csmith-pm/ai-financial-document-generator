import { describe, it, expect } from "vitest";

describe("health routes", () => {
  it("exports healthRoutes function", async () => {
    const mod = await import("../../src/api/routes/health.js");
    expect(mod.healthRoutes).toBeTypeOf("function");
  });
});
