/**
 * Grok Provider フローをデバッグ
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Grok Provider Flow Debug ---\n");

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

  const page = await context.newPage();

  console.log("[1] goto grok.com");
  await page.goto("https://grok.com", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: "debug-grok-p1.png" });
  console.log("    Screenshot: debug-grok-p1.png");
  console.log(`    URL: ${page.url()}`);

  // Check for TipTap editor
  const tiptap = page.locator(".tiptap.ProseMirror").first();
  const hasTiptap = await tiptap.isVisible().catch(() => false);
  console.log(`    TipTap visible: ${hasTiptap}`);

  // Check for textarea fallback
  const ta = page.locator("textarea").first();
  const hasTa = await ta.isVisible().catch(() => false);
  console.log(`    Textarea visible: ${hasTa}`);

  // List all interactable elements
  const inputs = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]').forEach(el => {
      const tag = el.tagName;
      const cls = el.className?.toString().slice(0, 80) ?? "";
      const visible = (el as HTMLElement).offsetParent !== null;
      results.push(`tag=${tag} class="${cls}" visible=${visible}`);
    });
    return results;
  });
  console.log("    Inputs:", inputs);

  if (!hasTiptap && !hasTa) {
    console.log("    No input found!");
    await page.close();
    await context.close();
    return;
  }

  console.log("\n[2] Typing...");
  if (hasTiptap) {
    await tiptap.click();
    await page.keyboard.type("What is 2+2? Reply briefly.", { delay: 10 });
  } else {
    await ta.click();
    await ta.fill("What is 2+2? Reply briefly.");
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: "debug-grok-p2.png" });
  console.log("    Screenshot: debug-grok-p2.png (after type)");

  // Count bubbles before sending
  const bubblesBefore = await page.locator(".message-bubble").count();
  console.log(`    Bubbles before send: ${bubblesBefore}`);

  console.log("\n[3] Sending...");
  const sendBtn = page.locator('button[aria-label="送信"], button[aria-label="Send"]').first();
  const sendVisible = await sendBtn.isVisible().catch(() => false);
  console.log(`    Send button visible: ${sendVisible}`);

  if (sendVisible) {
    await sendBtn.click();
    console.log("    Clicked send button");
  } else {
    await page.keyboard.press("Enter");
    console.log("    Pressed Enter");
  }

  await page.waitForTimeout(3_000);
  await page.screenshot({ path: "debug-grok-p3.png" });
  console.log("    Screenshot: debug-grok-p3.png (3s after send)");

  const bubblesAfter = await page.locator(".message-bubble").count();
  console.log(`    Bubbles after send: ${bubblesAfter}`);

  const markdowns = await page.locator(".response-content-markdown").count();
  console.log(`    response-content-markdown count: ${markdowns}`);

  // Wait more
  await page.waitForTimeout(10_000);
  await page.screenshot({ path: "debug-grok-p4.png" });
  console.log("    Screenshot: debug-grok-p4.png (13s after send)");

  const bubblesLater = await page.locator(".message-bubble").count();
  console.log(`    Bubbles: ${bubblesLater}`);

  if (bubblesLater > 0) {
    const text = await page.locator(".response-content-markdown").last().innerText().catch(() => "(empty)");
    console.log(`    Last response: "${text}"`);
  }

  await page.close();
  await context.close();
  console.log("\n--- Done ---");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
