export const CHATGPT_SELECTORS = {
  BASE_URL: "https://chatgpt.com",
  TEXT_INPUT: "#prompt-textarea",
  SEND_BUTTON: 'button[data-testid="send-button"]',

  ASSISTANT_MESSAGE: '[data-message-author-role="assistant"]',
  LOGGED_IN_INDICATOR: "#prompt-textarea",

  // Deep Research
  DEEP_RESEARCH_URL: "https://chatgpt.com/deep-research",
} as const;
