/**
 * ChatGPT ログインスクリプト
 * ブラウザが開くのでログインしてから Enter を押してください。
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- ChatGPT Login ---");
  console.log(`Profile: ${PROFILE_DIR}\n`);

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
  await page.goto("https://chatgpt.com", { waitUntil: "domcontentloaded" });

  console.log("ブラウザでログインしてください。");
  console.log("ログイン完了後、Enter を押してください。");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  console.log(`URL: ${page.url()}`);
  await context.close();
  console.log("Done. Profile saved.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
