import { describe, it, expect } from "vitest";
import { budgetBookDocType } from "../../src/doc-types/budget-book/index.js";
import { defaultRegistry } from "../../src/doc-types/index.js";
import type { BudgetBookData } from "../../src/doc-types/budget-book/data-types.js";

/** Minimal valid BudgetBookData for schema testing. */
const VALID_DATA: BudgetBookData = {
  fiscalYear: 2026,
  communityProfile: {
    name: "Springfield",
    state: "IL",
    population: 115000,
    squareMiles: 60,
    formOfGovernment: "Council-Manager",
    established: "1837",
  },
  revenueDetail: [],
  expenditureByDepartment: [],
  personnelDetail: [],
  capitalProjects: [],
  multiYearProjections: [],
  totalRevenue: 0,
  totalExpenditure: 0,
  totalPersonnelCost: 0,
  totalCapitalCost: 0,
};

describe("BudgetBookDocType", () => {
  it("has correct identity", () => {
    expect(budgetBookDocType.id).toBe("budget_book");
    expect(budgetBookDocType.name).toBe("Municipal Budget Book");
    expect(budgetBookDocType.version).toBe("1.0.0");
  });

  it("is registered in the default registry", () => {
    expect(defaultRegistry.has("budget_book")).toBe(true);
    expect(defaultRegistry.get("budget_book")).toBe(budgetBookDocType);
  });

  it("has 10 section types", () => {
    expect(budgetBookDocType.sectionTypes).toHaveLength(10);
    const ids = budgetBookDocType.sectionTypes.map((s) => s.id);
    expect(ids).toContain("executive_summary");
    expect(ids).toContain("revenue_summary");
    expect(ids).toContain("cover");
    expect(ids).toContain("toc");
  });

  it("has 4 agents", () => {
    expect(budgetBookDocType.agents).toHaveLength(4);
    const types = budgetBookDocType.agents.map((a) => a.type);
    expect(types).toContain("bb_creator");
    expect(types).toContain("bb_reviewer");
    expect(types).toContain("ada_reviewer");
    expect(types).toContain("bb_advisor");
  });

  it("getAgent returns correct definition", () => {
    const creator = budgetBookDocType.getAgent("bb_creator");
    expect(creator.name).toBe("BB_Creator");
    expect(creator.temperature).toBe(0.4);
  });

  it("getAgent throws on unknown type", () => {
    expect(() => budgetBookDocType.getAgent("unknown")).toThrow(
      'Unknown budget book agent type: "unknown"'
    );
  });

  it("has 2 reviewers", () => {
    expect(budgetBookDocType.reviewers).toHaveLength(2);
    expect(budgetBookDocType.reviewers[0].id).toBe("gfoa");
    expect(budgetBookDocType.reviewers[1].id).toBe("ada");
  });

  it("has 14 seed skills", () => {
    expect(budgetBookDocType.seedSkills).toHaveLength(14);
    const agentTypes = [...new Set(budgetBookDocType.seedSkills.map((s) => s.agentType))];
    expect(agentTypes).toContain("bb_creator");
    expect(agentTypes).toContain("bb_reviewer");
    expect(agentTypes).toContain("ada_reviewer");
  });

  it("has category priorities", () => {
    expect(budgetBookDocType.categoryPriority.accessibility).toBe(30);
    expect(budgetBookDocType.categoryPriority.gfoa_criteria).toBe(20);
    expect(budgetBookDocType.categoryPriority.chart_design).toBe(10);
    expect(budgetBookDocType.categoryPriority.advisory).toBe(5);
  });

  it("advisorAgentType is bb_advisor", () => {
    expect(budgetBookDocType.advisorAgentType).toBe("bb_advisor");
  });

  it("dataSchema validates valid BudgetBookData", () => {
    const result = budgetBookDocType.dataSchema.safeParse(VALID_DATA);
    expect(result.success).toBe(true);
  });

  it("dataSchema rejects invalid data", () => {
    const result = budgetBookDocType.dataSchema.safeParse({
      fiscalYear: "not a number",
    });
    expect(result.success).toBe(false);
  });

  it("detectDataGaps returns gaps for empty data", () => {
    const gaps = budgetBookDocType.detectDataGaps(VALID_DATA);
    // Empty revenue, expenditure, personnel, capital, multi-year = 5 gaps
    // + default community name (Springfield != "Municipality") = no gap
    // + no exec summary = 1 gap
    expect(gaps.length).toBeGreaterThanOrEqual(5);
    const titles = gaps.map((g) => g.title);
    expect(titles).toContain("No revenue data found");
    expect(titles).toContain("No expenditure data found");
  });

  it("getSectionData returns relevant data slice", () => {
    const data = budgetBookDocType.getSectionData("revenue_summary", VALID_DATA);
    expect(data).toHaveProperty("revenueDetail");
    expect(data).toHaveProperty("fiscalYear");
  });

  it("getSectionPrompt returns non-empty string", () => {
    const prompt = budgetBookDocType.getSectionPrompt("executive_summary", VALID_DATA, null);
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain("executive_summary");
    expect(prompt).toContain("Springfield");
  });

  it("has renderPdf method", () => {
    expect(typeof budgetBookDocType.renderPdf).toBe("function");
  });

  it("has analyzePriorDocument method", () => {
    expect(typeof budgetBookDocType.analyzePriorDocument).toBe("function");
  });

  it("has parseUpload method", () => {
    expect(typeof budgetBookDocType.parseUpload).toBe("function");
  });
});
