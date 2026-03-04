/**
 * Gemini Web UI 動作確認スクリプト（Provider 経由）
 *
 * Usage: npx tsx scripts/test-gemini.ts
 */

import { PlaywrightProvider } from "../src/providers/playwright/playwright-provider.js";

async function main() {
  console.log("--- Gemini Provider Test ---\n");

  const provider = new PlaywrightProvider({
    service: "gemini",
    headless: false,
  });

  try {
    console.log("[1] Sending test message...");
    const result = await provider.chat(
      "gemini-pro",
      [{ role: "user", content: "What is 2+2? Reply briefly." }],
      60_000,
    );

    console.log(`\n--- Result ---`);
    console.log(`Model: ${result.model}`);
    console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`Content: ${result.content.slice(0, 200)}`);
    console.log("\nSUCCESS!");
  } finally {
    await provider.close();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
