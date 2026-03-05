import type {
  CouncilConfig,
  CouncilResult,
  ModelResponse,
  AggregateRanking,
  RankingResult,
} from "../types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { log } from "../logger.js";
import type { EventLogger } from "../event-logger.js";
import {
  buildRankingPrompt,
  buildSynthesisPrompt,
  createLabelMapping,
  parseRanking,
} from "./prompts.js";

export class CouncilOrchestrator {
  private registry: ProviderRegistry;

  constructor(
    private readonly config: CouncilConfig,
    registry?: ProviderRegistry,
  ) {
    this.registry = registry ?? new ProviderRegistry(config);
  }

  async discuss(
    question: string,
    models?: string[],
    chairman?: string,
    eventLogger?: EventLogger,
  ): Promise<CouncilResult> {
    const councilModels = models ?? this.config.defaultModels;
    const chairmanModel = chairman ?? this.config.chairman;
    const totalStart = Date.now();
    const emit = eventLogger ? (e: Parameters<EventLogger["emit"]>[0]) => eventLogger.emit(e) : () => {};

    emit({ type: "session_start", discussionType: "council", question, models: councilModels, chairman: chairmanModel, timestamp: new Date().toISOString() });

    // Stage 1: Collect opinions in parallel
    log.stage("Council",`Stage 1: Querying ${councilModels.length} models...`);
    emit({ type: "phase_start", phase: "stage1", label: "Individual Opinions" });
    for (const m of councilModels) {
      emit({ type: "model_thinking", phase: "stage1", model: m });
    }
    const stage1Results = await this.registry.chatParallel(councilModels, [
      { role: "user", content: question },
    ]);

    const successfulResponses: ModelResponse[] = [];
    const errors: string[] = [];
    for (const result of stage1Results) {
      if (result.status === "success") {
        successfulResponses.push(result.response);
        emit({ type: "model_response", phase: "stage1", model: result.response.model, content: result.response.content, durationMs: result.response.durationMs });
      } else {
        errors.push(`${result.error.model}: ${result.error.error}`);
        emit({ type: "model_error", phase: "stage1", model: result.error.model, error: result.error.error });
      }
    }

    if (successfulResponses.length < 2) {
      throw new Error(
        `Need at least 2 successful responses for council. Got ${successfulResponses.length}. Errors: ${errors.join("; ")}`,
      );
    }

    log.stage("Council",
      `Stage 1 complete: ${successfulResponses.length} responses`,
    );

    // Create anonymous label mapping
    const labelToModel = createLabelMapping(successfulResponses);
    const labels = Object.keys(labelToModel);

    // Stage 2: Peer review & ranking in parallel
    log.stage("Council",`Stage 2: Peer review...`);
    emit({ type: "phase_start", phase: "stage2", label: "Peer Review & Ranking" });
    const rankingPrompt = buildRankingPrompt(
      question,
      successfulResponses,
      labelToModel,
    );

    const stage2Results = await this.registry.chatParallel(
      councilModels.filter((m) =>
        successfulResponses.some((r) => r.model === m),
      ),
      [{ role: "user", content: rankingPrompt }],
    );

    const rankings: RankingResult[] = [];
    for (const result of stage2Results) {
      if (result.status === "success") {
        rankings.push({
          model: result.response.model,
          evaluation: result.response.content,
          parsedRanking: parseRanking(result.response.content, labels),
        });
        emit({ type: "ranking", model: result.response.model, evaluation: result.response.content, parsedRanking: parseRanking(result.response.content, labels) });
      }
    }

    log.stage("Council",
      `Stage 2 complete: ${rankings.length} evaluations`,
    );

    // Calculate aggregate rankings
    const aggregateRankings = this.calculateAggregateRankings(
      rankings,
      labelToModel,
    );
    emit({ type: "aggregate_rankings", rankings: aggregateRankings, labelToModel });

    // Stage 3: Chairman synthesis
    log.stage("Council",`Stage 3: Chairman synthesis (${chairmanModel})...`);
    emit({ type: "phase_start", phase: "stage3", label: "Chairman Synthesis" });
    emit({ type: "model_thinking", phase: "stage3", model: chairmanModel });
    const synthesisPrompt = buildSynthesisPrompt(
      question,
      successfulResponses,
      rankings,
      labelToModel,
    );

    const synthesis = await this.registry.chat(chairmanModel, [
      { role: "user", content: synthesisPrompt },
    ]);

    emit({ type: "synthesis", model: synthesis.model, content: synthesis.content, durationMs: synthesis.durationMs });

    log.stage("Council",`Complete.`);

    const totalDurationMs = Date.now() - totalStart;
    emit({ type: "session_end", totalDurationMs });

    return {
      question,
      stage1: successfulResponses,
      stage2: rankings,
      stage3: synthesis,
      metadata: {
        labelToModel,
        aggregateRankings,
        totalDurationMs,
      },
    };
  }

  private calculateAggregateRankings(
    rankings: RankingResult[],
    labelToModel: Record<string, string>,
  ): AggregateRanking[] {
    const modelRanks = new Map<string, number[]>();

    for (const [label, model] of Object.entries(labelToModel)) {
      modelRanks.set(model, []);
      for (const ranking of rankings) {
        const position = ranking.parsedRanking.indexOf(label);
        if (position !== -1) {
          modelRanks.get(model)!.push(position + 1);
        }
      }
    }

    const aggregated: AggregateRanking[] = [];
    for (const [model, ranks] of modelRanks) {
      if (ranks.length > 0) {
        aggregated.push({
          model,
          averageRank: ranks.reduce((a, b) => a + b, 0) / ranks.length,
          rankingsCount: ranks.length,
        });
      }
    }

    return aggregated.sort((a, b) => a.averageRank - b.averageRank);
  }
}
