import type { Page } from "playwright";
import type {
  DeepResearchResult,
  DeepResearchSource,
  DeepResearchProgressCallback,
} from "./types.js";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { CHATGPT_SELECTORS as S } from "./selectors.js";
import { log } from "../../logger.js";

const POLL_INTERVAL_MS = 10_000;

export class ChatGPTAdapter extends BaseWebChatAdapter {
  readonly serviceName = "chatgpt";
  readonly supportedModels = ["chatgpt/gpt-4o", "chatgpt/gpt-4o-mini"];

  protected readonly selectors: AdapterSelectors = {
    BASE_URL: S.BASE_URL,
    TEXT_INPUT: S.TEXT_INPUT,
    LOGGED_IN_INDICATOR: S.LOGGED_IN_INDICATOR,
    RESPONSE_SELECTOR: S.ASSISTANT_MESSAGE,
  };

  async sendAndReceive(
    page: Page,
    prompt: string,
    timeoutMs: number,
  ): Promise<string> {
    const countBefore = await this.countResponseElements(
      page,
      S.ASSISTANT_MESSAGE,
    );

    const textArea = page.locator(S.TEXT_INPUT);
    await textArea.click();
    await textArea.fill(prompt);

    const sendButton = page.locator(S.SEND_BUTTON);
    await sendButton.waitFor({ state: "visible", timeout: 5_000 });
    await sendButton.click();

    // Wait for a new assistant message element to appear
    await this.waitForNewResponse(
      page,
      S.ASSISTANT_MESSAGE,
      countBefore,
      timeoutMs,
    );

    // ChatGPT reasoning models use .result-thinking while thinking (innerText is empty).
    // Wait for thinking to finish before polling for stable text.
    await this.waitForThinkingComplete(page, timeoutMs);

    const text = await this.pollForStableText(
      page,
      S.ASSISTANT_MESSAGE,
      timeoutMs,
    );
    return this.validateResponse(text);
  }

  private async waitForThinkingComplete(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const thinkingSelector = `${S.ASSISTANT_MESSAGE} .result-thinking`;

    while (Date.now() < deadline) {
      const count = await page.locator(thinkingSelector).count();
      if (count === 0) return;
      await page.waitForTimeout(1_000);
    }

    throw new Error("ChatGPT: thinking did not complete in time");
  }

  async deepResearch(
    page: Page,
    query: string,
    timeoutMs: number,
    onProgress?: DeepResearchProgressCallback,
  ): Promise<DeepResearchResult> {
    const start = Date.now();

    await this.navigateToDeepResearch(page);

    const textArea = page.locator(S.TEXT_INPUT);
    await textArea.click();
    await textArea.fill(query);

    const sendButton = page.locator(S.SEND_BUTTON);
    await sendButton.waitFor({ state: "visible", timeout: 5_000 });
    await sendButton.click();

    log.info("ChatGPT Deep Research: query sent, waiting for plan...");

    await this.confirmResearchPlan(page);

    log.info("ChatGPT Deep Research: research started");

    await this.waitForDeepResearchComplete(page, timeoutMs, start, onProgress);

    const content = await this.extractDeepResearchResult(page);
    const sources = await this.extractSources(page);

    return { content, sources, durationMs: Date.now() - start };
  }

  // --- Deep Research helpers ---

  private async navigateToDeepResearch(page: Page): Promise<void> {
    await page.goto(S.DEEP_RESEARCH_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(S.TEXT_INPUT, { timeout: 15_000 });
    log.info("ChatGPT: navigated to Deep Research page");
  }

  private async confirmResearchPlan(page: Page): Promise<void> {
    const startButton = page.getByRole("button", { name: /開始する|Start/i });
    await startButton.waitFor({ state: "visible", timeout: 30_000 });
    await startButton.click();
  }

  private async waitForDeepResearchComplete(
    page: Page,
    timeoutMs: number,
    startTime: number,
    onProgress?: DeepResearchProgressCallback,
  ): Promise<void> {
    const deadline = startTime + timeoutMs;

    const turnCountAtStart = await page
      .locator('[data-testid^="conversation-turn-"]')
      .count();
    log.info(
      `ChatGPT Deep Research: turns at start: ${turnCountAtStart}, waiting for result...`,
    );

    while (Date.now() < deadline) {
      const elapsed = Date.now() - startTime;

      const currentTurns = await page
        .locator('[data-testid^="conversation-turn-"]')
        .count();

      if (currentTurns > turnCountAtStart) {
        const lastTurn = page.locator(
          `[data-testid="conversation-turn-${currentTurns}"]`,
        );
        const hasCopy = await lastTurn
          .locator('[data-testid="copy-turn-action-button"]')
          .isVisible()
          .catch(() => false);

        if (hasCopy) {
          await page.waitForTimeout(2_000);
          log.info(
            `ChatGPT Deep Research: completed in ${Math.round(elapsed / 1000)}s`,
          );
          return;
        }
      }

      if (onProgress) {
        const statusText = await this.getResearchStatusText(page);
        onProgress({
          phase: "researching",
          message: statusText || "Deep Research in progress...",
          elapsedMs: elapsed,
        });
      }

      await page.waitForTimeout(POLL_INTERVAL_MS);
    }

    throw new Error(
      `ChatGPT Deep Research: timed out after ${Math.round(timeoutMs / 1000)}s`,
    );
  }

  private async getResearchStatusText(page: Page): Promise<string> {
    try {
      const lastTurn = page
        .locator('[data-testid^="conversation-turn-"]')
        .last();
      const text = await lastTurn.innerText({ timeout: 2_000 });
      return text.trim().slice(0, 200);
    } catch {
      return "";
    }
  }

  private async extractDeepResearchResult(page: Page): Promise<string> {
    const lastTurn = page
      .locator('[data-testid^="conversation-turn-"]')
      .last();
    const text = await lastTurn.innerText();
    return this.validateResponse(text);
  }

  private async extractSources(page: Page): Promise<DeepResearchSource[]> {
    const sources: DeepResearchSource[] = [];

    try {
      const lastTurn = page
        .locator('[data-testid^="conversation-turn-"]')
        .last();
      const links = lastTurn.locator("a[href^='http']");
      const count = await links.count();

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const title = (await link.innerText().catch(() => "")).trim();
        const url = (await link.getAttribute("href")) ?? "";
        if (url && title) {
          sources.push({ title, url });
        }
      }
    } catch {
      log.info("ChatGPT Deep Research: could not extract sources");
    }

    return sources;
  }
}
