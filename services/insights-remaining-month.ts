import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getFallbackRemainingVariableExpenseEstimate(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
}) {
  const { forecast, budgetPlan } = params;
  if (!forecast || forecast.expectedVariableCosts == null) return null;

  const variableSpent = Math.max(
    Number(budgetPlan?.monthToDateExpenses.variableCosts || 0),
    0,
  );

  return round2(Math.max(forecast.expectedVariableCosts - variableSpent, 0));
}

function resolveExplicitForecastEndBalance(
  forecast: InsightsForecastSummary | null,
) {
  if (!forecast) return null;
  return forecast.expectedEndOperationalBalance ?? forecast.expectedEndBalance ?? null;
}

export function getInsightsRemainingVariableExpenseEstimate(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
}) {
  const { budgetPlan } = params;

  if (budgetPlan?.weeklyVariablePlan) {
    return round2(
      (budgetPlan.weeklyVariablePlan || [])
        .filter((row) => !row.isPastWeek)
        .reduce((sum, row) => sum + Math.max(Number(row.remaining || 0), 0), 0),
    );
  }

  return getFallbackRemainingVariableExpenseEstimate(params);
}

export function getInsightsRemainingPlannedExpenseTotal(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
}) {
  const { forecast } = params;
  if (!forecast) return null;

  const fallbackVariable =
    getFallbackRemainingVariableExpenseEstimate(params) ?? 0;

  return round2(
    Math.max((forecast.remainingExpectedExpenseTotal ?? 0) - fallbackVariable, 0),
  );
}

export function getInsightsRemainingExpenseTotal(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
}) {
  const { forecast } = params;
  if (!forecast) return null;

  return round2(
    (getInsightsRemainingPlannedExpenseTotal(params) ?? 0) +
      (getInsightsRemainingVariableExpenseEstimate(params) ?? 0),
  );
}

export function getInsightsRemainingMonthNetTotal(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
}) {
  const { forecast } = params;
  if (!forecast) return null;

  return round2(
    (forecast.remainingExpectedIncomeTotal ?? 0) -
      (getInsightsRemainingExpenseTotal(params) ?? 0) -
      (forecast.remainingExpectedSavingsOutflowTotal ?? 0),
  );
}

export function resolveForecastDisplayExpectedEndBalance(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
  currentBalanceOverride?: number | null;
}) {
  const { forecast } = params;
  if (!forecast) return null;

  const explicitExpectedEndBalance = resolveExplicitForecastEndBalance(forecast);
  const remainingNet = getInsightsRemainingMonthNetTotal(params);
  const effectiveCurrentBalance =
    params.currentBalanceOverride != null
      ? params.currentBalanceOverride
      : forecast.currentOperationalBalance ?? forecast.currentBalanceAnchor;

  if (effectiveCurrentBalance != null && remainingNet != null) {
    const computedExpectedEndBalance = round2(
      effectiveCurrentBalance + remainingNet,
    );

    if (explicitExpectedEndBalance == null) {
      return computedExpectedEndBalance;
    }

    if (Math.abs(explicitExpectedEndBalance - computedExpectedEndBalance) > 0.01) {
      return computedExpectedEndBalance;
    }

    return explicitExpectedEndBalance;
  }

  return explicitExpectedEndBalance;
}

export function getInsightsDisplayExpectedEndBalance(params: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
  currentBalanceOverride?: number | null;
}) {
  return resolveForecastDisplayExpectedEndBalance(params);
}
