import { describe, it, expect } from "vitest";

describe("arbitration", () => {
  it("exports negotiateSkill function", async () => {
    const mod = await import("../../src/core/skills/arbitration.js");
    expect(mod.negotiateSkill).toBeTypeOf("function");
  });

  it("is re-exported from skills/index", async () => {
    const mod = await import("../../src/core/skills/index.js");
    expect(mod.negotiateSkill).toBeTypeOf("function");
  });
});
