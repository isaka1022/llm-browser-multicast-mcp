export const CLAUDE_SELECTORS = {
  BASE_URL: "https://claude.ai/new",
  TEXT_INPUT: '[data-testid="chat-input"]',
  TEXT_INPUT_SSR: '[data-testid="chat-input-ssr"]',
  ASSISTANT_MESSAGE: ".font-claude-response",
  RESPONSE_BODY: ".font-claude-response-body",
  STANDARD_MARKDOWN: ".standard-markdown",
  USER_MESSAGE: '[data-testid="user-message"]',
  LOGGED_IN_INDICATOR: '[data-testid="chat-input"]',
  NEW_CHAT_LINK: 'a[href="/new"]',
} as const;
