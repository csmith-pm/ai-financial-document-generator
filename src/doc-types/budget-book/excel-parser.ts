/**
 * Excel Budget Parser — two-phase approach:
 *   Phase 1: AI maps spreadsheet columns to our schema (small, cheap call)
 *   Phase 2: Code processes ALL rows programmatically (no AI, deterministic)
 *
 * This handles any size spreadsheet — 100 rows or 100K rows — at the same cost.
 */

import * as XLSX from "xlsx";
import type { AiProvider } from "../../core/providers.js";
import type {
  BudgetBookData,
  CommunityProfile,
  RevenueDetailRow,
  ExpenditureByDepartmentRow,
  PersonnelDetailRow,
  CapitalProjectDetail,
  ProjectionYear,
} from "./data-types.js";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SheetSummary {
  name: string;
  rowCount: number;
  headers: string[];
  allData: unknown[][];
}

/** @internal Exported for testing. */
export interface ColumnMapping {
  municipalityName: string | null;
  accountType: string | null;
  accountTypeValues: {
    revenue: string;
    expense: string;
  };
  fund: string | null;
  department: string | null;
  description: string | null;
  accountCode: string | null;
  currentBudget: string;
  priorYearBudget: string | null;
  priorYearActual: string | null;
  proposedBudget: string | null;
  functionCol: string | null;
  division: string | null;
  program: string | null;
  objectSummary: string | null;
  historicalYears: Array<{
    year: number;
    budgetColumn: string;
    actualColumn: string | null;
  }>;
}

// ─── Phase 1: AI Column Mapping ─────────────────────────────────────────────

const COLUMN_MAPPING_PROMPT = `You are a municipal finance data analyst. You will receive column headers and sample rows from a budget spreadsheet. Your job is to identify which columns map to which budget data fields.

Respond with valid JSON matching this exact structure:
{
  "municipalityName": "inferred municipality name from the data, or null",
  "accountType": "column name that distinguishes revenue vs expense rows, or null if all rows are same type",
  "accountTypeValues": {
    "revenue": "the cell value that indicates a revenue row (e.g. 'Revenue')",
    "expense": "the cell value that indicates an expense row (e.g. 'Expense')"
  },
  "fund": "column name for fund (e.g. 'Fund', 'Fund Name'), or null",
  "department": "column name for department (e.g. 'Department', 'Dept'), or null",
  "description": "column name for line item description (e.g. 'Description', 'Account Name'), or null",
  "accountCode": "column name for account code/ID, or null",
  "currentBudget": "column name for the current/target fiscal year budget amount",
  "priorYearBudget": "column name for prior year budget, or null",
  "priorYearActual": "column name for prior year actuals, or null",
  "proposedBudget": "column name for proposed/requested budget (may be same as currentBudget), or null",
  "functionCol": "column name for function/category, or null",
  "division": "column name for division, or null",
  "program": "column name for program, or null",
  "objectSummary": "column name for object code summary/classification, or null",
  "historicalYears": [
    { "year": 2024, "budgetColumn": "FY24 Original Budget", "actualColumn": "FY24 Actual" }
  ]
}

Rules:
- Use exact column header names from the data — do not rename them.
- For currentBudget, pick the column that best represents the TARGET fiscal year's budget or requested amount.
- For historicalYears, list ALL year-specific budget/actual column pairs you can identify, ordered oldest to newest.
- If the spreadsheet has columns like "FY27 Requested", "FY26 Original Budget", "FY25 Actual", map them to the appropriate fields.
- The target fiscal year is provided — use it to determine which column is "current" vs "prior" vs "historical".`;

/**
 * Build a diverse sample of rows that covers all Account Type values.
 * Returns up to ~15 rows: 3 per unique value in each categorical column.
 */
/** @internal Exported for testing. */
export function buildDiverseSample(
  headers: string[],
  allData: unknown[][],
): unknown[][] {
  // Find columns with low cardinality (likely categorical)
  const categoricalIdx = findCategoricalColumns(headers, allData);

  if (categoricalIdx.length === 0) {
    // No categorical columns found — just return first 10 rows
    return allData.slice(0, 10);
  }

  // Use the first categorical column (most likely Account Type) for diversity
  const typeIdx = categoricalIdx[0];
  const seen = new Map<string, number>();
  const sample: unknown[][] = [];

  for (const row of allData) {
    const val = String((row as unknown[])[typeIdx] ?? "");
    const count = seen.get(val) ?? 0;
    if (count < 3) {
      sample.push(row);
      seen.set(val, count + 1);
    }
    if (sample.length >= 15) break;
  }

  return sample;
}

/**
 * Find column indices with low cardinality (2-20 unique values) — likely categorical.
 */
/** @internal Exported for testing. */
export function findCategoricalColumns(
  headers: string[],
  allData: unknown[][],
): number[] {
  const results: Array<{ idx: number; cardinality: number }> = [];

  // Sample first 200 rows to detect cardinality
  const sampleSize = Math.min(allData.length, 200);

  for (let col = 0; col < headers.length; col++) {
    const unique = new Set<string>();
    for (let row = 0; row < sampleSize; row++) {
      const val = (allData[row] as unknown[])[col];
      if (val !== null && val !== undefined && val !== "") {
        unique.add(String(val));
      }
    }
    if (unique.size >= 2 && unique.size <= 20) {
      results.push({ idx: col, cardinality: unique.size });
    }
  }

  // Sort by cardinality ascending — lowest cardinality first (most likely "type" column)
  results.sort((a, b) => a.cardinality - b.cardinality);
  return results.map((r) => r.idx);
}

/**
 * Phase 1: Ask AI to map columns to our schema fields.
 */
async function mapColumns(
  ai: AiProvider,
  headers: string[],
  sampleRows: unknown[][],
  fiscalYear: number,
): Promise<ColumnMapping> {
  const headerLine = `Headers: ${headers.join(" | ")}`;
  const sampleLines = sampleRows
    .map((row) => (row as unknown[]).map((c) => String(c ?? "")).join(" | "))
    .join("\n");

  const { data } = await ai.callJson<ColumnMapping>(
    COLUMN_MAPPING_PROMPT,
    `Target fiscal year: FY${fiscalYear}\n\n${headerLine}\n\nSample rows (diverse selection):\n${sampleLines}`,
    { model: "claude-sonnet-4-20250514", temperature: 0.0, maxTokens: 2000 },
  );

  return data;
}

// ─── Phase 2: Programmatic Processing ───────────────────────────────────────

/** @internal Exported for testing. Safely parse a numeric value from a cell. */
export function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[$,\s()]/g, (m) => (m === "(" || m === ")" ? "" : ""));
  const n = parseFloat(cleaned);
  // Handle accounting-style negatives: ($1,234) → -1234
  if (String(val).startsWith("(") && String(val).endsWith(")")) {
    return isNaN(n) ? 0 : -Math.abs(n);
  }
  return isNaN(n) ? 0 : n;
}

/** Get a string field from a row by column name. */
function getString(row: Record<string, unknown>, col: string | null): string {
  if (!col) return "";
  const val = row[col];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

/** Personnel-related keywords in descriptions or object summaries. */
const PERSONNEL_KEYWORDS = [
  "salary", "salaries", "wages", "compensation", "payroll",
  "benefits", "health", "pension", "retirement", "insurance",
  "fica", "medicare", "workers comp", "overtime",
];

/** Capital-related keywords. */
const CAPITAL_KEYWORDS = [
  "capital", "construction", "infrastructure", "equipment",
  "vehicle", "building", "renovation", "improvement",
  "land acquisition", "machinery",
];

function isPersonnelRow(row: Record<string, unknown>, mapping: ColumnMapping): boolean {
  const desc = getString(row, mapping.description).toLowerCase();
  const obj = getString(row, mapping.objectSummary).toLowerCase();
  const text = `${desc} ${obj}`;
  return PERSONNEL_KEYWORDS.some((kw) => text.includes(kw));
}

function isCapitalRow(row: Record<string, unknown>, mapping: ColumnMapping): boolean {
  const desc = getString(row, mapping.description).toLowerCase();
  const func = getString(row, mapping.functionCol).toLowerCase();
  const obj = getString(row, mapping.objectSummary).toLowerCase();
  const text = `${desc} ${func} ${obj}`;
  return CAPITAL_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Phase 2: Process all rows programmatically using the column mapping.
 *
 * Aggregates revenue by fund and expenditures by department to keep
 * the resulting BudgetBookData small enough for downstream AI prompts.
 */
/** @internal Exported for testing. */
export function processAllRows(
  allRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  fiscalYear: number,
): BudgetBookData {
  const personnelDetail: PersonnelDetailRow[] = [];
  const capitalProjects: CapitalProjectDetail[] = [];

  // Aggregation maps
  const revenueByFund = new Map<string, { priorActual: number; currentBudget: number; proposedBudget: number }>();
  const expenseByDept = new Map<string, { priorActual: number; currentBudget: number; proposedBudget: number }>();
  const personnelByDept = new Map<string, { total: number; count: number }>();
  const capitalByProject = new Map<string, { desc: string; dept: string; total: number }>();

  for (const row of allRows) {
    const accountType = mapping.accountType ? getString(row, mapping.accountType) : "";
    const fund = getString(row, mapping.fund) || "General Fund";
    const dept = getString(row, mapping.department) || "Unassigned";
    const desc = getString(row, mapping.description);
    const currentBudget = toNumber(row[mapping.currentBudget]);
    const priorActual = toNumber(row[mapping.priorYearActual ?? ""]);
    const proposedBudget = mapping.proposedBudget
      ? toNumber(row[mapping.proposedBudget])
      : currentBudget;

    const isRevenue =
      mapping.accountType !== null &&
      accountType.toLowerCase() === mapping.accountTypeValues.revenue.toLowerCase();
    const isExpense =
      !mapping.accountType ||
      accountType.toLowerCase() === mapping.accountTypeValues.expense.toLowerCase();

    if (isRevenue) {
      const existing = revenueByFund.get(fund) ?? { priorActual: 0, currentBudget: 0, proposedBudget: 0 };
      existing.priorActual += priorActual;
      existing.currentBudget += currentBudget;
      existing.proposedBudget += proposedBudget;
      revenueByFund.set(fund, existing);
    }

    if (isExpense) {
      const existing = expenseByDept.get(dept) ?? { priorActual: 0, currentBudget: 0, proposedBudget: 0 };
      existing.priorActual += priorActual;
      existing.currentBudget += currentBudget;
      existing.proposedBudget += proposedBudget;
      expenseByDept.set(dept, existing);

      if (isPersonnelRow(row, mapping)) {
        const p = personnelByDept.get(dept) ?? { total: 0, count: 0 };
        p.total += currentBudget;
        p.count += 1;
        personnelByDept.set(dept, p);
      }

      if (isCapitalRow(row, mapping)) {
        const key = desc || `Capital - ${dept}`;
        const existing = capitalByProject.get(key);
        if (existing) {
          existing.total += currentBudget;
        } else {
          capitalByProject.set(key, { desc, dept, total: currentBudget });
        }
      }
    }
  }

  // Build aggregated revenue detail (one row per fund)
  const revenueDetail: RevenueDetailRow[] = [];
  for (const [fundName, totals] of revenueByFund) {
    revenueDetail.push({
      fundCode: "",
      fundName,
      accountCode: "",
      accountName: fundName,
      priorActual: totals.priorActual,
      currentBudget: totals.currentBudget,
      proposedBudget: totals.proposedBudget,
    });
  }

  // Build aggregated expenditure detail (one row per department)
  const expenditureByDepartment: ExpenditureByDepartmentRow[] = [];
  for (const [deptName, totals] of expenseByDept) {
    expenditureByDepartment.push({
      departmentCode: "",
      departmentName: deptName,
      priorActual: totals.priorActual,
      currentBudget: totals.currentBudget,
      proposedBudget: totals.proposedBudget,
    });
  }

  // Build personnel detail from aggregated data
  for (const [dept, data] of personnelByDept) {
    personnelDetail.push({
      department: dept,
      positionTitle: "",
      fte: 0,
      salary: data.total,
      benefits: 0,
      totalCompensation: data.total,
    });
  }

  // Build capital projects from aggregated data
  for (const [name, data] of capitalByProject) {
    capitalProjects.push({
      projectName: name,
      description: data.desc,
      department: data.dept,
      totalCost: data.total,
      fundingSource: "",
      yearOneAmount: data.total,
      status: "planned",
    });
  }

  // Build multi-year projections from historical columns
  const multiYearProjections: ProjectionYear[] = [];
  for (const hy of mapping.historicalYears) {
    let yearRevenue = 0;
    let yearExpenditure = 0;
    for (const row of allRows) {
      const accountType = mapping.accountType ? getString(row, mapping.accountType) : "";
      const budgetVal = toNumber(row[hy.budgetColumn]);
      const actualVal = hy.actualColumn ? toNumber(row[hy.actualColumn]) : budgetVal;
      const amount = actualVal || budgetVal;

      if (
        mapping.accountType &&
        accountType.toLowerCase() === mapping.accountTypeValues.revenue.toLowerCase()
      ) {
        yearRevenue += amount;
      } else if (
        !mapping.accountType ||
        accountType.toLowerCase() === mapping.accountTypeValues.expense.toLowerCase()
      ) {
        yearExpenditure += amount;
      }
    }
    multiYearProjections.push({
      fiscalYear: hy.year,
      revenue: yearRevenue,
      expenditure: yearExpenditure,
      fundBalance: 0,
      notes: "",
    });
  }

  // Add current fiscal year to projections
  const totalRevenue = revenueDetail.reduce((s, r) => s + r.currentBudget, 0);
  const totalExpenditure = expenditureByDepartment.reduce((s, r) => s + r.currentBudget, 0);
  multiYearProjections.push({
    fiscalYear,
    revenue: totalRevenue,
    expenditure: totalExpenditure,
    fundBalance: 0,
    notes: "",
  });
  multiYearProjections.sort((a, b) => a.fiscalYear - b.fiscalYear);

  const totalPersonnelCost = personnelDetail.reduce((s, d) => s + d.totalCompensation, 0);
  const totalCapitalCost = capitalProjects.reduce((s, p) => s + p.totalCost, 0);

  const communityProfile: CommunityProfile = {
    name: mapping.municipalityName ?? "Municipality",
    state: "",
    population: 0,
    squareMiles: 0,
    formOfGovernment: "Municipal Government",
    established: "",
  };

  return {
    fiscalYear,
    communityProfile,
    revenueDetail,
    expenditureByDepartment,
    personnelDetail,
    capitalProjects,
    multiYearProjections,
    totalRevenue,
    totalExpenditure,
    totalPersonnelCost,
    totalCapitalCost,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse an Excel buffer into sheet summaries.
 */
function parseExcelToSheets(buffer: Buffer): SheetSummary[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: SheetSummary[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    if (json.length === 0) continue;

    const headers = (json[0] as unknown[]).map((h) => String(h ?? ""));
    const dataRows = json.slice(1).filter((row) =>
      (row as unknown[]).some((cell) => cell !== null && cell !== undefined && cell !== "")
    );

    sheets.push({
      name,
      rowCount: dataRows.length,
      headers,
      allData: dataRows as unknown[][],
    });
  }

  return sheets;
}

/**
 * Parse an uploaded Excel budget file into BudgetBookData.
 *
 * Phase 1: AI maps columns (small call with headers + diverse sample rows).
 * Phase 2: Code processes ALL rows programmatically using that mapping.
 */
export async function parseExcelBudget(
  ai: AiProvider,
  buffer: Buffer,
  fiscalYear: number,
): Promise<BudgetBookData> {
  const sheets = parseExcelToSheets(buffer);

  if (sheets.length === 0) {
    throw new Error("Excel file contains no data sheets");
  }

  const sheet = sheets[0];

  // Phase 1: Build diverse sample and ask AI to map columns
  const diverseSample = buildDiverseSample(sheet.headers, sheet.allData);
  const mapping = await mapColumns(ai, sheet.headers, diverseSample, fiscalYear);

  // Phase 2: Read ALL rows as keyed objects and process programmatically
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheet.name]!,
  );

  return processAllRows(allRows, mapping, fiscalYear);
}
