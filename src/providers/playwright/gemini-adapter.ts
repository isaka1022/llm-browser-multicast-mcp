import type { Page } from "playwright";
import type { WebChatAdapter } from "./types.js";
import { GEMINI_SELECTORS as S } from "./gemini-selectors.js";
import { log } from "../../logger.js";

export class GeminiAdapter implements WebChatAdapter {
  readonly serviceName = "gemini";
  readonly supportedModels = ["gemini/gemini-pro"];

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
    // Gemini uses Quill editor — keyboard.type works reliably
    await page.keyboard.type(prompt, { delay: 10 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");

    await this.waitForResponseComplete(page, timeoutMs);

    const text = await this.extractLastResponse(page);
    if (!text.trim()) {
      throw new Error("Gemini: empty response received");
    }

    return text.trim();
  }

  private async extractLastResponse(page: Page): Promise<string> {
    const responses = page.locator(S.ASSISTANT_MESSAGE);
    const count = await responses.count();
    if (count === 0) {
      throw new Error("Gemini: no response found");
    }
    return await responses.last().innerText();
  }

  private async waitForResponseComplete(
    page: Page,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    // Wait for response container to appear
    try {
      await page.waitForSelector(S.RESPONSE_CONTAINER, {
        state: "visible",
        timeout: Math.min(30_000, timeoutMs),
      });
    } catch {
      log.info("Gemini: response container did not appear");
    }

    // Poll for text stabilization — Gemini streams text into .markdown
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

    throw new Error("Gemini: response timeout");
  }
}
