import Anthropic from "@anthropic-ai/sdk";
import type {
  AiProvider,
  AiCallOptions,
  AiCallResult,
  AiJsonResult,
  AiVisionResult,
} from "../core/providers.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 4096;

export interface AnthropicAiProviderConfig {
  apiKey: string;
  defaultModel?: string;
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;
}

export class AnthropicAiProvider implements AiProvider {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;

  constructor(config: AnthropicAiProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout ?? 5 * 60 * 1000,   // 5 minutes
      maxRetries: config.maxRetries ?? 3,
    });
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
    this.defaultMaxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async callText(
    systemPrompt: string,
    userPrompt: string,
    options?: AiCallOptions
  ): Promise<AiCallResult> {
    const model = options?.model ?? this.defaultModel;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: options?.temperature ?? 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model,
    };
  }

  async callJson<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: AiCallOptions
  ): Promise<AiJsonResult<T>> {
    const result = await this.callText(systemPrompt, userPrompt, options);

    let jsonStr = result.text.trim();
    const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const data = JSON.parse(jsonStr) as T;
    return {
      data,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    };
  }

  async callVision(
    systemPrompt: string,
    images: Buffer[],
    options?: AiCallOptions
  ): Promise<AiVisionResult> {
    const model = options?.model ?? this.defaultModel;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;

    const imageBlocks: Anthropic.ImageBlockParam[] = images.map((buf) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: buf.toString("base64"),
      },
    }));

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: options?.temperature ?? 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text" as const, text: "Analyze these images." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  /**
   * Optional usage logging — override in subclass or provide a callback.
   * Default is a no-op.
   */
  async logUsage(
    _tenantId: string,
    _endpoint: string,
    _inputTokens: number,
    _outputTokens: number,
    _model: string
  ): Promise<void> {
    // No-op by default. Override or wrap for cost tracking.
  }
}

/**
 * Estimate cost in USD for a Claude API call.
 * Sonnet pricing: $3/MTok input, $15/MTok output (as of 2025)
 */
export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;
  return inputCost + outputCost;
}
