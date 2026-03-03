export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimated: boolean;
}

export interface ModelResponse {
  model: string;
  content: string;
  durationMs: number;
  usage?: TokenUsage;
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
  | "anthropic"
  | "gemini-api"
  | "grok-api"
  | "gemini-cli"
  | "codex-cli"
  | "claude-cli"
  | "chatgpt-web";

export interface ProviderConfig {
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  models: string[];
  // Playwright provider options
  service?: "chatgpt";
  storageStatePath?: string;
  headless?: boolean;
}

export interface CouncilConfig {
  providers: Record<string, ProviderConfig>;
  defaultModels: string[];
  chairman: string;
  timeoutMs: number;
}

// Debate types
export interface DebateStance {
  model: string;
  stance: string;
  usage?: TokenUsage;
}

export interface DebateDiscussionTurn {
  model: string;
  round: number;
  response: string;
  usage?: TokenUsage;
}

export interface DebateResult {
  question: string;
  phase1: DebateStance[];
  phase2: DebateDiscussionTurn[];
  phase3: DebateStance[];
  phase4: ModelResponse;
  metadata: {
    models: string[];
    totalRounds: number;
    earlyConsensus: boolean;
    totalDurationMs: number;
    tokenUsage: {
      phase1: TokenUsage;
      phase2: TokenUsage;
      phase3: TokenUsage;
      phase4: TokenUsage;
      total: TokenUsage;
    };
  };
}
