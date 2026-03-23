import { describe, it, expect } from "vitest";

describe("Core exports: orchestrator", () => {
  it("exports orchestrateDocumentGeneration from core/orchestrator", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(typeof mod.orchestrateDocumentGeneration).toBe("function");
  });

  it("exports resumeDocumentGeneration from core/orchestrator", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(typeof mod.resumeDocumentGeneration).toBe("function");
  });
});

describe("Core exports: index.ts", () => {
  it("exports orchestrateDocumentGeneration from index", async () => {
    const mod = await import("../../src/index.js");
    expect(typeof mod.orchestrateDocumentGeneration).toBe("function");
  });

  it("exports buildDefaultPipeline from index", async () => {
    const mod = await import("../../src/index.js");
    expect(typeof mod.buildDefaultPipeline).toBe("function");
  });

  it("exports runPipeline from index", async () => {
    const mod = await import("../../src/index.js");
    expect(typeof mod.runPipeline).toBe("function");
  });

  it("buildDefaultPipeline returns 11 steps", async () => {
    const mod = await import("../../src/index.js");
    const pipeline = mod.buildDefaultPipeline();
    expect(pipeline).toHaveLength(11);
    expect(pipeline.map((s: { id: string }) => s.id)).toEqual([
      "seed_skills",
      "analyze_prior_pdf",
      "index_prior_document",
      "extract_prior_content",
      "fetch_data",
      "detect_gaps",
      "generate_sections",
      "render_charts",
      "review_and_iterate",
      "render_pdf",
      "finalize",
    ]);
  });
});

describe("Core exports: pipeline steps", () => {
  it("exports all steps from pipeline/index", async () => {
    const mod = await import("../../src/core/pipeline/index.js");
    expect(typeof mod.seedSkillsStep).toBe("object");
    expect(typeof mod.analyzeStyleStep).toBe("object");
    expect(typeof mod.fetchDataStep).toBe("object");
    expect(typeof mod.detectGapsStep).toBe("object");
    expect(typeof mod.generateSectionsStep).toBe("object");
    expect(typeof mod.renderChartsStep).toBe("object");
    expect(typeof mod.reviewAndIterateStep).toBe("object");
    expect(typeof mod.renderOutputStep).toBe("object");
    expect(typeof mod.finalizeStep).toBe("object");
  });
});
