import { describe, it, expect } from "vitest";

// Test that the module exports and function signatures are correct
describe("promptBuilder", () => {
  it("exports buildAgentPrompt function", async () => {
    const mod = await import("../../src/core/agents/promptBuilder.js");
    expect(mod.buildAgentPrompt).toBeTypeOf("function");
  });

  it("is re-exported from agents/index", async () => {
    const mod = await import("../../src/core/agents/index.js");
    expect(mod.buildAgentPrompt).toBeTypeOf("function");
  });
});
