/**
 * Backward compatibility tests — verify that imports from original paths
 * still work after the budget-book extraction refactor.
 */
import { describe, it, expect } from "vitest";

describe("Backward compatibility: re-export shims", () => {
  it("BudgetBookData types from core/providers", async () => {
    const mod = await import("../../src/core/providers.js");
    // Type re-exports don't show at runtime, but the module should load
    expect(mod).toBeDefined();
  });

  it("agent definitions from core/agents/definitions", async () => {
    const mod = await import("../../src/core/agents/definitions.js");
    expect(mod.AGENT_TYPES).toHaveLength(4);
    expect(mod.AGENT_DEFINITIONS).toBeDefined();
    expect(typeof mod.getAgentDefinition).toBe("function");
    expect(mod.getAgentDefinition("bb_creator").name).toBe("BB_Creator");
  });

  it("GLOBAL_SEEDS from core/skills/seeds", async () => {
    const mod = await import("../../src/core/skills/seeds.js");
    expect(mod.GLOBAL_SEEDS).toHaveLength(14);
    expect(typeof mod.seedGlobalSkills).toBe("function");
  });

  it("CATEGORY_PRIORITY from core/skills/arbitration", async () => {
    const mod = await import("../../src/core/skills/arbitration.js");
    expect(mod.CATEGORY_PRIORITY).toBeDefined();
    expect(mod.CATEGORY_PRIORITY.accessibility).toBe(30);
    expect(typeof mod.negotiateSkill).toBe("function");
  });

  it("detectDataGaps from core/todos/detector", async () => {
    const mod = await import("../../src/core/todos/detector.js");
    expect(typeof mod.detectDataGaps).toBe("function");
  });

  it("createTodosFromGfoaReview from core/todos/creator", async () => {
    const mod = await import("../../src/core/todos/creator.js");
    expect(typeof mod.createTodosFromGfoaReview).toBe("function");
    expect(typeof mod.createTodosFromDataGaps).toBe("function");
  });

  it("renderBudgetBookPdf from core/budgetBookPdf", async () => {
    const mod = await import("../../src/core/budgetBookPdf.js");
    expect(typeof mod.renderBudgetBookPdf).toBe("function");
  });

  it("PDF styles from core/pdfStyles", async () => {
    const mod = await import("../../src/core/pdfStyles.js");
    expect(typeof mod.getColorsFromAnalysis).toBe("function");
    expect(typeof mod.createBudgetBookStyles).toBe("function");
  });

  it("analyzePriorYearPdf from core/pdfAnalyzer", async () => {
    const mod = await import("../../src/core/pdfAnalyzer.js");
    expect(typeof mod.analyzePriorYearPdf).toBe("function");
  });

  it("parseExcelBudget from core/excelParser", async () => {
    const mod = await import("../../src/core/excelParser.js");
    expect(typeof mod.parseExcelBudget).toBe("function");
  });

  it("defaultRegistry and DocumentTypeDefinition from index", async () => {
    const mod = await import("../../src/index.js");
    expect(mod.defaultRegistry).toBeDefined();
    expect(mod.defaultRegistry.has("budget_book")).toBe(true);
  });
});
