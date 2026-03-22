import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineContext } from "../../src/core/pipeline/types.js";
import { createInitialState } from "../../src/core/pipeline/executor.js";
import type { EngineContext } from "../../src/core/context.js";
import type { DocumentTypeDefinition } from "../../src/core/doc-type.js";
import { z } from "zod";

import { seedSkillsStep } from "../../src/core/pipeline/steps/seed-skills.js";
import { analyzeStyleStep } from "../../src/core/pipeline/steps/analyze-style.js";
import { fetchDataStep } from "../../src/core/pipeline/steps/fetch-data.js";
import { detectGapsStep } from "../../src/core/pipeline/steps/detect-gaps.js";
import { generateSectionsStep } from "../../src/core/pipeline/steps/generate-sections.js";
import { renderChartsStep } from "../../src/core/pipeline/steps/render-charts.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMockCtx(): EngineContext {
  const mockChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  // Deep mock for Drizzle's chained query builder
  const selectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        limit: vi.fn().mockResolvedValue([]),
      }),
      orderBy: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };
  return {
    db: {
      update: vi.fn().mockReturnValue(mockChain),
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as unknown as EngineContext["db"],
    ai: {
      callText: vi.fn(),
      callJson: vi.fn(),
      callVision: vi.fn(),
      logUsage: vi.fn(),
    } as unknown as EngineContext["ai"],
    storage: {
      upload: vi.fn().mockResolvedValue("key"),
      getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
      getSignedUrl: vi.fn().mockResolvedValue("https://signed.url"),
    } as unknown as EngineContext["storage"],
    data: {
      getBudgetData: vi.fn().mockResolvedValue({ revenueDetail: [] }),
    } as unknown as EngineContext["data"],
    tenantId: "test-tenant",
    config: {
      maxIterations: 3,
      chartsEnabled: true,
      defaultModel: "claude-sonnet-4-20250514",
    },
  };
}

function makeStubDocType(
  overrides: Partial<DocumentTypeDefinition> = {}
): DocumentTypeDefinition {
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
    ...overrides,
  };
}

function makePipelineCtx(
  overrides?: {
    ctx?: Partial<EngineContext>;
    docType?: Partial<DocumentTypeDefinition>;
    state?: Partial<ReturnType<typeof createInitialState>>;
  }
): PipelineContext {
  return {
    ctx: { ...makeMockCtx(), ...overrides?.ctx } as EngineContext,
    docType: makeStubDocType(overrides?.docType),
    documentId: "doc-123",
    state: createInitialState(overrides?.state),
  };
}

// ── seed-skills ──────────────────────────────────────────────────────────

describe("seedSkillsStep", () => {
  it("has correct id", () => {
    expect(seedSkillsStep.id).toBe("seed_skills");
  });

  it("completes successfully", async () => {
    const pCtx = makePipelineCtx();
    const result = await seedSkillsStep.execute(pCtx);
    expect(result.status).toBe("completed");
  });
});

// ── analyze-style ────────────────────────────────────────────────────────

describe("analyzeStyleStep", () => {
  it("has correct id", () => {
    expect(analyzeStyleStep.id).toBe("analyze_prior_pdf");
  });

  it("skips when no prior PDF key", async () => {
    const pCtx = makePipelineCtx({
      state: { document: { priorYearPdfS3Key: null } },
    });
    const result = await analyzeStyleStep.execute(pCtx);
    expect(result.status).toBe("skipped");
    expect(pCtx.state.styleAnalysis).toBeNull();
  });

  it("analyzes when prior PDF exists and doc type supports it", async () => {
    const mockAnalysis = { colorScheme: ["#333", "#666"], tone: "formal" };
    const pCtx = makePipelineCtx({
      docType: {
        analyzePriorDocument: vi.fn().mockResolvedValue(mockAnalysis),
      },
      state: { document: { priorYearPdfS3Key: "tenant/prior.pdf" } },
    });

    const result = await analyzeStyleStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.state.styleAnalysis).toEqual(mockAnalysis);
  });
});

// ── fetch-data ───────────────────────────────────────────────────────────

describe("fetchDataStep", () => {
  it("has correct id", () => {
    expect(fetchDataStep.id).toBe("fetch_data");
  });

  it("fetches via data provider when worksheetId exists", async () => {
    const mockData = { revenueDetail: [{ source: "Tax", amount: 100 }] };
    const pCtx = makePipelineCtx({
      state: {
        document: { worksheetId: "ws-1", dataSource: "module" },
        fiscalYear: 2026,
      },
    });
    (pCtx.ctx.data.getBudgetData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

    const result = await fetchDataStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.state.documentData).toEqual(mockData);
    expect(pCtx.ctx.data.getBudgetData).toHaveBeenCalledWith(
      "test-tenant",
      "ws-1",
      2026
    );
  });

  it("parses upload when dataSource is upload", async () => {
    const mockData = { revenueDetail: [] };
    const pCtx = makePipelineCtx({
      docType: {
        parseUpload: vi.fn().mockResolvedValue(mockData),
      },
      state: {
        document: {
          dataSource: "upload",
          uploadedDataS3Key: "tenant/budget.xlsx",
        },
        fiscalYear: 2026,
      },
    });

    const result = await fetchDataStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.state.documentData).toEqual(mockData);
  });

  it("throws when no data source available", async () => {
    const pCtx = makePipelineCtx({
      state: {
        document: { dataSource: "module", worksheetId: null },
      },
    });

    await expect(fetchDataStep.execute(pCtx)).rejects.toThrow(
      "no data source"
    );
  });
});

// ── detect-gaps ──────────────────────────────────────────────────────────

describe("detectGapsStep", () => {
  it("has correct id", () => {
    expect(detectGapsStep.id).toBe("detect_gaps");
  });

  it("skips when no gaps detected", async () => {
    const pCtx = makePipelineCtx({
      docType: { detectDataGaps: () => [] },
      state: { documentData: {} },
    });
    const result = await detectGapsStep.execute(pCtx);
    expect(result.status).toBe("skipped");
  });

  it("creates todos when gaps are detected", async () => {
    const gaps = [
      { category: "data_gap" as const, title: "Missing data", description: "No revenue", sectionType: "revenue_summary", priority: "high" as const },
    ];
    const pCtx = makePipelineCtx({
      docType: { detectDataGaps: () => gaps },
      state: { documentData: {} },
    });
    const result = await detectGapsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(result.message).toContain("1 data gap");
  });
});

// ── generate-sections ────────────────────────────────────────────────────

describe("generateSectionsStep", () => {
  it("has correct id", () => {
    expect(generateSectionsStep.id).toBe("generate_sections");
  });

  it("generates sections using doc type specs", async () => {
    const mockSection = {
      sectionType: "revenue_summary",
      title: "Revenue Summary",
      narrativeContent: "Revenue is...",
      tableData: [],
      chartConfigs: [],
    };

    const pCtx = makePipelineCtx({
      docType: {
        sectionTypes: [
          { id: "revenue_summary", name: "Revenue Summary", order: 1, parallel: true, structural: false },
        ],
        getAgent: () => ({
          name: "Creator",
          type: "bb_creator",
          role: "creator",
          baseSystemPrompt: "You are a creator",
          skillDomain: [],
          producesSkillsFor: [],
          temperature: 0.4,
          maxTokens: 4096,
        }),
        getSectionPrompt: () => "Generate revenue...",
      },
      state: { documentData: { revenueDetail: [] } },
    });

    // Mock AI response
    (pCtx.ctx.ai as { callJson: ReturnType<typeof vi.fn> }).callJson = vi.fn().mockResolvedValue({
      data: mockSection,
      inputTokens: 100,
      outputTokens: 200,
      model: "test",
    });

    const result = await generateSectionsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.state.sections).toHaveLength(1);
    expect(pCtx.state.sections[0]!.sectionType).toBe("revenue_summary");
  });
});

// ── render-charts ────────────────────────────────────────────────────────

describe("renderChartsStep", () => {
  it("has correct id", () => {
    expect(renderChartsStep.id).toBe("render_charts");
  });

  it("persists sections to DB", async () => {
    const pCtx = makePipelineCtx({
      docType: {
        sectionTypes: [
          { id: "revenue_summary", name: "Revenue Summary", order: 1, parallel: true, structural: false },
        ],
      },
      state: {
        sections: [
          {
            sectionType: "revenue_summary",
            title: "Revenue Summary",
            narrativeContent: "Revenue is...",
            tableData: [],
            chartConfigs: [],
          },
        ],
      },
    });

    const result = await renderChartsStep.execute(pCtx);
    expect(result.status).toBe("completed");
    expect(pCtx.ctx.db.insert).toHaveBeenCalled();
  });
});
