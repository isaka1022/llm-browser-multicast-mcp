import type { Page } from "playwright";
import type {
  WebChatAdapter,
  DeepResearchResult,
  DeepResearchSource,
  DeepResearchProgressCallback,
} from "./types.js";
import { CHATGPT_SELECTORS as S } from "./selectors.js";
import { log } from "../../logger.js";

const POLL_INTERVAL_MS = 10_000;

export class ChatGPTAdapter implements WebChatAdapter {
  readonly serviceName = "chatgpt";
  readonly supportedModels = ["chatgpt/gpt-4o", "chatgpt/gpt-4o-mini"];

  async navigateToChat(page: Page): Promise<void> {
    const currentUrl = page.url();
    if (currentUrl.startsWith(S.BASE_URL)) return;
    await page.goto(S.BASE_URL, { waitUntil: "domcontentloaded" });
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(S.LOGGED_IN_INDICATOR, { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  async startNewChat(page: Page): Promise<void> {
    await page.goto(S.BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(S.TEXT_INPUT, { timeout: 15_000 });
  }

  async sendAndReceive(
    page: Page,
    prompt: string,
    timeoutMs: number,
  ): Promise<string> {
    const textArea = page.locator(S.TEXT_INPUT);
    await textArea.click();
    await textArea.fill(prompt);

    const sendButton = page.locator(S.SEND_BUTTON);
    await sendButton.waitFor({ state: "visible", timeout: 5_000 });
    await sendButton.click();

    await this.waitForResponseComplete(page, timeoutMs);

    const messages = page.locator(S.ASSISTANT_MESSAGE);
    const lastMessage = messages.last();
    const text = await lastMessage.innerText();

    if (!text.trim()) {
      throw new Error("ChatGPT: empty response received");
    }

    return text.trim();
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

    // Deep Research page uses a different send button (text "Deep Research")
    const sendButton = page.locator(S.SEND_BUTTON);
    await sendButton.waitFor({ state: "visible", timeout: 5_000 });
    await sendButton.click();

    log.info("ChatGPT Deep Research: query sent, waiting for plan...");

    // Wait for the plan confirmation screen and click "開始する" (Start)
    await this.confirmResearchPlan(page);

    log.info("ChatGPT Deep Research: research started");

    await this.waitForDeepResearchComplete(page, timeoutMs, start, onProgress);

    const content = await this.extractDeepResearchResult(page);
    const sources = await this.extractSources(page);

    return {
      content,
      sources,
      durationMs: Date.now() - start,
    };
  }

  private async navigateToDeepResearch(page: Page): Promise<void> {
    // Always navigate fresh to ensure a clean state (no leftover conversations)
    await page.goto(S.DEEP_RESEARCH_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(S.TEXT_INPUT, { timeout: 15_000 });
    log.info("ChatGPT: navigated to Deep Research page");
  }

  private async confirmResearchPlan(page: Page): Promise<void> {
    // After sending a query, Deep Research shows a plan confirmation screen
    // with "編集する" (Edit), "キャンセル" (Cancel), "開始する" (Start) buttons.
    // We need to click "開始する" to begin the research.
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

    // After clicking "開始する", the research begins.
    // turn-1 = user query, turn-2 = plan + research progress, turn-3 = final report.
    // Completion: a new assistant turn appears with substantial content and a copy button.
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

      // A new turn appeared beyond the plan turn — check if it's the final report
      if (currentTurns > turnCountAtStart) {
        const lastTurn = page.locator(
          `[data-testid="conversation-turn-${currentTurns}"]`,
        );
        const copyBtn = lastTurn.locator(
          '[data-testid="copy-turn-action-button"]',
        );
        const hasCopy = await copyBtn.isVisible().catch(() => false);

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
      // Look for progress text in the latest conversation turn
      const lastTurn = page
        .locator('[data-testid^="conversation-turn-"]')
        .last();
      const text = await lastTurn.innerText({ timeout: 2_000 });
      if (text.trim()) {
        return text.trim().slice(0, 200);
      }
    } catch {
      // ignore
    }
    return "";
  }

  private async extractDeepResearchResult(page: Page): Promise<string> {
    // The final report is in the last conversation turn
    const lastTurn = page
      .locator('[data-testid^="conversation-turn-"]')
      .last();
    const text = await lastTurn.innerText();

    if (!text.trim()) {
      throw new Error("ChatGPT Deep Research: empty response received");
    }

    return text.trim();
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

  private async waitForResponseComplete(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    // Wait for stop button to appear (response started)
    try {
      await page.waitForSelector(S.STOP_BUTTON, {
        state: "visible",
        timeout: Math.min(30_000, timeoutMs),
      });
    } catch {
      log.info(
        "ChatGPT: stop button did not appear, checking for response directly",
      );
    }

    // Wait for stop button to disappear (response complete)
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("ChatGPT: response timeout");

    await page.waitForSelector(S.STOP_BUTTON, {
      state: "hidden",
      timeout: remaining,
    });

    // Brief wait for text to stabilize
    await page.waitForTimeout(500);
  }
}
