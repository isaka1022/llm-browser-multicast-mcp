import type { ChatMessage, ModelResponse, TokenUsage } from "../../types.js";
import type { LLMProvider } from "../base.js";
import type { WebChatAdapter, PlaywrightProviderOptions } from "./types.js";
import { BrowserManager } from "./browser-manager.js";
import { ChatGPTAdapter } from "./chatgpt-adapter.js";
import { log } from "../../logger.js";
import type { Page } from "playwright";

function messagesToPrompt(messages: ChatMessage[]): string {
  return messages.map((m) => m.content).join("\n\n");
}

export class PlaywrightProvider implements LLMProvider {
  private readonly browserManager: BrowserManager;
  private readonly adapter: WebChatAdapter;
  private readonly providerName: string;

  private activeRequests = 0;
  private readonly maxConcurrency = 1;
  private waitQueue: Array<() => void> = [];

  constructor(options: PlaywrightProviderOptions) {
    this.browserManager = new BrowserManager({
      headless: options.headless ?? true,
      storageStatePath:
        options.storageStatePath ?? ".playwright-auth/chatgpt-state.json",
      navigationTimeoutMs: options.navigationTimeoutMs ?? 30_000,
    });

    switch (options.service) {
      case "chatgpt":
        this.adapter = new ChatGPTAdapter();
        this.providerName = "chatgpt";
        break;
      default:
        throw new Error(
          `Unknown playwright service: ${options.service as string}`,
        );
    }
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ModelResponse> {
    await this.acquireLock();
    let page: Page | null = null;

    try {
      const start = Date.now();
      const prompt = messagesToPrompt(messages);

      page = await this.browserManager.newPage();
      await this.adapter.navigateToChat(page);

      const loggedIn = await this.adapter.isLoggedIn(page);
      if (!loggedIn) {
        throw new Error(
          `${this.providerName}: not logged in. ` +
            `Run with headless: false to log in manually, then restart.`,
        );
      }

      await this.adapter.startNewChat(page);
      const content = await this.adapter.sendAndReceive(
        page,
        prompt,
        timeoutMs,
      );

      await this.browserManager.saveStorageState();

      const usage: TokenUsage = {
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: Math.ceil(content.length / 4),
        estimated: true,
      };

      return {
        model: `${this.providerName}/${model}`,
        content,
        durationMs: Date.now() - start,
        usage,
      };
    } catch (error) {
      log.error(
        `PlaywrightProvider error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      this.releaseLock();
    }
  }

  async listModels(): Promise<string[]> {
    return this.adapter.supportedModels;
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }

  private async acquireLock(): Promise<void> {
    if (this.activeRequests < this.maxConcurrency) {
      this.activeRequests++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }

  private releaseLock(): void {
    this.activeRequests--;
    const next = this.waitQueue.shift();
    if (next) next();
  }
}
