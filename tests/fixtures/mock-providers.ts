import type {
  AiProvider,
  AiCallOptions,
  AiCallResult,
  AiJsonResult,
  AiVisionResult,
  StorageProvider,
  DataProvider,
  QueueProvider,
  BudgetBookData,
} from "../../src/core/providers.js";
import { sampleBudgetData } from "./sample-budget-data.js";

/**
 * Mock AiProvider that returns canned responses.
 * Override specific methods in tests as needed.
 */
export class MockAiProvider implements AiProvider {
  calls: Array<{ method: string; args: unknown[] }> = [];

  async callText(
    systemPrompt: string,
    userPrompt: string,
    options?: AiCallOptions
  ): Promise<AiCallResult> {
    this.calls.push({ method: "callText", args: [systemPrompt, userPrompt, options] });
    return {
      text: "Mock AI response",
      inputTokens: 100,
      outputTokens: 50,
      model: options?.model ?? "claude-sonnet-4-20250514",
    };
  }

  async callJson<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: AiCallOptions
  ): Promise<AiJsonResult<T>> {
    this.calls.push({ method: "callJson", args: [systemPrompt, userPrompt, options] });
    return {
      data: {} as T,
      inputTokens: 100,
      outputTokens: 50,
      model: options?.model ?? "claude-sonnet-4-20250514",
    };
  }

  async callVision(
    systemPrompt: string,
    images: Buffer[],
    options?: AiCallOptions
  ): Promise<AiVisionResult> {
    this.calls.push({ method: "callVision", args: [systemPrompt, images, options] });
    return {
      text: "Mock vision response",
      inputTokens: 200,
      outputTokens: 100,
    };
  }

  async logUsage(
    tenantId: string,
    endpoint: string,
    inputTokens: number,
    outputTokens: number,
    model: string
  ): Promise<void> {
    this.calls.push({ method: "logUsage", args: [tenantId, endpoint, inputTokens, outputTokens, model] });
  }
}

/**
 * Mock StorageProvider backed by an in-memory Map.
 */
export class MockStorageProvider implements StorageProvider {
  private store = new Map<string, Buffer>();
  calls: Array<{ method: string; args: unknown[] }> = [];

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    this.calls.push({ method: "upload", args: [key, buffer, contentType] });
    this.store.set(key, buffer);
    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    this.calls.push({ method: "getObject", args: [key] });
    const buf = this.store.get(key);
    if (!buf) throw new Error(`Object not found: ${key}`);
    return buf;
  }

  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    this.calls.push({ method: "getSignedUrl", args: [key, expiresInSeconds] });
    return `https://mock-storage.example.com/${key}?expires=${expiresInSeconds ?? 3600}`;
  }
}

/**
 * Mock DataProvider that returns sample budget data.
 */
export class MockDataProvider implements DataProvider {
  calls: Array<{ method: string; args: unknown[] }> = [];
  data: BudgetBookData = sampleBudgetData;

  async getBudgetData(
    tenantId: string,
    worksheetId: string,
    fiscalYear: number
  ): Promise<BudgetBookData> {
    this.calls.push({ method: "getBudgetData", args: [tenantId, worksheetId, fiscalYear] });
    return this.data;
  }
}

/**
 * Mock QueueProvider that executes jobs synchronously.
 */
export class MockQueueProvider implements QueueProvider {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>();

  async enqueue(jobType: string, payload: Record<string, unknown>): Promise<string> {
    this.calls.push({ method: "enqueue", args: [jobType, payload] });
    const handler = this.handlers.get(jobType);
    if (handler) await handler(payload);
    return `mock-job-${Date.now()}`;
  }

  process(jobType: string, handler: (payload: Record<string, unknown>) => Promise<void>): void {
    this.calls.push({ method: "process", args: [jobType] });
    this.handlers.set(jobType, handler);
  }
}
