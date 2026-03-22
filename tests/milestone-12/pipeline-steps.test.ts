import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineContext } from "../../src/core/pipeline/types.js";
import { createInitialState } from "../../src/core/pipeline/executor.js";
import type { EngineContext } from "../../src/core/context.js";
import type { DocumentTypeDefinition } from "../../src/core/doc-type.js";
import { z } from "zod";

import { seedSkillsStep } from "../../src/core/pipeline/steps/seed-skills.js";
import { analyzeStyleStep } from "../../src/core/pipeline/steps/analyze-style.js";
import { fetchDataStep } from "../../src/core/pipeline/steps/fetch-data.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMockCtx(): EngineContext {
  const mockChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      update: vi.fn().mockReturnValue(mockChain),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
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
