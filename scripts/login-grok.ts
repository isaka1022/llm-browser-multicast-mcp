/**
 * Grok Web UI ログインヘルパー
 *
 * Usage: npx tsx scripts/login-grok.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Grok Login Helper ---\n");
  console.log("Chrome プロファイルを使ってブラウザを開きます。");
  console.log("手動で Grok にログインしてください。\n");

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1280, height: 720 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://grok.com", {
    waitUntil: "domcontentloaded",
  });

  console.log("ログインが完了したら Enter を押してください。");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const url = page.url();
  console.log(`\n現在のURL: ${url}`);
  console.log("セッションが保存されました。");

  await context.close();
  console.log("\n--- Done ---");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
