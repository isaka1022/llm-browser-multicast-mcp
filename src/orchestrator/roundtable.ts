import type {
  CouncilConfig,
  RoundtableResult,
  RoundtableRound,
} from "../types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { log } from "../logger.js";
import type { EventLogger } from "../event-logger.js";
import {
  buildRoundtablePrompt,
  buildRoundtableSummaryPrompt,
} from "./prompts.js";

export class RoundtableOrchestrator {
  private registry: ProviderRegistry;

  constructor(private readonly config: CouncilConfig) {
    this.registry = new ProviderRegistry(config);
  }

  async discuss(
    question: string,
    models?: string[],
    rounds = 2,
    eventLogger?: EventLogger,
  ): Promise<RoundtableResult> {
    const participants = models ?? this.config.defaultModels;
    const totalStart = Date.now();
    const allRounds: RoundtableRound[][] = [];
    const emit = eventLogger ? (e: Parameters<EventLogger["emit"]>[0]) => eventLogger.emit(e) : () => {};

    emit({ type: "session_start", discussionType: "roundtable", question, models: participants, chairman: this.config.chairman, timestamp: new Date().toISOString() });

    for (let round = 0; round < rounds; round++) {
      log.stage("Roundtable", `Round ${round + 1}/${rounds}...`);
      emit({ type: "phase_start", phase: `round${round + 1}`, label: `Round ${round + 1}/${rounds}` });
      const roundResponses: RoundtableRound[] = [];

      // Build cumulative history from all previous rounds + current round
      const previousResponses: Array<{ model: string; response: string }> = [];
      for (const pastRound of allRounds) {
        for (const entry of pastRound) {
          previousResponses.push(entry);
        }
      }

      for (const modelId of participants) {
        // Include this round's earlier responses too
        const allPrevious = [
          ...previousResponses,
          ...roundResponses.map((r) => ({
            model: r.model,
            response: r.response,
          })),
        ];

        const prompt = buildRoundtablePrompt(
          question,
          allPrevious,
          modelId,
        );

        emit({ type: "model_thinking", phase: `round${round + 1}`, model: modelId });

        try {
          const result = await this.registry.chat(modelId, [
            { role: "user", content: prompt },
          ]);
          log.stage("Roundtable", `${result.model} responded (${result.durationMs}ms)`);
          roundResponses.push({
            model: result.model,
            response: result.content,
          });
          emit({ type: "model_response", phase: `round${round + 1}`, model: result.model, content: result.content, durationMs: result.durationMs });
        } catch (err) {
          log.error(
            `Roundtable: ${modelId} failed: ${err instanceof Error ? err.message : err}`,
          );
          roundResponses.push({
            model: modelId,
            response: `[Error: ${err instanceof Error ? err.message : "Unknown error"}]`,
          });
          emit({ type: "model_error", phase: `round${round + 1}`, model: modelId, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      allRounds.push(roundResponses);
    }

    // Summary by chairman
    log.stage("Roundtable", "Generating summary...");
    emit({ type: "phase_start", phase: "summary", label: "Chairman Summary" });
    emit({ type: "model_thinking", phase: "summary", model: this.config.chairman });
    const summaryPrompt = buildRoundtableSummaryPrompt(
      question,
      allRounds.map((round) =>
        round.map((r) => ({ model: r.model, response: r.response })),
      ),
    );

    const summary = await this.registry.chat(
      this.config.chairman,
      [{ role: "user", content: summaryPrompt }],
    );

    emit({ type: "synthesis", model: summary.model, content: summary.content, durationMs: summary.durationMs });

    log.stage("Roundtable", "Complete.");

    const totalDurationMs = Date.now() - totalStart;
    emit({ type: "session_end", totalDurationMs });

    return {
      question,
      rounds: allRounds,
      summary,
      metadata: {
        totalRounds: rounds,
        models: participants,
        totalDurationMs,
      },
    };
  }
}
