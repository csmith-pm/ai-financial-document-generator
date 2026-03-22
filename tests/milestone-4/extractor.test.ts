import { describe, it, expect } from "vitest";

describe("extractor", () => {
  it("exports extractSkillsFromGfoaReview function", async () => {
    const mod = await import("../../src/core/skills/extractor.js");
    expect(mod.extractSkillsFromGfoaReview).toBeTypeOf("function");
  });

  it("exports extractSkillsFromAdaReview function", async () => {
    const mod = await import("../../src/core/skills/extractor.js");
    expect(mod.extractSkillsFromAdaReview).toBeTypeOf("function");
  });

  it("both are re-exported from skills/index", async () => {
    const mod = await import("../../src/core/skills/index.js");
    expect(mod.extractSkillsFromGfoaReview).toBeTypeOf("function");
    expect(mod.extractSkillsFromAdaReview).toBeTypeOf("function");
  });
});
