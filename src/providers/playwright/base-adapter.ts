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

  protected async pollForStableText(
    page: Page,
    selector: string,
    timeoutMs: number,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    // Wait for at least one response element
    try {
      await page.waitForSelector(selector, {
        state: "visible",
        timeout: Math.min(30_000, timeoutMs),
      });
    } catch {
      log.info(`${this.serviceName}: response element did not appear`);
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

  protected validateResponse(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error(`${this.serviceName}: empty response received`);
    }
    return trimmed;
  }
}
