// Mirror of extension/types.ts for the webview side
// Keep in sync manually (shared types between extension and webview)

export interface SessionMeta {
  sessionId: string;
  discussionType: string;
  question: string;
  models: string[];
  timestamp: string;
  completed: boolean;
}

export type SessionEvent =
  | { type: "session_start"; discussionType: string; question: string; models: string[]; chairman?: string; timestamp: string }
  | { type: "phase_start"; phase: string; label: string }
  | { type: "model_thinking"; phase: string; model: string }
  | { type: "model_response"; phase: string; model: string; content: string; durationMs: number }
  | { type: "model_error"; phase: string; model: string; error: string }
  | { type: "ranking"; model: string; evaluation: string; parsedRanking: string[] }
  | { type: "aggregate_rankings"; rankings: Array<{ model: string; averageRank: number; rankingsCount: number }>; labelToModel: Record<string, string> }
  | { type: "consensus_check"; result: boolean }
  | { type: "synthesis"; model: string; content: string; durationMs: number }
  | { type: "session_end"; totalDurationMs: number };

export type ExtToWebviewMessage =
  | { type: "session_list"; sessions: SessionMeta[] }
  | { type: "session_event"; sessionId: string; event: SessionEvent }
  | { type: "session_loaded"; sessionId: string; events: SessionEvent[] };
