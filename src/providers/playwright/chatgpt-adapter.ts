import type { Page } from "playwright";
import type { WebChatAdapter } from "./types.js";
import { CHATGPT_SELECTORS as S } from "./selectors.js";
import { log } from "../../logger.js";

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
