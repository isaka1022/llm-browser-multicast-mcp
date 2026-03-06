/**
 * 各 Web UI で現在選択されているモデルを確認するスクリプト
 * スクリーンショットを撮って確認する
 */

import { PlaywrightProvider } from "../src/providers/playwright/playwright-provider.js";
import { BrowserManager } from "../src/providers/playwright/browser-manager.js";

const SERVICES = ["chatgpt", "gemini", "claude", "grok"] as const;

async function main() {
  console.log("=== Model Selection Check ===\n");

  const providers = SERVICES.map(
    (service) => new PlaywrightProvider({ service, headless: false }),
  );

  // Open all pages in parallel
  const results = await Promise.allSettled(
    providers.map(async (provider, i) => {
      const service = SERVICES[i];
      console.log(`[${service}] Opening...`);
      // Send a simple query to trigger page creation
      const result = await provider.chat(
        "default",
        [{ role: "user", content: "What model are you? Reply with just your model name/version." }],
        120_000,
      );
      console.log(`[${service}] Response: ${result.content.slice(0, 200)}`);
      return result;
    }),
  );

  console.log("\n" + "=".repeat(60));
  console.log("MODEL IDENTIFICATION\n");

  for (let i = 0; i < results.length; i++) {
    const service = SERVICES[i];
    const result = results[i];
    if (result.status === "fulfilled") {
      console.log(`--- ${service} ---`);
      console.log(result.value.content.slice(0, 300));
    } else {
      console.log(`--- ${service} (ERROR) ---`);
      console.log(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
    console.log();
  }

  await Promise.all(providers.map((p) => p.close()));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
