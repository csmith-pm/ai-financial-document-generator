import type {
  DataProvider,
  AiProvider,
  StorageProvider,
  BudgetBookData,
} from "../core/providers.js";

export interface ExcelDataProviderConfig {
  ai: AiProvider;
  storage: StorageProvider;
  /** S3 key where the uploaded Excel file is stored */
  excelS3Key: string;
}

/**
 * DataProvider that creates BudgetBookData from an uploaded Excel file.
 * Uses the AI-assisted Excel parser to interpret municipal budget formats.
 *
 * Note: The actual parseExcelBudget function is in core/excelParser.ts.
 * This provider will be fully wired in Milestone 6 when the parser is refactored.
 * For now it serves as the interface placeholder.
 */
export class ExcelDataProvider implements DataProvider {
  private ai: AiProvider;
  private storage: StorageProvider;
  private excelS3Key: string;

  constructor(config: ExcelDataProviderConfig) {
    this.ai = config.ai;
    this.storage = config.storage;
    this.excelS3Key = config.excelS3Key;
  }

  async getBudgetData(
    _tenantId: string,
    _worksheetId: string,
    fiscalYear: number
  ): Promise<BudgetBookData> {
    const buffer = await this.storage.getObject(this.excelS3Key);
    const { parseExcelBudget } = await import("../core/excelParser.js");
    return parseExcelBudget(this.ai, buffer, fiscalYear);
  }
}
