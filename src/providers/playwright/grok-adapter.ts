import type { Page } from "playwright";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { GROK_SELECTORS as S } from "./grok-selectors.js";
import { log } from "../../logger.js";

export class GrokAdapter extends BaseWebChatAdapter {
  readonly serviceName = "grok";
  readonly supportedModels = ["grok-web/expert"];

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

  async selectModel(page: Page, model: string): Promise<void> {
    const modelButton = page.locator(S.MODEL_SELECTOR_BUTTON);
    const isVisible = await modelButton.isVisible().catch(() => false);
    if (!isVisible) {
      log.info(`Grok: model selector not visible, skip selecting "${model}"`);
      return;
    }

    // Map model names to menu text patterns
    const modelPatterns: Record<string, RegExp> = {
      expert: /^expert/i,
      "grok-4.20": /grok\s*4\.?20/i,
      heavy: /^heavy/i,
    };
    const pattern = modelPatterns[model] ?? modelPatterns["expert"];

    await modelButton.click();
    await page.waitForTimeout(500);

    const option = page
      .locator(S.MODEL_OPTION)
      .filter({ hasText: pattern })
      .first();
    const optionVisible = await option.isVisible().catch(() => false);
    if (!optionVisible) {
      await page.keyboard.press("Escape").catch(() => {});
      log.info(`Grok: model option not found for "${model}"`);
      return;
    }

    // Check if the option is disabled or requires upgrade
    const isDisabled = await option.evaluate(
      (el) => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
    ).catch(() => false);
    if (isDisabled) {
      await page.keyboard.press("Escape").catch(() => {});
      log.info(`Grok: "${model}" is disabled (plan limitation), using default mode`);
      return;
    }

    await option.click();
    await page.waitForTimeout(500);
    log.info(`Grok: selected model "${model}"`);
  }
}
