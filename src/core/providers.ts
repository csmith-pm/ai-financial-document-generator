/**
 * Provider Interfaces
 *
 * These are the abstraction seams that decouple the orchestration engine
 * from any specific infrastructure. Implement these interfaces to plug
 * the budget book engine into any application.
 */

// ─── AI Provider ────────────────────────────────────────────────────────────

export interface AiCallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiJsonResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiVisionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  /** Send a text prompt and get a text response */
  callText(
    systemPrompt: string,
    userPrompt: string,
    options?: AiCallOptions
  ): Promise<AiCallResult>;

  /** Send a text prompt and parse the response as JSON */
  callJson<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: AiCallOptions
  ): Promise<AiJsonResult<T>>;

  /** Send images + text prompt (for PDF analysis) */
  callVision(
    systemPrompt: string,
    images: Buffer[],
    options?: AiCallOptions
  ): Promise<AiVisionResult>;

  /** Optional: log AI usage for cost tracking */
  logUsage?(
    tenantId: string,
    endpoint: string,
    inputTokens: number,
    outputTokens: number,
    model: string
  ): Promise<void>;
}

// ─── Storage Provider ───────────────────────────────────────────────────────

export interface StorageProvider {
  /** Upload a buffer and return a storage key */
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;

  /** Retrieve a buffer by storage key */
  getObject(key: string): Promise<Buffer>;

  /** Get a signed/public download URL */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

// ─── Data Provider ──────────────────────────────────────────────────────────

// BudgetBookData types — canonical definitions live in doc-types/budget-book/data-types.ts
export type {
  RevenueDetailRow,
  ExpenditureByDepartmentRow,
  PersonnelDetailRow,
  CapitalProjectDetail,
  ProjectionYear,
  CommunityProfile,
  BudgetBookData,
} from "../doc-types/budget-book/data-types.js";

// Re-import for use in DataProvider below
import type { BudgetBookData } from "../doc-types/budget-book/data-types.js";

export interface DataProvider {
  /** Fetch structured budget data from whatever source system the host app uses */
  getBudgetData(
    tenantId: string,
    worksheetId: string,
    fiscalYear: number
  ): Promise<BudgetBookData>;
}

// ─── Queue Provider (optional, for async generation) ────────────────────────

export interface QueueProvider {
  /** Enqueue a budget book generation job */
  enqueue(
    jobType: string,
    payload: Record<string, unknown>
  ): Promise<string>;

  /** Process jobs (register a handler) */
  process(
    jobType: string,
    handler: (payload: Record<string, unknown>) => Promise<void>
  ): void;
}

// ─── Engine Configuration ───────────────────────────────────────────────────

export interface EngineConfig {
  ai: AiProvider;
  storage: StorageProvider;
  data: DataProvider;
  queue?: QueueProvider;

  /** PostgreSQL connection string */
  connectionString: string;

  /** Max review-revise iterations (default: 3) */
  maxIterations?: number;

  /** Default AI model (default: claude-sonnet-4-20250514) */
  defaultModel?: string;

  /** Chart rendering enabled (requires Puppeteer) */
  chartsEnabled?: boolean;

  /** Custom section types to generate (default: all standard sections) */
  sectionTypes?: string[];

  /** Custom review criteria (default: GFOA Distinguished Budget) */
  reviewCriteria?: string;
}
