import type { Page } from "playwright";
import type { WebChatAdapter } from "./types.js";
import { GROK_SELECTORS as S } from "./grok-selectors.js";
import { log } from "../../logger.js";

export class GrokAdapter implements WebChatAdapter {
  readonly serviceName = "grok";
  readonly supportedModels = ["grok-web/grok"];

  async navigateToChat(page: Page): Promise<void> {
    const currentUrl = page.url();
    if (currentUrl.startsWith(S.BASE_URL)) return;
    await page.goto(S.BASE_URL, { waitUntil: "domcontentloaded" });
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      // Logged-in users get TipTap editor; logged-out users get plain textarea
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
    // Grok uses TipTap ProseMirror — click + keyboard.type works
    const editor = page.locator(S.TEXT_INPUT).first();
    await editor.click();
    await page.keyboard.type(prompt, { delay: 10 });
    await page.waitForTimeout(300);

    // Click send button
    const sendBtn = page.locator(S.SEND_BUTTON).first();
    const sendVisible = await sendBtn.isVisible().catch(() => false);
    if (sendVisible) {
      await sendBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await this.waitForResponseComplete(page, timeoutMs);

    const text = await this.extractLastResponse(page);
    if (!text.trim()) {
      throw new Error("Grok: empty response received");
    }

    return text.trim();
  }

  private async extractLastResponse(page: Page): Promise<string> {
    const responses = page.locator(S.RESPONSE_MARKDOWN);
    const count = await responses.count();
    if (count === 0) {
      throw new Error("Grok: no response found");
    }
    return await responses.last().innerText();
  }

  private async waitForResponseComplete(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    // Wait for at least one response bubble to appear
    try {
      await page.waitForSelector(S.MESSAGE_BUBBLE, {
        state: "visible",
        timeout: Math.min(30_000, timeoutMs),
      });
    } catch {
      log.info("Grok: message bubble did not appear");
    }

    // Poll for text stabilization on the last response-content-markdown
    let previousText = "";
    let stableCount = 0;

    while (Date.now() < deadline) {
      const responses = page.locator(S.RESPONSE_MARKDOWN);
      const count = await responses.count();
      if (count >= 2) {
        // count >= 2: user message + assistant response both have .response-content-markdown
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

    throw new Error("Grok: response timeout");
  }
}
