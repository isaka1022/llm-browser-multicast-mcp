/**
 * 4つの Web UI モデルに同じ質問を並列に投げて結果を出力する（非インタラクティブ）
 *
 * Usage: npx tsx scripts/ask-all.ts <prompt-file>
 */

import * as fs from "node:fs";
import { PlaywrightProvider } from "../src/providers/playwright/playwright-provider.js";

const SERVICES = ["chatgpt", "gemini", "claude", "grok"] as const;

async function main() {
  const promptFile = process.argv[2];
  if (!promptFile) {
    console.error("Usage: npx tsx scripts/ask-all.ts <prompt-file>");
    process.exit(1);
  }

  const question = fs.readFileSync(promptFile, "utf-8").trim();

  console.log("=== Parallel Web UI Chat ===\n");
  console.log("Prompt (first 100 chars):", question.slice(0, 100), "...\n");

  const providers = SERVICES.map(
    (service) =>
      new PlaywrightProvider({
        service,
        headless: false,
      }),
  );

  const start = Date.now();

  const results = await Promise.allSettled(
    providers.map((provider, i) => {
      const service = SERVICES[i];
      console.log(`[${service}] Sending...`);
      return provider.chat(
        "default",
        [{ role: "user", content: question }],
        300_000,
      );
    }),
  );

  const totalMs = Date.now() - start;

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS\n");

  for (let i = 0; i < results.length; i++) {
    const service = SERVICES[i];
    const result = results[i];

    if (result.status === "fulfilled") {
      const r = result.value;
      console.log(`--- ${service} (${(r.durationMs / 1000).toFixed(1)}s) ---`);
      console.log(r.content);
    } else {
      console.log(`--- ${service} (ERROR) ---`);
      console.log(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
    console.log();
  }

  console.log(`Total wall time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(
    `Succeeded: ${results.filter((r) => r.status === "fulfilled").length}/${results.length}`,
  );

  await Promise.all(providers.map((p) => p.close()));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
