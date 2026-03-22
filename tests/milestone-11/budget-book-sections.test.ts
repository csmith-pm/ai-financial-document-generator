import { describe, it, expect } from "vitest";
import { budgetBookDocType } from "../../src/doc-types/budget-book/index.js";
import type { BudgetBookData } from "../../src/doc-types/budget-book/data-types.js";

const SAMPLE_DATA: BudgetBookData = {
  fiscalYear: 2026,
  communityProfile: {
    name: "Testville",
    state: "CA",
    population: 50000,
    squareMiles: 25,
    formOfGovernment: "Mayor-Council",
    established: "1920",
  },
  revenueDetail: [
    { source: "Property Tax", category: "Taxes", amount: 5000000, priorYear: 4800000, budgeted: 5100000 },
  ],
  expenditureByDepartment: [
    { department: "Fire", amount: 2000000, priorYear: 1900000, budgeted: 2100000, headcount: 45 },
  ],
  personnelDetail: [
    { department: "Fire", title: "Chief", count: 1, salary: 120000, benefits: 40000, totalCost: 160000 },
  ],
  capitalProjects: [
    { name: "Station Upgrade", department: "Fire", estimatedCost: 500000, startYear: 2026, endYear: 2027, fundingSource: "Bonds", status: "Planned" },
  ],
  multiYearProjections: [
    { year: 2027, projectedRevenue: 5200000, projectedExpenditure: 5100000 },
  ],
  totalRevenue: 5000000,
  totalExpenditure: 2000000,
  totalPersonnelCost: 160000,
  totalCapitalCost: 500000,
};

describe("BudgetBookDocType sections", () => {
  const allSectionIds = budgetBookDocType.sectionTypes.map((s) => s.id);

  it("has all 10 section types", () => {
    expect(allSectionIds).toEqual([
      "executive_summary",
      "community_profile",
      "revenue_summary",
      "expenditure_summary",
      "personnel_summary",
      "capital_summary",
      "multi_year_outlook",
      "appendix",
      "cover",
      "toc",
    ]);
  });

  describe("getSectionData", () => {
    it("executive_summary includes fiscalYear", () => {
      const data = budgetBookDocType.getSectionData("executive_summary", SAMPLE_DATA);
      expect(data).toHaveProperty("fiscalYear", 2026);
    });

    it("community_profile includes profile info", () => {
      const data = budgetBookDocType.getSectionData("community_profile", SAMPLE_DATA);
      expect(data).toHaveProperty("communityProfile");
    });

    it("revenue_summary includes revenueDetail", () => {
      const data = budgetBookDocType.getSectionData("revenue_summary", SAMPLE_DATA);
      expect(data).toHaveProperty("revenueDetail");
      expect(data).toHaveProperty("fiscalYear");
    });

    it("expenditure_summary includes expenditureByDepartment", () => {
      const data = budgetBookDocType.getSectionData("expenditure_summary", SAMPLE_DATA);
      expect(data).toHaveProperty("expenditureByDepartment");
    });

    it("personnel_summary includes personnelDetail", () => {
      const data = budgetBookDocType.getSectionData("personnel_summary", SAMPLE_DATA);
      expect(data).toHaveProperty("personnelDetail");
    });

    it("capital_summary includes capital data", () => {
      const data = budgetBookDocType.getSectionData("capital_summary", SAMPLE_DATA);
      expect(data).toHaveProperty("capitalDetail");
    });

    it("multi_year_outlook includes multiYearProjections", () => {
      const data = budgetBookDocType.getSectionData("multi_year_outlook", SAMPLE_DATA);
      expect(data).toHaveProperty("multiYearProjections");
    });

    it("cover includes communityProfile and fiscalYear", () => {
      const data = budgetBookDocType.getSectionData("cover", SAMPLE_DATA);
      expect(data).toHaveProperty("communityProfile");
      expect(data).toHaveProperty("fiscalYear");
    });

    it("toc returns minimal data", () => {
      const data = budgetBookDocType.getSectionData("toc", SAMPLE_DATA);
      expect(data).toHaveProperty("fiscalYear");
    });

    it("appendix returns full data", () => {
      const data = budgetBookDocType.getSectionData("appendix", SAMPLE_DATA);
      expect(data).toHaveProperty("fiscalYear");
    });
  });

  describe("getSectionPrompt", () => {
    it.each(allSectionIds)("%s returns non-empty prompt", (sectionId) => {
      const prompt = budgetBookDocType.getSectionPrompt(sectionId, SAMPLE_DATA, null);
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("prompt includes community name", () => {
      const prompt = budgetBookDocType.getSectionPrompt("executive_summary", SAMPLE_DATA, null);
      expect(prompt).toContain("Testville");
    });

    it("prompt includes section type", () => {
      const prompt = budgetBookDocType.getSectionPrompt("revenue_summary", SAMPLE_DATA, null);
      expect(prompt).toContain("revenue_summary");
    });
  });
});
