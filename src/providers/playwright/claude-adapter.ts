import type { Page } from "playwright";
import type { WebChatAdapter } from "./types.js";
import { CLAUDE_SELECTORS as S } from "./claude-selectors.js";
import { log } from "../../logger.js";

export class ClaudeAdapter implements WebChatAdapter {
  readonly serviceName = "claude";
  readonly supportedModels = ["claude-web/sonnet"];

  async navigateToChat(page: Page): Promise<void> {
    const currentUrl = page.url();
    if (currentUrl.startsWith("https://claude.ai")) return;
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
    // Claude uses TipTap ProseMirror editor — click + keyboard.type works
    const editor = page.locator(S.TEXT_INPUT);
    await editor.click();
    await page.keyboard.type(prompt, { delay: 10 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");

    await this.waitForResponseComplete(page, timeoutMs);

    const text = await this.extractLastResponse(page);
    if (!text.trim()) {
      throw new Error("Claude: empty response received");
    }

    return text.trim();
  }

  private async extractLastResponse(page: Page): Promise<string> {
    // Use .standard-markdown to avoid capturing extended thinking text
    const markdownBlocks = page.locator(S.STANDARD_MARKDOWN);
    const count = await markdownBlocks.count();
    if (count > 0) {
      return await markdownBlocks.last().innerText();
    }
    // Fallback to .font-claude-response
    const responses = page.locator(S.ASSISTANT_MESSAGE);
    const responseCount = await responses.count();
    if (responseCount === 0) {
      throw new Error("Claude: no response found");
    }
    return await responses.last().innerText();
  }

  private async waitForResponseComplete(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    // Wait for at least one response element to appear
    try {
      await page.waitForSelector(S.ASSISTANT_MESSAGE, {
        state: "visible",
        timeout: Math.min(30_000, timeoutMs),
      });
    } catch {
      log.info("Claude: response element did not appear");
    }

    // Poll for text stabilization — Claude streams text progressively
    let previousText = "";
    let stableCount = 0;

    while (Date.now() < deadline) {
      const responses = page.locator(S.ASSISTANT_MESSAGE);
      const count = await responses.count();
      if (count > 0) {
        const text = await responses.last().innerText().catch(() => "");
        if (text && text === previousText) {
          stableCount++;
          if (stableCount >= 3) {
            return;
          }
        } else {
          stableCount = 0;
          previousText = text;
        }
      }
      await page.waitForTimeout(1_000);
    }

    throw new Error("Claude: response timeout");
  }
}
