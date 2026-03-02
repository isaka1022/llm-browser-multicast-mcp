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
