export const GEMINI_SELECTORS = {
  BASE_URL: "https://gemini.google.com/app",
  TEXT_INPUT: '.ql-editor[role="textbox"]',
  MODEL_SELECTOR_BUTTON: '[data-test-id="bard-mode-menu-button"]',
  MODEL_OPTION: '[role="menuitemradio"], [role="menuitem"]',
  ASSISTANT_MESSAGE: ".model-response-text .markdown",
  LOGGED_IN_INDICATOR: '.ql-editor[role="textbox"]',
} as const;
