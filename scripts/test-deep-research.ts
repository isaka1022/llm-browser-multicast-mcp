/**
 * Deep Research 動作確認スクリプト
 *
 * Usage: npx tsx scripts/test-deep-research.ts
 */

import { PlaywrightProvider } from "../src/providers/playwright/playwright-provider.js";

async function main() {
  console.log("--- Deep Research Test ---\n");

  const provider = new PlaywrightProvider({
    service: "chatgpt",
    headless: false,
  });

  try {
    const query = "What are the latest developments in WebAssembly in 2025? Give a brief summary.";
    console.log(`Query: "${query}"`);
    console.log("Timeout: 10 minutes\n");

    const result = await provider.deepResearch(
      query,
      10 * 60 * 1_000,
      (status) => {
        const elapsed = Math.round(status.elapsedMs / 1000);
        console.log(`  [${status.phase}] ${status.message} (${elapsed}s)`);
      },
    );

    console.log(`\n--- Result ---`);
    console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`Content (first 500 chars):\n${result.content.slice(0, 500)}`);
    console.log(`\nSources (${result.sources.length}):`);
    for (const s of result.sources.slice(0, 10)) {
      console.log(`  - ${s.title}: ${s.url}`);
    }
  } finally {
    await provider.close();
  }

  console.log("\n--- Done ---");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
