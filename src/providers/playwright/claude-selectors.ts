export const CLAUDE_SELECTORS = {
  BASE_URL: "https://claude.ai/new",
  TEXT_INPUT: '[data-testid="chat-input"]',
  MODEL_SELECTOR_BUTTON: 'button[data-testid="model-selector-dropdown"]',
  MODEL_OPTION: '[role="option"], [role="menuitem"]',
  ASSISTANT_MESSAGE: ".font-claude-response",
  STANDARD_MARKDOWN: ".standard-markdown",
  LOGGED_IN_INDICATOR: '[data-testid="chat-input"]',
} as const;
