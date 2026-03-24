import { createSupabaseCategorizationRepository } from "@/services/categorization-repository";
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

export async function recategorizeTransactionWithAI(
  transactionId: string,
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
