/**
 * Claude 送信デバッグスクリプト
 *
 * Usage: npx tsx scripts/debug-claude-send.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Claude Send Debug ---\n");

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

  console.log("[1] Navigating to claude.ai/new...");
  await page.goto("https://claude.ai/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: "debug-claude-step1.png" });
  console.log("    Screenshot: debug-claude-step1.png");

  // Check what inputs are available
  console.log("\n[2] Available inputs:");
  const inputs = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]').forEach(el => {
      const tag = el.tagName;
      const testId = el.getAttribute("data-testid") ?? "";
      const visible = (el as HTMLElement).offsetParent !== null;
      const rect = el.getBoundingClientRect();
      results.push(`tag=${tag} data-testid="${testId}" visible=${visible} rect=${JSON.stringify({x: rect.x, y: rect.y, w: rect.width, h: rect.height})}`);
    });
    return results;
  });
  inputs.forEach(i => console.log(`    ${i}`));

  // Try typing into the TipTap editor
  console.log("\n[3] Clicking TipTap editor and typing...");
  const editor = page.locator('[data-testid="chat-input"]');
  const editorVisible = await editor.isVisible().catch(() => false);
  console.log(`    Editor visible: ${editorVisible}`);

  if (editorVisible) {
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type("What is 2+2? Reply briefly.", { delay: 10 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "debug-claude-step2.png" });
    console.log("    Screenshot: debug-claude-step2.png (after typing)");

    // Check for send button
    console.log("\n[4] Looking for send button...");
    const buttons = await page.evaluate(() => {
      const results: string[] = [];
      document.querySelectorAll("button").forEach(el => {
        const ariaLabel = el.getAttribute("aria-label") ?? "";
        const dataTestId = el.getAttribute("data-testid") ?? "";
        const disabled = el.disabled;
        const visible = el.offsetParent !== null;
        if (ariaLabel.toLowerCase().includes("send") ||
            dataTestId.includes("send") ||
            ariaLabel.toLowerCase().includes("submit")) {
          results.push(`aria="${ariaLabel}" data-testid="${dataTestId}" disabled=${disabled} visible=${visible}`);
        }
      });
      return results;
    });
    buttons.forEach(b => console.log(`    ${b}`));

    // Try pressing Enter
    console.log("\n[5] Pressing Enter...");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5_000);
    await page.screenshot({ path: "debug-claude-step3.png" });
    console.log("    Screenshot: debug-claude-step3.png (after Enter)");

    // Check if response appeared
    console.log("\n[6] Checking for responses...");
    const responseCount = await page.locator(".font-claude-response").count();
    console.log(`    .font-claude-response count: ${responseCount}`);

    const userMsgCount = await page.locator('[data-testid="user-message"]').count();
    console.log(`    user-message count: ${userMsgCount}`);

    // Wait more and screenshot again
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: "debug-claude-step4.png" });
    console.log("    Screenshot: debug-claude-step4.png (after 10s wait)");

    const responseCount2 = await page.locator(".font-claude-response").count();
    console.log(`    .font-claude-response count: ${responseCount2}`);
  } else {
    // Try SSR textarea
    console.log("    TipTap editor not visible, trying SSR textarea...");
    const ssr = page.locator('[data-testid="chat-input-ssr"]');
    await ssr.click();
    await ssr.fill("What is 2+2? Reply briefly.");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "debug-claude-step2.png" });
  }

  console.log("\n[7] Enter で終了。");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  await context.close();
  console.log("\n--- Done ---");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
