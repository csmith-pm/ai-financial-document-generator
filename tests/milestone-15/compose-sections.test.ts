/**
 * Tests for the compose-sections pipeline step — Phase 3.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { composeSectionsStep } from "../../src/core/pipeline/steps/compose-sections.js";
import { createInitialState } from "../../src/core/pipeline/executor.js";
import type { PipelineContext } from "../../src/core/pipeline/types.js";
import type { DocumentTypeDefinition, SectionOutput, GenericAgentDefinition } from "../../src/core/doc-type.js";
import type { EngineContext } from "../../src/core/context.js";

// Ensure built-ins are registered
import "../../src/core/components/built-in/index.js";

// ─── Mocks ──────────────────────────────────────────────────────────────

function mockSection(sectionType: string, title: string): SectionOutput {
  return {
    sectionType,
    title,
    narrativeContent: "Revenue increased by 4.2% in FY2027.",
    tableData: [
      { header: true, cells: ["Fund", "Amount"] },
      { cells: ["General", "$1,000,000"] },
    ],
    chartConfigs: [
      {
        type: "bar" as const,
        title: "Revenue by Fund",
        data: [{ name: "General", revenue: 1000000 }],
        dataKeys: ["revenue"],
        categoryKey: "name",
        width: 800,
        height: 400,
      },
    ],
  };
}

const composerAgent: GenericAgentDefinition = {
  name: "BB_Composer",
  type: "bb_composer",
  role: "Layout composer",
  baseSystemPrompt: "You are a composer agent.",
  skillDomain: ["layout"],
  producesSkillsFor: [],
  temperature: 0.2,
  maxTokens: 2048,
};

function makePCtx(overrides: {
  composerAgentType?: string;
  aiResponse?: unknown;
  sections?: SectionOutput[];
}): PipelineContext {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockReturnThis(),
  };
  const mockDb = {
    select: vi.fn().mockReturnValue(chainable),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  } as unknown as EngineContext["db"];

  const mockAi = {
    callJson: vi.fn().mockResolvedValue({
      data: overrides.aiResponse ?? [
        { componentId: "narrative-block", props: { text: "Revenue increased by 4.2%." }, order: 1 },
        { componentId: "financial-table", props: { rows: [{ header: true, cells: ["Fund", "Amount"] }] }, order: 2 },
        { componentId: "bar-chart", props: { title: "Revenue", chartType: "bar", data: [], dataKeys: ["rev"], categoryKey: "name" }, order: 3 },
      ],
      inputTokens: 500,
      outputTokens: 200,
      model: "claude-sonnet-4-20250514",
    }),
    logUsage: vi.fn(),
  } as unknown as EngineContext["ai"];

  const state = createInitialState({
    sections: overrides.sections ?? [mockSection("revenue_summary", "Revenue Summary")],
  });

  const docType = {
    id: "budget_book",
    composerAgentType: overrides.composerAgentType,
    getAgent: vi.fn().mockReturnValue(composerAgent),
  } as unknown as DocumentTypeDefinition;

  return {
    ctx: { db: mockDb, ai: mockAi, tenantId: "test-tenant" } as unknown as EngineContext,
    docType,
    documentId: "test-doc-id",
    state,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("composeSectionsStep", () => {
  it("skips when composerAgentType is undefined", async () => {
    const pCtx = makePCtx({ composerAgentType: undefined });
    const result = await composeSectionsStep.execute(pCtx);
    expect(result.status).toBe("skipped");
    expect(result.message).toContain("No composerAgentType");
    expect(pCtx.state.layoutSpec).toBeNull();
  });

  it("produces a valid DocumentLayoutSpec", async () => {
    const pCtx = makePCtx({ composerAgentType: "bb_composer" });
    const result = await composeSectionsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.state.layoutSpec).not.toBeNull();
    expect(pCtx.state.layoutSpec!.sections).toHaveLength(1);
    expect(pCtx.state.layoutSpec!.sections[0].sectionType).toBe("revenue_summary");
    expect(pCtx.state.layoutSpec!.sections[0].entries).toHaveLength(3);
  });

  it("entries are sorted by order", async () => {
    const pCtx = makePCtx({
      composerAgentType: "bb_composer",
      aiResponse: [
        { componentId: "narrative-block", props: { text: "text" }, order: 3 },
        { componentId: "bar-chart", props: { title: "x", chartType: "bar", data: [], dataKeys: ["r"], categoryKey: "n" }, order: 1 },
        { componentId: "financial-table", props: { rows: [] }, order: 2 },
      ],
    });
    const result = await composeSectionsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    const orders = pCtx.state.layoutSpec!.sections[0].entries.map((e) => e.order);
    expect(orders).toEqual([1, 2, 3]);
  });

  it("tracks __missing__ components", async () => {
    const pCtx = makePCtx({
      composerAgentType: "bb_composer",
      aiResponse: [
        { componentId: "__missing__", props: { description: "Org chart needed" }, order: 1 },
        { componentId: "narrative-block", props: { text: "text" }, order: 2 },
      ],
    });
    const result = await composeSectionsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(result.message).toContain("1 missing components");
    const missing = pCtx.state.layoutSpec!.sections[0].entries.find(
      (e) => e.componentId === "__missing__"
    );
    expect(missing).toBeDefined();
    expect(missing!.props.description).toBe("Org chart needed");
  });

  it("sets componentRegistry on state", async () => {
    const pCtx = makePCtx({ composerAgentType: "bb_composer" });
    await composeSectionsStep.execute(pCtx);
    expect(pCtx.state.componentRegistry).not.toBeNull();
    expect(pCtx.state.componentRegistry!.has("narrative-block")).toBe(true);
  });

  it("creates fallback layout on AI failure", async () => {
    const pCtx = makePCtx({ composerAgentType: "bb_composer" });
    // Make AI call throw
    (pCtx.ctx.ai.callJson as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("API error"));
    const result = await composeSectionsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    // Should still have a layout with fallback entries
    expect(pCtx.state.layoutSpec!.sections).toHaveLength(1);
    const entries = pCtx.state.layoutSpec!.sections[0].entries;
    expect(entries.length).toBeGreaterThan(0);
    // Fallback should contain narrative-block since section has narrativeContent
    expect(entries.some((e) => e.componentId === "narrative-block")).toBe(true);
  });

  it("handles multiple sections", async () => {
    const pCtx = makePCtx({
      composerAgentType: "bb_composer",
      sections: [
        mockSection("revenue_summary", "Revenue Summary"),
        mockSection("expenditure", "Expenditure Analysis"),
        mockSection("executive_summary", "Executive Summary"),
      ],
    });
    const result = await composeSectionsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.state.layoutSpec!.sections).toHaveLength(3);
  });
});
