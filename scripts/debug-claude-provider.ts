/**
 * Claude Provider フローを再現するデバッグスクリプト
 * BrowserManager → newPage → navigate → send の流れを再現
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Claude Provider Flow Debug ---\n");

  // Simulate BrowserManager
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
  context.setDefaultNavigationTimeout(60_000);

  // Simulate newPage() - this is what PlaywrightProvider does
  const page = await context.newPage();

  console.log("[1] startNewChat: goto /new");
  await page.goto("https://claude.ai/new", { waitUntil: "domcontentloaded" });

  console.log("[2] Waiting for chat-input...");
  try {
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 15_000 });
    console.log("    chat-input found!");
  } catch {
    console.log("    chat-input NOT found. Checking page...");
    await page.screenshot({ path: "debug-claude-provider-1.png" });
    console.log("    Screenshot: debug-claude-provider-1.png");

    // Check current URL
    console.log(`    URL: ${page.url()}`);

    // Wait longer
    console.log("    Waiting 10 more seconds...");
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: "debug-claude-provider-2.png" });
    console.log("    Screenshot: debug-claude-provider-2.png");

    const hasInput = await page.locator('[data-testid="chat-input"]').isVisible().catch(() => false);
    console.log(`    chat-input visible now: ${hasInput}`);

    if (!hasInput) {
      // Check for login redirect
      const inputs = await page.evaluate(() => {
        const results: string[] = [];
        document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]').forEach(el => {
          results.push(`tag=${el.tagName} id="${el.id}" testid="${el.getAttribute("data-testid") ?? ""}" visible=${(el as HTMLElement).offsetParent !== null}`);
        });
        return results;
      });
      console.log("    All inputs:", inputs);
      await page.close();
      await context.close();
      return;
    }
  }

  console.log("\n[3] Typing and sending...");
  const editor = page.locator('[data-testid="chat-input"]');
  await editor.click();
  await page.keyboard.type("What is 2+2? Reply briefly.", { delay: 10 });
  await page.waitForTimeout(300);

  await page.screenshot({ path: "debug-claude-provider-3.png" });
  console.log("    Screenshot: debug-claude-provider-3.png (after type)");

  await page.keyboard.press("Enter");
  console.log("    Enter pressed");

  // Wait and check
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: "debug-claude-provider-4.png" });
  console.log("    Screenshot: debug-claude-provider-4.png (3s after Enter)");

  const userMsg = await page.locator('[data-testid="user-message"]').count();
  console.log(`    user-message count: ${userMsg}`);

  const response = await page.locator(".font-claude-response").count();
  console.log(`    font-claude-response count: ${response}`);

  // Wait more
  await page.waitForTimeout(15_000);
  await page.screenshot({ path: "debug-claude-provider-5.png" });
  console.log("    Screenshot: debug-claude-provider-5.png (18s after Enter)");

  const response2 = await page.locator(".font-claude-response").count();
  console.log(`    font-claude-response count: ${response2}`);

  const markdown = await page.locator(".standard-markdown").count();
  console.log(`    standard-markdown count: ${markdown}`);

  if (markdown > 0) {
    const text = await page.locator(".standard-markdown").last().innerText();
    console.log(`    Response text: "${text}"`);
  }

  await page.close();
  await context.close();
  console.log("\n--- Done ---");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
