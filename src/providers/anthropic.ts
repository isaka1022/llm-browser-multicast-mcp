import type { ChatMessage, ModelResponse, TokenUsage } from "../types.js";
import type { LLMProvider } from "./base.js";

interface AnthropicMessage {
  content: Array<{ type: string; text: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  async chat(
    model: string,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ModelResponse> {
    const start = Date.now();

    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: nonSystemMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as AnthropicMessage;
    const textBlock = data.content.find((b) => b.type === "text");
    if (!textBlock) {
      throw new Error("Anthropic: no text content in response");
    }

    const usage: TokenUsage | undefined = data.usage
      ? {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          estimated: false,
        }
      : undefined;

    return {
      model: `anthropic/${model}`,
      content: textBlock.text,
      durationMs: Date.now() - start,
      usage,
    };
  }

  async listModels(): Promise<string[]> {
    return [
      "anthropic/claude-sonnet-4-20250514",
      "anthropic/claude-haiku-4-20250414",
    ];
  }
}
