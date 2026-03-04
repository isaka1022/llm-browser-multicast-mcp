export const CHATGPT_SELECTORS = {
  BASE_URL: "https://chatgpt.com",
  TEXT_INPUT: "#prompt-textarea",
  SEND_BUTTON: 'button[data-testid="send-button"]',
  STOP_BUTTON: 'button[data-testid="stop-button"]',
  ASSISTANT_MESSAGE: '[data-message-author-role="assistant"]',
  LOGGED_IN_INDICATOR: "#prompt-textarea",
  NEW_CHAT_BUTTON: 'a[data-testid="create-new-chat-button"]',

  // Deep Research
  DEEP_RESEARCH_URL: "https://chatgpt.com/deep-research",
  DEEP_RESEARCH_SIDEBAR: 'a[data-testid="deep-research-sidebar-item"]',
} as const;
