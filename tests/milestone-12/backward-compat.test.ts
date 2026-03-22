import { describe, it, expect } from "vitest";

describe("Backward compatibility: orchestrator exports", () => {
  it("exports orchestrateBudgetBookGeneration from core/orchestrator", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(typeof mod.orchestrateBudgetBookGeneration).toBe("function");
  });

  it("exports resumeBudgetBookGeneration from core/orchestrator", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(typeof mod.resumeBudgetBookGeneration).toBe("function");
  });

  it("exports orchestrateDocumentGeneration from core/orchestrator", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(typeof mod.orchestrateDocumentGeneration).toBe("function");
  });

  it("exports resumeDocumentGeneration from core/orchestrator", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(typeof mod.resumeDocumentGeneration).toBe("function");
  });

  it("backward-compat aliases point to the same function", async () => {
    const mod = await import("../../src/core/orchestrator.js");
    expect(mod.orchestrateBudgetBookGeneration).toBe(
      mod.orchestrateDocumentGeneration
    );
    expect(mod.resumeBudgetBookGeneration).toBe(
      mod.resumeDocumentGeneration
    );
  });
});

describe("Backward compatibility: index.ts exports", () => {
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

  it("buildDefaultPipeline returns 9 steps", async () => {
    const mod = await import("../../src/index.js");
    const pipeline = mod.buildDefaultPipeline();
    expect(pipeline).toHaveLength(9);
    expect(pipeline.map((s: { id: string }) => s.id)).toEqual([
      "seed_skills",
      "analyze_prior_pdf",
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

describe("Backward compatibility: pipeline step exports", () => {
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
