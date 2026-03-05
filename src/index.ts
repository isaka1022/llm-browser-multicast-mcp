import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { loadConfig } from "./config.js";
import { CouncilOrchestrator } from "./orchestrator/council.js";
import { RoundtableOrchestrator } from "./orchestrator/roundtable.js";
import { DebateOrchestrator } from "./orchestrator/debate.js";
import { ProviderRegistry } from "./providers/registry.js";
import { formatCouncilResult, formatRoundtableResult, formatDebateResult, formatDeepResearchResult } from "./formatters.js";
import { PlaywrightProvider } from "./providers/playwright/playwright-provider.js";
import { log } from "./logger.js";
import { EventLogger } from "./event-logger.js";

async function main() {
  const config = await loadConfig();
  const registry = new ProviderRegistry(config);

  const server = new McpServer({
    name: "llm-council",
    version: "0.1.0",
  });

  // Tool: council_discuss
  server.tool(
    "council_discuss",
    "Run a council discussion: all models answer in parallel, peer-review each other anonymously, then a chairman synthesizes the best answer.",
    {
      question: z.string().describe("The question or topic to discuss"),
      models: z
        .array(z.string())
        .optional()
        .describe(
          'Model IDs to participate (format: "provider/model"). Defaults to config.',
        ),
      chairman: z
        .string()
        .optional()
        .describe("Model ID for the chairman who synthesizes. Defaults to config."),
    },
    async ({ question, models, chairman }) => {
      try {
        const eventLogger = new EventLogger();
        const orchestrator = new CouncilOrchestrator(config, registry);
        const result = await orchestrator.discuss(question, models, chairman, eventLogger);
        return {
          content: [{ type: "text" as const, text: formatCouncilResult(result) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Council error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: roundtable_discuss
  server.tool(
    "roundtable_discuss",
    "Run a roundtable discussion: models take turns responding, building on previous responses. More natural, conversational debate style.",
    {
      question: z.string().describe("The question or topic to discuss"),
      models: z
        .array(z.string())
        .optional()
        .describe(
          'Model IDs to participate (format: "provider/model"). Defaults to config.',
        ),
      rounds: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("Number of discussion rounds (1-5). Defaults to 2."),
    },
    async ({ question, models, rounds }) => {
      try {
        const eventLogger = new EventLogger();
        const orchestrator = new RoundtableOrchestrator(config, registry);
        const result = await orchestrator.discuss(
          question,
          models,
          rounds ?? 2,
          eventLogger,
        );
        return {
          content: [
            { type: "text" as const, text: formatRoundtableResult(result) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Roundtable error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: debate_discuss
  server.tool(
    "debate_discuss",
    "Run a structured debate: models state positions, discuss in rounds, restate final positions, then a chairman synthesizes points of agreement and disagreement.",
    {
      question: z.string().describe("The question or topic to debate"),
      models: z
        .array(z.string())
        .optional()
        .describe(
          'Model IDs to participate (format: "provider/model"). Defaults to config.',
        ),
      rounds: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("Number of discussion rounds (1-5). Defaults to 3."),
    },
    async ({ question, models, rounds }, extra) => {
      try {
        let step = 0;
        const progressToken = extra._meta?.progressToken;
        const eventLogger = new EventLogger();
        const orchestrator = new DebateOrchestrator(config, registry);
        const result = await orchestrator.discuss(
          question,
          models,
          rounds ?? 3,
          async (event) => {
            step++;
            if (progressToken != null) {
              await extra.sendNotification({
                method: "notifications/progress",
                params: {
                  progressToken,
                  progress: step,
                  message: `[Phase ${event.phase}] ${event.message}`,
                },
              });
            }
          },
          eventLogger,
        );
        return {
          content: [
            { type: "text" as const, text: formatDebateResult(result) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Debate error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: list_models
  server.tool(
    "list_models",
    "List all available models from configured providers.",
    {},
    async () => {
      try {
        const models = await registry.listAllModels();
        const defaultModels = config.defaultModels;
        const chairman = config.chairman;

        const lines = [
          "# Available Models\n",
          ...models.map((m) => {
            const tags: string[] = [];
            if (defaultModels.includes(m)) tags.push("default");
            if (m === chairman) tags.push("chairman");
            const suffix = tags.length > 0 ? ` (${tags.join(", ")})` : "";
            return `- ${m}${suffix}`;
          }),
          "",
          `**Default council:** ${defaultModels.join(", ")}`,
          `**Chairman:** ${chairman}`,
        ];

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing models: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: ask_model (single model, interactive use)
  server.tool(
    "ask_model",
    "Ask a single model a question. Use this for interactive, facilitator-style discussions where Claude Code orchestrates the conversation and the user can intervene between rounds.",
    {
      model: z
        .string()
        .describe('Model ID (format: "provider/model", e.g. "gemini-cli/default")'),
      prompt: z.string().describe("The question or prompt to send"),
      context: z
        .string()
        .optional()
        .describe("Optional context from previous discussion to include"),
    },
    async ({ model, prompt, context }) => {
      try {
        const messages = [];
        if (context) {
          messages.push({
            role: "system" as const,
            content: `Previous discussion context:\n${context}`,
          });
        }
        messages.push({ role: "user" as const, content: prompt });

        const response = await registry.chat(model, messages);

        return {
          content: [
            {
              type: "text" as const,
              text: `**${response.model}** (${response.durationMs}ms):\n\n${response.content}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from ${model}: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: ask_models (parallel query, interactive use)
  server.tool(
    "ask_models",
    "Ask multiple models the same question in parallel. Returns all responses at once. Use for gathering diverse opinions that Claude Code can then synthesize with the user.",
    {
      models: z
        .array(z.string())
        .describe(
          'Model IDs to query (format: "provider/model"). If empty, uses default council models.',
        ),
      prompt: z.string().describe("The question or prompt to send to all models"),
      context: z
        .string()
        .optional()
        .describe("Optional context from previous discussion to include"),
    },
    async ({ models, prompt, context }) => {
      try {
        const modelIds =
          models.length > 0 ? models : config.defaultModels;
        const messages = [];
        if (context) {
          messages.push({
            role: "system" as const,
            content: `Previous discussion context:\n${context}`,
          });
        }
        messages.push({ role: "user" as const, content: prompt });

        const results = await registry.chatParallel(modelIds, messages);

        const lines: string[] = [];
        for (const result of results) {
          if (result.status === "success") {
            const r = result.response;
            lines.push(`### ${r.model} (${r.durationMs}ms)\n`);
            lines.push(r.content);
            lines.push("");
          } else {
            lines.push(`### ${result.error.model} [ERROR]\n`);
            lines.push(result.error.error);
            lines.push("");
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: deep_research
  server.tool(
    "deep_research",
    "Run ChatGPT Deep Research on a query. Performs in-depth web research using ChatGPT's Deep Research mode (5-15 min). Returns comprehensive results with sources. Note: blocks other ChatGPT operations during research.",
    {
      query: z.string().describe("The research query or question to investigate"),
      timeout_minutes: z
        .number()
        .int()
        .min(5)
        .max(30)
        .optional()
        .describe("Maximum time to wait in minutes (5-30). Defaults to 30."),
    },
    async ({ query, timeout_minutes }, extra) => {
      try {
        const timeoutMs = (timeout_minutes ?? 30) * 60 * 1_000;
        let step = 0;
        const progressToken = extra._meta?.progressToken;

        const chatgptConfig = Object.entries(config.providers).find(
          ([, p]) => p.type === "chatgpt-web",
        );

        const provider = new PlaywrightProvider({
          service: chatgptConfig?.[1].service ?? "chatgpt",
          profileDir: chatgptConfig?.[1].profileDir,
          headless: chatgptConfig?.[1].headless,
        });

        try {
          const result = await provider.deepResearch(
            query,
            timeoutMs,
            (status) => {
              step++;
              if (progressToken != null) {
                extra.sendNotification({
                  method: "notifications/progress",
                  params: {
                    progressToken,
                    progress: step,
                    message: `[${status.phase}] ${status.message} (${Math.round(status.elapsedMs / 1000)}s)`,
                  },
                });
              }
            },
          );

          return {
            content: [
              {
                type: "text" as const,
                text: formatDeepResearchResult(result),
              },
            ],
          };
        } finally {
          await provider.close();
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Deep Research error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Graceful shutdown: close all providers (browser pages, etc.)
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      log.info(`Received ${signal}, closing providers...`);
      await registry.closeAll();
      process.exit(0);
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("LLM Council MCP server running on stdio");
}

main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
