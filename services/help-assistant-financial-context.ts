import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
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
import { resolveIncomeSemantics } from "@/services/income-semantics";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";

export const UNIFIED_FINANCIAL_CONTEXT_CACHE_TTL_MS = 45_000;

const financialAdviceContextCache = new RequestCache();

export function clearUnifiedFinancialAdviceContextCache() {
  financialAdviceContextCache.clear("help-assistant-financial-context");
}

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

type FinancialCategorySpendSubcategory = {
  key: string;
  label: string;
  amount: number;
  transactionCount: number;
};

type FinancialCategorySpendItem = {
  key: string;
  label: string;
  amount: number;
  transactionCount: number;
  subcategories: FinancialCategorySpendSubcategory[];
};

type FinancialCategorySpendBreakdown = {
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
    const subLabel =
      trailLabels.length > 1 ? trailLabels.slice(1).join(" › ") : mainLabel;
    const subKey = trail.length > 1 ? trail.map((item) => item.id).join("›") : mainKey;

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
        label: subLabel,
        amount: delta,
        transactionCount: 1,
      });
      mainBuckets.set(mainKey, {
        key: mainKey,
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
        label: subLabel,
        amount: delta,
        transactionCount: 1,
      });
    }
  }

  const categories = [...mainBuckets.values()]
    .map((entry) => ({
      key: entry.key,
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
  const currentWeekStart = startOfUtcDay(startOfUtcWeekMonday(referenceDate));
  const currentWeekEnd = addDays(currentWeekStart, 7);

  const cacheKey = [
    "help-assistant-financial-context",
    userId,
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
      });

      const nextForecast = await loadMonthForecastSummary({
        monthStartIso: nextMonthOption.startIso,
        referenceDate: new Date(`${nextMonthOption.startIso}T12:00:00.000Z`),
        reason: "help_assistant_financial_next",
        userId,
      });

      const { plan, forecast } = await loadBudgetPlanForSurface({
        referenceDate,
        planKey: "default",
        timelineReference: new Date(),
        forecastReason: "help_assistant_financial_context",
        forecastSummary: currentForecast,
        userId,
      });

      const activeForecast = forecast || currentForecast;
      const currentBalance = await loadLatestKnownBalanceSnapshot(userId).catch(
        () => ({ balance: null, date: null }),
      );
      const budgetFlags = await listBankAccountBudgetFlags(userId).catch(
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
      } satisfies UnifiedFinancialAdviceContext;
    },
  );

  return {
    ...cached.value,
    quality: {
      ...cached.value.quality,
      cacheHit: cached.cacheHit,
    },
  };
}
