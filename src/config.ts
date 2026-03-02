import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CouncilConfig } from "./types.js";

const DEFAULT_CONFIG: CouncilConfig = {
  providers: {
    ollama: {
      type: "ollama",
      baseUrl: "http://localhost:11434",
      models: ["qwen2.5:latest", "phi4:14b", "llama3:8b"],
    },
  },
  defaultModels: [
    "ollama/qwen2.5:latest",
    "ollama/phi4:14b",
    "ollama/llama3:8b",
  ],
  chairman: "ollama/qwen2.5:latest",
  timeoutMs: 120_000,
};

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, envName: string) => {
    return process.env[envName] ?? "";
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
    const userConfig = JSON.parse(raw) as Partial<CouncilConfig>;
    const merged = { ...DEFAULT_CONFIG, ...userConfig };
    return resolveConfigEnvVars(merged);
  } catch {
    return DEFAULT_CONFIG;
  }
}
