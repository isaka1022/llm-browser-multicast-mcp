import { spawn } from "node:child_process";
import type { ChatMessage, ModelResponse, TokenUsage } from "../types.js";
import type { LLMProvider } from "./base.js";
import { log } from "../logger.js";

interface CLIProviderOptions {
  name: string;
  command: string;
  buildArgs: (prompt: string) => string[];
  parseOutput?: (stdout: string) => string;
  envOverrides?: Record<string, string | undefined>;
}

function messagesToPrompt(messages: ChatMessage[]): string {
  return messages.map((m) => m.content).join("\n\n");
}

function runCLI(
  command: string,
  args: string[],
  timeoutMs: number,
  envOverrides?: Record<string, string | undefined>,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...envOverrides };
    // Remove keys explicitly set to undefined
    for (const [key, val] of Object.entries(envOverrides ?? {})) {
      if (val === undefined) delete env[key];
    }
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`CLI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `CLI exited with code ${code}: ${stderr || stdout}`.slice(0, 500),
          ),
        );
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`CLI spawn error: ${err.message}`));
    });

    child.stdin.end();
  });
}

export class CLIProvider implements LLMProvider {
  constructor(private readonly options: CLIProviderOptions) {}

  async chat(
    model: string,
    messages: ChatMessage[],
    timeoutMs: number,
  ): Promise<ModelResponse> {
    const start = Date.now();
    const prompt = messagesToPrompt(messages);
    const args = this.options.buildArgs(prompt);

    log.info(`CLI call: ${this.options.command} ${this.options.name}/${model}`);

    const { stdout } = await runCLI(
      this.options.command,
      args,
      timeoutMs,
      this.options.envOverrides,
    );
    const content = this.options.parseOutput
      ? this.options.parseOutput(stdout)
      : stdout.trim();

    if (!content) {
      throw new Error(`${this.options.name}: empty response`);
    }

    const usage: TokenUsage = {
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil(content.length / 4),
      estimated: true,
    };

    return {
      model: `${this.options.name}/${model}`,
      content,
      durationMs: Date.now() - start,
      usage,
    };
  }

  async listModels(): Promise<string[]> {
    return [`${this.options.name}/default`];
  }
}

export function createGeminiCLI(): CLIProvider {
  return new CLIProvider({
    name: "gemini-cli",
    command: "gemini",
    buildArgs: (prompt) => ["-p", prompt],
  });
}

export function createCodexCLI(): CLIProvider {
  return new CLIProvider({
    name: "codex-cli",
    command: "codex",
    buildArgs: (prompt) => ["exec", prompt, "--json"],
    parseOutput: (stdout) => {
      try {
        const parsed = JSON.parse(stdout) as { output?: string; text?: string };
        return parsed.output ?? parsed.text ?? stdout.trim();
      } catch {
        return stdout.trim();
      }
    },
  });
}

export function createClaudeCLI(): CLIProvider {
  return new CLIProvider({
    name: "claude-cli",
    command: "claude",
    buildArgs: (prompt) => ["-p", prompt, "--output-format", "text"],
    envOverrides: { CLAUDECODE: undefined },
  });
}
