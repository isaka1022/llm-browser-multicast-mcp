/**
 * Claude UI セレクタ発見スクリプト
 *
 * メッセージ送信後の応答UI要素を調査する。
 *
 * Usage: npx tsx scripts/discover-claude.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Claude Response UI Discovery ---\n");

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

  console.log("[1] Navigating to Claude...");
  await page.goto("https://claude.ai/new", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(5_000);

  // Screenshot before sending
  await page.screenshot({ path: "debug-claude-initial.png" });
  console.log("    Screenshot: debug-claude-initial.png\n");

  // Step 2: Find text input
  console.log("[2] Text input elements:");
  const inputElements = await page.evaluate(() => {
    const results: string[] = [];
    // Check contenteditable divs, textareas, inputs
    document
      .querySelectorAll(
        '[contenteditable="true"], textarea, input[type="text"], [role="textbox"]',
      )
      .forEach((el) => {
        const tag = el.tagName;
        const className = el.className?.toString().slice(0, 120) ?? "";
        const id = el.id ?? "";
        const role = el.getAttribute("role") ?? "";
        const placeholder = el.getAttribute("placeholder") ?? el.getAttribute("aria-placeholder") ?? "";
        const dataTestId = el.getAttribute("data-testid") ?? "";
        results.push(
          `tag=${tag} id="${id}" class="${className}" role="${role}" placeholder="${placeholder}" data-testid="${dataTestId}"`,
        );
      });
    return results;
  });
  inputElements.forEach((el) => console.log(`    ${el}`));

  // Step 3: Send a message
  console.log("\n[3] Sending test message...");

  // Try contenteditable div first (common for Claude)
  const contentEditable = page.locator('[contenteditable="true"]').first();
  const ceVisible = await contentEditable.isVisible().catch(() => false);

  if (ceVisible) {
    console.log("    Found contenteditable div, typing...");
    await contentEditable.click();
    await page.keyboard.type('Reply with exactly: "test OK"', { delay: 10 });
  } else {
    // Try textarea
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill('Reply with exactly: "test OK"');
  }

  await page.waitForTimeout(500);

  // Find and click send button
  console.log("    Looking for send button...");
  const sendButtons = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("button").forEach((el) => {
      const className = el.className?.toString().slice(0, 80) ?? "";
      const ariaLabel = el.getAttribute("aria-label") ?? "";
      const dataTestId = el.getAttribute("data-testid") ?? "";
      const text = el.textContent?.trim().slice(0, 40) ?? "";
      if (
        ariaLabel.toLowerCase().includes("send") ||
        dataTestId.includes("send") ||
        className.includes("send") ||
        text.toLowerCase().includes("send")
      ) {
        results.push(
          `class="${className}" aria="${ariaLabel}" data-testid="${dataTestId}" text="${text}" visible=${el.offsetParent !== null}`,
        );
      }
    });
    return results;
  });
  sendButtons.forEach((el) => console.log(`    Send button: ${el}`));

  // Try pressing Enter to send
  console.log("    Pressing Enter to send...");
  await page.keyboard.press("Enter");
  console.log("    Message sent. Waiting 15s for response...");
  await page.waitForTimeout(15_000);

  // Screenshot after response
  await page.screenshot({ path: "debug-claude-response.png" });
  console.log("    Screenshot: debug-claude-response.png\n");

  // Step 4: Look for response containers
  console.log("[4] Response elements (class contains 'response' or 'message'):");
  const responseElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const className = el.className?.toString() ?? "";
      if (
        className.includes("response") ||
        className.includes("message") ||
        className.includes("assistant") ||
        className.includes("markdown") ||
        className.includes("prose")
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

  // Step 5: Find elements by data attributes
  console.log("\n[5] Elements with data-testid or data-* attributes:");
  const dataElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("[data-testid]").forEach((el) => {
      const testId = el.getAttribute("data-testid") ?? "";
      const tag = el.tagName;
      const text = el.textContent?.trim().slice(0, 60) ?? "";
      if (
        testId.includes("message") ||
        testId.includes("response") ||
        testId.includes("chat") ||
        testId.includes("turn") ||
        testId.includes("send") ||
        testId.includes("input") ||
        testId.includes("new")
      ) {
        results.push(`tag=${tag} data-testid="${testId}" text="${text}"`);
      }
    });
    return results.slice(0, 30);
  });
  dataElements.forEach((el) => console.log(`    ${el}`));

  // Step 6: Elements containing "test OK"
  console.log('\n[6] Elements containing response text:');
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
          for (let i = 0; i < 5 && node; i++) {
            const dataTestId = node.getAttribute("data-testid") ?? "";
            chain += `${node.tagName}(class="${node.className?.toString().slice(0, 60)}"${dataTestId ? ` data-testid="${dataTestId}"` : ""}) → `;
            node = node.parentElement;
          }
          results.push(`text="${text.slice(0, 80)}" chain: ${chain}`);
        }
      }
    }
    return results;
  });
  responseText.forEach((el) => console.log(`    ${el}`));

  // Step 7: Stop/loading indicators
  console.log("\n[7] Stop/loading elements:");
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
    document
      .querySelectorAll("[class*='loading'], [class*='spinner'], [class*='progress'], [class*='streaming']")
      .forEach((el) => {
        results.push(
          `tag=${el.tagName} class="${el.className?.toString().slice(0, 80)}" visible=${el.offsetParent !== null}`,
        );
      });
    return results;
  });
  stopElements.forEach((el) => console.log(`    ${el}`));

  // Step 8: All unique class names
  console.log("\n[8] Unique classes with 'response/message/turn/model/chat/assistant':");
  const uniqueClasses = await page.evaluate(() => {
    const classSet = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      const classes = el.className?.toString().split(/\s+/) ?? [];
      for (const cls of classes) {
        if (
          cls.includes("response") ||
          cls.includes("message") ||
          cls.includes("turn") ||
          cls.includes("model") ||
          cls.includes("chat") ||
          cls.includes("assistant") ||
          cls.includes("human") ||
          cls.includes("user")
        ) {
          classSet.add(cls);
        }
      }
    });
    return [...classSet].sort();
  });
  uniqueClasses.forEach((cls) => console.log(`    ${cls}`));

  // Step 9: Check for new chat button
  console.log("\n[9] Navigation/new chat elements:");
  const navElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("a, button").forEach((el) => {
      const text = el.textContent?.trim().slice(0, 40) ?? "";
      const href = el.getAttribute("href") ?? "";
      const ariaLabel = el.getAttribute("aria-label") ?? "";
      const dataTestId = el.getAttribute("data-testid") ?? "";
      if (
        text.toLowerCase().includes("new") ||
        href.includes("/new") ||
        ariaLabel.toLowerCase().includes("new") ||
        dataTestId.includes("new")
      ) {
        results.push(
          `tag=${el.tagName} href="${href}" aria="${ariaLabel}" data-testid="${dataTestId}" text="${text}"`,
        );
      }
    });
    return results.slice(0, 15);
  });
  navElements.forEach((el) => console.log(`    ${el}`));

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
