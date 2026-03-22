import type {
  DataProvider,
  AiProvider,
  StorageProvider,
} from "../core/providers.js";

export interface ExcelDataProviderConfig {
  ai: AiProvider;
  storage: StorageProvider;
  /** S3 key where the uploaded Excel file is stored */
  excelS3Key: string;
}

/**
 * DataProvider that creates structured document data from an uploaded Excel file.
 * Uses the AI-assisted Excel parser to interpret municipal budget formats.
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

  async getDocumentData(
    _docTypeId: string,
    _tenantId: string,
    _worksheetId: string,
    fiscalYear: number
  ): Promise<unknown> {
    const buffer = await this.storage.getObject(this.excelS3Key);
    // Import from the budget-book doc type's parser
    const { parseExcelBudget } = await import("../doc-types/budget-book/excel-parser.js");
    return parseExcelBudget(this.ai, buffer, fiscalYear);
  }
}
