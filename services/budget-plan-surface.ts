import { computeBudgetPlan } from "@/services/budget-plan";
import { applyBudgetWeekRebalanceGuardrails } from "@/services/budget-week-guardrails";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { loadMonthForecastSummary } from "@/services/month-forecast-summary";
import type { BudgetPlanComputation } from "@/types/categorization";

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
  userId?: string;
}): Promise<{
  plan: BudgetPlanComputation;
  forecast: InsightsForecastSummary | null;
}> {
  const {
    referenceDate,
    planKey = "default",
    timelineReference = new Date(),
    forecastReason,
    forecastSummary,
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

  return {
    forecast: loadedForecast,
    plan: applyBudgetWeekRebalanceGuardrails({
      plan: rawPlan,
      forecast: loadedForecast,
      now: timelineReference,
    }),
  };
}
