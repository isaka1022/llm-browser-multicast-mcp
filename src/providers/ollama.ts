import type { ChatMessage, ModelResponse } from "../types.js";
import type { LLMProvider } from "./base.js";

interface OllamaModel {
  name: string;
}

interface OllamaChatResponse {
  message: {
    content: string;
  };
}

export class OllamaProvider implements LLMProvider {
  constructor(private readonly baseUrl: string) {}

  async chat(
    model: string,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ModelResponse> {
    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Ollama API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return {
      model: `ollama/${model}`,
      content: data.message.content,
      durationMs: Date.now() - start,
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) return [];
    const data = (await response.json()) as { models: OllamaModel[] };
    return data.models.map((m) => `ollama/${m.name}`);
  }
}
