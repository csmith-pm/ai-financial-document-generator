import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  PipelineStep,
  PipelineContext,
  StepResult,
} from "../../src/core/pipeline/types.js";
import {
  runPipeline,
  createInitialState,
} from "../../src/core/pipeline/executor.js";
import type { EngineContext } from "../../src/core/context.js";
import type { DocumentTypeDefinition } from "../../src/core/doc-type.js";
import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Minimal mock EngineContext with spied db methods */
function makeMockCtx(): EngineContext {
  const mockChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      update: vi.fn().mockReturnValue(mockChain),
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as unknown as EngineContext["db"],
    ai: {} as EngineContext["ai"],
    storage: {} as EngineContext["storage"],
    data: {} as EngineContext["data"],
    tenantId: "test-tenant",
    config: {
      maxIterations: 3,
      chartsEnabled: true,
      defaultModel: "claude-sonnet-4-20250514",
    },
  };
}

function makeStubDocType(): DocumentTypeDefinition {
  return {
    id: "test_doc",
    name: "Test Document",
    version: "1.0.0",
    dataSchema: z.object({}),
    sectionTypes: [],
    getSectionData: () => ({}),
    getSectionPrompt: () => "",
    agents: [],
    getAgent: () => { throw new Error("not implemented"); },
    reviewers: [],
    seedSkills: [],
    categoryPriority: {},
    detectDataGaps: () => [],
    advisorAgentType: "test_advisor",
    storagePrefix: "test-docs",
  };
}

function makeStep(
  id: string,
  executeFn?: (pCtx: PipelineContext) => Promise<StepResult>
): PipelineStep {
  return {
    id,
    name: `Test step ${id}`,
    execute: executeFn ?? (async () => ({ status: "completed" as const })),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("createInitialState", () => {
  it("creates default state with empty collections", () => {
    const state = createInitialState();
    expect(state.styleAnalysis).toBeNull();
    expect(state.documentData).toBeNull();
    expect(state.sections).toEqual([]);
    expect(state.reviewResults).toBeInstanceOf(Map);
    expect(state.reviewResults.size).toBe(0);
    expect(state.iteration).toBe(0);
    expect(state.maxIterations).toBe(3);
    expect(state.previousScores).toBeInstanceOf(Map);
  });

  it("allows overrides", () => {
    const state = createInitialState({
      maxIterations: 5,
      fiscalYear: 2027,
    });
    expect(state.maxIterations).toBe(5);
    expect(state.fiscalYear).toBe(2027);
  });
});

describe("runPipeline", () => {
  let ctx: EngineContext;
  let docType: DocumentTypeDefinition;

  beforeEach(() => {
    ctx = makeMockCtx();
    docType = makeStubDocType();
  });

  it("runs steps in order", async () => {
    const order: string[] = [];

    const steps = [
      makeStep("step_a", async () => {
        order.push("a");
        return { status: "completed" };
      }),
      makeStep("step_b", async () => {
        order.push("b");
        return { status: "completed" };
      }),
      makeStep("step_c", async () => {
        order.push("c");
        return { status: "completed" };
      }),
    ];

    await runPipeline(ctx, docType, "doc-123", steps);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("passes shared state between steps", async () => {
    const steps = [
      makeStep("writer", async (pCtx) => {
        pCtx.state.fiscalYear = 2027;
        return { status: "completed" };
      }),
      makeStep("reader", async (pCtx) => {
        expect(pCtx.state.fiscalYear).toBe(2027);
        return { status: "completed" };
      }),
    ];

    await runPipeline(ctx, docType, "doc-123", steps);
  });

  it("handles skipped steps gracefully", async () => {
    const steps = [
      makeStep("skippable", async () => ({
        status: "skipped" as const,
        message: "Nothing to do",
      })),
      makeStep("next", async () => ({ status: "completed" as const })),
    ];

    // Should not throw
    await runPipeline(ctx, docType, "doc-123", steps);
  });

  it("stops on step failure and sets document to failed", async () => {
    const order: string[] = [];

    const steps = [
      makeStep("good", async () => {
        order.push("good");
        return { status: "completed" };
      }),
      makeStep("bad", async () => {
        throw new Error("step failed!");
      }),
      makeStep("never", async () => {
        order.push("never");
        return { status: "completed" };
      }),
    ];

    await expect(
      runPipeline(ctx, docType, "doc-123", steps)
    ).rejects.toThrow("step failed!");

    // Only the first step ran
    expect(order).toEqual(["good"]);

    // Document status was set to failed
    expect(ctx.db.update).toHaveBeenCalled();
  });

  it("runs with empty step list", async () => {
    await runPipeline(ctx, docType, "doc-123", []);
    // No error
  });

  it("provides docType and documentId to steps", async () => {
    const steps = [
      makeStep("check", async (pCtx) => {
        expect(pCtx.docType.id).toBe("test_doc");
        expect(pCtx.documentId).toBe("doc-456");
        expect(pCtx.ctx.tenantId).toBe("test-tenant");
        return { status: "completed" };
      }),
    ];

    await runPipeline(ctx, docType, "doc-456", steps);
  });

  it("accepts initial state overrides", async () => {
    const steps = [
      makeStep("check", async (pCtx) => {
        expect(pCtx.state.maxIterations).toBe(5);
        expect(pCtx.state.fiscalYear).toBe(2028);
        return { status: "completed" };
      }),
    ];

    await runPipeline(ctx, docType, "doc-123", steps, {
      maxIterations: 5,
      fiscalYear: 2028,
    });
  });
});
