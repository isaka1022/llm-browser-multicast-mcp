import type { Page } from "playwright";
import type { WebChatAdapter } from "./types.js";
import { log } from "../../logger.js";

export interface AdapterSelectors {
  readonly BASE_URL: string;
  readonly TEXT_INPUT: string;
  readonly LOGGED_IN_INDICATOR: string;
  readonly RESPONSE_SELECTOR: string;
}

export abstract class BaseWebChatAdapter implements WebChatAdapter {
  abstract readonly serviceName: string;
  abstract readonly supportedModels: string[];
  protected abstract readonly selectors: AdapterSelectors;

  async navigateToChat(page: Page): Promise<void> {
    const currentUrl = page.url();
    if (currentUrl.startsWith(this.selectors.BASE_URL)) return;
    await page.goto(this.selectors.BASE_URL, {
      waitUntil: "domcontentloaded",
    });
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(this.selectors.LOGGED_IN_INDICATOR, {
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async startNewChat(page: Page): Promise<void> {
    await page.goto(this.selectors.BASE_URL, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(this.selectors.TEXT_INPUT, { timeout: 15_000 });
  }

  abstract sendAndReceive(
    page: Page,
    prompt: string,
    timeoutMs: number,
  ): Promise<string>;

  /**
   * Paste text into the focused element via clipboard.
   * Unlike keyboard.type, this handles multi-line text without triggering Enter/submit.
   */
  protected async pasteText(page: Page, text: string): Promise<void> {
    await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+v`);
    await page.waitForTimeout(200);
  }

  /**
   * Count the current number of response elements on the page.
   * Call this before sending a message to track when a new response appears.
   */
  protected async countResponseElements(
    page: Page,
    selector: string,
  ): Promise<number> {
    return page.locator(selector).count();
  }

  protected async pollForStableText(
    page: Page,
    selector: string,
    timeoutMs: number,
    initialCount?: number,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    // If initialCount is given, wait for a NEW element to appear beyond that count
    if (initialCount !== undefined) {
      while (Date.now() < deadline) {
        const count = await page.locator(selector).count();
        if (count > initialCount) break;
        await page.waitForTimeout(500);
      }
      if (Date.now() >= deadline) {
        throw new Error(`${this.serviceName}: new response did not appear`);
      }
    } else {
      // Wait for at least one response element
      try {
        await page.waitForSelector(selector, {
          state: "visible",
          timeout: Math.min(30_000, timeoutMs),
        });
      } catch {
        log.info(`${this.serviceName}: response element did not appear`);
      }
    }

    let previousText = "";
    let stableCount = 0;

    while (Date.now() < deadline) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        const text = await elements.last().innerText().catch(() => "");
        if (text && text === previousText) {
          stableCount++;
          if (stableCount >= 3) {
            return text;
          }
        } else {
          stableCount = 0;
          previousText = text;
        }
      }
      await page.waitForTimeout(1_000);
    }

    throw new Error(`${this.serviceName}: response timeout`);
  }

  /**
   * Wait until a new response element appears beyond the initial count.
   */
  protected async waitForNewResponse(
    page: Page,
    selector: string,
    initialCount: number,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const count = await page.locator(selector).count();
      if (count > initialCount) return;
      await page.waitForTimeout(500);
    }
    throw new Error(`${this.serviceName}: new response did not appear`);
  }

  protected validateResponse(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error(`${this.serviceName}: empty response received`);
    }
    return trimmed;
  }
}
