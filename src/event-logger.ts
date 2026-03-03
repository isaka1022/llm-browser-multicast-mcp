import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AggregateRanking } from "./types.js";

const SESSIONS_DIR = resolve(process.cwd(), "logs", "sessions");

try {
  mkdirSync(SESSIONS_DIR, { recursive: true });
} catch {
  // ignore
}

export type DiscussionType = "council" | "roundtable" | "debate";

export type SessionEvent =
  | { type: "session_start"; discussionType: DiscussionType; question: string; models: string[]; chairman?: string; timestamp: string }
  | { type: "phase_start"; phase: string; label: string }
  | { type: "model_thinking"; phase: string; model: string }
  | { type: "model_response"; phase: string; model: string; content: string; durationMs: number }
  | { type: "model_error"; phase: string; model: string; error: string }
  | { type: "ranking"; model: string; evaluation: string; parsedRanking: string[] }
  | { type: "aggregate_rankings"; rankings: AggregateRanking[]; labelToModel: Record<string, string> }
  | { type: "consensus_check"; result: boolean }
  | { type: "synthesis"; model: string; content: string; durationMs: number }
  | { type: "session_end"; totalDurationMs: number };

export class EventLogger {
  readonly sessionId: string;
  private readonly filePath: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? randomUUID();
    this.filePath = resolve(SESSIONS_DIR, `${this.sessionId}.jsonl`);
  }

  emit(event: SessionEvent): void {
    const line = JSON.stringify({ ...event, _ts: Date.now() }) + "\n";
    appendFileSync(this.filePath, line);
  }

  get path(): string {
    return this.filePath;
  }
}
