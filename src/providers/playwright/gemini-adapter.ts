import type { Page } from "playwright";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { GEMINI_SELECTORS as S } from "./gemini-selectors.js";
import { log } from "../../logger.js";

export class GeminiAdapter extends BaseWebChatAdapter {
  readonly serviceName = "gemini";
  readonly supportedModels = ["gemini-web/pro"];

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
    await this.pasteText(page, prompt);
    await page.keyboard.press("Enter");

    const text = await this.pollForStableText(
      page,
      S.ASSISTANT_MESSAGE,
      timeoutMs,
      countBefore,
    );
    return this.validateResponse(text);
  }

  async selectModel(page: Page, model: string): Promise<void> {
    const pickerButton = page.locator(S.MODEL_SELECTOR_BUTTON);
    const pickerVisible = await pickerButton.isVisible().catch(() => false);
    if (!pickerVisible) {
      log.info(`Gemini: model selector not visible, skip selecting "${model}"`);
      return;
    }

    await pickerButton.click();
    await page.waitForTimeout(500);

    // Gemini modes: 高速モード/Flash, 思考モード/Thinking, Pro/Pro
    const option = page
      .locator(S.MODEL_OPTION)
      .filter({ hasText: /pro/i })
      .first();
    const optionVisible = await option.isVisible().catch(() => false);
    if (!optionVisible) {
      await page.keyboard.press("Escape").catch(() => {});
      log.info(`Gemini: model option not found for "${model}"`);
      return;
    }

    // Check if the option is disabled (plan limitation)
    const isDisabled = await option.evaluate(
      (el) => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
    ).catch(() => false);
    if (isDisabled) {
      await page.keyboard.press("Escape").catch(() => {});
      log.info(`Gemini: "${model}" is disabled (plan limitation), using default mode`);
      return;
    }

    await option.click();
    await page.waitForTimeout(500);
    log.info(`Gemini: selected model "${model}"`);
  }
}
