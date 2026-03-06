import type { Page } from "playwright";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { CLAUDE_SELECTORS as S } from "./claude-selectors.js";
import { log } from "../../logger.js";

export class ClaudeAdapter extends BaseWebChatAdapter {
  readonly serviceName = "claude";
  readonly supportedModels = ["claude-web/sonnet"];

  protected readonly selectors: AdapterSelectors = {
    BASE_URL: "https://claude.ai",
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

    const editor = page.locator(S.TEXT_INPUT);
    await editor.click();
    await this.pasteText(page, prompt);
    await page.keyboard.press("Enter");

    // Wait for the response container to appear
    await this.waitForNewResponse(
      page,
      S.ASSISTANT_MESSAGE,
      countBefore,
      timeoutMs,
    );

    // Poll on .standard-markdown to skip thinking/loading text
    const text = await this.pollForStableText(
      page,
      S.STANDARD_MARKDOWN,
      timeoutMs,
    );
    return this.validateResponse(text);
  }

  async selectModel(page: Page, model: string): Promise<void> {
    const modelButton = page.locator(S.MODEL_SELECTOR_BUTTON);
    const isVisible = await modelButton.isVisible().catch(() => false);
    if (!isVisible) {
      log.info(`Claude: model selector not visible, skip selecting "${model}"`);
      return;
    }

    await modelButton.click();
    await page.waitForTimeout(500);

    const option = page
      .locator(S.MODEL_OPTION)
      .filter({ hasText: /sonnet/i })
      .first();
    const optionVisible = await option.isVisible().catch(() => false);
    if (!optionVisible) {
      await page.keyboard.press("Escape").catch(() => {});
      log.info(`Claude: model option not found for "${model}"`);
      return;
    }

    await option.click();
    await page.waitForTimeout(500);
    log.info(`Claude: selected model "${model}"`);
  }
}
