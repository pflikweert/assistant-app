import { computeBudgetPlan } from "@/services/budget-plan";
import { applyBudgetWeekRebalanceGuardrails } from "@/services/budget-week-guardrails";
import {
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";
import { loadMoneyViewScopePreference } from "@/services/finance-scope-preference";
import {
  buildFinancialBalanceSnapshot,
  type FinancialBalanceSnapshot,
} from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { loadLatestKnownBalanceSnapshot } from "@/services/latest-known-balance";
import { loadMonthForecastSummary } from "@/services/month-forecast-summary";
import type { BudgetPlanComputation } from "@/types/categorization";

// Canonical surface contract shared by Dashboard, Insights and Budget.
export type ForecastSurfaceSummary = {
  scopeView: MoneyViewScope;
  plan: BudgetPlanComputation;
  forecast: InsightsForecastSummary | null;
  balances: FinancialBalanceSnapshot;
};

function startOfMonthIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export async function loadBudgetPlanForSurface(params: {
  referenceDate: Date;
  planKey?: string;
  timelineReference?: Date;
  forecastReason?: string;
  forecastSummary?: InsightsForecastSummary | null;
  currentBalanceOverride?: number | null;
  moneyViewScope?: MoneyViewScope;
  userId?: string;
}): Promise<ForecastSurfaceSummary> {
  const {
    referenceDate,
    planKey = "default",
    timelineReference = new Date(),
    forecastReason,
    forecastSummary,
    currentBalanceOverride,
    moneyViewScope,
    userId,
  } = params;

  const monthStartIso = startOfMonthIso(referenceDate);
  const resolvedUserId = userId || undefined;
  const scopePreference =
    moneyViewScope != null
      ? { scopeView: moneyViewScope }
      : await loadMoneyViewScopePreference(resolvedUserId).catch(() => ({
          scopeView: "personal" as MoneyViewScope,
        }));
  const resolvedMoneyViewScope = normalizeMoneyViewScope(
    scopePreference.scopeView,
  );
  const latestKnownBalance =
    currentBalanceOverride != null
      ? { balance: currentBalanceOverride, date: null }
      : await loadLatestKnownBalanceSnapshot(
          resolvedUserId,
          resolvedMoneyViewScope,
        ).catch(() => ({ balance: null, date: null }));

  const [rawPlan, loadedForecast] = await Promise.all([
    computeBudgetPlan(
      referenceDate,
      planKey,
      timelineReference,
      resolvedMoneyViewScope,
    ),
    forecastSummary === undefined
      ? loadMonthForecastSummary({
          monthStartIso,
          referenceDate,
          reason: forecastReason,
          moneyViewScope: resolvedMoneyViewScope,
          userId,
        })
      : Promise.resolve(forecastSummary),
  ]);

  const plan = applyBudgetWeekRebalanceGuardrails({
      plan: rawPlan,
      forecast: loadedForecast,
      now: timelineReference,
    });

  return {
    scopeView: resolvedMoneyViewScope,
    forecast: loadedForecast,
    plan,
    balances: buildFinancialBalanceSnapshot({
      forecast: loadedForecast,
      plan,
      currentBalanceOverride: latestKnownBalance.balance,
    }),
  };
}
