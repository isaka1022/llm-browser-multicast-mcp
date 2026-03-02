import type { ModelResponse } from "../types.js";

export function buildRankingPrompt(
  question: string,
  responses: ModelResponse[],
  labelToModel: Record<string, string>,
): string {
  const labels = Object.keys(labelToModel);

  const responsesSection = responses
    .map((r, i) => {
      const label = labels[i];
      return `### ${label}\n${r.content}`;
    })
    .join("\n\n---\n\n");

  return `You are evaluating multiple AI responses to a question. Each response is labeled anonymously.

## Question
${question}

## Responses

${responsesSection}

## Your Task

1. Evaluate each response individually, noting strengths and weaknesses.
2. Provide a final ranking from best to worst.

IMPORTANT: You MUST end your evaluation with a section in exactly this format:

FINAL RANKING:
1. ${labels[0]} or another label
2. ${labels[1]} or another label
${labels.slice(2).map((l, i) => `${i + 3}. ${l} or another label`).join("\n")}

Replace the labels with your actual ranking. Every response label must appear exactly once.`;
}

export function buildSynthesisPrompt(
  question: string,
  responses: ModelResponse[],
  rankings: Array<{ model: string; evaluation: string }>,
  labelToModel: Record<string, string>,
): string {
  const labels = Object.keys(labelToModel);

  const responsesSection = responses
    .map((r, i) => `### ${labels[i]}\n${r.content}`)
    .join("\n\n---\n\n");

  const rankingsSection = rankings
    .map((r) => `### Evaluator (${r.model})\n${r.evaluation}`)
    .join("\n\n---\n\n");

  return `You are the Chairman of an AI council. Your job is to synthesize the best possible answer by combining insights from multiple AI responses and their peer evaluations.

## Original Question
${question}

## Individual Responses

${responsesSection}

## Peer Evaluations & Rankings

${rankingsSection}

## Your Task

Synthesize a comprehensive, well-structured final answer that:
1. Incorporates the strongest points from all responses
2. Resolves any contradictions between responses
3. Addresses any gaps identified in the peer evaluations
4. Presents the information in a clear, organized manner

Provide your synthesized answer directly, without meta-commentary about the process.`;
}

export function buildRoundtablePrompt(
  question: string,
  previousResponses: Array<{ model: string; response: string }>,
  currentModel: string,
): string {
  if (previousResponses.length === 0) {
    return `You are participating in a roundtable discussion. Please provide your thoughtful perspective on the following question.

## Question
${question}

Provide your response directly.`;
  }

  const discussionSoFar = previousResponses
    .map((r) => `### ${r.model}\n${r.response}`)
    .join("\n\n---\n\n");

  return `You are participating in a roundtable discussion as ${currentModel}. Other participants have already shared their perspectives. Please build on, challenge, or add to the discussion.

## Question
${question}

## Discussion So Far

${discussionSoFar}

## Your Task

Provide your perspective, considering what has already been said. You may:
- Agree and expand on points others made
- Respectfully disagree with reasoning
- Introduce new angles not yet covered
- Synthesize or reconcile different viewpoints

Respond directly with your contribution.`;
}

export function buildRoundtableSummaryPrompt(
  question: string,
  rounds: Array<Array<{ model: string; response: string }>>,
): string {
  const discussionText = rounds
    .map(
      (round, i) =>
        `## Round ${i + 1}\n\n${round.map((r) => `### ${r.model}\n${r.response}`).join("\n\n---\n\n")}`,
    )
    .join("\n\n===\n\n");

  return `You are summarizing a roundtable discussion between multiple AI models.

## Original Question
${question}

## Full Discussion

${discussionText}

## Your Task

Provide a comprehensive summary that:
1. Captures the key points of agreement
2. Highlights areas of disagreement and the reasoning behind different positions
3. Notes how perspectives evolved across rounds
4. Presents a balanced conclusion

Provide your summary directly.`;
}

export function createLabelMapping(
  responses: ModelResponse[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  responses.forEach((r, i) => {
    const label = `Response ${String.fromCharCode(65 + i)}`;
    mapping[label] = r.model;
  });
  return mapping;
}

export function parseRanking(text: string, labels: string[]): string[] {
  const rankingMatch = text.match(/FINAL RANKING:\s*([\s\S]*?)$/i);
  if (!rankingMatch) return labels;

  const rankingText = rankingMatch[1];
  const parsed: string[] = [];
  const responsePattern = /Response\s+[A-Z]/gi;
  const matches = rankingText.matchAll(responsePattern);

  for (const match of matches) {
    const label = match[0].replace(/response\s+/i, "Response ");
    if (labels.includes(label) && !parsed.includes(label)) {
      parsed.push(label);
    }
  }

  if (parsed.length === labels.length) return parsed;
  return labels;
}

// Debate prompts

export function buildDebateStancePrompt(question: string): string {
  return `You are participating in a structured debate. State your position or perspective on the following topic.

## Topic
${question}

## Instructions
- Clearly state your stance or perspective
- Provide your key reasoning points
- Be specific and direct
- You are free to take any position — there is no assigned "side"

Provide your stance directly.`;
}

export function buildDebateAgreementCheckPrompt(
  question: string,
  stances: Array<{ model: string; stance: string }>,
): string {
  const stancesSection = stances
    .map((s, i) => `### Participant ${i + 1}\n${s.stance}`)
    .join("\n\n---\n\n");

  return `You are judging whether the following participants essentially agree on a topic, or whether there are meaningful differences that warrant further debate.

## Topic
${question}

## Stances

${stancesSection}

## Your Task
Determine whether these stances are in substantial agreement or have meaningful disagreements.

You MUST end your response with exactly one of these lines:
VERDICT: AGREE
VERDICT: DISAGREE`;
}

export function buildDebateDiscussionPrompt(
  question: string,
  previousTurns: Array<{ model: string; response: string }>,
  currentModel: string,
): string {
  const historySection = previousTurns
    .map((t) => `### ${t.model}\n${t.response}`)
    .join("\n\n---\n\n");

  return `You are participating in a structured debate as ${currentModel}. React to previous speakers while advancing your own argument.

## Topic
${question}

## Discussion So Far

${historySection}

## Your Task
- Respond to specific points made by other participants
- Defend, refine, or update your position based on what others have said
- Introduce new evidence or reasoning if relevant
- Be direct and substantive

Respond directly with your contribution.`;
}

export function buildDebateFinalStancePrompt(
  question: string,
  allTurns: Array<{ model: string; response: string }>,
): string {
  const historySection = allTurns
    .map((t) => `### ${t.model}\n${t.response}`)
    .join("\n\n---\n\n");

  return `You have participated in a debate on the following topic. After hearing all arguments, state your final position.

## Topic
${question}

## Full Discussion

${historySection}

## Your Task
- State your final stance clearly
- Note if and how your position changed during the debate, and why
- Summarize your strongest argument

Provide your final stance directly.`;
}

export function buildDebateSynthesisPrompt(
  question: string,
  initialStances: Array<{ model: string; stance: string }>,
  discussionTurns: Array<{ model: string; response: string; round: number }>,
  finalStances: Array<{ model: string; stance: string }>,
  earlyConsensus: boolean,
): string {
  const initialSection = initialStances
    .map((s) => `### ${s.model}\n${s.stance}`)
    .join("\n\n---\n\n");

  let body: string;

  if (earlyConsensus) {
    body = `## Initial Stances (Consensus Reached)

${initialSection}

All participants were in substantial agreement from the start, so no further debate was needed.`;
  } else {
    const discussionSection = discussionTurns
      .map((t) => `### ${t.model} (Round ${t.round})\n${t.response}`)
      .join("\n\n---\n\n");

    const finalSection = finalStances
      .map((s) => `### ${s.model}\n${s.stance}`)
      .join("\n\n---\n\n");

    body = `## Initial Stances

${initialSection}

## Discussion

${discussionSection}

## Final Stances

${finalSection}`;
  }

  return `You are the chairman synthesizing a structured debate.

## Topic
${question}

${body}

## Your Task
Provide a synthesis that includes:
1. **Conclusion**: The strongest overall position, informed by the debate
2. **Points of Agreement**: Where participants converged
3. **Points of Disagreement**: Where participants remained divided, and the key arguments on each side
${earlyConsensus ? "" : "4. **Evolution**: How positions shifted during the debate and why"}

Provide your synthesis directly.`;
}
