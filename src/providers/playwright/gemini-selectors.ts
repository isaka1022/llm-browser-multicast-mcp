export const GEMINI_SELECTORS = {
  BASE_URL: "https://gemini.google.com/app",
  TEXT_INPUT: '.ql-editor[role="textbox"]',
  SEND_BUTTON: "button.send-button",
  ASSISTANT_MESSAGE: ".model-response-text .markdown",
  RESPONSE_CONTAINER: ".response-container",
  LOADING_SPINNER: ".loading-content-spinner-container",
  LOGGED_IN_INDICATOR: '.ql-editor[role="textbox"]',
} as const;
