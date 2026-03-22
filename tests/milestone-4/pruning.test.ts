import { describe, it, expect } from "vitest";

describe("pruning", () => {
  it("exports pruneSkills function", async () => {
    const mod = await import("../../src/core/skills/pruning.js");
    expect(mod.pruneSkills).toBeTypeOf("function");
  });

  it("is re-exported from skills/index", async () => {
    const mod = await import("../../src/core/skills/index.js");
    expect(mod.pruneSkills).toBeTypeOf("function");
  });
});
