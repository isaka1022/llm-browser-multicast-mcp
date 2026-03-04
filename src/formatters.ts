import type { CouncilResult, RoundtableResult, DebateResult } from "./types.js";
import type { DeepResearchResult } from "./providers/playwright/types.js";

export function formatCouncilResult(result: CouncilResult): string {
  const lines: string[] = [];

  lines.push(`# Council Discussion\n`);
  lines.push(`**Question:** ${result.question}\n`);

  // Stage 1
  lines.push(`## Stage 1: Individual Opinions\n`);
  for (const r of result.stage1) {
    lines.push(`### ${r.model} (${r.durationMs}ms)\n`);
    lines.push(r.content);
    lines.push("");
  }

  // Stage 2 - Rankings
  lines.push(`## Stage 2: Peer Rankings\n`);
  if (result.metadata.aggregateRankings.length > 0) {
    lines.push("| Rank | Model | Avg Score |");
    lines.push("|------|-------|-----------|");
    for (const r of result.metadata.aggregateRankings) {
      lines.push(`| ${r.averageRank.toFixed(1)} | ${r.model} | ${r.rankingsCount} evaluations |`);
    }
    lines.push("");
  }

  // Stage 3
  lines.push(`## Stage 3: Chairman's Synthesis\n`);
  lines.push(`*Synthesized by ${result.stage3.model}*\n`);
  lines.push(result.stage3.content);
  lines.push("");

  lines.push(`---\n*Total time: ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s*`);

  return lines.join("\n");
}

export function formatRoundtableResult(result: RoundtableResult): string {
  const lines: string[] = [];

  lines.push(`# Roundtable Discussion\n`);
  lines.push(`**Question:** ${result.question}\n`);
  lines.push(`**Participants:** ${result.metadata.models.join(", ")}\n`);

  for (let i = 0; i < result.rounds.length; i++) {
    lines.push(`## Round ${i + 1}\n`);
    for (const entry of result.rounds[i]) {
      lines.push(`### ${entry.model}\n`);
      lines.push(entry.response);
      lines.push("");
    }
  }

  lines.push(`## Summary\n`);
  lines.push(`*Summarized by ${result.summary.model}*\n`);
  lines.push(result.summary.content);
  lines.push("");

  lines.push(`---\n*Total time: ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s*`);

  return lines.join("\n");
}

export function formatDebateResult(result: DebateResult): string {
  const lines: string[] = [];

  lines.push(`# Debate\n`);
  lines.push(`**Topic:** ${result.question}\n`);
  lines.push(`**Participants:** ${result.metadata.models.join(", ")}\n`);

  // Phase 1
  lines.push(`## Phase 1: Initial Stances\n`);
  for (const stance of result.phase1) {
    lines.push(`### ${stance.model}\n`);
    lines.push(stance.stance);
    lines.push("");
  }

  if (result.metadata.earlyConsensus) {
    lines.push(`> **Early Consensus:** All participants were in substantial agreement. Discussion phase was skipped.\n`);
  } else {
    // Phase 2
    lines.push(`## Phase 2: Discussion (${result.metadata.totalRounds} rounds)\n`);
    for (let r = 1; r <= result.metadata.totalRounds; r++) {
      const roundTurns = result.phase2.filter((t) => t.round === r);
      if (roundTurns.length > 0) {
        lines.push(`### Round ${r}\n`);
        for (const turn of roundTurns) {
          lines.push(`#### ${turn.model}\n`);
          lines.push(turn.response);
          lines.push("");
        }
      }
    }

    // Phase 3
    lines.push(`## Phase 3: Final Stances\n`);
    for (const stance of result.phase3) {
      lines.push(`### ${stance.model}\n`);
      lines.push(stance.stance);
      lines.push("");
    }
  }

  // Phase 4
  lines.push(`## Phase 4: Synthesis\n`);
  lines.push(`*Synthesized by ${result.phase4.model}*\n`);
  lines.push(result.phase4.content);
  lines.push("");

  // Token usage summary
  const usage = result.metadata.tokenUsage;
  lines.push(`---`);
  lines.push(`*Total time: ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s*\n`);
  lines.push(`### Token Usage${usage.total.estimated ? " (includes estimates)" : ""}`);
  lines.push(`| Phase | Input | Output | Total |`);
  lines.push(`|-------|-------|--------|-------|`);
  lines.push(`| Phase 1 | ${usage.phase1.inputTokens} | ${usage.phase1.outputTokens} | ${usage.phase1.inputTokens + usage.phase1.outputTokens} |`);
  lines.push(`| Phase 2 | ${usage.phase2.inputTokens} | ${usage.phase2.outputTokens} | ${usage.phase2.inputTokens + usage.phase2.outputTokens} |`);
  lines.push(`| Phase 3 | ${usage.phase3.inputTokens} | ${usage.phase3.outputTokens} | ${usage.phase3.inputTokens + usage.phase3.outputTokens} |`);
  lines.push(`| Phase 4 | ${usage.phase4.inputTokens} | ${usage.phase4.outputTokens} | ${usage.phase4.inputTokens + usage.phase4.outputTokens} |`);
  lines.push(`| **Total** | **${usage.total.inputTokens}** | **${usage.total.outputTokens}** | **${usage.total.inputTokens + usage.total.outputTokens}** |`);

  return lines.join("\n");
}

export function formatDeepResearchResult(result: DeepResearchResult): string {
  const lines: string[] = [];

  lines.push("# Deep Research Result\n");
  lines.push(result.content);
  lines.push("");

  if (result.sources.length > 0) {
    lines.push("## Sources\n");
    for (const source of result.sources) {
      lines.push(`- [${source.title || source.url}](${source.url})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Research time: ${(result.durationMs / 1000).toFixed(1)}s*`);

  return lines.join("\n");
}
