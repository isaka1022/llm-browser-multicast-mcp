import { useMemo } from "react";
import type { SessionEvent } from "../types";
import { PhaseNode } from "./PhaseNode";
import { ModelCard } from "./ModelCard";
import { RankingChart } from "./RankingChart";

interface TimelineProps {
  events: SessionEvent[];
}

interface PhaseData {
  phase: string;
  label: string;
  models: Map<string, {
    status: "thinking" | "done" | "error";
    content?: string;
    durationMs?: number;
    error?: string;
  }>;
  rankings?: Array<{ model: string; averageRank: number; rankingsCount: number }>;
  synthesis?: { model: string; content: string; durationMs: number };
  consensus?: boolean;
}

export function Timeline({ events }: TimelineProps) {
  const { sessionStart, phases, sessionEnd } = useMemo(() => {
    let sessionStart: Extract<SessionEvent, { type: "session_start" }> | null = null;
    let sessionEnd: Extract<SessionEvent, { type: "session_end" }> | null = null;
    const phases = new Map<string, PhaseData>();

    for (const event of events) {
      switch (event.type) {
        case "session_start":
          sessionStart = event;
          break;
        case "session_end":
          sessionEnd = event;
          break;
        case "phase_start":
          if (!phases.has(event.phase)) {
            phases.set(event.phase, {
              phase: event.phase,
              label: event.label,
              models: new Map(),
            });
          }
          break;
        case "model_thinking": {
          const p = phases.get(event.phase);
          if (p && !p.models.has(event.model)) {
            p.models.set(event.model, { status: "thinking" });
          }
          break;
        }
        case "model_response": {
          const p = phases.get(event.phase);
          if (p) {
            p.models.set(event.model, {
              status: "done",
              content: event.content,
              durationMs: event.durationMs,
            });
          }
          break;
        }
        case "model_error": {
          const p = phases.get(event.phase);
          if (p) {
            p.models.set(event.model, {
              status: "error",
              error: event.error,
            });
          }
          break;
        }
        case "ranking":
          // Rankings are shown via aggregate_rankings
          break;
        case "aggregate_rankings": {
          // Find the ranking phase (stage2 for council)
          for (const [, p] of phases) {
            if (p.phase.includes("stage2") || p.phase.includes("ranking")) {
              p.rankings = event.rankings;
              break;
            }
          }
          // If no ranking phase found yet, attach to last phase
          if (phases.size > 0) {
            const lastPhase = [...phases.values()].at(-1)!;
            if (!lastPhase.rankings) {
              lastPhase.rankings = event.rankings;
            }
          }
          break;
        }
        case "consensus_check": {
          const lastPhase = [...phases.values()].at(-1);
          if (lastPhase) {
            lastPhase.consensus = event.result;
          }
          break;
        }
        case "synthesis": {
          const lastPhase = [...phases.values()].at(-1);
          if (lastPhase) {
            lastPhase.synthesis = event;
          }
          break;
        }
      }
    }

    return { sessionStart, phases: [...phases.values()], sessionEnd };
  }, [events]);

  if (!sessionStart) {
    return <div className="timeline-empty">No session data</div>;
  }

  const typeLabel = {
    council: "Council",
    roundtable: "Roundtable",
    debate: "Debate",
  }[sessionStart.discussionType] ?? sessionStart.discussionType;

  return (
    <div className="timeline">
      {/* Session header */}
      <PhaseNode
        label={`${typeLabel} Session`}
        completed={!!sessionEnd}
        active={!sessionEnd}
      >
        <div className="session-info">
          <p className="session-question">{sessionStart.question}</p>
          <div className="session-models">
            {sessionStart.models.map((m) => (
              <span key={m} className="model-tag">{m.split("/")[0]}</span>
            ))}
          </div>
        </div>
      </PhaseNode>

      {/* Phases */}
      {phases.map((phase) => {
        const allDone = [...phase.models.values()].every(
          (m) => m.status === "done" || m.status === "error",
        );
        const hasActivity = phase.models.size > 0 || phase.synthesis || phase.rankings;

        return (
          <PhaseNode
            key={phase.phase}
            label={phase.label}
            completed={allDone && hasActivity}
            active={!allDone && hasActivity}
          >
            {/* Model cards */}
            {[...phase.models.entries()].map(([model, data]) => (
              <ModelCard
                key={`${phase.phase}-${model}`}
                model={model}
                content={data.content}
                durationMs={data.durationMs}
                status={data.status}
                error={data.error}
              />
            ))}

            {/* Consensus indicator */}
            {phase.consensus != null && (
              <div className={`consensus-badge ${phase.consensus ? "agree" : "disagree"}`}>
                {phase.consensus ? "Consensus reached" : "No consensus"}
              </div>
            )}

            {/* Rankings */}
            {phase.rankings && <RankingChart rankings={phase.rankings} />}

            {/* Synthesis */}
            {phase.synthesis && (
              <ModelCard
                model={phase.synthesis.model}
                content={phase.synthesis.content}
                durationMs={phase.synthesis.durationMs}
                status="done"
                role="chairman"
              />
            )}
          </PhaseNode>
        );
      })}

      {/* Session end */}
      {sessionEnd && (
        <PhaseNode label={`Complete (${(sessionEnd.totalDurationMs / 1000).toFixed(1)}s)`} completed />
      )}
    </div>
  );
}
