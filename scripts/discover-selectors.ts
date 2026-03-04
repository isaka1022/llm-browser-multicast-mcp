/**
 * Deep Research 進行中UI調査スクリプト
 *
 * Deep Research を開始してリサーチ中のUI要素をダンプする。
 *
 * Usage: npx tsx scripts/discover-selectors.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Deep Research In-Progress UI Discovery ---\n");

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

  console.log("[1] Navigating to Deep Research...");
  await page.goto("https://chatgpt.com/deep-research", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(5_000);

  // Send a query
  console.log("[2] Sending test query...");
  const textArea = page.locator("#prompt-textarea");
  await textArea.click();
  await textArea.fill("What is 2+2? Brief answer.");

  // Find and click send button
  const sendBtn = page.locator('button[data-testid="send-button"]');
  const sendVisible = await sendBtn.isVisible().catch(() => false);
  console.log(`    Send button (data-testid) visible: ${sendVisible}`);

  if (!sendVisible) {
    // Try alternative: button with "Deep Research" text
    const altSend = page.locator("button").filter({ hasText: /Deep Research/i });
    const altCount = await altSend.count();
    console.log(`    Alt send buttons with 'Deep Research' text: ${altCount}`);
    for (let i = 0; i < altCount; i++) {
      const el = altSend.nth(i);
      const testId = await el.getAttribute("data-testid");
      const text = await el.innerText();
      console.log(`      [${i}] testid="${testId}" text="${text.trim()}"`);
    }
    if (altCount > 0) {
      await altSend.last().click();
    }
  } else {
    await sendBtn.click();
  }

  console.log("[3] Query sent. Waiting 10s for research to start...");
  await page.waitForTimeout(10_000);

  // Screenshot
  await page.screenshot({ path: "debug-research-inprogress.png" });
  console.log("    Screenshot: debug-research-inprogress.png");

  // Check for stop button
  console.log("\n[4] Stop button search:");
  const stopElements = await page.evaluate(() => {
    const results: string[] = [];
    // Standard stop button
    document.querySelectorAll('[data-testid*="stop"]').forEach((el) => {
      results.push(
        `testid="${el.getAttribute("data-testid")}" tag=${el.tagName} visible=${el.offsetParent !== null} text="${el.textContent?.slice(0, 60)}"`,
      );
    });
    // aria-label stop
    document.querySelectorAll('[aria-label*="Stop"], [aria-label*="stop"]').forEach((el) => {
      results.push(
        `aria="${el.getAttribute("aria-label")}" tag=${el.tagName} testid="${el.getAttribute("data-testid")}" visible=${el.offsetParent !== null}`,
      );
    });
    // Any button that might be a cancel/stop
    document.querySelectorAll("button").forEach((el) => {
      const text = el.textContent?.toLowerCase() ?? "";
      if (text.includes("stop") || text.includes("cancel") || text.includes("中止")) {
        results.push(
          `button text="${el.textContent?.trim().slice(0, 60)}" testid="${el.getAttribute("data-testid")}"`,
        );
      }
    });
    return results;
  });
  stopElements.forEach((el) => console.log(`    ${el}`));

  // Check for assistant messages
  console.log("\n[5] Assistant message elements:");
  const assistantMsgs = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('[data-message-author-role]').forEach((el) => {
      results.push(
        `role="${el.getAttribute("data-message-author-role")}" tag=${el.tagName} text="${el.textContent?.trim().slice(0, 100)}"`,
      );
    });
    return results;
  });
  assistantMsgs.forEach((msg) => console.log(`    ${msg}`));

  // Check for any progress/status indicators
  console.log("\n[6] Progress/status indicators:");
  const progressElements = await page.evaluate(() => {
    const results: string[] = [];
    // Check for role=status or aria-live
    document.querySelectorAll('[role="status"], [aria-live], [role="progressbar"]').forEach((el) => {
      results.push(
        `role="${el.getAttribute("role")}" aria-live="${el.getAttribute("aria-live")}" text="${el.textContent?.trim().slice(0, 100)}"`,
      );
    });
    // Check for any "searching" / "browsing" / "reading" indicators
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.toLowerCase() ?? "";
      if (
        text.includes("searching") ||
        text.includes("browsing") ||
        text.includes("reading") ||
        text.includes("analyzing") ||
        text.includes("generating") ||
        text.includes("検索") ||
        text.includes("分析") ||
        text.includes("調査")
      ) {
        const parent = walker.currentNode.parentElement;
        results.push(
          `text="${walker.currentNode.textContent?.trim().slice(0, 100)}" parent=${parent?.tagName} class="${parent?.className?.toString().slice(0, 60)}"`,
        );
      }
    }
    return results;
  });
  progressElements.forEach((el) => console.log(`    ${el}`));

  // All data-testid
  console.log("\n[7] All data-testid on page:");
  const allTestIds = await page.evaluate(() => {
    const ids: string[] = [];
    document.querySelectorAll("[data-testid]").forEach((el) => {
      ids.push(el.getAttribute("data-testid") ?? "");
    });
    return [...new Set(ids)].sort();
  });
  allTestIds.forEach((id) => console.log(`    ${id}`));

  // Wait another 30s and check again
  console.log("\n[8] Waiting 30s more and checking again...");
  await page.waitForTimeout(30_000);

  await page.screenshot({ path: "debug-research-inprogress-2.png" });
  console.log("    Screenshot: debug-research-inprogress-2.png");

  // Re-check stop and messages
  console.log("\n[9] Stop/progress after 30s:");
  const stopAfter = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('[data-testid*="stop"]').forEach((el) => {
      results.push(
        `testid="${el.getAttribute("data-testid")}" visible=${el.offsetParent !== null}`,
      );
    });
    document.querySelectorAll('[data-message-author-role]').forEach((el) => {
      results.push(
        `msg role="${el.getAttribute("data-message-author-role")}" text="${el.textContent?.trim().slice(0, 150)}"`,
      );
    });
    return results;
  });
  stopAfter.forEach((el) => console.log(`    ${el}`));

  console.log("\n[10] Enter で終了。");
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
