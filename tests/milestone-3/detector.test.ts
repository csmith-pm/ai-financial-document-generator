import { describe, it, expect } from "vitest";
import { detectDataGaps } from "../../src/core/todos/detector.js";
import { sampleBudgetData, sparseBudgetData } from "../fixtures/sample-budget-data.js";
import type { BudgetBookData } from "../../src/core/providers.js";

describe("detectDataGaps", () => {
  it("returns no gaps for complete data", () => {
    const gaps = detectDataGaps(sampleBudgetData);
    expect(gaps).toEqual([]);
  });

  it("detects all gaps in sparse (empty) data", () => {
    const gaps = detectDataGaps(sparseBudgetData);
    expect(gaps.length).toBeGreaterThanOrEqual(6);

    const titles = gaps.map((g) => g.title);
    expect(titles).toContain("No revenue data found");
    expect(titles).toContain("No expenditure data found");
    expect(titles).toContain("No personnel data linked");
    expect(titles).toContain("No capital projects found");
    expect(titles).toContain("No multi-year projections available");
    expect(titles).toContain("Community profile not configured");
    expect(titles).toContain("No executive summary data");
  });

  it("detects missing revenue as high priority", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      revenueDetail: [],
    };
    const gaps = detectDataGaps(data);
    const revenueGap = gaps.find((g) => g.title === "No revenue data found");
    expect(revenueGap).toBeDefined();
    expect(revenueGap!.priority).toBe("high");
    expect(revenueGap!.sectionType).toBe("revenue_summary");
    expect(revenueGap!.category).toBe("data_gap");
  });

  it("detects limited revenue as medium priority clarification", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      revenueDetail: [sampleBudgetData.revenueDetail[0]],
    };
    const gaps = detectDataGaps(data);
    const limitedGap = gaps.find((g) => g.title === "Limited revenue detail");
    expect(limitedGap).toBeDefined();
    expect(limitedGap!.priority).toBe("medium");
    expect(limitedGap!.category).toBe("clarification");
  });

  it("detects missing expenditure data", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      expenditureByDepartment: [],
    };
    const gaps = detectDataGaps(data);
    expect(gaps.some((g) => g.title === "No expenditure data found")).toBe(true);
  });

  it("detects missing personnel data", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      personnelDetail: [],
    };
    const gaps = detectDataGaps(data);
    expect(gaps.some((g) => g.title === "No personnel data linked")).toBe(true);
  });

  it("detects missing capital projects", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      capitalProjects: [],
    };
    const gaps = detectDataGaps(data);
    expect(gaps.some((g) => g.title === "No capital projects found")).toBe(true);
  });

  it("detects missing multi-year projections as high priority", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      multiYearProjections: [],
    };
    const gaps = detectDataGaps(data);
    const projGap = gaps.find((g) => g.title === "No multi-year projections available");
    expect(projGap).toBeDefined();
    expect(projGap!.priority).toBe("high");
    expect(projGap!.sectionType).toBe("multi_year_outlook");
  });

  it("detects fewer than 3 years of projections", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      multiYearProjections: sampleBudgetData.multiYearProjections.slice(0, 2),
    };
    const gaps = detectDataGaps(data);
    const thinGap = gaps.find((g) => g.title === "Fewer than 3 years of projections");
    expect(thinGap).toBeDefined();
    expect(thinGap!.priority).toBe("medium");
  });

  it("detects default community profile name", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      communityProfile: { ...sampleBudgetData.communityProfile, name: "Municipality" },
    };
    const gaps = detectDataGaps(data);
    expect(gaps.some((g) => g.title === "Community profile not configured")).toBe(true);
  });

  it("detects empty community profile name", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      communityProfile: { ...sampleBudgetData.communityProfile, name: "" },
    };
    const gaps = detectDataGaps(data);
    expect(gaps.some((g) => g.title === "Community profile not configured")).toBe(true);
  });

  it("detects missing executive summary as low priority", () => {
    const data: BudgetBookData = {
      ...sampleBudgetData,
      executiveSummary: undefined,
    };
    const gaps = detectDataGaps(data);
    const esGap = gaps.find((g) => g.title === "No executive summary data");
    expect(esGap).toBeDefined();
    expect(esGap!.priority).toBe("low");
  });

  it("returns correct DetectedGap shape", () => {
    const gaps = detectDataGaps(sparseBudgetData);
    for (const gap of gaps) {
      expect(gap).toHaveProperty("category");
      expect(gap).toHaveProperty("title");
      expect(gap).toHaveProperty("description");
      expect(gap).toHaveProperty("sectionType");
      expect(gap).toHaveProperty("priority");
      expect(["data_gap", "clarification"]).toContain(gap.category);
      expect(["high", "medium", "low"]).toContain(gap.priority);
      expect(gap.description.length).toBeGreaterThan(20);
    }
  });
});
