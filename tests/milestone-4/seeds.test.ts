import { describe, it, expect } from "vitest";

describe("seeds", () => {
  it("exports seedGlobalSkills function", async () => {
    const mod = await import("../../src/core/skills/seeds.js");
    expect(mod.seedGlobalSkills).toBeTypeOf("function");
  });

  it("is re-exported from skills/index", async () => {
    const mod = await import("../../src/core/skills/index.js");
    expect(mod.seedGlobalSkills).toBeTypeOf("function");
  });
});
