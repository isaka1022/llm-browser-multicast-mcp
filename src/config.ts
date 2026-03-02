import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod/v4";
import type { CouncilConfig, ProviderType } from "./types.js";
import { log } from "./logger.js";

const PROVIDER_TYPES: ProviderType[] = [
  "openai-compatible",
  "anthropic",
  "gemini-api",
  "grok-api",
  "gemini-cli",
  "codex-cli",
  "claude-cli",
];

const ProviderConfigSchema = z.object({
  type: z.enum(PROVIDER_TYPES as [ProviderType, ...ProviderType[]]),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  models: z.array(z.string()),
});

const CouncilConfigSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
  defaultModels: z.array(z.string()),
  chairman: z.string(),
  timeoutMs: z.number().positive(),
});

const DEFAULT_CONFIG: CouncilConfig = {
  providers: {
    "gemini-cli": {
      type: "gemini-cli",
      models: ["default"],
    },
    "claude-cli": {
      type: "claude-cli",
      models: ["default"],
    },
    "codex-cli": {
      type: "codex-cli",
      models: ["default"],
    },
  },
  defaultModels: [
    "gemini-cli/default",
    "claude-cli/default",
    "codex-cli/default",
  ],
  chairman: "gemini-cli/default",
  timeoutMs: 300_000,
};

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, envName: string) => {
    const resolved = process.env[envName];
    if (resolved === undefined) {
      log.error(`Environment variable ${envName} is not defined`);
      return "";
    }
    return resolved;
  });
}

function resolveConfigEnvVars(config: CouncilConfig): CouncilConfig {
  for (const provider of Object.values(config.providers)) {
    if (provider.apiKey) {
      provider.apiKey = resolveEnvVars(provider.apiKey);
    }
    if (provider.baseUrl) {
      provider.baseUrl = resolveEnvVars(provider.baseUrl);
    }
  }
  return config;
}

export async function loadConfig(): Promise<CouncilConfig> {
  const configPath = resolve(process.cwd(), "council.config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const userConfig = CouncilConfigSchema.partial().parse(parsed);
    const merged: CouncilConfig = { ...DEFAULT_CONFIG, ...userConfig } as CouncilConfig;
    return resolveConfigEnvVars(merged);
  } catch (err) {
    if (err instanceof z.ZodError) {
      log.error(`Invalid config: ${err.issues.map((i) => i.message).join(", ")}`);
    }
    return DEFAULT_CONFIG;
  }
}
