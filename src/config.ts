import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { z } from "zod/v4";
import type { CouncilConfig, ProviderType } from "./types.js";
import { log } from "./logger.js";

const PROVIDER_TYPES: ProviderType[] = [
  "chatgpt-web",
  "gemini-web",
  "claude-web",
  "grok-web",
];

const ProviderConfigSchema = z.object({
  type: z.enum(PROVIDER_TYPES as [ProviderType, ...ProviderType[]]),
  models: z.array(z.string()),
  service: z.enum(["chatgpt", "gemini", "claude", "grok"]).optional(),
  profileDir: z.string().optional(),
  headless: z.boolean().optional(),
});

const CouncilConfigSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
  defaultModels: z.array(z.string()),
  chairman: z.string(),
  timeoutMs: z.number().positive(),
});

const DEFAULT_CONFIG: CouncilConfig = {
  providers: {
    chatgpt: {
      type: "chatgpt-web",
      models: ["gpt-4o"],
    },
    gemini: {
      type: "gemini-web",
      models: ["gemini-2.5-pro"],
    },
    claude: {
      type: "claude-web",
      models: ["claude-sonnet-4"],
    },
    grok: {
      type: "grok-web",
      models: ["grok-3"],
    },
  },
  defaultModels: [
    "chatgpt/gpt-4o",
    "gemini/gemini-2.5-pro",
    "claude/claude-sonnet-4",
  ],
  chairman: "claude/claude-sonnet-4",
  timeoutMs: 300_000,
};

function resolveConfigPath(): string | undefined {
  // 1. Explicit env var
  const envPath = process.env.COUNCIL_CONFIG;
  if (envPath) return resolve(envPath);

  // 2. CWD
  const cwdPath = resolve(process.cwd(), "council.config.json");

  // 3. XDG / global config
  const globalPath = resolve(homedir(), ".config", "llm-council", "config.json");

  // Return first that might exist (actual existence checked in loadConfig)
  return cwdPath;
}

async function tryReadConfig(configPath: string): Promise<string | undefined> {
  try {
    return await readFile(configPath, "utf-8");
  } catch {
    return undefined;
  }
}

export async function loadConfig(): Promise<CouncilConfig> {
  const candidates = [
    process.env.COUNCIL_CONFIG ? resolve(process.env.COUNCIL_CONFIG) : undefined,
    resolve(process.cwd(), "council.config.json"),
    resolve(homedir(), ".config", "llm-council", "config.json"),
  ].filter((p): p is string => p !== undefined);

  for (const configPath of candidates) {
    const raw = await tryReadConfig(configPath);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const userConfig = CouncilConfigSchema.partial().parse(parsed);
      const merged: CouncilConfig = { ...DEFAULT_CONFIG, ...userConfig } as CouncilConfig;
      log.info(`Config loaded from ${configPath}`);
      return merged;
    } catch (err) {
      if (err instanceof z.ZodError) {
        log.error(`Invalid config at ${configPath}: ${err.issues.map((i) => i.message).join(", ")}`);
      } else {
        log.error(`Failed to parse config at ${configPath}: ${err}`);
      }
    }
  }

  log.info("No config file found, using defaults");
  return DEFAULT_CONFIG;
}
