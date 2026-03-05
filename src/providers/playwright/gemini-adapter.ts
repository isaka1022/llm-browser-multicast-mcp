import type { Page } from "playwright";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { GEMINI_SELECTORS as S } from "./gemini-selectors.js";

export class GeminiAdapter extends BaseWebChatAdapter {
  readonly serviceName = "gemini";
  readonly supportedModels = ["gemini-web/gemini-pro"];

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
    await page.keyboard.type(prompt, { delay: 10 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");

    const text = await this.pollForStableText(
      page,
      S.ASSISTANT_MESSAGE,
      timeoutMs,
      countBefore,
    );
    return this.validateResponse(text);
  }
}
