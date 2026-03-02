export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelResponse {
  model: string;
  content: string;
  durationMs: number;
}

export interface ModelError {
  model: string;
  error: string;
}

export type ModelResult =
  | { status: "success"; response: ModelResponse }
  | { status: "error"; error: ModelError };

export interface RankingResult {
  model: string;
  evaluation: string;
  parsedRanking: string[];
}

export interface AggregateRanking {
  model: string;
  averageRank: number;
  rankingsCount: number;
}

export interface CouncilResult {
  question: string;
  stage1: ModelResponse[];
  stage2: RankingResult[];
  stage3: ModelResponse;
  metadata: {
    labelToModel: Record<string, string>;
    aggregateRankings: AggregateRanking[];
    totalDurationMs: number;
  };
}

export interface RoundtableRound {
  model: string;
  response: string;
}

export interface RoundtableResult {
  question: string;
  rounds: RoundtableRound[][];
  summary: ModelResponse;
  metadata: {
    totalRounds: number;
    models: string[];
    totalDurationMs: number;
  };
}

export type ProviderType =
  | "ollama"
  | "openai-compatible"
  | "anthropic"
  | "gemini-api"
  | "grok-api"
  | "gemini-cli"
  | "codex-cli"
  | "claude-cli";

export interface ProviderConfig {
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  models: string[];
}

export interface CouncilConfig {
  providers: Record<string, ProviderConfig>;
  defaultModels: string[];
  chairman: string;
  timeoutMs: number;
}
