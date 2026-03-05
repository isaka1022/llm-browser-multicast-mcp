import type { Page } from "playwright";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { GROK_SELECTORS as S } from "./grok-selectors.js";

export class GrokAdapter extends BaseWebChatAdapter {
  readonly serviceName = "grok";
  readonly supportedModels = ["grok-web/grok"];

  protected readonly selectors: AdapterSelectors = {
    BASE_URL: S.BASE_URL,
    TEXT_INPUT: S.TEXT_INPUT,
    LOGGED_IN_INDICATOR: S.LOGGED_IN_INDICATOR,
    RESPONSE_SELECTOR: S.RESPONSE_MARKDOWN,
  };

  async sendAndReceive(
    page: Page,
    prompt: string,
    timeoutMs: number,
  ): Promise<string> {
    const countBefore = await this.countResponseElements(
      page,
      S.RESPONSE_MARKDOWN,
    );

    const editor = page.locator(S.TEXT_INPUT).first();
    await editor.click();
    await this.pasteText(page, prompt);

    const sendBtn = page.locator(S.SEND_BUTTON).first();
    const sendVisible = await sendBtn.isVisible().catch(() => false);
    if (sendVisible) {
      await sendBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    const text = await this.pollForStableText(
      page,
      S.RESPONSE_MARKDOWN,
      timeoutMs,
      countBefore,
    );
    return this.validateResponse(text);
  }
}
