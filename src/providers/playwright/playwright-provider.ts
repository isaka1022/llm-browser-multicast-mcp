import type { ChatMessage, ModelResponse, TokenUsage } from "../../types.js";
import type { LLMProvider } from "../base.js";
import type {
  WebChatAdapter,
  PlaywrightProviderOptions,
  DeepResearchResult,
  DeepResearchProgressCallback,
} from "./types.js";
import { BrowserManager } from "./browser-manager.js";
import { ChatGPTAdapter } from "./chatgpt-adapter.js";
import { GeminiAdapter } from "./gemini-adapter.js";
import { ClaudeAdapter } from "./claude-adapter.js";
import { GrokAdapter } from "./grok-adapter.js";
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

  private readonly profileDir: string;
  private persistentPage: Page | null = null;

  constructor(options: PlaywrightProviderOptions) {
    this.profileDir = options.profileDir ?? ".playwright-auth/chrome-profile";
    this.browserManager = BrowserManager.getShared({
      headless: options.headless ?? false,
      profileDir: this.profileDir,
      navigationTimeoutMs: options.navigationTimeoutMs ?? 30_000,
    });

    switch (options.service) {
      case "chatgpt":
        this.adapter = new ChatGPTAdapter();
        this.providerName = "chatgpt";
        break;
      case "gemini":
        this.adapter = new GeminiAdapter();
        this.providerName = "gemini";
        break;
      case "claude":
        this.adapter = new ClaudeAdapter();
        this.providerName = "claude-web";
        break;
      case "grok":
        this.adapter = new GrokAdapter();
        this.providerName = "grok-web";
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

    try {
      const start = Date.now();
      const prompt = messagesToPrompt(messages);

      // First call: open page and start new chat
      // Subsequent calls: reuse existing page (same tab / conversation)
      if (!this.persistentPage || this.persistentPage.isClosed()) {
        const page = await this.browserManager.newPage();
        await this.adapter.navigateToChat(page);

        const loggedIn = await this.adapter.isLoggedIn(page);
        if (!loggedIn) {
          await page.close().catch(() => {});
          throw new Error(
            `${this.providerName}: not logged in. ` +
              `Run with headless: false to log in manually, then restart.`,
          );
        }

        await this.adapter.startNewChat(page);
        await this.adapter.selectModel(page, model);
        this.persistentPage = page;
      }

      let content: string;
      try {
        content = await this.adapter.sendAndReceive(
          this.persistentPage,
          prompt,
          timeoutMs,
        );
      } catch (err) {
        // On timeout, reload the page (preserving chat URL) and retry once
        const isTimeout =
          err instanceof Error &&
          (err.message.includes("timeout") || err.message.includes("Timeout"));
        if (!isTimeout || !this.persistentPage) throw err;

        log.info(
          `${this.providerName}: timed out, reloading page and retrying...`,
        );
        await this.persistentPage.reload({ waitUntil: "domcontentloaded" });
        await this.persistentPage.waitForTimeout(3_000);
        content = await this.adapter.sendAndReceive(
          this.persistentPage,
          prompt,
          timeoutMs,
        );
      }

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
      this.releaseLock();
    }
  }

  async listModels(): Promise<string[]> {
    return this.adapter.supportedModels;
  }

  async deepResearch(
    query: string,
    timeoutMs: number,
    onProgress?: DeepResearchProgressCallback,
  ): Promise<DeepResearchResult> {
    await this.acquireLock();
    let page: Page | null = null;

    try {
      page = await this.browserManager.newPage();

      const chatgptAdapter = this.adapter as ChatGPTAdapter;
      await chatgptAdapter.navigateToChat(page);

      const loggedIn = await chatgptAdapter.isLoggedIn(page);
      if (!loggedIn) {
        throw new Error(
          "ChatGPT: not logged in. Run with headless: false to log in manually.",
        );
      }

      await chatgptAdapter.startNewChat(page);
      return await chatgptAdapter.deepResearch(
        page,
        query,
        timeoutMs,
        onProgress,
      );
    } catch (error) {
      log.error(
        `Deep Research error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      if (page) await page.close().catch(() => {});
      this.releaseLock();
    }
  }

  async close(): Promise<void> {
    if (this.persistentPage && !this.persistentPage.isClosed()) {
      await this.persistentPage.close().catch(() => {});
      this.persistentPage = null;
    }
    await BrowserManager.releaseShared({ profileDir: this.profileDir });
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
