import type { CouncilConfig, ChatMessage, ModelResponse, ModelResult } from "../types.js";
import type { LLMProvider } from "./base.js";
import { OpenAICompatibleProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { createGeminiCLI, createCodexCLI, createClaudeCLI } from "./cli.js";
import { PlaywrightProvider } from "./playwright/playwright-provider.js";
import { log } from "../logger.js";

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(private readonly config: CouncilConfig) {
    this.initProviders();
  }

  private initProviders(): void {
    for (const [name, providerConfig] of Object.entries(
      this.config.providers,
    )) {
      switch (providerConfig.type) {
        case "anthropic":
          this.providers.set(
            name,
            new AnthropicProvider(
              providerConfig.apiKey ?? "",
              providerConfig.baseUrl,
            ),
          );
          break;
        case "gemini-api":
          this.providers.set(
            name,
            new OpenAICompatibleProvider(
              name,
              providerConfig.baseUrl ??
                "https://generativelanguage.googleapis.com/v1beta/openai",
              {
                Authorization: `Bearer ${providerConfig.apiKey ?? ""}`,
              },
            ),
          );
          break;
        case "grok-api":
          this.providers.set(
            name,
            new OpenAICompatibleProvider(
              name,
              providerConfig.baseUrl ?? "https://api.x.ai",
              {
                Authorization: `Bearer ${providerConfig.apiKey ?? ""}`,
              },
            ),
          );
          break;
        case "gemini-cli":
          this.providers.set(name, createGeminiCLI());
          break;
        case "codex-cli":
          this.providers.set(name, createCodexCLI());
          break;
        case "claude-cli":
          this.providers.set(name, createClaudeCLI());
          break;
        case "chatgpt-web":
          this.providers.set(
            name,
            new PlaywrightProvider({
              service: providerConfig.service ?? "chatgpt",
              profileDir: providerConfig.profileDir,
              headless: providerConfig.headless,
            }),
          );
          break;
        case "gemini-web":
          this.providers.set(
            name,
            new PlaywrightProvider({
              service: providerConfig.service ?? "gemini",
              profileDir: providerConfig.profileDir,
              headless: providerConfig.headless,
            }),
          );
          break;
        case "claude-web":
          this.providers.set(
            name,
            new PlaywrightProvider({
              service: providerConfig.service ?? "claude",
              profileDir: providerConfig.profileDir,
              headless: providerConfig.headless,
            }),
          );
          break;
        case "grok-web":
          this.providers.set(
            name,
            new PlaywrightProvider({
              service: providerConfig.service ?? "grok",
              profileDir: providerConfig.profileDir,
              headless: providerConfig.headless,
            }),
          );
          break;
      }
    }
  }

  private resolve(modelId: string): { provider: LLMProvider; model: string } {
    const slashIndex = modelId.indexOf("/");
    if (slashIndex === -1) {
      throw new Error(
        `Invalid model ID "${modelId}". Use format "provider/model"`,
      );
    }
    const providerName = modelId.slice(0, slashIndex);
    const model = modelId.slice(slashIndex + 1);
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(
        `Unknown provider "${providerName}". Available: ${[...this.providers.keys()].join(", ")}`,
      );
    }
    return { provider, model };
  }

  async chat(
    modelId: string,
    messages: ChatMessage[],
  ): Promise<ModelResponse> {
    const { provider, model } = this.resolve(modelId);
    return provider.chat(model, messages, this.config.timeoutMs);
  }

  async chatParallel(
    modelIds: string[],
    messages: ChatMessage[],
  ): Promise<ModelResult[]> {
    const results = await Promise.allSettled(
      modelIds.map((id) => this.chat(id, messages)),
    );

    return results.map((result, i) => {
      if (result.status === "fulfilled") {
        return { status: "success" as const, response: result.value };
      }
      return {
        status: "error" as const,
        error: {
          model: modelIds[i],
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        },
      };
    });
  }

  async closeAll(): Promise<void> {
    const closeable = [...this.providers.values()].filter(
      (p): p is LLMProvider & { close(): Promise<void> } =>
        "close" in p && typeof (p as Record<string, unknown>).close === "function",
    );
    await Promise.all(closeable.map((p) => p.close()));
  }

  async listAllModels(): Promise<string[]> {
    const allModels: string[] = [];
    for (const [name, provider] of this.providers.entries()) {
      const models = await provider.listModels().catch((err) => {
        log.error(`Failed to list models from provider "${name}": ${err instanceof Error ? err.message : String(err)}`);
        return [];
      });
      allModels.push(...models);
    }
    return allModels;
  }
}
