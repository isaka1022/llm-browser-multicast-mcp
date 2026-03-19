import type { ChatMessage, ModelResponse } from "../types.js";

export interface ChatOptions {
  resumeUrl?: string;
}

export interface LLMProvider {
  chat(model: string, messages: ChatMessage[], timeoutMs: number, options?: ChatOptions): Promise<ModelResponse>;
  listModels(): Promise<string[]>;
}
