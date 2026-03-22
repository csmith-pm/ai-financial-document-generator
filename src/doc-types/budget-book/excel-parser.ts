/**
 * Excel Budget Parser — reads an uploaded Excel file and uses an AI provider
 * to interpret it into BudgetBookData format.
 *
 * Extracted from src/core/excelParser.ts.
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

interface SheetSummary {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: unknown[][];
  allData: unknown[][];
}

/**
 * Parse an Excel buffer into sheet summaries for AI.
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
      sampleRows: dataRows.slice(0, 5) as unknown[][],
      allData: dataRows as unknown[][],
    });
  }

  return sheets;
}

/**
 * Build a text representation of the Excel data for AI.
 * Includes all data for sheets with < 200 rows, sample for larger ones.
 */
function buildExcelPrompt(sheets: SheetSummary[]): string {
  const parts: string[] = [];

  for (const sheet of sheets) {
    parts.push(`\n=== Sheet: "${sheet.name}" (${sheet.rowCount} data rows) ===`);
    parts.push(`Headers: ${sheet.headers.join(" | ")}`);

    const rows = sheet.rowCount <= 200 ? sheet.allData : sheet.sampleRows;
    const label = sheet.rowCount <= 200 ? "All data" : `Sample (first 5 of ${sheet.rowCount})`;
    parts.push(`${label}:`);

    for (const row of rows) {
      parts.push((row as unknown[]).map((c) => String(c ?? "")).join(" | "));
    }
  }

  return parts.join("\n");
}

const INTERPRETATION_PROMPT = `You are a municipal finance data analyst. You will receive the contents of a budget Excel spreadsheet. Your job is to interpret the data and extract structured budget information.

Analyze the sheets and extract as much of the following as you can find:

1. **communityProfile**: municipality name, government type
2. **revenue**: line items with fund, source/category, budget amount, prior year actuals
3. **expenditures**: line items with fund, department, budget amount, prior year actuals
4. **personnel**: departments with position counts and compensation totals
5. **capital**: project names, descriptions, costs
6. **multiYearProjections**: revenue and expense projections by year
7. **executiveSummary**: fund-level totals

Respond with valid JSON matching this exact structure:
{
  "municipalityName": "string or null",
  "fiscalYear": number,
  "revenue": [{ "fund": "string", "source": "string", "currentBudget": number, "priorYearActuals": number }],
  "expenditures": [{ "fund": "string", "department": "string", "currentBudget": number, "priorYearActuals": number }],
  "personnel": [{ "department": "string", "positionCount": number, "totalCompensation": number }],
  "capitalProjects": [{ "projectName": "string", "description": "string", "totalCost": number, "status": "string" }],
  "projections": [{ "year": number, "revenue": number, "expense": number }],
  "fundSummary": [{ "fundName": "string", "revenue": number, "expenditure": number }]
}

If a section is not present in the data, use empty arrays. Make your best interpretation of the column meanings based on common municipal budget terminology. Convert all amounts to numbers (remove $ signs, commas, etc).`;

interface ParsedBudgetData {
  municipalityName: string | null;
  fiscalYear: number;
  revenue: { fund: string; source: string; currentBudget: number; priorYearActuals: number }[];
  expenditures: { fund: string; department: string; currentBudget: number; priorYearActuals: number }[];
  personnel: { department: string; positionCount: number; totalCompensation: number }[];
  capitalProjects: { projectName: string; description: string; totalCost: number; status: string }[];
  projections: { year: number; revenue: number; expense: number }[];
  fundSummary: { fundName: string; revenue: number; expenditure: number }[];
}

/**
 * Parse an uploaded Excel budget file into BudgetBookData.
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

  const excelText = buildExcelPrompt(sheets);

  const { data: parsed } = await ai.callJson<ParsedBudgetData>(
    INTERPRETATION_PROMPT,
    `Here is the budget Excel data for FY${fiscalYear}:\n${excelText}`,
    { model: "claude-sonnet-4-20250514", temperature: 0.1, maxTokens: 8000 },
  );

  // Map parsed data to flat RevenueDetailRow[]
  const revenueDetail: RevenueDetailRow[] = parsed.revenue.map((r) => ({
    fundCode: "",
    fundName: r.fund,
    accountCode: "",
    accountName: r.source,
    priorActual: r.priorYearActuals,
    currentBudget: r.currentBudget,
    proposedBudget: r.currentBudget,
  }));

  // Map parsed data to flat ExpenditureByDepartmentRow[]
  const expenditureByDepartment: ExpenditureByDepartmentRow[] = parsed.expenditures.map((e) => ({
    departmentCode: "",
    departmentName: e.department,
    priorActual: e.priorYearActuals,
    currentBudget: e.currentBudget,
    proposedBudget: e.currentBudget,
  }));

  // Map parsed data to flat PersonnelDetailRow[]
  const personnelDetail: PersonnelDetailRow[] = parsed.personnel.map((p) => ({
    department: p.department,
    positionTitle: "",
    fte: p.positionCount,
    salary: p.positionCount > 0 ? p.totalCompensation / p.positionCount : 0,
    benefits: 0,
    totalCompensation: p.totalCompensation,
  }));

  // Map parsed data to flat CapitalProjectDetail[]
  const capitalProjects: CapitalProjectDetail[] = parsed.capitalProjects.map((c) => ({
    projectName: c.projectName,
    description: c.description,
    department: "",
    totalCost: c.totalCost,
    fundingSource: "",
    yearOneAmount: c.totalCost,
    status: c.status || "planned",
  }));

  // Map parsed data to flat ProjectionYear[]
  const multiYearProjections: ProjectionYear[] = parsed.projections.map((p) => ({
    fiscalYear: p.year,
    revenue: p.revenue,
    expenditure: p.expense,
    fundBalance: 0,
    notes: "",
  }));

  const communityProfile: CommunityProfile = {
    name: parsed.municipalityName ?? "Municipality",
    state: "",
    population: 0,
    squareMiles: 0,
    formOfGovernment: "Municipal Government",
    established: "",
  };

  const totalRevenue = revenueDetail.reduce((s, r) => s + r.currentBudget, 0);
  const totalExpenditure = expenditureByDepartment.reduce((s, r) => s + r.currentBudget, 0);
  const totalPersonnelCost = personnelDetail.reduce((s, d) => s + d.totalCompensation, 0);
  const totalCapitalCost = capitalProjects.reduce((s, p) => s + p.totalCost, 0);

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
