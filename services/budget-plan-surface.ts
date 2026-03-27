import { computeBudgetPlan } from "@/services/budget-plan";
import { applyBudgetWeekRebalanceGuardrails } from "@/services/budget-week-guardrails";
import {
  buildFinancialBalanceSnapshot,
  type FinancialBalanceSnapshot,
} from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { loadMonthForecastSummary } from "@/services/month-forecast-summary";
import type { BudgetPlanComputation } from "@/types/categorization";

// Canonical surface contract shared by Dashboard, Insights and Budget.
export type ForecastSurfaceSummary = {
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
  userId?: string;
}): Promise<ForecastSurfaceSummary> {
  const {
    referenceDate,
    planKey = "default",
    timelineReference = new Date(),
    forecastReason,
    forecastSummary,
    currentBalanceOverride,
    userId,
  } = params;

  const monthStartIso = startOfMonthIso(referenceDate);

  const [rawPlan, loadedForecast] = await Promise.all([
    computeBudgetPlan(referenceDate, planKey, timelineReference),
    forecastSummary === undefined
      ? loadMonthForecastSummary({
          monthStartIso,
          referenceDate,
          reason: forecastReason,
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
    forecast: loadedForecast,
    plan,
    balances: buildFinancialBalanceSnapshot({
      forecast: loadedForecast,
      plan,
      currentBalanceOverride,
    }),
  };
}
