const INPUT_COST_PER_1K_TOKENS_EUR = 0.00015;
const OUTPUT_COST_PER_1K_TOKENS_EUR = 0.0006;

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type AiCostEstimateInput = {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  model?: string | null;
};

export function estimateAiUsageCostEur(input: AiCostEstimateInput) {
  const promptTokens = Math.max(0, Math.round(toFiniteNumber(input.promptTokens)));
  const completionTokens = Math.max(
    0,
    Math.round(toFiniteNumber(input.completionTokens)),
  );
  const totalTokens = Math.max(
    promptTokens + completionTokens,
    Math.round(toFiniteNumber(input.totalTokens)),
  );

  const estimated =
    (promptTokens / 1000) * INPUT_COST_PER_1K_TOKENS_EUR +
    (completionTokens / 1000) * OUTPUT_COST_PER_1K_TOKENS_EUR;

  if (estimated > 0) {
    return Math.round(estimated * 10000) / 10000;
  }

  return Math.round((totalTokens / 1000) * OUTPUT_COST_PER_1K_TOKENS_EUR * 10000) / 10000;
}

export function formatEstimatedAiCostEur(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}
