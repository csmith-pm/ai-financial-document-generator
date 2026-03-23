import { describe, it, expect } from "vitest";
import { parseIndexResult, buildDefaultIndex } from "../../src/doc-types/budget-book/pdf/indexer.js";
import { parseExtractionResult } from "../../src/doc-types/budget-book/pdf/extractor.js";
import { SECTION_TYPE_SPECS } from "../../src/doc-types/budget-book/sections.js";
import type { DocumentIndex, PriorSectionContent } from "../../src/core/types.js";

// ─── Indexer: parseIndexResult ──────────────────────────────────────────

describe("parseIndexResult", () => {
  it("parses valid JSON", () => {
    const json = JSON.stringify({
      title: "City Budget FY2026",
      sections: [
        { name: "About Us", startPage: 5, endPage: 10, mappedSectionType: "community_profile", hasNarrative: true, hasTables: false, hasCharts: false },
      ],
      metadata: { municipalityName: "Test City" },
    });

    const result = parseIndexResult(json);
    expect(result.title).toBe("City Budget FY2026");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]!.mappedSectionType).toBe("community_profile");
    expect(result.metadata.municipalityName).toBe("Test City");
  });

  it("parses JSON wrapped in code fences", () => {
    const json = '```json\n{"title": "Budget", "sections": [], "metadata": {}}\n```';
    const result = parseIndexResult(json);
    expect(result.title).toBe("Budget");
    expect(result.sections).toEqual([]);
  });

  it("returns default index on invalid JSON", () => {
    const result = parseIndexResult("This is not JSON at all");
    expect(result.title).toBe("Budget Book");
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("adds empty metadata if missing", () => {
    const json = JSON.stringify({ title: "Budget", sections: [] });
    const result = parseIndexResult(json);
    expect(result.metadata).toEqual({});
  });
});

// ─── Indexer: buildDefaultIndex ─────────────────────────────────────────

describe("buildDefaultIndex", () => {
  it("returns sections matching non-structural SECTION_TYPE_SPECS", () => {
    const index = buildDefaultIndex();
    const nonStructural = SECTION_TYPE_SPECS.filter((s) => !s.structural);
    expect(index.sections).toHaveLength(nonStructural.length);
  });

  it("maps each section to its standard type", () => {
    const index = buildDefaultIndex();
    for (const section of index.sections) {
      expect(section.mappedSectionType).not.toBeNull();
    }
  });

  it("has empty metadata", () => {
    const index = buildDefaultIndex();
    expect(index.metadata).toEqual({});
  });
});

// ─── Extractor: parseExtractionResult ───────────────────────────────────

describe("parseExtractionResult", () => {
  it("parses valid JSON with section type override", () => {
    const json = JSON.stringify({
      sectionType: "wrong_type",
      narrative: "Test narrative",
      tables: [{ title: "Table 1", headers: ["A"], rows: [["1"]] }],
      chartDescriptions: [],
      pageCount: 3,
      keyFindings: ["Finding 1"],
    });

    const result = parseExtractionResult(json, "revenue_summary");
    expect(result.sectionType).toBe("revenue_summary"); // overridden
    expect(result.narrative).toBe("Test narrative");
    expect(result.tables).toHaveLength(1);
    expect(result.keyFindings).toEqual(["Finding 1"]);
  });

  it("parses JSON in code fences", () => {
    const json = '```json\n{"sectionType":"x","narrative":"text","tables":[],"chartDescriptions":[],"pageCount":1,"keyFindings":[]}\n```';
    const result = parseExtractionResult(json, "test");
    expect(result.narrative).toBe("text");
    expect(result.sectionType).toBe("test");
  });

  it("falls back to raw text as narrative on invalid JSON", () => {
    const raw = "This is just plain text about revenue trends.";
    const result = parseExtractionResult(raw, "revenue_summary");
    expect(result.sectionType).toBe("revenue_summary");
    expect(result.narrative).toBe(raw);
    expect(result.tables).toEqual([]);
    expect(result.chartDescriptions).toEqual([]);
  });
});

// ─── Pipeline Steps: index-prior-document ───────────────────────────────

describe("indexPriorDocumentStep", () => {
  it("skips when no prior PDF key", async () => {
    const { indexPriorDocumentStep } = await import("../../src/core/pipeline/steps/index-prior-document.js");
    const { createInitialState } = await import("../../src/core/pipeline/executor.js");
    const { MockAiProvider, MockStorageProvider } = await import("../fixtures/mock-providers.js");

    const state = createInitialState({ document: { id: "doc1" } });
    const result = await indexPriorDocumentStep.execute({
      ctx: {
        db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) } as never,
        ai: new MockAiProvider(),
        storage: new MockStorageProvider(),
        data: {} as never,
        tenantId: "t1",
        config: {} as never,
      },
      docType: { indexPriorDocument: undefined } as never,
      documentId: "doc1",
      state,
    });

    expect(result.status).toBe("skipped");
    expect(state.documentIndex).toBeNull();
  });

  it("skips when doc type has no indexer", async () => {
    const { indexPriorDocumentStep } = await import("../../src/core/pipeline/steps/index-prior-document.js");
    const { createInitialState } = await import("../../src/core/pipeline/executor.js");
    const { MockAiProvider, MockStorageProvider } = await import("../fixtures/mock-providers.js");

    const state = createInitialState({
      document: { id: "doc1", priorYearPdfS3Key: "prior.pdf" },
    });
    const result = await indexPriorDocumentStep.execute({
      ctx: {
        db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) } as never,
        ai: new MockAiProvider(),
        storage: new MockStorageProvider(),
        data: {} as never,
        tenantId: "t1",
        config: {} as never,
      },
      docType: {} as never, // no indexPriorDocument
      documentId: "doc1",
      state,
    });

    expect(result.status).toBe("skipped");
  });

  it("has correct step id and name", async () => {
    const { indexPriorDocumentStep } = await import("../../src/core/pipeline/steps/index-prior-document.js");
    expect(indexPriorDocumentStep.id).toBe("index_prior_document");
    expect(indexPriorDocumentStep.name).toBe("Index Prior Document");
  });
});

// ─── Pipeline Steps: extract-prior-content ──────────────────────────────

describe("extractPriorContentStep", () => {
  it("skips when no document index", async () => {
    const { extractPriorContentStep } = await import("../../src/core/pipeline/steps/extract-prior-content.js");
    const { createInitialState } = await import("../../src/core/pipeline/executor.js");
    const { MockAiProvider, MockStorageProvider } = await import("../fixtures/mock-providers.js");

    const state = createInitialState({
      document: { id: "doc1", priorYearPdfS3Key: "prior.pdf" },
    });
    const result = await extractPriorContentStep.execute({
      ctx: {
        db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) } as never,
        ai: new MockAiProvider(),
        storage: new MockStorageProvider(),
        data: {} as never,
        tenantId: "t1",
        config: {} as never,
      },
      docType: { extractPriorContent: async () => new Map() } as never,
      documentId: "doc1",
      state,
    });

    expect(result.status).toBe("skipped");
    expect(state.priorContent.size).toBe(0);
  });

  it("skips when doc type has no extractor", async () => {
    const { extractPriorContentStep } = await import("../../src/core/pipeline/steps/extract-prior-content.js");
    const { createInitialState } = await import("../../src/core/pipeline/executor.js");
    const { MockAiProvider, MockStorageProvider } = await import("../fixtures/mock-providers.js");

    const state = createInitialState({
      document: { id: "doc1", priorYearPdfS3Key: "prior.pdf" },
    });
    state.documentIndex = { title: "Test", sections: [], metadata: {} };

    const result = await extractPriorContentStep.execute({
      ctx: {
        db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) } as never,
        ai: new MockAiProvider(),
        storage: new MockStorageProvider(),
        data: {} as never,
        tenantId: "t1",
        config: {} as never,
      },
      docType: {} as never, // no extractPriorContent
      documentId: "doc1",
      state,
    });

    expect(result.status).toBe("skipped");
  });

  it("has correct step id and name", async () => {
    const { extractPriorContentStep } = await import("../../src/core/pipeline/steps/extract-prior-content.js");
    expect(extractPriorContentStep.id).toBe("extract_prior_content");
    expect(extractPriorContentStep.name).toBe("Extract Prior Content");
  });
});

// ─── Pipeline: default pipeline includes new steps ──────────────────────

describe("default pipeline", () => {
  it("includes index and extract steps in correct order", async () => {
    const { buildDefaultPipeline } = await import("../../src/core/pipeline/index.js");
    const steps = buildDefaultPipeline();
    const ids = steps.map((s) => s.id);

    expect(ids).toContain("index_prior_document");
    expect(ids).toContain("extract_prior_content");

    // Order: analyze_prior_pdf < index < extract < fetch_data
    const analyzeIdx = ids.indexOf("analyze_prior_pdf");
    const indexIdx = ids.indexOf("index_prior_document");
    const extractIdx = ids.indexOf("extract_prior_content");
    const fetchIdx = ids.indexOf("fetch_data");

    expect(analyzeIdx).toBeLessThan(indexIdx);
    expect(indexIdx).toBeLessThan(extractIdx);
    expect(extractIdx).toBeLessThan(fetchIdx);
  });
});

// ─── PipelineState includes new fields ──────────────────────────────────

describe("PipelineState", () => {
  it("createInitialState includes documentIndex and priorContent", async () => {
    const { createInitialState } = await import("../../src/core/pipeline/executor.js");
    const state = createInitialState();
    expect(state.documentIndex).toBeNull();
    expect(state.priorContent).toBeInstanceOf(Map);
    expect(state.priorContent.size).toBe(0);
  });
});
