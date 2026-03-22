import { describe, it, expect } from "vitest";

describe("budget-book skill extractor", () => {
  it("exports extractSkillsFromGfoaReview function", async () => {
    const mod = await import("../../src/doc-types/budget-book/skill-extractor.js");
    expect(mod.extractSkillsFromGfoaReview).toBeTypeOf("function");
  });

  it("exports extractSkillsFromAdaReview function", async () => {
    const mod = await import("../../src/doc-types/budget-book/skill-extractor.js");
    expect(mod.extractSkillsFromAdaReview).toBeTypeOf("function");
  });
});
