import {
  loadBudgetPlanForSurface,
} from "@/services/budget-plan-surface";
import { buildCategoryRecordMap } from "@/services/category-display";
import { createSupabaseCategorizationRepository } from "@/services/categorization-repository";
import { isBankAccountIncludedInBudget, listBankAccountBudgetFlags } from "@/services/bank-accounts";
import { requireCurrentUserId } from "@/services/current-user";
import {
  getInsightsDisplayExpectedEndBalance,
  getInsightsRemainingMonthNetTotal,
  getInsightsRemainingPlannedExpenseTotal,
  getInsightsRemainingVariableExpenseEstimate,
} from "@/services/insights-remaining-month";
import { loadLatestKnownBalanceSnapshot } from "@/services/latest-known-balance";
import { loadMonthForecastSummary } from "@/services/month-forecast-summary";
import { RequestCache } from "@/services/request-cache";
import { startOfUtcWeekMonday } from "@/services/budget-week-utils";
import { loadMoneyViewScopePreference } from "@/services/finance-scope-preference";
import {
  resolveFinancialSurfaceStatus,
  resolveSafetyContextCopy,
} from "@/services/financial-surface-semantics";
import {
  getCurrentMonthKey,
  getMonthOptionByKey,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import {
  getMonthVariableBudgetSnapshot,
  getWeekBudgetSnapshot,
} from "@/services/budget-risk";
import type { HelpAssistantContext } from "@/services/help-assistant-context";
import { buildAssistantAdviceSignals } from "@/services/help-assistant-spending-advice";
import { resolveIncomeSemantics } from "@/services/income-semantics";
import { supabase } from "@/services/supabase";
import type {
  BudgetRecommendationRow,
  CategoryRecord,
} from "@/types/categorization";

export const UNIFIED_FINANCIAL_CONTEXT_CACHE_TTL_MS = 45_000;

const financialAdviceContextCache = new RequestCache();

export function clearUnifiedFinancialAdviceContextCache() {
  financialAdviceContextCache.clear("help-assistant-financial-context");
}

export type AssistantContextDataMeta = {
  isAvailable: boolean;
  isCanonical: boolean;
  isDerived: boolean;
  isFallback: boolean;
  source: string;
  dataGapReason: string | null;
};

export type UnifiedFinancialAdviceContext = {
  period: {
    key: string;
    label: string;
    startIso: string;
    endIsoExclusive: string;
    referenceDateIso: string;
    usedFallbackPeriod: boolean;
  };
  currentBalance: {
    balance: number | null;
    date: string | null;
  };
  spending: {
    currentMonthTotal: number | null;
    currentWeekTotal: number | null;
    currentMonthBreakdown: FinancialCategorySpendBreakdown;
    currentWeekBreakdown: FinancialCategorySpendBreakdown;
  };
  budget: {
    remainingVariableBudget: number | null;
    spentVariableBudget: number | null;
    totalVariableBudget: number | null;
    monthStatusLabel: string | null;
    monthRiskTone: "good" | "watch" | "critical" | "neutral" | null;
    weekRemainingBudget: number | null;
    weekStatusLabel: string | null;
    weekRiskTone: "good" | "watch" | "critical" | "neutral" | null;
    weekTempoDelta: number | null;
  };
  trend: {
    monthStatusLabel: string | null;
    monthRiskTone: "good" | "watch" | "critical" | "neutral" | null;
    weekStatusLabel: string | null;
    weekRiskTone: "good" | "watch" | "critical" | "neutral" | null;
    weekTempoDelta: number | null;
    monthProgress: number | null;
  };
  budgetPlan: {
    monthlyBudgetTotal: number | null;
    weeklyBudgetTotal: number | null;
    fixedCostsBudget: number | null;
    subscriptionsBudget: number | null;
    variableBudget: number | null;
    variableSubcategoriesBudgetTotal: number | null;
    appliedSavingsTarget: number | null;
    currentWeekBudget: number | null;
    currentWeekActual: number | null;
    currentWeekRemaining: number | null;
    subtotalAfterFixed: number | null;
    subtotalAfterSubscriptions: number | null;
    // Canonical source today only contains coarse variable buckets
    // (groceries|fuel|smoking|other), not granular category budgets.
    variableCategoryBudgets: {
      categoryKey: string;
      label: string;
      monthlyBudget: number;
      monthlyActual: number;
      utilization: number;
    }[];
  };
  planning: {
    upcomingCommittedExpenseTotal: number | null;
    upcomingCommittedIncomeTotal: number | null;
    expectedFixedCosts: number | null;
    expectedSubscriptions: number | null;
    remainingPlannedExpenseTotal: number | null;
    remainingVariableExpenseEstimate: number | null;
  };
  forecastCurrentMonth: {
    hasData: boolean;
    expectedEndBalance: number | null;
    lowestExpectedBalance: number | null;
    riskFlag: "none" | "deficit_warning";
    cashRiskFlag: "none" | "cash_gap_warning";
    remainingMonthNetTotal: number | null;
    forecastReferenceDate: string | null;
  };
  forecastNextMonth: {
    hasData: boolean;
    monthKey: string;
    monthLabel: string;
    expectedEndBalance: number | null;
    riskFlag: "none" | "deficit_warning";
    cashRiskFlag: "none" | "cash_gap_warning";
    forecastReferenceDate: string | null;
  };
  surfaceSemantics?: {
    remainingMonthlyBudget: number | null;
    expectedEndOperationalBalance: number | null;
    freeToSpendNow: number | null;
    safeToSpendUntilNextIncome: number | null;
    nextIncomeDateAnchor: string | null;
    nextIncomeAmountAnchor: number | null;
    nextIncomeAmountAnchorMeta: AssistantContextDataMeta;
    knownUpcomingFixedCostsUntilAnchor: number | null;
    knownUpcomingSubscriptionsUntilAnchor: number | null;
    safeToSpendConfidenceScore: "HIGH" | "MEDIUM" | "INDICATIVE" | null;
    safeToSpendLabel: string;
    safeToSpendSubtitle: string;
    statusLabel: string;
    statusTone: "good" | "watch" | "critical" | "neutral";
  };
  spendingAdvice: SpendingAdviceAssistantContext;
  quality: {
    cacheHit: boolean;
    fetchedAtIso: string;
    cacheTtlMs: number;
    hasBudgetSignals: boolean;
    hasPlanningSignals: boolean;
    hasForecastSignals: boolean;
    hasBalanceSignals: boolean;
    hasSpendingSignals: boolean;
    hasCategorySignals: boolean;
    confidence: "low" | "medium" | "high";
    dataGaps: string[];
  };
};

export type SpendingAdviceAssistantContext = {
  monthBudget: {
    monthLabel: string;
    daysRemainingInMonth: number;
    variableBudgetTotal: number | null;
    variableSpent: number | null;
    variableRemaining: number | null;
    monthBudgetStatus:
      | "unknown"
      | "no_budget"
      | "on_track"
      | "watch"
      | "over_budget";
    monthBudgetStatusLabel: string | null;
    weekBudgetRemaining: number | null;
    weekBudgetStatus: "unknown" | "on_track" | "over_budget";
    weekTempoSignal: "unknown" | "under_tempo" | "on_tempo" | "over_tempo";
  };
  cashflowSafety: {
    currentBalance: number | null;
    extraSpaceUntilNextIncome: number | null;
    extraSpaceLabel: string;
    nextIncomeDate: string | null;
    nextIncomeAmount: number | null;
    nextIncomeAmountMeta: AssistantContextDataMeta;
    daysUntilNextIncome: number | null;
    expectedEndBalance: number | null;
    lowestProjectedBalance: number | null;
    knownUpcomingFixedCosts: number | null;
    expectedFixedAndSubscriptions: number | null;
    forecastReliability: "low" | "medium" | "high";
  };
  categoryStatus: SpendingAdviceCategoryStatus | null;
  assistantAdviceSignals: ReturnType<typeof buildAssistantAdviceSignals>;
};

export type SpendingAdviceCategoryStatus = {
  categoryKey: string;
  categoryLabel: string;
  spentCurrentMonth: number | null;
  budgetCurrentMonth: number | null;
  remaining: number | null;
  status: "within_budget" | "watch" | "over_budget" | "tracked_without_budget";
  budgetAvailability: "canonical" | "bucket_only" | "unavailable" | "fallback_only";
  budgetSourceType:
    | "plan_recommendation_category"
    | "plan_recommendation_bucket"
    | "legacy_fallback"
    | "none";
  budgetMeta: AssistantContextDataMeta;
  // Prepared field, currently unresolved in services.
  projectedEndOfMonth: number | null;
  projectedEndOfMonthMeta: AssistantContextDataMeta;
  // Prepared field, currently unresolved in services.
  // Do not backfill from non-equivalent avg forecast fields.
  avgLast3Months: number | null;
  avgLast3MonthsMeta: AssistantContextDataMeta;
};

export type FinancialCategorySpendSubcategory = {
  key: string;
  categoryId: string | null;
  categoryKey: string | null;
  label: string;
  amount: number;
  transactionCount: number;
};

export type FinancialCategorySpendItem = {
  key: string;
  categoryId: string | null;
  categoryKey: string | null;
  label: string;
  amount: number;
  transactionCount: number;
  subcategories: FinancialCategorySpendSubcategory[];
};

export type FinancialCategorySpendBreakdown = {
  total: number;
  transactionCount: number;
  categories: FinancialCategorySpendItem[];
};

type SpendRow = {
  id: string;
  date: string;
  amount: number;
  details: string;
  counterparty: string | null;
  bank_account_id: string | null;
  category_id_auto: string | null;
  category_id_user: string | null;
  budget_excluded: boolean;
};

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toMonthKeyFromIso(value: string) {
  const key = String(value || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
}

function resolveSelectedMonthOption(context: HelpAssistantContext) {
  const period = context.selectedPeriod;
  if (period?.key) {
    const byKey = getMonthOptionByKey(period.key);
    if (byKey) return { option: byKey, usedFallback: false };
  }

  if (period?.startIso) {
    const fromStart = toMonthKeyFromIso(period.startIso);
    if (fromStart) {
      const byStartKey = getMonthOptionByKey(fromStart);
      if (byStartKey) return { option: byStartKey, usedFallback: false };
    }
  }

  const fallback = getMonthOptionByKey(getCurrentMonthKey())!;
  return { option: fallback, usedFallback: true };
}

function getReferenceDate(option: TransactionMonthOption) {
  if (option.isCurrentMonth) return new Date();
  const referenceDate = new Date(`${option.endIso}T12:00:00.000Z`);
  referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
  return referenceDate;
}

function roundEuro(value: number) {
  return Math.round(value);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function buildCategoryTrail(
  categoryId: string,
  categoryById: Map<string, CategoryRecord>,
) {
  const trail: CategoryRecord[] = [];
  const visited = new Set<string>();
  let current = categoryById.get(categoryId) || null;

  while (current && !visited.has(current.id)) {
    trail.unshift(current);
    visited.add(current.id);
    if (!current.parent_id) break;
    current = categoryById.get(current.parent_id) || null;
  }

  return trail;
}

function emptyFinancialCategorySpendBreakdown(): FinancialCategorySpendBreakdown {
  return {
    total: 0,
    transactionCount: 0,
    categories: [],
  };
}

function buildFinancialCategorySpendBreakdown(
  rows: SpendRow[],
  categoryById: Map<string, CategoryRecord>,
): FinancialCategorySpendBreakdown {
  const mainBuckets = new Map<
    string,
    {
      key: string;
      categoryId: string | null;
      categoryKey: string | null;
      label: string;
      amount: number;
      transactionCount: number;
      subcategories: Map<string, FinancialCategorySpendSubcategory>;
    }
  >();

  let total = 0;
  let transactionCount = 0;

  for (const row of rows) {
    if (row.budget_excluded) continue;
    const amount = Number(row.amount || 0);
    if (amount === 0) continue;

    const categoryId = row.category_id_user || row.category_id_auto || null;
    const category = categoryId ? categoryById.get(categoryId) || null : null;
    const trail = categoryId ? buildCategoryTrail(categoryId, categoryById) : [];
    const trailLabels = trail
      .map((item) => String(item.name || "").trim())
      .filter(Boolean);
    const mainLabel = trailLabels[0] || "Ongecategoriseerd";
    const mainKey = trail[0]?.id || categoryId || "uncategorized";
    const mainCategoryId = trail[0]?.id || categoryId || null;
    const mainCategoryKey = trail[0]?.key || category?.key || null;
    const subLabel =
      trailLabels.length > 1 ? trailLabels.slice(1).join(" › ") : mainLabel;
    const subKey = trail.length > 1 ? trail.map((item) => item.id).join("›") : mainKey;
    const leafCategoryId = trail.length
      ? trail[trail.length - 1]?.id || categoryId || null
      : categoryId;
    const leafCategoryKey = trail.length
      ? trail[trail.length - 1]?.key || category?.key || null
      : category?.key || null;

    let delta = 0;
    if (amount < 0) {
      delta = Math.abs(amount);
    } else {
      const semantics = resolveIncomeSemantics({
        amount,
        counterparty: row.counterparty,
        details: row.details,
        categoryKey: category?.key || null,
        budgetGroup: category?.budget_group || null,
        analysisCategory: null,
      });
      if (semantics.kind === "expense_refund" && semantics.expenseOffsetBucket) {
        delta = -Math.abs(amount);
      } else {
        continue;
      }
    }

    total += delta;
    transactionCount += 1;

    const existingMain = mainBuckets.get(mainKey);
    if (!existingMain) {
      const subcategories = new Map<string, FinancialCategorySpendSubcategory>();
      subcategories.set(subKey, {
        key: subKey,
        categoryId: leafCategoryId,
        categoryKey: leafCategoryKey,
        label: subLabel,
        amount: delta,
        transactionCount: 1,
      });
      mainBuckets.set(mainKey, {
        key: mainKey,
        categoryId: mainCategoryId,
        categoryKey: mainCategoryKey,
        label: mainLabel,
        amount: delta,
        transactionCount: 1,
        subcategories,
      });
      continue;
    }

    existingMain.amount += delta;
    existingMain.transactionCount += 1;
    const existingSub = existingMain.subcategories.get(subKey);
    if (existingSub) {
      existingSub.amount += delta;
      existingSub.transactionCount += 1;
    } else {
      existingMain.subcategories.set(subKey, {
        key: subKey,
        categoryId: leafCategoryId,
        categoryKey: leafCategoryKey,
        label: subLabel,
        amount: delta,
        transactionCount: 1,
      });
    }
  }

  const categories = [...mainBuckets.values()]
    .map((entry) => ({
      key: entry.key,
      categoryId: entry.categoryId,
      categoryKey: entry.categoryKey,
      label: entry.label,
      amount: roundEuro(entry.amount),
      transactionCount: entry.transactionCount,
      subcategories: [...entry.subcategories.values()]
        .map((sub) => ({
          ...sub,
          amount: roundEuro(sub.amount),
        }))
        .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)),
    }))
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .slice(0, 8);

  return {
    total: roundEuro(total),
    transactionCount,
    categories,
  };
}

function normalizeMatchText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetweenUtc(start: Date, end: Date) {
  return Math.max(
    0,
    Math.round((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / 86400000),
  );
}

function parseIsoDateToUtc(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function createAssistantDataMeta(input: {
  isAvailable: boolean;
  isCanonical: boolean;
  isDerived: boolean;
  isFallback: boolean;
  source: string;
  dataGapReason?: string | null;
}): AssistantContextDataMeta {
  return {
    isAvailable: input.isAvailable,
    isCanonical: input.isCanonical,
    isDerived: input.isDerived,
    isFallback: input.isFallback,
    source: input.source,
    dataGapReason: input.dataGapReason ?? null,
  };
}

function mapMonthBudgetStatus(input: {
  totalVariableBudget: number | null;
  variableRemaining: number | null;
  monthRiskTone: "good" | "watch" | "critical" | "neutral" | null;
}) {
  if (input.totalVariableBudget == null) return "unknown" as const;
  if (input.totalVariableBudget <= 0) return "no_budget" as const;
  if ((input.variableRemaining ?? 0) < 0 || input.monthRiskTone === "critical") {
    return "over_budget" as const;
  }
  if (input.monthRiskTone === "watch") return "watch" as const;
  return "on_track" as const;
}

function mapWeekBudgetStatus(input: {
  weekRemainingBudget: number | null;
  weekRiskTone: "good" | "watch" | "critical" | "neutral" | null;
}) {
  if (input.weekRemainingBudget == null) return "unknown" as const;
  if ((input.weekRemainingBudget ?? 0) < 0 || input.weekRiskTone === "critical") {
    return "over_budget" as const;
  }
  return "on_track" as const;
}

function mapWeekTempoSignal(tempoDelta: number | null) {
  if (tempoDelta == null) return "unknown" as const;
  if (tempoDelta >= 15) return "under_tempo" as const;
  if (tempoDelta <= -15) return "over_tempo" as const;
  return "on_tempo" as const;
}

function mapForecastReliability(input: {
  qualityConfidence: "low" | "medium" | "high";
  safeToSpendConfidenceScore: "HIGH" | "MEDIUM" | "INDICATIVE" | null | undefined;
}) {
  const qualityRank =
    input.qualityConfidence === "high"
      ? 3
      : input.qualityConfidence === "medium"
        ? 2
        : 1;
  const safetyRank =
    input.safeToSpendConfidenceScore === "HIGH"
      ? 3
      : input.safeToSpendConfidenceScore === "MEDIUM"
        ? 2
        : 1;
  const rank = Math.min(qualityRank, safetyRank);
  if (rank >= 3) return "high" as const;
  if (rank === 2) return "medium" as const;
  return "low" as const;
}

function buildVariableCategoryBudgetMap(
  recommendations: BudgetRecommendationRow[],
) {
  return new Map(
    recommendations
      .filter((row) =>
        row.categoryKey === "groceries" ||
        row.categoryKey === "fuel" ||
        row.categoryKey === "smoking" ||
        row.categoryKey === "other",
      )
      .map((row) => [
        row.categoryKey,
        {
          categoryKey: row.categoryKey,
          label: row.label,
          monthlyBudget: roundEuro(row.monthlyBudget),
          monthlyActual: roundEuro(row.monthlyActual),
          utilization: row.utilization,
        },
      ]),
  );
}

type ResolvedSpendCandidate = {
  categoryKey: string;
  categoryLabel: string;
  spentCurrentMonth: number;
};

function collectSpendCandidates(breakdown: FinancialCategorySpendBreakdown) {
  const candidates: ResolvedSpendCandidate[] = [];

  for (const category of breakdown.categories) {
    candidates.push({
      categoryKey: category.categoryKey || category.key,
      categoryLabel: category.label,
      spentCurrentMonth: category.amount,
    });
    for (const subcategory of category.subcategories) {
      candidates.push({
        categoryKey:
          subcategory.categoryKey || category.categoryKey || subcategory.key,
        categoryLabel: subcategory.label,
        spentCurrentMonth: subcategory.amount,
      });
    }
  }

  return candidates;
}

function resolveHintTokens(question: string) {
  const normalized = normalizeMatchText(question);
  if (
    normalized.includes("boodschap") ||
    normalized.includes("supermarkt")
  ) {
    return ["groceries", "boodschappen", "supermarkt"];
  }
  if (
    normalized.includes("benzine") ||
    normalized.includes("tank") ||
    normalized.includes("brandstof")
  ) {
    return ["fuel", "brandstof", "benzine"];
  }
  if (
    normalized.includes("roken") ||
    normalized.includes("sigaret") ||
    normalized.includes("tabak") ||
    normalized.includes("vape")
  ) {
    return ["smoking", "roken", "tabak"];
  }
  if (
    normalized.includes("horeca") ||
    normalized.includes("restaurant") ||
    normalized.includes("uit eten")
  ) {
    return ["horeca", "restaurant", "uit eten"];
  }
  if (
    normalized.includes("kleding") ||
    normalized.includes("kleedgeld")
  ) {
    return ["kleding", "clothing", "shopping_clothing"];
  }
  return [] as string[];
}

function resolveCanonicalBudgetBucketHint(
  question: string | null | undefined,
): "groceries" | "fuel" | "smoking" | null {
  const normalized = normalizeMatchText(question);
  if (!normalized) return null;

  if (normalized.includes("boodschap") || normalized.includes("supermarkt")) {
    return "groceries";
  }
  if (
    normalized.includes("benzine") ||
    normalized.includes("tank") ||
    normalized.includes("brandstof")
  ) {
    return "fuel";
  }
  if (
    normalized.includes("roken") ||
    normalized.includes("sigaret") ||
    normalized.includes("tabak") ||
    normalized.includes("vape")
  ) {
    return "smoking";
  }

  return null;
}

function findCategoryCandidate(params: {
  question: string | null | undefined;
  breakdown: FinancialCategorySpendBreakdown;
}): ResolvedSpendCandidate | null {
  const question = normalizeMatchText(params.question);
  if (!question) return null;

  const candidates = collectSpendCandidates(params.breakdown);
  if (!candidates.length) return null;

  const direct = candidates.find((candidate) => {
    const label = normalizeMatchText(candidate.categoryLabel);
    const key = normalizeMatchText(candidate.categoryKey);
    return (
      question.includes(label) ||
      label.includes(question) ||
      question.includes(key) ||
      key.includes(question)
    );
  });

  if (direct) return direct;

  const hintTokens = resolveHintTokens(question);
  if (hintTokens.length) {
    const hinted = candidates.find((candidate) => {
      const label = normalizeMatchText(candidate.categoryLabel);
      const key = normalizeMatchText(candidate.categoryKey);
      return hintTokens.some(
        (token) => label.includes(token) || key.includes(token),
      );
    });
    if (hinted) return hinted;
  }

  return null;
}

function buildCategoryStatus(params: {
  question: string | null | undefined;
  currentMonthBreakdown: FinancialCategorySpendBreakdown;
  variableCategoryBudgets: Map<
    string,
    {
      categoryKey: string;
      label: string;
      monthlyBudget: number;
      monthlyActual: number;
      utilization: number;
    }
  >;
}): SpendingAdviceCategoryStatus | null {
  const candidate = findCategoryCandidate({
    question: params.question,
    breakdown: params.currentMonthBreakdown,
  });
  if (!candidate) return null;

  const directBudget =
    params.variableCategoryBudgets.get(candidate.categoryKey) || null;
  const hintedBudgetKey = resolveCanonicalBudgetBucketHint(params.question);
  const hintedBucketBudget =
    hintedBudgetKey == null
      ? null
      : params.variableCategoryBudgets.get(hintedBudgetKey) || null;
  const budget = directBudget || hintedBucketBudget;
  const budgetAvailability =
    directBudget != null
      ? ("canonical" as const)
      : hintedBucketBudget != null
        ? ("bucket_only" as const)
        : ("unavailable" as const);
  const budgetSourceType =
    directBudget != null
      ? ("plan_recommendation_category" as const)
      : hintedBucketBudget != null
        ? ("plan_recommendation_bucket" as const)
        : ("none" as const);

  if (!budget) {
    return {
      categoryKey: candidate.categoryKey,
      categoryLabel: candidate.categoryLabel,
      spentCurrentMonth: candidate.spentCurrentMonth,
      budgetCurrentMonth: null,
      remaining: null,
      status: "tracked_without_budget",
      budgetAvailability,
      budgetSourceType,
      budgetMeta: createAssistantDataMeta({
        isAvailable: false,
        isCanonical: false,
        isDerived: false,
        isFallback: false,
        source: "budget_plan_recommendations",
        dataGapReason: "category_budget_not_available",
      }),
      projectedEndOfMonth: null,
      projectedEndOfMonthMeta: createAssistantDataMeta({
        isAvailable: false,
        isCanonical: false,
        isDerived: false,
        isFallback: false,
        source: "category_projection",
        dataGapReason: "projected_end_of_month_not_available",
      }),
      avgLast3Months: null,
      avgLast3MonthsMeta: createAssistantDataMeta({
        isAvailable: false,
        isCanonical: false,
        isDerived: false,
        isFallback: false,
        source: "category_average",
        dataGapReason: "avg_last_3_months_not_available",
      }),
    };
  }

  // For bucket_only we compare against the canonical bucket actual from the plan,
  // not against the granular category spend to avoid false category precision.
  const spendForBudgetComparison =
    budgetAvailability === "bucket_only"
      ? budget.monthlyActual
      : candidate.spentCurrentMonth;
  const remaining = roundEuro(budget.monthlyBudget - spendForBudgetComparison);
  const utilization =
    budget.monthlyBudget > 0
      ? spendForBudgetComparison / Math.max(budget.monthlyBudget, 1)
      : null;

  return {
    categoryKey: candidate.categoryKey,
    categoryLabel: candidate.categoryLabel,
    spentCurrentMonth: candidate.spentCurrentMonth,
    budgetCurrentMonth: budget.monthlyBudget,
    remaining,
    status:
      remaining < 0
        ? "over_budget"
        : utilization != null && utilization >= 0.85
          ? "watch"
          : "within_budget",
    budgetAvailability,
    budgetSourceType,
    budgetMeta: createAssistantDataMeta({
      isAvailable: true,
      isCanonical: true,
      isDerived: budgetAvailability === "bucket_only",
      isFallback: false,
      source:
        budgetAvailability === "bucket_only"
          ? "budget_plan_recommendation_bucket"
          : "budget_plan_recommendation_category",
    }),
    projectedEndOfMonth: null,
    projectedEndOfMonthMeta: createAssistantDataMeta({
      isAvailable: false,
      isCanonical: false,
      isDerived: false,
      isFallback: false,
      source: "category_projection",
      dataGapReason: "projected_end_of_month_not_available",
    }),
    avgLast3Months: null,
    avgLast3MonthsMeta: createAssistantDataMeta({
      isAvailable: false,
      isCanonical: false,
      isDerived: false,
      isFallback: false,
      source: "category_average",
      dataGapReason: "avg_last_3_months_not_available",
    }),
  };
}

type UnifiedFinancialAdviceContextBase = Omit<
  UnifiedFinancialAdviceContext,
  "spendingAdvice"
>;

function buildAssistantReadySpendingAdvice(params: {
  baseContext: UnifiedFinancialAdviceContextBase;
  question?: string | null;
  requestedAmount?: number | null;
}): SpendingAdviceAssistantContext {
  const { baseContext } = params;
  const referenceDate = new Date(baseContext.period.referenceDateIso);
  const periodEnd = parseIsoDateToUtc(baseContext.period.endIsoExclusive);
  const daysRemainingInMonth = daysBetweenUtc(referenceDate, periodEnd);
  const variableCategoryBudgets = new Map(
    baseContext.budgetPlan.variableCategoryBudgets.map((row) => [row.categoryKey, row]),
  );
  const categoryStatus = buildCategoryStatus({
    question: params.question,
    currentMonthBreakdown: baseContext.spending.currentMonthBreakdown,
    variableCategoryBudgets,
  });
  const forecastReliability = mapForecastReliability({
    qualityConfidence: baseContext.quality.confidence,
    safeToSpendConfidenceScore:
      baseContext.surfaceSemantics?.safeToSpendConfidenceScore || null,
  });
  const expectedFixedAndSubscriptions =
    baseContext.planning.expectedFixedCosts == null &&
    baseContext.planning.expectedSubscriptions == null
      ? null
      : roundEuro(
          Number(baseContext.planning.expectedFixedCosts || 0) +
            Number(baseContext.planning.expectedSubscriptions || 0),
        );

  const monthBudgetStatus = mapMonthBudgetStatus({
    totalVariableBudget: baseContext.budget.totalVariableBudget,
    variableRemaining: baseContext.budget.remainingVariableBudget,
    monthRiskTone: baseContext.budget.monthRiskTone,
  });
  const nextIncomeAmountMeta =
    baseContext.surfaceSemantics?.nextIncomeAmountAnchorMeta ||
    createAssistantDataMeta({
      isAvailable: false,
      isCanonical: false,
      isDerived: false,
      isFallback: true,
      source: "unified_financial_context_fallback",
      dataGapReason: "next_income_amount_meta_missing",
    });
  const cashflowSafety = {
    currentBalance: baseContext.currentBalance.balance,
    extraSpaceUntilNextIncome:
      baseContext.surfaceSemantics?.safeToSpendUntilNextIncome ?? null,
    extraSpaceLabel:
      baseContext.surfaceSemantics?.safeToSpendLabel ||
      resolveSafetyContextCopy({}).fullLabel,
    nextIncomeDate: baseContext.surfaceSemantics?.nextIncomeDateAnchor ?? null,
    nextIncomeAmount: nextIncomeAmountMeta.isAvailable
      ? (baseContext.surfaceSemantics?.nextIncomeAmountAnchor ?? null)
      : null,
    nextIncomeAmountMeta,
    daysUntilNextIncome: baseContext.surfaceSemantics?.nextIncomeDateAnchor
      ? daysBetweenUtc(
          referenceDate,
          parseIsoDateToUtc(baseContext.surfaceSemantics.nextIncomeDateAnchor),
        )
      : null,
    expectedEndBalance:
      baseContext.surfaceSemantics?.expectedEndOperationalBalance ??
      baseContext.forecastCurrentMonth.expectedEndBalance,
    lowestProjectedBalance:
      baseContext.forecastCurrentMonth.lowestExpectedBalance,
    knownUpcomingFixedCosts:
      baseContext.surfaceSemantics == null
        ? null
        : roundEuro(
            Number(
              baseContext.surfaceSemantics.knownUpcomingFixedCostsUntilAnchor || 0,
            ) +
              Number(
                baseContext.surfaceSemantics
                  .knownUpcomingSubscriptionsUntilAnchor || 0,
              ),
          ),
    expectedFixedAndSubscriptions,
    forecastReliability,
  } satisfies SpendingAdviceAssistantContext["cashflowSafety"];

  const assistantAdviceSignals = buildAssistantAdviceSignals({
    monthBudgetStatus,
    variableRemaining: baseContext.budget.remainingVariableBudget,
    variableBudgetTotal: baseContext.budget.totalVariableBudget,
    extraSpaceUntilNextIncome: cashflowSafety.extraSpaceUntilNextIncome,
    expectedEndBalance: cashflowSafety.expectedEndBalance,
    lowestProjectedBalance: cashflowSafety.lowestProjectedBalance,
    forecastReliabilityScore:
      baseContext.surfaceSemantics?.safeToSpendConfidenceScore || null,
    requestedAmount: params.requestedAmount,
    categoryStatus: categoryStatus
      ? {
          status: categoryStatus.status,
          remaining: categoryStatus.remaining,
        }
      : null,
  });

  return {
    monthBudget: {
      monthLabel: baseContext.period.label,
      daysRemainingInMonth,
      variableBudgetTotal: baseContext.budget.totalVariableBudget,
      variableSpent: baseContext.budget.spentVariableBudget,
      variableRemaining: baseContext.budget.remainingVariableBudget,
      monthBudgetStatus,
      monthBudgetStatusLabel: baseContext.budget.monthStatusLabel,
      weekBudgetRemaining: baseContext.budget.weekRemainingBudget,
      weekBudgetStatus: mapWeekBudgetStatus({
        weekRemainingBudget: baseContext.budget.weekRemainingBudget,
        weekRiskTone: baseContext.budget.weekRiskTone,
      }),
      weekTempoSignal: mapWeekTempoSignal(baseContext.budget.weekTempoDelta),
    },
    cashflowSafety,
    categoryStatus,
    assistantAdviceSignals,
  };
}

async function fetchSpendRowsInRange(params: {
  userId: string;
  startIso: string;
  endIsoExclusive: string;
  budgetFlags: Map<string, boolean> | null;
}): Promise<SpendRow[]> {
  const { userId, startIso, endIsoExclusive, budgetFlags } = params;
  const rows: SpendRow[] = [];
  let offset = 0;
  const pageSize = 500;

  while (true) {
    const to = offset + pageSize - 1;
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id,date,amount,details,counterparty,bank_account_id,category_id_auto,category_id_user,budget_excluded",
      )
      .eq("user_id", userId)
      .gte("date", startIso)
      .lt("date", endIsoExclusive)
      .order("date", { ascending: false })
      .range(offset, to);

    if (error) throw error;

    const page = ((data || []) as Record<string, unknown>[])
      .map((row) => {
        const bankAccountId = row.bank_account_id ? String(row.bank_account_id) : null;
        if (
          budgetFlags &&
          !isBankAccountIncludedInBudget(bankAccountId, budgetFlags)
        ) {
          return null;
        }

        return {
          id: String(row.id || ""),
          date: String(row.date || ""),
          amount: Number(row.amount || 0),
          details: String(row.details || ""),
          counterparty: row.counterparty ? String(row.counterparty) : null,
          bank_account_id: bankAccountId,
          category_id_auto: row.category_id_auto ? String(row.category_id_auto) : null,
          category_id_user: row.category_id_user ? String(row.category_id_user) : null,
          budget_excluded: Boolean(row.budget_excluded),
        } satisfies SpendRow;
      })
      .filter((row): row is SpendRow => Boolean(row));

    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function loadFinancialCategoryMap() {
  const categoryRepository = createSupabaseCategorizationRepository();
  const categories = await categoryRepository.getCategories();
  return buildCategoryRecordMap(categories);
}

async function resolveFinancialCategorySpendBreakdown(params: {
  userId: string;
  startIso: string;
  endIsoExclusive: string;
  budgetFlags: Map<string, boolean> | null;
  categoryById: Map<string, CategoryRecord>;
}): Promise<FinancialCategorySpendBreakdown> {
  const { categoryById, ...rowParams } = params;
  const rows = await fetchSpendRowsInRange(rowParams);
  return buildFinancialCategorySpendBreakdown(rows, categoryById);
}

export async function resolveUnifiedFinancialAdviceContext(input: {
  context: HelpAssistantContext;
  question?: string | null;
  requestedAmount?: number | null;
}): Promise<UnifiedFinancialAdviceContext> {
  const { context } = input;
  const { option: selectedMonth, usedFallback } = resolveSelectedMonthOption(context);
  const nextMonthDate = addMonths(
    new Date(selectedMonth.year, selectedMonth.month - 1, 1),
    1,
  );
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(
    nextMonthDate.getMonth() + 1,
  ).padStart(2, "0")}`;
  const nextMonthOption = getMonthOptionByKey(nextMonthKey)!;
  const referenceDate = getReferenceDate(selectedMonth);
  const userId = await requireCurrentUserId();
  const scopePreference = await loadMoneyViewScopePreference(userId).catch(
    () => ({
      scopeView: "personal" as const,
    }),
  );
  const currentWeekStart = startOfUtcDay(startOfUtcWeekMonday(referenceDate));
  const currentWeekEnd = addDays(currentWeekStart, 7);

  const cacheKey = [
    "help-assistant-financial-context",
    userId,
    scopePreference.scopeView,
    selectedMonth.key,
    selectedMonth.startIso,
  ].join(":");

  const cached = await financialAdviceContextCache.run(
    cacheKey,
    UNIFIED_FINANCIAL_CONTEXT_CACHE_TTL_MS,
    async () => {
      const currentForecast = await loadMonthForecastSummary({
        monthStartIso: selectedMonth.startIso,
        referenceDate,
        reason: "help_assistant_financial_current",
        userId,
        moneyViewScope: scopePreference.scopeView,
      });

      const nextForecast = await loadMonthForecastSummary({
        monthStartIso: nextMonthOption.startIso,
        referenceDate: new Date(`${nextMonthOption.startIso}T12:00:00.000Z`),
        reason: "help_assistant_financial_next",
        userId,
        moneyViewScope: scopePreference.scopeView,
      });

      const surface = await loadBudgetPlanForSurface({
        referenceDate,
        planKey: "default",
        timelineReference: new Date(),
        forecastReason: "help_assistant_financial_context",
        forecastSummary: currentForecast,
        userId,
        moneyViewScope: scopePreference.scopeView,
      });

      const plan = surface.plan;
      const forecast = surface.forecast;
      const activeForecast = forecast || currentForecast;
      const currentBalance = await loadLatestKnownBalanceSnapshot(
        userId,
        scopePreference.scopeView,
      ).catch(() => ({ balance: null, date: null }));
      const budgetFlags = await listBankAccountBudgetFlags(
        userId,
        scopePreference.scopeView,
      ).catch(
        () => null,
      );
      const categoryById = await loadFinancialCategoryMap().catch(
        () => null,
      );
      const [currentMonthSpend, currentWeekSpend] = await Promise.all([
        categoryById
          ? resolveFinancialCategorySpendBreakdown({
              userId,
              startIso: selectedMonth.startIso,
              endIsoExclusive: selectedMonth.endIso,
              budgetFlags,
              categoryById,
            }).catch(() => emptyFinancialCategorySpendBreakdown())
          : Promise.resolve(emptyFinancialCategorySpendBreakdown()),
        categoryById
          ? resolveFinancialCategorySpendBreakdown({
              userId,
              startIso: currentWeekStart.toISOString().slice(0, 10),
              endIsoExclusive: currentWeekEnd.toISOString().slice(0, 10),
              budgetFlags,
              categoryById,
            }).catch(() => emptyFinancialCategorySpendBreakdown())
          : Promise.resolve(emptyFinancialCategorySpendBreakdown()),
      ]);
      const monthSnapshot = getMonthVariableBudgetSnapshot(plan);
      const currentWeek =
        plan.weeklyVariablePlan.find((week) => week.isCurrentWeek) || null;
      const weekSnapshot = getWeekBudgetSnapshot(currentWeek);
      const remainingVariableExpenseEstimate =
        getInsightsRemainingVariableExpenseEstimate({
          forecast: activeForecast,
          budgetPlan: plan,
        });
      const remainingPlannedExpenseTotal = getInsightsRemainingPlannedExpenseTotal({
        forecast: activeForecast,
        budgetPlan: plan,
      });
      const remainingMonthNetTotal = getInsightsRemainingMonthNetTotal({
        forecast: activeForecast,
        budgetPlan: plan,
      });
      const expectedEndBalance = getInsightsDisplayExpectedEndBalance({
        forecast: activeForecast,
        budgetPlan: plan,
      });
      const safetyCopy = resolveSafetyContextCopy({
        anchorLabel: surface.nextIncomeLabelAnchor,
        anchorDate: surface.nextIncomeDateAnchor,
        isEstimatedAnchorDate: surface.safeToSpendIsEstimatedAnchorDate,
      });
      const surfaceStatus = resolveFinancialSurfaceStatus({
        activeMonthLabel: selectedMonth.monthLabel,
        expectedEndOperationalBalance:
          surface.balances?.expectedEndOperationalBalance?.amount ??
          expectedEndBalance,
        remainingMonthlyBudget: monthSnapshot.remaining,
        monthBudgetTone: monthSnapshot.tone,
      });
      const currentWeekBudget = currentWeek?.budget ?? null;
      const currentWeekActual = currentWeek?.actual ?? null;
      const currentWeekRemaining = currentWeek?.remaining ?? null;

      const dataGaps: string[] = [];
      const hasBudgetSignals = monthSnapshot.remaining != null;
      const hasBalanceSignals = currentBalance.balance != null;
      const hasSpendingSignals =
        currentMonthSpend.transactionCount > 0 ||
        currentWeekSpend.transactionCount > 0;
      const hasCategorySignals =
        Boolean(categoryById) &&
        (currentMonthSpend.categories.length > 0 ||
          currentWeekSpend.categories.length > 0);
      const hasPlanningSignals =
        activeForecast?.upcomingCommittedExpenseTotal != null ||
        activeForecast?.expectedFixedCosts != null ||
        activeForecast?.expectedSubscriptions != null ||
        remainingPlannedExpenseTotal != null ||
        remainingVariableExpenseEstimate != null;
      const hasForecastSignals =
        activeForecast?.expectedEndBalance != null ||
        activeForecast?.lowestExpectedBalance != null ||
        remainingMonthNetTotal != null;

      if (usedFallback) dataGaps.push("periode_niet_specifiek");
      if (!hasBudgetSignals) dataGaps.push("budgetruimte_onvolledig");
      if (!hasBalanceSignals) dataGaps.push("saldo_ontbreekt");
      if (!hasSpendingSignals) dataGaps.push("uitgaven_ontbreken");
      if (!hasCategorySignals) dataGaps.push("categorieverdeling_ontbreekt");
      if (!hasPlanningSignals) dataGaps.push("planning_signalen_beperkt");
      if (!hasForecastSignals) dataGaps.push("forecast_signalen_beperkt");
      if (!nextForecast) dataGaps.push("volgende_maand_forecast_ontbreekt");

      const confidence =
        hasBudgetSignals &&
        hasPlanningSignals &&
        hasForecastSignals &&
        hasBalanceSignals &&
        hasSpendingSignals &&
        hasCategorySignals
          ? nextForecast
            ? "high"
            : "medium"
          : hasBudgetSignals ||
              hasPlanningSignals ||
              hasForecastSignals ||
              hasBalanceSignals ||
              hasSpendingSignals
            ? "medium"
            : "low";

      return {
        period: {
          key: selectedMonth.key,
          label: selectedMonth.label,
          startIso: selectedMonth.startIso,
          endIsoExclusive: selectedMonth.endIso,
          referenceDateIso: referenceDate.toISOString(),
          usedFallbackPeriod: usedFallback,
        },
        budget: {
          remainingVariableBudget: monthSnapshot.remaining,
          spentVariableBudget: monthSnapshot.spent,
          totalVariableBudget: monthSnapshot.budget,
          monthStatusLabel: monthSnapshot.label,
          monthRiskTone: monthSnapshot.tone,
          weekRemainingBudget: weekSnapshot.remaining,
          weekStatusLabel: weekSnapshot.label,
          weekRiskTone: weekSnapshot.tone,
          weekTempoDelta: weekSnapshot.tempoDelta,
        },
        currentBalance,
        spending: {
          currentMonthTotal: currentMonthSpend.total,
          currentWeekTotal: currentWeekSpend.total,
          currentMonthBreakdown: currentMonthSpend,
          currentWeekBreakdown: currentWeekSpend,
        },
        trend: {
          monthStatusLabel: monthSnapshot.label,
          monthRiskTone: monthSnapshot.tone,
          weekStatusLabel: weekSnapshot.label,
          weekRiskTone: weekSnapshot.tone,
          weekTempoDelta: weekSnapshot.tempoDelta,
          monthProgress: roundEuro(plan.monthProgress * 100) / 100,
        },
        budgetPlan: {
          monthlyBudgetTotal: plan.monthlyBudgetTotal,
          weeklyBudgetTotal: plan.weeklyBudgetTotal,
          fixedCostsBudget: plan.flowSummary.fixedCostsBudget,
          subscriptionsBudget: plan.flowSummary.subscriptionsBudget,
          variableBudget: plan.flowSummary.variableBudget,
          variableSubcategoriesBudgetTotal:
            plan.flowSummary.variableSubcategoriesBudgetTotal,
          appliedSavingsTarget: plan.flowSummary.appliedSavingsTarget,
          currentWeekBudget,
          currentWeekActual,
          currentWeekRemaining,
          subtotalAfterFixed: plan.flowSummary.subtotalAfterFixed,
          subtotalAfterSubscriptions: plan.flowSummary.subtotalAfterSubscriptions,
          variableCategoryBudgets: Array.from(
            buildVariableCategoryBudgetMap(plan.recommendations).values(),
          ),
        },
        planning: {
          upcomingCommittedExpenseTotal:
            activeForecast?.upcomingCommittedExpenseTotal ?? null,
          upcomingCommittedIncomeTotal:
            activeForecast?.upcomingCommittedIncomeTotal ?? null,
          expectedFixedCosts: activeForecast?.expectedFixedCosts ?? null,
          expectedSubscriptions: activeForecast?.expectedSubscriptions ?? null,
          remainingPlannedExpenseTotal,
          remainingVariableExpenseEstimate,
        },
        forecastCurrentMonth: {
          hasData: Boolean(activeForecast),
          expectedEndBalance,
          lowestExpectedBalance: activeForecast?.lowestExpectedBalance ?? null,
          riskFlag: activeForecast?.riskFlag || "none",
          cashRiskFlag: activeForecast?.cashRiskFlag || "none",
          remainingMonthNetTotal,
          forecastReferenceDate: activeForecast?.forecastReferenceDate ?? null,
        },
        forecastNextMonth: {
          hasData: Boolean(nextForecast),
          monthKey: nextMonthOption.key,
          monthLabel: nextMonthOption.label,
          expectedEndBalance: nextForecast?.expectedEndBalance ?? null,
          riskFlag: nextForecast?.riskFlag || "none",
          cashRiskFlag: nextForecast?.cashRiskFlag || "none",
          forecastReferenceDate: nextForecast?.forecastReferenceDate ?? null,
        },
        surfaceSemantics: {
          remainingMonthlyBudget: monthSnapshot.remaining,
          expectedEndOperationalBalance:
            surface.balances?.expectedEndOperationalBalance?.amount ??
            expectedEndBalance,
          freeToSpendNow:
            surface.balances?.freeToSpendNow?.amount ??
            activeForecast?.freeToSpendNow ??
            null,
          safeToSpendUntilNextIncome: surface.safeToSpendUntilNextIncome ?? null,
          nextIncomeDateAnchor: surface.nextIncomeDateAnchor ?? null,
          nextIncomeAmountAnchor: surface.nextIncomeAmountAnchor ?? null,
          nextIncomeAmountAnchorMeta: surface.nextIncomeAmountAnchorMeta
            ? {
                isAvailable: Boolean(
                  surface.nextIncomeAmountAnchorMeta.isAvailable,
                ),
                isCanonical: Boolean(
                  surface.nextIncomeAmountAnchorMeta.isCanonical,
                ),
                isDerived: Boolean(surface.nextIncomeAmountAnchorMeta.isDerived),
                isFallback: Boolean(
                  surface.nextIncomeAmountAnchorMeta.isFallback,
                ),
                source: String(
                  surface.nextIncomeAmountAnchorMeta.source || "safety_anchor",
                ),
                dataGapReason:
                  surface.nextIncomeAmountAnchorMeta.dataGapReason == null
                    ? null
                    : String(surface.nextIncomeAmountAnchorMeta.dataGapReason),
              }
            : createAssistantDataMeta({
                isAvailable: false,
                isCanonical: false,
                isDerived: false,
                isFallback: true,
                source: "surface_semantics_fallback",
                dataGapReason: "next_income_amount_meta_missing",
              }),
          knownUpcomingFixedCostsUntilAnchor:
            surface.knownUpcomingFixedCostsUntilAnchor ?? null,
          knownUpcomingSubscriptionsUntilAnchor:
            surface.knownUpcomingSubscriptionsUntilAnchor ?? null,
          safeToSpendConfidenceScore:
            surface.safeToSpendConfidenceScore ?? null,
          safeToSpendLabel: safetyCopy.fullLabel,
          safeToSpendSubtitle: safetyCopy.sheetSubtitle,
          statusLabel: surfaceStatus.label,
          statusTone: surfaceStatus.tone,
        },
        quality: {
          cacheHit: false,
          fetchedAtIso: new Date().toISOString(),
          cacheTtlMs: UNIFIED_FINANCIAL_CONTEXT_CACHE_TTL_MS,
          hasBudgetSignals,
          hasPlanningSignals,
          hasForecastSignals,
          hasBalanceSignals,
          hasSpendingSignals,
          hasCategorySignals,
          confidence,
          dataGaps,
        },
      } satisfies UnifiedFinancialAdviceContextBase;
    },
  );

  const baseContext: UnifiedFinancialAdviceContextBase = {
    ...cached.value,
    quality: {
      ...cached.value.quality,
      cacheHit: cached.cacheHit,
    },
  };

  // Source precedence for spending advice stays explicit:
  // 1) canonical surface + budget + forecast signals
  // 2) existing unified fallback fields
  // 3) null with data gap, never invented data.
  const spendingAdvice = buildAssistantReadySpendingAdvice({
    baseContext,
    question: input.question,
    requestedAmount: input.requestedAmount,
  });
  const quality =
    (() => {
      const dataGaps = [...baseContext.quality.dataGaps];

      if (spendingAdvice.categoryStatus?.status === "tracked_without_budget") {
        if (!dataGaps.includes("categoriebudget_niet_beschikbaar")) {
          dataGaps.push("categoriebudget_niet_beschikbaar");
        }
      }

      if (
        spendingAdvice.categoryStatus?.budgetAvailability === "bucket_only" &&
        !dataGaps.includes("categoriebudget_alleen_bucketniveau")
      ) {
        dataGaps.push("categoriebudget_alleen_bucketniveau");
      }

      if (
        !spendingAdvice.cashflowSafety.nextIncomeAmountMeta.isAvailable &&
        !dataGaps.includes("volgende_inkomstenbedrag_onbetrouwbaar")
      ) {
        dataGaps.push("volgende_inkomstenbedrag_onbetrouwbaar");
      }

      return {
        ...baseContext.quality,
        dataGaps,
      };
    })();

  return {
    ...baseContext,
    spendingAdvice,
    quality,
  };
}
