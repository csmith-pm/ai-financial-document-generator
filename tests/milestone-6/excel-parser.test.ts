import { describe, it, expect } from "vitest";
import {
  parseExcelBudget,
  toNumber,
  processAllRows,
  buildDiverseSample,
  findCategoricalColumns,
} from "../../src/doc-types/budget-book/excel-parser.js";
import type { ColumnMapping } from "../../src/doc-types/budget-book/excel-parser.js";

// ─── toNumber ─────────────────────────────────────────────────────────────

describe("toNumber", () => {
  it("parses plain numbers", () => {
    expect(toNumber(1234)).toBe(1234);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-500)).toBe(-500);
  });

  it("parses dollar strings", () => {
    expect(toNumber("$1,234.56")).toBe(1234.56);
    expect(toNumber("$100")).toBe(100);
  });

  it("handles accounting-style negatives", () => {
    expect(toNumber("($1,234)")).toBe(-1234);
    expect(toNumber("(500)")).toBe(-500);
  });

  it("returns 0 for null, undefined, empty string", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(toNumber("abc")).toBe(0);
    expect(toNumber("N/A")).toBe(0);
  });
});

// ─── findCategoricalColumns ─────────────────────────────────────────────

describe("findCategoricalColumns", () => {
  it("detects low-cardinality columns", () => {
    const headers = ["Name", "Type", "Amount"];
    const data = [
      ["Alice", "Revenue", 100],
      ["Bob", "Expense", 200],
      ["Carol", "Revenue", 300],
      ["Dave", "Expense", 400],
      ["Eve", "Revenue", 500],
    ] as unknown[][];

    const result = findCategoricalColumns(headers, data);
    // "Type" has cardinality 2, "Name" has cardinality 5 — both qualify (2-20)
    // "Amount" has cardinality 5 — also qualifies but higher
    // Should be sorted by cardinality ascending
    expect(result[0]).toBe(1); // "Type" column (cardinality 2)
  });

  it("excludes columns with cardinality > 20", () => {
    const headers = ["ID", "Type"];
    const data = Array.from({ length: 25 }, (_, i) => [i, i % 3 === 0 ? "A" : "B"]) as unknown[][];

    const result = findCategoricalColumns(headers, data);
    // "ID" has cardinality 25 (excluded), "Type" has cardinality 2
    expect(result).toEqual([1]);
  });

  it("returns empty for all high-cardinality columns", () => {
    const headers = ["ID", "Value"];
    const data = Array.from({ length: 50 }, (_, i) => [i, i * 10]) as unknown[][];

    const result = findCategoricalColumns(headers, data);
    expect(result).toEqual([]);
  });
});

// ─── buildDiverseSample ─────────────────────────────────────────────────

describe("buildDiverseSample", () => {
  it("returns up to 3 rows per category value", () => {
    const headers = ["Desc", "Type", "Amount"];
    const data: unknown[][] = [];
    for (let i = 0; i < 50; i++) {
      data.push([`Item ${i}`, i % 2 === 0 ? "Revenue" : "Expense", i * 100]);
    }

    const sample = buildDiverseSample(headers, data);
    // Should have 3 Revenue + 3 Expense = 6
    expect(sample.length).toBe(6);
  });

  it("returns first 10 rows when no categorical columns found", () => {
    const headers = ["ID", "Value"];
    const data = Array.from({ length: 50 }, (_, i) => [i, i * 10]) as unknown[][];

    const sample = buildDiverseSample(headers, data);
    expect(sample.length).toBe(10);
  });

  it("handles fewer rows than limit", () => {
    const headers = ["Type"];
    const data: unknown[][] = [["A"], ["B"]];

    const sample = buildDiverseSample(headers, data);
    expect(sample.length).toBe(2);
  });
});

// ─── processAllRows ─────────────────────────────────────────────────────

describe("processAllRows", () => {
  const baseMapping: ColumnMapping = {
    municipalityName: "Test City",
    accountType: "Account Type",
    accountTypeValues: { revenue: "Revenue", expense: "Expense" },
    fund: "Fund",
    department: "Department",
    description: "Description",
    accountCode: "Account ID",
    currentBudget: "FY27 Budget",
    priorYearBudget: "FY26 Budget",
    priorYearActual: "FY26 Actual",
    proposedBudget: null,
    functionCol: "Function",
    division: null,
    program: null,
    objectSummary: "Object Summary",
    historicalYears: [
      { year: 2025, budgetColumn: "FY25 Budget", actualColumn: "FY25 Actual" },
    ],
  };

  const sampleRows: Record<string, unknown>[] = [
    { "Account Type": "Revenue", "Fund": "General Fund", "Department": "Tax", "Description": "Property Tax", "FY27 Budget": 500000, "FY26 Actual": 480000, "Object Summary": "Tax Revenue", "FY25 Budget": 460000, "FY25 Actual": 450000 },
    { "Account Type": "Revenue", "Fund": "General Fund", "Department": "Tax", "Description": "Sales Tax", "FY27 Budget": 200000, "FY26 Actual": 190000, "Object Summary": "Tax Revenue", "FY25 Budget": 180000, "FY25 Actual": 175000 },
    { "Account Type": "Revenue", "Fund": "Water Fund", "Department": "Utilities", "Description": "Water Fees", "FY27 Budget": 100000, "FY26 Actual": 95000, "Object Summary": "Fees", "FY25 Budget": 90000, "FY25 Actual": 88000 },
    { "Account Type": "Expense", "Fund": "General Fund", "Department": "Police", "Description": "Officer Salaries", "FY27 Budget": 300000, "FY26 Actual": 280000, "Object Summary": "Salaries", "FY25 Budget": 270000, "FY25 Actual": 265000 },
    { "Account Type": "Expense", "Fund": "General Fund", "Department": "Police", "Description": "Health Benefits", "FY27 Budget": 50000, "FY26 Actual": 48000, "Object Summary": "Benefits", "FY25 Budget": 46000, "FY25 Actual": 45000 },
    { "Account Type": "Expense", "Fund": "General Fund", "Department": "Fire", "Description": "Equipment Purchase", "FY27 Budget": 75000, "FY26 Actual": 0, "Object Summary": "Capital Equipment", "FY25 Budget": 0, "FY25 Actual": 0 },
  ];

  it("aggregates revenue by fund", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    expect(result.revenueDetail).toHaveLength(2); // General Fund + Water Fund
    const generalFund = result.revenueDetail.find((r) => r.fundName === "General Fund")!;
    expect(generalFund.currentBudget).toBe(700000); // 500k + 200k
    expect(generalFund.priorActual).toBe(670000); // 480k + 190k
    const waterFund = result.revenueDetail.find((r) => r.fundName === "Water Fund")!;
    expect(waterFund.currentBudget).toBe(100000);
  });

  it("aggregates expenditures by department", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    const police = result.expenditureByDepartment.find((e) => e.departmentName === "Police")!;
    expect(police.currentBudget).toBe(350000); // 300k + 50k
    const fire = result.expenditureByDepartment.find((e) => e.departmentName === "Fire")!;
    expect(fire.currentBudget).toBe(75000);
  });

  it("detects personnel rows by keyword", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    // "Officer Salaries" and "Health Benefits" match personnel keywords
    const policePers = result.personnelDetail.find((p) => p.department === "Police");
    expect(policePers).toBeDefined();
    expect(policePers!.totalCompensation).toBe(350000);
  });

  it("detects capital rows by keyword", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    // "Equipment Purchase" with "Capital Equipment" matches capital keywords
    expect(result.capitalProjects.length).toBeGreaterThanOrEqual(1);
    const equip = result.capitalProjects.find((p) => p.projectName.includes("Equipment"));
    expect(equip).toBeDefined();
    expect(equip!.totalCost).toBe(75000);
  });

  it("computes totals correctly", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    expect(result.totalRevenue).toBe(800000); // 500k + 200k + 100k
    expect(result.totalExpenditure).toBe(425000); // 300k + 50k + 75k
  });

  it("builds multi-year projections from historical columns", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    expect(result.multiYearProjections.length).toBeGreaterThanOrEqual(2);
    const fy25 = result.multiYearProjections.find((p) => p.fiscalYear === 2025);
    expect(fy25).toBeDefined();
    // FY25 actuals: revenue = 450k+175k+88k=713k, expense = 265k+45k+0=310k
    expect(fy25!.revenue).toBe(713000);
    expect(fy25!.expenditure).toBe(310000);
  });

  it("sets community profile from mapping", () => {
    const result = processAllRows(sampleRows, baseMapping, 2027);
    expect(result.communityProfile.name).toBe("Test City");
    expect(result.fiscalYear).toBe(2027);
  });
});

// ─── ExcelDataProvider integration ──────────────────────────────────────

describe("ExcelDataProvider integration", () => {
  it("exports parseExcelBudget function with correct arity", async () => {
    const mod = await import("../../src/doc-types/budget-book/excel-parser.js");
    expect(mod.parseExcelBudget).toBeTypeOf("function");
    expect(mod.parseExcelBudget.length).toBe(3);
  });

  it("ExcelDataProvider.getDocumentData calls storage.getObject", async () => {
    const { ExcelDataProvider } = await import("../../src/providers/excel-data.js");
    const { MockAiProvider, MockStorageProvider } = await import("../fixtures/mock-providers.js");

    const storage = new MockStorageProvider();
    await storage.upload("test.xlsx", Buffer.from("fake-excel"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const provider = new ExcelDataProvider({
      ai: new MockAiProvider(),
      storage,
      excelS3Key: "test.xlsx",
    });

    await expect(provider.getDocumentData("budget_book", "t1", "ws1", 2026)).rejects.toThrow();
    expect(storage.calls.some((c) => c.method === "getObject")).toBe(true);
  });
});
