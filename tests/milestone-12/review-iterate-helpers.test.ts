import { describe, it, expect, vi } from "vitest";
import {
  checkTermination,
  type ReviewRunResult,
} from "../../src/core/pipeline/steps/review-and-iterate.js";
import type {
  DocumentTypeDefinition,
  ReviewerSpec,
  SectionOutput,
} from "../../src/core/doc-type.js";
import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeReviewerSpec(
  id: string,
  overrides: Partial<ReviewerSpec> = {}
): ReviewerSpec {
  return {
    id,
    agentType: `${id}_reviewer`,
    buildReviewPrompt: () => "review prompt",
    resultSchema: z.object({}),
    isPassed: () => true,
    getScore: () => 100,
    getRecommendations: () => [],
    getFeedbackForSection: () => [],
    ...overrides,
  };
}

function makeStubDocType(
  overrides: Partial<DocumentTypeDefinition> = {}
): DocumentTypeDefinition {
  return {
    id: "test_doc",
    name: "Test",
    version: "1.0.0",
    dataSchema: z.object({}),
    sectionTypes: [],
    getSectionData: () => ({}),
    getSectionPrompt: () => "",
    agents: [],
    getAgent: () => { throw new Error("not impl"); },
    reviewers: [],
    seedSkills: [],
    categoryPriority: {},
    detectDataGaps: () => [],
    advisorAgentType: "test_advisor",
    storagePrefix: "test-docs",
    ...overrides,
  };
}

// ─── checkTermination ────────────────────────────────────────────────────

describe("checkTermination", () => {
  it("stops when all reviewers pass", () => {
    const results: ReviewRunResult[] = [
      {
        reviewerSpec: makeReviewerSpec("gfoa", {
          isPassed: () => true,
          getScore: () => 150,
        }),
        result: {},
      },
      {
        reviewerSpec: makeReviewerSpec("ada", {
          isPassed: () => true,
          getScore: () => null,
        }),
        result: {},
      },
    ];

    const { shouldStop, reason } = checkTermination(
      makeStubDocType(),
      results,
      1,
      3,
      new Map()
    );

    expect(shouldStop).toBe(true);
    expect(reason).toContain("All reviewers passed");
  });

  it("stops when max iterations reached", () => {
    const results: ReviewRunResult[] = [
      {
        reviewerSpec: makeReviewerSpec("gfoa", {
          isPassed: () => false,
          getScore: () => 80,
        }),
        result: {},
      },
    ];

    const { shouldStop, reason } = checkTermination(
      makeStubDocType(),
      results,
      3,
      3,
      new Map()
    );

    expect(shouldStop).toBe(true);
    expect(reason).toContain("Max iterations");
  });

  it("continues when reviews fail and iterations remain", () => {
    const results: ReviewRunResult[] = [
      {
        reviewerSpec: makeReviewerSpec("gfoa", {
          isPassed: () => false,
          getScore: () => 80,
        }),
        result: {},
      },
    ];

    const { shouldStop } = checkTermination(
      makeStubDocType(),
      results,
      1,
      3,
      new Map()
    );

    expect(shouldStop).toBe(false);
  });

  it("uses doc type shouldContinueIterating when provided", () => {
    const docType = makeStubDocType({
      shouldContinueIterating: vi.fn().mockReturnValue(false),
    });

    const results: ReviewRunResult[] = [
      {
        reviewerSpec: makeReviewerSpec("gfoa", {
          isPassed: () => false,
          getScore: () => 80,
        }),
        result: {},
      },
    ];

    const { shouldStop, reason } = checkTermination(
      docType,
      results,
      2,
      5,
      new Map([["gfoa", 80]])
    );

    expect(shouldStop).toBe(true);
    expect(reason).toContain("Doc type termination");
    expect(docType.shouldContinueIterating).toHaveBeenCalled();
  });

  it("continues when doc type says to continue", () => {
    const docType = makeStubDocType({
      shouldContinueIterating: vi.fn().mockReturnValue(true),
    });

    const results: ReviewRunResult[] = [
      {
        reviewerSpec: makeReviewerSpec("gfoa", {
          isPassed: () => false,
          getScore: () => 90,
        }),
        result: {},
      },
    ];

    const { shouldStop } = checkTermination(
      docType,
      results,
      2,
      5,
      new Map([["gfoa", 80]])
    );

    expect(shouldStop).toBe(false);
  });

  it("passes correct args to shouldContinueIterating", () => {
    const mockFn = vi.fn().mockReturnValue(true);
    const docType = makeStubDocType({
      shouldContinueIterating: mockFn,
    });

    const results: ReviewRunResult[] = [
      {
        reviewerSpec: makeReviewerSpec("gfoa", {
          isPassed: () => false,
          getScore: () => 95,
        }),
        result: {},
      },
    ];

    const previousScores = new Map<string, number | null>([["gfoa", 85]]);

    checkTermination(docType, results, 2, 5, previousScores);

    const [resultsMap, iteration, prevScores] = mockFn.mock.calls[0]!;
    expect(resultsMap.get("gfoa")).toEqual({ passed: false, score: 95 });
    expect(iteration).toBe(2);
    expect(prevScores.get("gfoa")).toBe(85);
  });
});
