import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateCostUsd } from "../../src/providers/anthropic.js";

// We can't test AnthropicAiProvider without a real API key,
// so we test the class structure + the utility function + JSON parsing logic.
// The actual API integration is tested via the MockAiProvider in other milestones.

describe("AnthropicAiProvider", () => {
  describe("module exports", () => {
    it("exports AnthropicAiProvider class", async () => {
      const mod = await import("../../src/providers/anthropic.js");
      expect(mod.AnthropicAiProvider).toBeDefined();
      expect(typeof mod.AnthropicAiProvider).toBe("function");
    });

    it("exports estimateCostUsd function", () => {
      expect(estimateCostUsd).toBeTypeOf("function");
    });
  });

  describe("estimateCostUsd", () => {
    it("calculates cost correctly for typical usage", () => {
      // 1000 input tokens, 500 output tokens
      // Input: (1000/1_000_000) * 3 = 0.003
      // Output: (500/1_000_000) * 15 = 0.0075
      const cost = estimateCostUsd(1000, 500);
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it("returns 0 for zero tokens", () => {
      expect(estimateCostUsd(0, 0)).toBe(0);
    });

    it("handles large token counts", () => {
      // 1M input, 100K output
      const cost = estimateCostUsd(1_000_000, 100_000);
      // Input: 3.00, Output: 1.50
      expect(cost).toBeCloseTo(4.5, 2);
    });
  });

  describe("JSON code fence stripping", () => {
    // Test the regex pattern used in callJson
    const stripCodeFences = (text: string): string => {
      let jsonStr = text.trim();
      const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
      if (jsonMatch?.[1]) {
        jsonStr = jsonMatch[1].trim();
      }
      return jsonStr;
    };

    it("strips ```json ... ``` fences", () => {
      const input = '```json\n{"key": "value"}\n```';
      expect(stripCodeFences(input)).toBe('{"key": "value"}');
    });

    it("strips ``` ... ``` fences without language tag", () => {
      const input = '```\n{"key": "value"}\n```';
      expect(stripCodeFences(input)).toBe('{"key": "value"}');
    });

    it("returns raw JSON when no fences present", () => {
      const input = '{"key": "value"}';
      expect(stripCodeFences(input)).toBe('{"key": "value"}');
    });

    it("handles multiline JSON in fences", () => {
      const input = '```json\n{\n  "scores": [1, 2, 3],\n  "total": 6\n}\n```';
      const result = stripCodeFences(input);
      expect(JSON.parse(result)).toEqual({ scores: [1, 2, 3], total: 6 });
    });
  });

  describe("AnthropicAiProvider class structure", () => {
    it("implements AiProvider interface methods", async () => {
      const mod = await import("../../src/providers/anthropic.js");
      const proto = mod.AnthropicAiProvider.prototype;
      expect(proto.callText).toBeTypeOf("function");
      expect(proto.callJson).toBeTypeOf("function");
      expect(proto.callVision).toBeTypeOf("function");
      expect(proto.logUsage).toBeTypeOf("function");
    });
  });
});
