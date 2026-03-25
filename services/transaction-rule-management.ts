import {
  createSupabaseCategorizationRepository,
  normalizePattern,
  getTransactionDetail,
} from "@/services/categorization-repository";
import type {
  CategoryRuleRecord,
  TransactionCategorizationRecord,
} from "@/types/categorization";
import { requestForecastRefresh } from "@/services/forecast-refresh";

export type TransactionRuleMatch = {
  ruleId: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  pattern: string;
  patternType: string;
  confidence: number;
  scope: string;
  userId: string | null;
};

type RuleHaystackSource = "counterparty" | "merchant" | "details";

type RuleHaystackEntry = {
  text: string;
  priority: number;
  source: RuleHaystackSource;
};

function splitDetailSegments(details: string) {
  return details
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isTechnicalDetailSegment(segment: string) {
  const normalized = normalizePattern(segment);
  if (!normalized) return true;

  if (
    normalized.includes("google pay") ||
    normalized.includes("apple pay") ||
    normalized.includes("terminal") ||
    normalized.includes("appr cd") ||
    normalized.includes("pasnr") ||
    normalized.includes("contactloos") ||
    normalized.includes("contactless")
  ) {
    return true;
  }

  if (/\b\d{4}[a-z]{2}\b/.test(normalized) && normalized.includes("nld")) {
    return true;
  }

  return false;
}

function getRelevantDetailSegments(tx: TransactionCategorizationRecord) {
  return splitDetailSegments(tx.details).filter(
    (segment) => !isTechnicalDetailSegment(segment),
  );
}

function getPrimaryMerchantText(tx: TransactionCategorizationRecord) {
  const counterparty = normalizePattern(tx.counterparty || "");
  if (counterparty) return counterparty;

  const detailSegments = getRelevantDetailSegments(tx);
  const merchantSegment =
    detailSegments[detailSegments.length - 1] || tx.details;
  return normalizePattern(merchantSegment);
}

function getRelevantDetailsText(tx: TransactionCategorizationRecord) {
  const detailSegments = getRelevantDetailSegments(tx);
  if (!detailSegments.length) return tx.details || "";
  return detailSegments.join(" | ");
}

function getRuleHaystacks(tx: TransactionCategorizationRecord) {
  const entries: RuleHaystackEntry[] = [];
  const seen = new Set<string>();

  const push = (
    value: string,
    priority: number,
    source: RuleHaystackSource,
  ) => {
    const normalized = normalizePattern(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ text: normalized, priority, source });
  };

  push(tx.counterparty || "", 3, "counterparty");
  push(getPrimaryMerchantText(tx), 2, "merchant");
  push(getRelevantDetailsText(tx), 1, "details");

  return entries;
}

function tryRuleMatch(
  tx: TransactionCategorizationRecord,
  rules: CategoryRuleRecord[],
): { categoryId: string; confidence: number; ruleId: string } | null {
  const haystacks = getRuleHaystacks(tx);
  if (!haystacks.length) return null;

  let best: {
    categoryId: string;
    confidence: number;
    ruleId: string;
    score: number;
  } | null = null;

  for (const rule of rules) {
    if (!rule.is_active) continue;
    const needle = rule.pattern_normalized;
    if (!needle) continue;
    const patternType = String(rule.pattern_type || "counterparty_contains");

    const conf = Math.max(0, Math.min(1, Number(rule.confidence) || 0));

    for (const haystack of haystacks) {
      if (patternType === "details_contains" && haystack.source !== "details") {
        continue;
      }
      if (!haystack.text.includes(needle)) continue;

      const score =
        (patternType === "details_contains" ? 5000 : 0) +
        haystack.priority * 1000 +
        needle.length * 10 +
        conf;
      if (!best || score > best.score) {
        best = {
          categoryId: rule.category_id,
          confidence: conf,
          ruleId: rule.id,
          score,
        };
      }
    }
  }

  if (!best) return null;
  return {
    categoryId: best.categoryId,
    confidence: best.confidence,
    ruleId: best.ruleId,
  };
}

export async function getTransactionRuleMatch(
  transactionId: string,
): Promise<TransactionRuleMatch | null> {
  const repo = createSupabaseCategorizationRepository();
  const [categories, rules, txs] = await Promise.all([
    repo.getCategories(),
    repo.getActiveRules(),
    repo.getTransactionsByIds([transactionId]),
  ]);

  const tx = txs[0];
  if (!tx || !categories.length || !rules.length) return null;

  const matched = tryRuleMatch(tx, rules);
  if (!matched) return null;

  const category = categories.find((item) => item.id === matched.categoryId);
  const rule = rules.find((item) => item.id === matched.ruleId);
  if (!category || !rule) return null;

  return {
    ruleId: matched.ruleId,
    categoryId: category.id,
    categoryKey: category.key,
    categoryName: category.name,
    pattern: rule.pattern,
    patternType: rule.pattern_type,
    confidence: matched.confidence,
    scope: rule.scope || "system",
    userId: rule.user_id || null,
  };
}

export async function resetTransactionRuleMatch(transactionId: string) {
  const repo = createSupabaseCategorizationRepository();
  const [detail, match] = await Promise.all([
    getTransactionDetail(transactionId),
    getTransactionRuleMatch(transactionId),
  ]);

  if (!match || match.scope !== "user") return false;

  await repo.setCategoryRuleActive(match.ruleId, false);

  if (detail?.category_source === "rule" && !detail.category_id_user) {
    await repo.clearAutoCategories([transactionId]);
  }

  await requestForecastRefresh({
    reason: "manual_category",
    eager: true,
  }).catch((error) => {
    console.warn(
      "[transaction-rule-management] forecast refresh scheduling after rule reset failed",
      error,
    );
  });

  return true;
}
