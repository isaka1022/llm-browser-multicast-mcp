import type { ChatMessage, ModelResponse } from "../types.js";

export interface LLMProvider {
  chat(model: string, messages: ChatMessage[], timeoutMs: number): Promise<ModelResponse>;
  listModels(): Promise<string[]>;
}

interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    private readonly providerName: string,
    private readonly baseUrl: string,
    private readonly headers: Record<string, string> = {},
  ) {}

  async chat(
    model: string,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ModelResponse> {
    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `${this.providerName} API error ${response.status}: ${body}`,
      );
    }

    const data = (await response.json()) as OpenAICompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.providerName}: empty response`);
    }

    return {
      model: `${this.providerName}/${model}`,
      content,
      durationMs: Date.now() - start,
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/v1/models`, {
      headers: this.headers,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      data: Array<{ id: string }>;
    };
    return data.data.map((m) => `${this.providerName}/${m.id}`);
  }
}
