import {
  bulkUpdateCategoryByCounterparty,
  createSupabaseCategorizationRepository,
  normalizePattern,
} from "@/services/categorization-repository";
import { requestForecastRefresh } from "@/services/forecast-refresh";
import { recategorizeSingleTransaction } from "@/services/categorization";

export type TransactionAiCategorizationResult = {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  confidence: number;
  reason: string;
  model: string;
};

type RecategorizeWithAiOptions = {
  applyToCounterparty?: boolean;
  learnFromCounterparty?: boolean;
};

export async function recategorizeTransactionWithAI(
  transactionId: string,
  options: RecategorizeWithAiOptions = {},
): Promise<TransactionAiCategorizationResult | null> {
  const prediction = await recategorizeSingleTransaction(transactionId);
  if (!prediction) return null;

  const repo = createSupabaseCategorizationRepository();
  const update = await repo.setAutoCategory(
    transactionId,
    prediction.categoryId,
    prediction.confidence,
    "openai",
    prediction.model,
  );

  await repo.insertAudit({
    transactionId,
    previousCategoryId: update.previousCategoryId,
    newCategoryId: prediction.categoryId,
    source: "openai",
    model: prediction.model,
    confidence: prediction.confidence,
    reason: prediction.reason,
  });

  if (options.applyToCounterparty && update.counterparty) {
    await bulkUpdateCategoryByCounterparty(
      update.counterparty,
      prediction.categoryId,
      "all",
    );
  }

  if (options.learnFromCounterparty && update.counterparty) {
    const normalizedPattern = normalizePattern(update.counterparty);
    if (normalizedPattern) {
      await repo.upsertCounterpartyRule(
        normalizedPattern,
        update.counterparty,
        prediction.categoryId,
      );
    }
  }

  await requestForecastRefresh({
    reason: "manual_category",
    delayMs: 5000,
  }).catch((error) => {
    console.warn(
      "[transaction-ai-categorization] forecast refresh scheduling failed",
      error,
    );
  });

  return prediction;
}
