/**
 * Gemini UI セレクタ発見スクリプト v2
 *
 * メッセージ送信後の応答UI要素を調査する。
 *
 * Usage: npx tsx scripts/discover-gemini.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Gemini Response UI Discovery ---\n");

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

  console.log("[1] Navigating to Gemini...");
  await page.goto("https://gemini.google.com/app", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(5_000);

  // Send a message
  console.log("[2] Sending test message...");
  const textArea = page.locator('.ql-editor[role="textbox"]');
  await textArea.click();
  await textArea.pressSequentially('Reply with exactly: "test OK"', {
    delay: 10,
  });

  const sendBtn = page.locator("button.send-button");
  await sendBtn.waitFor({ state: "visible", timeout: 5_000 });
  await sendBtn.click();
  console.log("    Message sent. Waiting 15s for response...");
  await page.waitForTimeout(15_000);

  // Screenshot
  await page.screenshot({ path: "debug-gemini-response.png" });
  console.log("    Screenshot: debug-gemini-response.png\n");

  // Step 3: Look for response containers
  console.log("[3] Response elements (class contains 'response' or 'message'):");
  const responseElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const className = el.className?.toString() ?? "";
      if (
        className.includes("response") ||
        className.includes("message-content") ||
        className.includes("model-response") ||
        className.includes("markdown")
      ) {
        const text = el.textContent?.trim().slice(0, 100) ?? "";
        if (text) {
          results.push(
            `tag=${el.tagName} class="${className.slice(0, 120)}" children=${el.children.length} text="${text}"`,
          );
        }
      }
    });
    return results.slice(0, 40);
  });
  responseElements.forEach((el) => console.log(`    ${el}`));

  // Step 4: Look for turn containers
  console.log("\n[4] Conversation turn containers:");
  const turnElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const className = el.className?.toString() ?? "";
      if (
        className.includes("turn") ||
        className.includes("conversation") ||
        className.includes("chat-turn")
      ) {
        const text = el.textContent?.trim().slice(0, 80) ?? "";
        results.push(
          `tag=${el.tagName} class="${className.slice(0, 120)}" text="${text}"`,
        );
      }
    });
    return results.slice(0, 20);
  });
  turnElements.forEach((el) => console.log(`    ${el}`));

  // Step 5: Find elements containing "test OK" or the response text
  console.log('\n[5] Elements containing response text:');
  const responseText = await page.evaluate(() => {
    const results: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim() ?? "";
      if (text.toLowerCase().includes("test ok") || text.toLowerCase().includes("ok")) {
        const parent = walker.currentNode.parentElement;
        if (parent) {
          let chain = "";
          let node: HTMLElement | null = parent;
          for (let i = 0; i < 4 && node; i++) {
            chain += `${node.tagName}(class="${node.className?.toString().slice(0, 60)}") → `;
            node = node.parentElement;
          }
          results.push(`text="${text.slice(0, 80)}" chain: ${chain}`);
        }
      }
    }
    return results;
  });
  responseText.forEach((el) => console.log(`    ${el}`));

  // Step 6: Stop/loading indicators
  console.log("\n[6] Stop/loading elements:");
  const stopElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("button").forEach((el) => {
      const className = el.className?.toString() ?? "";
      const ariaLabel = el.getAttribute("aria-label") ?? "";
      if (
        className.includes("stop") ||
        ariaLabel.toLowerCase().includes("stop") ||
        className.includes("loading")
      ) {
        results.push(
          `tag=${el.tagName} class="${className.slice(0, 80)}" aria="${ariaLabel}" visible=${el.offsetParent !== null}`,
        );
      }
    });
    // Also check for loading spinners
    document
      .querySelectorAll("[class*='loading'], [class*='spinner'], [class*='progress']")
      .forEach((el) => {
        results.push(
          `tag=${el.tagName} class="${el.className?.toString().slice(0, 80)}" visible=${el.offsetParent !== null}`,
        );
      });
    return results;
  });
  stopElements.forEach((el) => console.log(`    ${el}`));

  // Step 7: All unique class names with 'response' or 'message'
  console.log("\n[7] Unique classes with 'response/message/turn/model':");
  const uniqueClasses = await page.evaluate(() => {
    const classSet = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      const classes = el.className?.toString().split(/\s+/) ?? [];
      for (const cls of classes) {
        if (
          cls.includes("response") ||
          cls.includes("message") ||
          cls.includes("turn") ||
          cls.includes("model")
        ) {
          classSet.add(cls);
        }
      }
    });
    return [...classSet].sort();
  });
  uniqueClasses.forEach((cls) => console.log(`    ${cls}`));

  console.log("\n[8] Enter で終了。");
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
