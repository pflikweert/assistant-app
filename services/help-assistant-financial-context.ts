import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
import { requireCurrentUserId } from "@/services/current-user";
import {
  getInsightsDisplayExpectedEndBalance,
  getInsightsRemainingMonthNetTotal,
  getInsightsRemainingPlannedExpenseTotal,
  getInsightsRemainingVariableExpenseEstimate,
} from "@/services/insights-remaining-month";
import { loadMonthForecastSummary } from "@/services/month-forecast-summary";
import { RequestCache } from "@/services/request-cache";
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
    confidence: "low" | "medium" | "high";
    dataGaps: string[];
  };
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

      const dataGaps: string[] = [];
      const hasBudgetSignals = monthSnapshot.remaining != null;
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
      if (!hasPlanningSignals) dataGaps.push("planning_signalen_beperkt");
      if (!hasForecastSignals) dataGaps.push("forecast_signalen_beperkt");
      if (!nextForecast) dataGaps.push("volgende_maand_forecast_ontbreekt");

      const confidence = hasBudgetSignals && hasPlanningSignals && hasForecastSignals
        ? nextForecast
          ? "high"
          : "medium"
        : hasBudgetSignals || hasPlanningSignals || hasForecastSignals
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
