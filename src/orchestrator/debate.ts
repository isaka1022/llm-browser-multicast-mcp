import type {
  CouncilConfig,
  DebateResult,
  DebateStance,
  DebateDiscussionTurn,
  TokenUsage,
} from "../types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { log } from "../logger.js";
import {
  buildDebateStancePrompt,
  buildDebateAgreementCheckPrompt,
  buildDebateDiscussionPrompt,
  buildDebateFinalStancePrompt,
  buildDebateSynthesisPrompt,
} from "./prompts.js";

function sumTokenUsage(usages: (TokenUsage | undefined)[]): TokenUsage {
  const result: TokenUsage = { inputTokens: 0, outputTokens: 0, estimated: false };
  for (const u of usages) {
    if (!u) continue;
    result.inputTokens += u.inputTokens;
    result.outputTokens += u.outputTokens;
    if (u.estimated) result.estimated = true;
  }
  return result;
}

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, estimated: false };
}

export class DebateOrchestrator {
  private registry: ProviderRegistry;

  constructor(private readonly config: CouncilConfig) {
    this.registry = new ProviderRegistry(config);
  }

  async discuss(
    topic: string,
    models?: string[],
    rounds = 3,
  ): Promise<DebateResult> {
    const participants = models ?? this.config.defaultModels;
    const chairmanModel = this.config.chairman;
    const totalStart = Date.now();

    // Phase 1: Initial Stances (parallel)
    log.stage("Debate", `Phase 1: Collecting initial stances from ${participants.length} models...`);
    const stancePrompt = buildDebateStancePrompt(topic);
    const phase1Results = await this.registry.chatParallel(participants, [
      { role: "user", content: stancePrompt },
    ]);

    const initialStances: DebateStance[] = [];
    for (const result of phase1Results) {
      if (result.status === "success") {
        initialStances.push({
          model: result.response.model,
          stance: result.response.content,
          usage: result.response.usage,
        });
      } else {
        log.error(`Debate Phase 1: ${result.error.model} failed: ${result.error.error}`);
      }
    }

    if (initialStances.length < 2) {
      throw new Error(
        `Need at least 2 successful stances for debate. Got ${initialStances.length}.`,
      );
    }

    const phase1Usage = sumTokenUsage(initialStances.map((s) => s.usage));
    log.stage("Debate", `Phase 1 complete: ${initialStances.length} stances collected`);

    // Check for early consensus using chairman
    log.stage("Debate", "Checking for consensus...");
    const agreementPrompt = buildDebateAgreementCheckPrompt(topic, initialStances);
    const agreementCheck = await this.registry.chat(chairmanModel, [
      { role: "user", content: agreementPrompt },
    ]);

    const phase1TotalUsage = sumTokenUsage([phase1Usage, agreementCheck.usage]);
    const earlyConsensus = /VERDICT:\s*AGREE/i.test(agreementCheck.content);

    let discussionTurns: DebateDiscussionTurn[] = [];
    let finalStances: DebateStance[] = [];
    let phase2Usage = emptyUsage();
    let phase3Usage = emptyUsage();

    if (earlyConsensus) {
      log.stage("Debate", "Consensus detected — skipping to synthesis");
    } else {
      // Phase 2: Discussion (sequential rounds)
      log.stage("Debate", `Phase 2: Discussion (${rounds} rounds)...`);
      discussionTurns = await this.runDiscussion(topic, initialStances, participants, rounds);
      phase2Usage = sumTokenUsage(discussionTurns.map((t) => t.usage));
      log.stage("Debate", `Phase 2 complete: ${discussionTurns.length} turns`);

      // Phase 3: Final Stances (parallel)
      log.stage("Debate", "Phase 3: Collecting final stances...");
      finalStances = await this.collectFinalStances(topic, initialStances, discussionTurns, participants);
      phase3Usage = sumTokenUsage(finalStances.map((s) => s.usage));
      log.stage("Debate", `Phase 3 complete: ${finalStances.length} final stances`);
    }

    // Phase 4: Synthesis
    log.stage("Debate", `Phase 4: Chairman synthesis (${chairmanModel})...`);
    const synthesisPrompt = buildDebateSynthesisPrompt(
      topic,
      initialStances,
      discussionTurns.map((t) => ({ model: t.model, response: t.response, round: t.round })),
      finalStances,
      earlyConsensus,
    );

    const synthesis = await this.registry.chat(chairmanModel, [
      { role: "user", content: synthesisPrompt },
    ]);
    const phase4Usage = synthesis.usage ?? emptyUsage();

    log.stage("Debate", "Complete.");

    const totalUsage = sumTokenUsage([phase1TotalUsage, phase2Usage, phase3Usage, phase4Usage]);

    return {
      question: topic,
      phase1: initialStances,
      phase2: discussionTurns,
      phase3: finalStances,
      phase4: synthesis,
      metadata: {
        models: participants,
        totalRounds: earlyConsensus ? 0 : rounds,
        earlyConsensus,
        totalDurationMs: Date.now() - totalStart,
        tokenUsage: {
          phase1: phase1TotalUsage,
          phase2: phase2Usage,
          phase3: phase3Usage,
          phase4: phase4Usage,
          total: totalUsage,
        },
      },
    };
  }

  private async runDiscussion(
    topic: string,
    initialStances: DebateStance[],
    participants: string[],
    rounds: number,
  ): Promise<DebateDiscussionTurn[]> {
    const allTurns: DebateDiscussionTurn[] = [];

    // Seed history with initial stances
    const history: Array<{ model: string; response: string }> = initialStances.map((s) => ({
      model: s.model,
      response: s.stance,
    }));

    for (let round = 1; round <= rounds; round++) {
      log.stage("Debate", `Round ${round}/${rounds}...`);

      for (const modelId of participants) {
        const currentHistory = [
          ...history,
          ...allTurns.map((t) => ({ model: t.model, response: t.response })),
        ];

        const prompt = buildDebateDiscussionPrompt(topic, currentHistory, modelId);

        try {
          const result = await this.registry.chat(modelId, [
            { role: "user", content: prompt },
          ]);
          log.stage("Debate", `${result.model} responded (${result.durationMs}ms)`);
          allTurns.push({
            model: result.model,
            round,
            response: result.content,
            usage: result.usage,
          });
        } catch (err) {
          log.error(
            `Debate: ${modelId} failed in round ${round}: ${err instanceof Error ? err.message : err}`,
          );
          allTurns.push({
            model: modelId,
            round,
            response: `[Error: ${err instanceof Error ? err.message : "Unknown error"}]`,
          });
        }
      }
    }

    return allTurns;
  }

  private async collectFinalStances(
    topic: string,
    initialStances: DebateStance[],
    discussionTurns: DebateDiscussionTurn[],
    participants: string[],
  ): Promise<DebateStance[]> {
    const allTurns: Array<{ model: string; response: string }> = [
      ...initialStances.map((s) => ({ model: s.model, response: s.stance })),
      ...discussionTurns.map((t) => ({ model: t.model, response: t.response })),
    ];

    const finalPrompt = buildDebateFinalStancePrompt(topic, allTurns);
    const results = await this.registry.chatParallel(participants, [
      { role: "user", content: finalPrompt },
    ]);

    const stances: DebateStance[] = [];
    for (const result of results) {
      if (result.status === "success") {
        stances.push({
          model: result.response.model,
          stance: result.response.content,
          usage: result.response.usage,
        });
      } else {
        log.error(`Debate Phase 3: ${result.error.model} failed: ${result.error.error}`);
      }
    }

    return stances;
  }
}
