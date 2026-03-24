import type { CategoryRecord } from "@/types/categorization";

export type ForecastReferenceSourceType =
  | "transaction"
  | "income_source"
  | "subscription_profile"
  | "rare_subscription"
  | "derived";

export type ForecastReferenceContext = {
  referenceTransactionId: string | null;
  referenceCategoryId: string | null;
  referenceCategoryPath: string | null;
  referenceLabel: string | null;
  referenceSourceType: ForecastReferenceSourceType | null;
};

type TransactionReferenceLike = {
  id: string | null;
  counterparty: string | null;
  details: string;
  category_id_auto: string | null;
  category_id_user: string | null;
};

function cleanText(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const first = raw.split("|")[0]?.trim() || raw;
  if (!first) return null;
  return first;
}

export function resolveCategoryPathById(
  categoryId: string | null | undefined,
  categoryById: Map<string, CategoryRecord>,
) {
  const effectiveId = String(categoryId || "").trim();
  if (!effectiveId) return null;

  const trail: CategoryRecord[] = [];
  const visited = new Set<string>();
  let current = categoryById.get(effectiveId) || null;

  while (current && !visited.has(current.id)) {
    trail.push(current);
    visited.add(current.id);
    current = current.parent_id ? categoryById.get(current.parent_id) || null : null;
  }

  if (!trail.length) return null;
  return trail
    .reverse()
    .map((category) => category.name)
    .filter(Boolean)
    .join(" › ");
}

export function buildForecastReferenceContext(
  tx: TransactionReferenceLike | null | undefined,
  categoryById: Map<string, CategoryRecord>,
  referenceSourceType: ForecastReferenceSourceType = "transaction",
): ForecastReferenceContext {
  const effectiveCategoryId = tx?.category_id_user || tx?.category_id_auto || null;
  return {
    referenceTransactionId: tx?.id || null,
    referenceCategoryId: effectiveCategoryId,
    referenceCategoryPath:
      resolveCategoryPathById(effectiveCategoryId, categoryById) || null,
    referenceLabel: tx ? cleanText(tx.details) || cleanText(tx.counterparty) : null,
    referenceSourceType,
  };
}

