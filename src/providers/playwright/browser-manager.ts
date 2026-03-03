import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { log } from "../../logger.js";

const DEFAULT_STORAGE_STATE_PATH = ".playwright-auth/chatgpt-state.json";
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

interface BrowserManagerOptions {
  headless: boolean;
  storageStatePath: string;
  navigationTimeoutMs: number;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly options: BrowserManagerOptions;

  constructor(options?: Partial<BrowserManagerOptions>) {
    this.options = {
      headless: options?.headless ?? true,
      storageStatePath: options?.storageStatePath ?? DEFAULT_STORAGE_STATE_PATH,
      navigationTimeoutMs:
        options?.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS,
    };

    const cleanup = () => {
      this.close().catch(() => {});
    };
    process.on("beforeExit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  async ensureInitialized(): Promise<void> {
    if (this.browser?.isConnected()) return;
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    await this.initPromise;
    this.initPromise = null;
  }

  private async init(): Promise<void> {
    log.info("BrowserManager: launching browser...");

    this.browser = await chromium.launch({
      headless: this.options.headless,
    });

    const storageState = this.loadStorageState();

    this.context = await this.browser.newContext({
      ...(storageState ? { storageState } : {}),
      viewport: { width: 1280, height: 720 },
    });

    this.context.setDefaultNavigationTimeout(this.options.navigationTimeoutMs);
    log.info("BrowserManager: browser ready");
  }

  async newPage(): Promise<Page> {
    await this.ensureInitialized();
    return this.context!.newPage();
  }

  async saveStorageState(): Promise<void> {
    if (!this.context) return;
    const dir = dirname(this.options.storageStatePath);
    mkdirSync(dir, { recursive: true });
    const state = await this.context.storageState();
    writeFileSync(
      this.options.storageStatePath,
      JSON.stringify(state, null, 2),
    );
    log.info(
      `BrowserManager: storage state saved to ${this.options.storageStatePath}`,
    );
  }

  private loadStorageState(): string | undefined {
    if (!existsSync(this.options.storageStatePath)) return undefined;
    try {
      // playwright expects a file path string for storageState
      return this.options.storageStatePath;
    } catch {
      log.error("BrowserManager: failed to load storage state");
      return undefined;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.saveStorageState().catch(() => {});
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    log.info("BrowserManager: browser closed");
  }
}
