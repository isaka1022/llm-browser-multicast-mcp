import type { Page } from "playwright";

export interface WebChatAdapter {
  readonly serviceName: string;
  readonly supportedModels: string[];

  navigateToChat(page: Page): Promise<void>;
  isLoggedIn(page: Page): Promise<boolean>;
  startNewChat(page: Page): Promise<void>;
  sendAndReceive(
    page: Page,
    prompt: string,
    timeoutMs: number,
  ): Promise<string>;

  /** Select a specific model in the UI (no-op if not supported). */
  selectModel(page: Page, model: string): Promise<void>;
}

export interface PlaywrightProviderOptions {
  service: "chatgpt" | "gemini" | "claude" | "grok";
  profileDir?: string;
  headless?: boolean;
  navigationTimeoutMs?: number;
}

export interface DeepResearchSource {
  title: string;
  url: string;
}

export interface DeepResearchResult {
  content: string;
  sources: DeepResearchSource[];
  durationMs: number;
}

export type DeepResearchProgressCallback = (status: {
  phase: string;
  message: string;
  elapsedMs: number;
}) => void;
