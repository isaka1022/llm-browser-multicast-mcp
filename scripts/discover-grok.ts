/**
 * Grok UI セレクタ発見スクリプト
 *
 * Usage: npx tsx scripts/discover-grok.ts
 */

import { chromium } from "playwright";

const PROFILE_DIR = ".playwright-auth/chrome-profile";

async function main() {
  console.log("--- Grok Response UI Discovery ---\n");

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

  console.log("[1] Navigating to Grok...");
  await page.goto("https://grok.com", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: "debug-grok-initial.png" });
  console.log("    Screenshot: debug-grok-initial.png\n");

  // Step 2: Find text input
  console.log("[2] Text input elements:");
  const inputElements = await page.evaluate(() => {
    const results: string[] = [];
    document
      .querySelectorAll(
        '[contenteditable="true"], textarea, input[type="text"], [role="textbox"]',
      )
      .forEach((el) => {
        const tag = el.tagName;
        const className = el.className?.toString().slice(0, 120) ?? "";
        const id = el.id ?? "";
        const role = el.getAttribute("role") ?? "";
        const placeholder =
          el.getAttribute("placeholder") ??
          el.getAttribute("aria-placeholder") ??
          "";
        const dataTestId = el.getAttribute("data-testid") ?? "";
        results.push(
          `tag=${tag} id="${id}" class="${className.slice(0, 80)}" role="${role}" placeholder="${placeholder}" data-testid="${dataTestId}"`,
        );
      });
    return results;
  });
  inputElements.forEach((el) => console.log(`    ${el}`));

  // Step 3: Send a message
  console.log("\n[3] Sending test message...");

  // Try textarea first
  const textarea = page.locator("textarea").first();
  const taVisible = await textarea.isVisible().catch(() => false);

  if (taVisible) {
    console.log("    Found textarea, typing...");
    await textarea.click();
    await textarea.fill('Reply with exactly: "test OK"');
  } else {
    // Try contenteditable
    const ce = page.locator('[contenteditable="true"]').first();
    const ceVisible = await ce.isVisible().catch(() => false);
    if (ceVisible) {
      console.log("    Found contenteditable, typing...");
      await ce.click();
      await page.keyboard.type('Reply with exactly: "test OK"', { delay: 10 });
    } else {
      console.log("    No input found!");
      await page.screenshot({ path: "debug-grok-no-input.png" });
      await context.close();
      return;
    }
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: "debug-grok-after-type.png" });
  console.log("    Screenshot: debug-grok-after-type.png");

  // Find send button
  console.log("\n[4] Looking for send button...");
  const allButtons = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("button").forEach((el) => {
      const className = el.className?.toString().slice(0, 80) ?? "";
      const ariaLabel = el.getAttribute("aria-label") ?? "";
      const dataTestId = el.getAttribute("data-testid") ?? "";
      const text = el.textContent?.trim().slice(0, 40) ?? "";
      const visible = el.offsetParent !== null;
      const disabled = el.disabled;
      if (
        ariaLabel.toLowerCase().includes("send") ||
        ariaLabel.toLowerCase().includes("submit") ||
        dataTestId.includes("send") ||
        dataTestId.includes("submit") ||
        className.includes("send") ||
        text.toLowerCase().includes("send")
      ) {
        results.push(
          `class="${className}" aria="${ariaLabel}" data-testid="${dataTestId}" text="${text}" visible=${visible} disabled=${disabled}`,
        );
      }
    });
    return results;
  });
  allButtons.forEach((el) => console.log(`    ${el}`));

  // Also check for any prominent button near the input
  const nearbyButtons = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("button").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const visible = el.offsetParent !== null;
      if (visible && rect.y > 250) {
        // Lower half of page
        const ariaLabel = el.getAttribute("aria-label") ?? "";
        const className = el.className?.toString().slice(0, 60) ?? "";
        const text = el.textContent?.trim().slice(0, 30) ?? "";
        results.push(
          `y=${Math.round(rect.y)} class="${className}" aria="${ariaLabel}" text="${text}"`,
        );
      }
    });
    return results;
  });
  console.log("    Buttons in lower half:");
  nearbyButtons.forEach((el) => console.log(`      ${el}`));

  // Try pressing Enter
  console.log("\n[5] Pressing Enter...");
  await page.keyboard.press("Enter");
  console.log("    Waiting 15s for response...");
  await page.waitForTimeout(15_000);
  await page.screenshot({ path: "debug-grok-response.png" });
  console.log("    Screenshot: debug-grok-response.png\n");

  // Step 6: Look for response containers
  console.log("[6] Response elements:");
  const responseElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const className = el.className?.toString() ?? "";
      if (
        className.includes("response") ||
        className.includes("message") ||
        className.includes("assistant") ||
        className.includes("markdown") ||
        className.includes("prose") ||
        className.includes("bot") ||
        className.includes("grok")
      ) {
        const text = el.textContent?.trim().slice(0, 100) ?? "";
        if (text && text.length > 1) {
          results.push(
            `tag=${el.tagName} class="${className.slice(0, 120)}" children=${el.children.length} text="${text.slice(0, 80)}"`,
          );
        }
      }
    });
    return results.slice(0, 40);
  });
  responseElements.forEach((el) => console.log(`    ${el}`));

  // Step 7: data-testid elements
  console.log("\n[7] Elements with data-testid:");
  const dataElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("[data-testid]").forEach((el) => {
      const testId = el.getAttribute("data-testid") ?? "";
      const tag = el.tagName;
      const text = el.textContent?.trim().slice(0, 60) ?? "";
      results.push(`tag=${tag} data-testid="${testId}" text="${text.slice(0, 50)}"`);
    });
    return results.slice(0, 40);
  });
  dataElements.forEach((el) => console.log(`    ${el}`));

  // Step 8: Elements containing response text
  console.log('\n[8] Elements containing "test OK" or "ok":');
  const responseText = await page.evaluate(() => {
    const results: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim() ?? "";
      if (text.toLowerCase().includes("test ok")) {
        const parent = walker.currentNode.parentElement;
        if (parent) {
          let chain = "";
          let node: HTMLElement | null = parent;
          for (let i = 0; i < 5 && node; i++) {
            const cls = node.className?.toString().slice(0, 60) ?? "";
            const testId = node.getAttribute("data-testid") ?? "";
            chain += `${node.tagName}(class="${cls}"${testId ? ` testid="${testId}"` : ""}) → `;
            node = node.parentElement;
          }
          results.push(`text="${text.slice(0, 80)}" chain: ${chain}`);
        }
      }
    }
    return results;
  });
  responseText.forEach((el) => console.log(`    ${el}`));

  // Step 9: Unique classes
  console.log("\n[9] Unique classes with 'response/message/chat/model/grok/bot':");
  const uniqueClasses = await page.evaluate(() => {
    const classSet = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      const classes = el.className?.toString().split(/\s+/) ?? [];
      for (const cls of classes) {
        if (
          cls.includes("response") ||
          cls.includes("message") ||
          cls.includes("chat") ||
          cls.includes("model") ||
          cls.includes("grok") ||
          cls.includes("bot") ||
          cls.includes("turn")
        ) {
          classSet.add(cls);
        }
      }
    });
    return [...classSet].sort();
  });
  uniqueClasses.forEach((cls) => console.log(`    ${cls}`));

  // Step 10: New chat elements
  console.log("\n[10] New chat / navigation elements:");
  const navElements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("a, button").forEach((el) => {
      const text = el.textContent?.trim().slice(0, 40) ?? "";
      const href = el.getAttribute("href") ?? "";
      const ariaLabel = el.getAttribute("aria-label") ?? "";
      if (
        text.toLowerCase().includes("new") ||
        href.includes("/new") ||
        href.includes("/chat") ||
        ariaLabel.toLowerCase().includes("new")
      ) {
        results.push(
          `tag=${el.tagName} href="${href}" aria="${ariaLabel}" text="${text}"`,
        );
      }
    });
    return results.slice(0, 15);
  });
  navElements.forEach((el) => console.log(`    ${el}`));

  // Step 11: Stop/loading
  console.log("\n[11] Stop/loading elements:");
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
          `class="${className.slice(0, 80)}" aria="${ariaLabel}" visible=${el.offsetParent !== null}`,
        );
      }
    });
    return results;
  });
  stopElements.forEach((el) => console.log(`    ${el}`));

  console.log("\n[12] Enter で終了。");
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
