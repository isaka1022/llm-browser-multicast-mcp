export const GROK_SELECTORS = {
  BASE_URL: "https://grok.com",
  // Logged-in uses TipTap ProseMirror (contenteditable), logged-out uses textarea
  TEXT_INPUT: ".tiptap.ProseMirror",
  TEXT_INPUT_FALLBACK: "textarea",
  SEND_BUTTON: 'button[aria-label="送信"], button[aria-label="Send"]',
  MESSAGE_BUBBLE: ".message-bubble",
  RESPONSE_MARKDOWN: ".response-content-markdown",
  LAST_RESPONSE: ".last-response",
  ACTION_BUTTONS: ".action-buttons",
  LOGGED_IN_INDICATOR: ".tiptap.ProseMirror",
} as const;
