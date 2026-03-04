/**
 * Claude Web UI ログインヘルパー
 *
 * ブラウザを開いて手動でログインし、セッションを保存する。
 * Enter を押すとブラウザを閉じる。
 *
 * Usage: npx tsx scripts/login-claude.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Claude Login Helper ---\n");
  console.log("Chrome プロファイルを使ってブラウザを開きます。");
  console.log("手動で Claude にログインしてください。\n");

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

  await page.goto("https://claude.ai", {
    waitUntil: "domcontentloaded",
  });

  console.log("ログインが完了したら Enter を押してください。");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  // Verify login
  const url = page.url();
  console.log(`\n現在のURL: ${url}`);

  if (url.includes("claude.ai") && !url.includes("login")) {
    console.log("ログイン成功！セッションが保存されました。");
  } else {
    console.log("警告: ログインが完了していない可能性があります。");
  }

  await context.close();
  console.log("\n--- Done ---");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
