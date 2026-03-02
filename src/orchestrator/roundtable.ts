import type {
  CouncilConfig,
  RoundtableResult,
  RoundtableRound,
} from "../types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { log } from "../logger.js";
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
  ): Promise<RoundtableResult> {
    const participants = models ?? this.config.defaultModels;
    const totalStart = Date.now();
    const allRounds: RoundtableRound[][] = [];

    for (let round = 0; round < rounds; round++) {
      log.stage("Roundtable", `Round ${round + 1}/${rounds}...`);
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

        try {
          const result = await this.registry.chat(modelId, [
            { role: "user", content: prompt },
          ]);
          log.stage("Roundtable", `${result.model} responded (${result.durationMs}ms)`);
          roundResponses.push({
            model: result.model,
            response: result.content,
          });
        } catch (err) {
          log.error(
            `Roundtable: ${modelId} failed: ${err instanceof Error ? err.message : err}`,
          );
          roundResponses.push({
            model: modelId,
            response: `[Error: ${err instanceof Error ? err.message : "Unknown error"}]`,
          });
        }
      }

      allRounds.push(roundResponses);
    }

    // Summary by chairman
    log.stage("Roundtable", "Generating summary...");
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

    log.stage("Roundtable", "Complete.");

    return {
      question,
      rounds: allRounds,
      summary,
      metadata: {
        totalRounds: rounds,
        models: participants,
        totalDurationMs: Date.now() - totalStart,
      },
    };
  }
}
