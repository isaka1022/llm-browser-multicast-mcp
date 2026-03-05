import { chromium, type BrowserContext, type Page } from "playwright";
import { log } from "../../logger.js";

const DEFAULT_PROFILE_DIR = ".playwright-auth/chrome-profile";
const DEFAULT_NAVIGATION_TIMEOUT_MS = 60_000;

interface BrowserManagerOptions {
  headless: boolean;
  profileDir: string;
  navigationTimeoutMs: number;
}

interface PoolEntry {
  manager: BrowserManager;
  refCount: number;
}

export class BrowserManager {
  private static pool = new Map<string, PoolEntry>();

  private context: BrowserContext | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly options: BrowserManagerOptions;

  /**
   * Get a shared BrowserManager for the given profile directory.
   * Multiple callers with the same profileDir share one browser instance.
   */
  static getShared(options?: Partial<BrowserManagerOptions>): BrowserManager {
    const profileDir = options?.profileDir ?? DEFAULT_PROFILE_DIR;
    const entry = BrowserManager.pool.get(profileDir);

    if (entry) {
      entry.refCount++;
      return entry.manager;
    }

    const manager = new BrowserManager(options);
    BrowserManager.pool.set(profileDir, { manager, refCount: 1 });
    return manager;
  }

  /**
   * Release a shared BrowserManager. Closes the browser when the last
   * consumer releases it.
   */
  static async releaseShared(
    options?: Partial<BrowserManagerOptions>,
  ): Promise<void> {
    const profileDir = options?.profileDir ?? DEFAULT_PROFILE_DIR;
    const entry = BrowserManager.pool.get(profileDir);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      BrowserManager.pool.delete(profileDir);
      await entry.manager.close();
    }
  }

  constructor(options?: Partial<BrowserManagerOptions>) {
    this.options = {
      headless: options?.headless ?? false,
      profileDir: options?.profileDir ?? DEFAULT_PROFILE_DIR,
      navigationTimeoutMs:
        options?.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS,
    };
  }

  async ensureInitialized(): Promise<void> {
    if (this.context) return;
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    await this.initPromise;
    this.initPromise = null;
  }

  private async init(): Promise<void> {
    log.info("BrowserManager: launching browser...");

    this.context = await chromium.launchPersistentContext(
      this.options.profileDir,
      {
        headless: this.options.headless,
        channel: "chrome",
        viewport: { width: 1280, height: 720 },
        args: [
          "--disable-blink-features=AutomationControlled",
          "--no-first-run",
          "--no-default-browser-check",
        ],
      },
    );

    this.context.setDefaultNavigationTimeout(this.options.navigationTimeoutMs);
    log.info("BrowserManager: browser ready");
  }

  async newPage(): Promise<Page> {
    await this.ensureInitialized();
    return this.context!.newPage();
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    log.info("BrowserManager: browser closed");
  }
}
