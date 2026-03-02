import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { loadConfig } from "./config.js";
import { CouncilOrchestrator } from "./orchestrator/council.js";
import { RoundtableOrchestrator } from "./orchestrator/roundtable.js";
import { ProviderRegistry } from "./providers/registry.js";
import type { CouncilResult, RoundtableResult } from "./types.js";
import { log } from "./logger.js";

function formatCouncilResult(result: CouncilResult): string {
  const lines: string[] = [];

  lines.push(`# Council Discussion\n`);
  lines.push(`**Question:** ${result.question}\n`);

  // Stage 1
  lines.push(`## Stage 1: Individual Opinions\n`);
  for (const r of result.stage1) {
    lines.push(`### ${r.model} (${r.durationMs}ms)\n`);
    lines.push(r.content);
    lines.push("");
  }

  // Stage 2 - Rankings
  lines.push(`## Stage 2: Peer Rankings\n`);
  if (result.metadata.aggregateRankings.length > 0) {
    lines.push("| Rank | Model | Avg Score |");
    lines.push("|------|-------|-----------|");
    for (const r of result.metadata.aggregateRankings) {
      lines.push(`| ${r.averageRank.toFixed(1)} | ${r.model} | ${r.rankingsCount} evaluations |`);
    }
    lines.push("");
  }

  // Stage 3
  lines.push(`## Stage 3: Chairman's Synthesis\n`);
  lines.push(`*Synthesized by ${result.stage3.model}*\n`);
  lines.push(result.stage3.content);
  lines.push("");

  lines.push(`---\n*Total time: ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s*`);

  return lines.join("\n");
}

function formatRoundtableResult(result: RoundtableResult): string {
  const lines: string[] = [];

  lines.push(`# Roundtable Discussion\n`);
  lines.push(`**Question:** ${result.question}\n`);
  lines.push(`**Participants:** ${result.metadata.models.join(", ")}\n`);

  for (let i = 0; i < result.rounds.length; i++) {
    lines.push(`## Round ${i + 1}\n`);
    for (const entry of result.rounds[i]) {
      lines.push(`### ${entry.model}\n`);
      lines.push(entry.response);
      lines.push("");
    }
  }

  lines.push(`## Summary\n`);
  lines.push(`*Summarized by ${result.summary.model}*\n`);
  lines.push(result.summary.content);
  lines.push("");

  lines.push(`---\n*Total time: ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s*`);

  return lines.join("\n");
}

async function main() {
  const config = await loadConfig();

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
        const orchestrator = new CouncilOrchestrator(config);
        const result = await orchestrator.discuss(question, models, chairman);
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
        const orchestrator = new RoundtableOrchestrator(config);
        const result = await orchestrator.discuss(
          question,
          models,
          rounds ?? 2,
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

  // Tool: list_models
  server.tool(
    "list_models",
    "List all available models from configured providers.",
    {},
    async () => {
      try {
        const registry = new ProviderRegistry(config);
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
        const registry = new ProviderRegistry(config);
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
        const registry = new ProviderRegistry(config);
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("LLM Council MCP server running on stdio");
}

main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
