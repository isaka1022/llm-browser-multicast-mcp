import type { Page } from "playwright";
import { BaseWebChatAdapter, type AdapterSelectors } from "./base-adapter.js";
import { CLAUDE_SELECTORS as S } from "./claude-selectors.js";

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

    await this.pollForStableText(
      page,
      S.ASSISTANT_MESSAGE,
      timeoutMs,
      countBefore,
    );

    // Use .standard-markdown to avoid capturing extended thinking text
    const text = await this.extractLastResponse(page);
    return this.validateResponse(text);
  }

  private async extractLastResponse(page: Page): Promise<string> {
    const markdownBlocks = page.locator(S.STANDARD_MARKDOWN);
    const count = await markdownBlocks.count();
    if (count > 0) {
      return await markdownBlocks.last().innerText();
    }
    const responses = page.locator(S.ASSISTANT_MESSAGE);
    const responseCount = await responses.count();
    if (responseCount === 0) {
      throw new Error("Claude: no response found");
    }
    return await responses.last().innerText();
  }
}
