/**
 * 4つの Web UI モデルに同じ質問を並列に投げるテスト
 * タブは開いたまま維持し、追加メッセージも送信可能
 *
 * Usage: npx tsx scripts/test-parallel.ts ["最初の質問"]
 */

import * as readline from "node:readline";
import { PlaywrightProvider } from "../src/providers/playwright/playwright-provider.js";

const SERVICES = ["chatgpt", "gemini", "claude", "grok"] as const;

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val: string) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };
    rl.question(prompt, done);
    rl.once("close", () => done("exit"));
  });
}

async function sendToAll(
  providers: PlaywrightProvider[],
  question: string,
): Promise<void> {
  const start = Date.now();

  const results = await Promise.allSettled(
    providers.map((provider, i) => {
      const service = SERVICES[i];
      console.log(`[${service}] Sending...`);
      return provider.chat(
        "default",
        [{ role: "user", content: question }],
        180_000,
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
      console.log(
        `--- ${service} (${(r.durationMs / 1000).toFixed(1)}s) ---`,
      );
      console.log(r.content.slice(0, 500));
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
}

async function main() {
  const firstQuestion = process.argv[2] ?? "What is 2+2? Reply briefly.";

  console.log("=== Parallel Web UI Chat ===\n");
  console.log('Type a message to send to all models. Type "exit" to quit.\n');

  const providers = SERVICES.map(
    (service) =>
      new PlaywrightProvider({
        service,
        headless: false,
      }),
  );

  // Send first question
  console.log(`> ${firstQuestion}\n`);
  await sendToAll(providers, firstQuestion);

  // Interactive follow-up loop
  const rl = createReadline();

  while (true) {
    const input = await ask(rl, "\n> ");
    const trimmed = input.trim();

    if (!trimmed || trimmed === "exit") {
      console.log("Closing...");
      break;
    }

    console.log();
    await sendToAll(providers, trimmed);
  }

  rl.close();

  // Close all providers (closes tabs + releases browser)
  await Promise.all(providers.map((p) => p.close()));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
