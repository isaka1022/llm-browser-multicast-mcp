export const GROK_SELECTORS = {
  BASE_URL: "https://grok.com",
  TEXT_INPUT: ".tiptap.ProseMirror",
  MODEL_SELECTOR_BUTTON: '#model-select-trigger',
  MODEL_OPTION: '[role="menuitem"], [role="option"]',
  SEND_BUTTON: 'button[aria-label="送信"], button[aria-label="Send"]',
  RESPONSE_MARKDOWN: ".response-content-markdown",
  LOGGED_IN_INDICATOR: ".tiptap.ProseMirror",
} as const;
