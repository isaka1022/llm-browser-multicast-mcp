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
}

export interface PlaywrightProviderOptions {
  service: "chatgpt";
  storageStatePath?: string;
  headless?: boolean;
  navigationTimeoutMs?: number;
}
