import type {
  BudgetExpenseBreakdown,
  BudgetPlanComputation,
  BudgetForecastExpenseSource,
} from "@/types/categorization";

type HistoryExpenseForecast = {
  fixedCosts: number;
  subscriptions: number;
  variableCosts: number;
  savingsTransfers: number;
};

type ForecastExpenseBaselines = {
  fixedCosts: number;
  subscriptions: number;
  variableCosts: number;
  projectedVariableCostsTotal: number | null;
  savingsTransfers: number;
  source: BudgetForecastExpenseSource;
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveProjectedVariableCostsTotal(
  budgetPlan: BudgetPlanComputation | null,
  monthToDateExpenses: BudgetExpenseBreakdown | null,
) {
  if (!budgetPlan || !monthToDateExpenses) return null;

  const remainingVariableForecast = round2(
    (budgetPlan.weeklyVariablePlan || [])
      .filter((row) => !row.isPastWeek)
      .reduce((sum, row) => sum + Math.max(asNumber(row.remaining, 0), 0), 0),
  );

  return round2(
    Math.max(asNumber(monthToDateExpenses.variableCosts, 0), 0) +
      remainingVariableForecast,
  );
}

export function resolveForecastExpenseBaselines(params: {
  historyForecast: HistoryExpenseForecast;
  budgetPlan: BudgetPlanComputation | null;
  monthToDateExpenses: BudgetExpenseBreakdown | null;
}) {
  const { historyForecast, budgetPlan, monthToDateExpenses } = params;

  const preferredSource = budgetPlan?.settings.forecastExpenseSource || "trend";
  const trendExpenses = budgetPlan?.trend?.expenses || null;
  const projectedVariableCostsTotal =
    preferredSource === "budget_settings"
      ? resolveProjectedVariableCostsTotal(budgetPlan, monthToDateExpenses)
      : null;

  if (preferredSource === "budget_settings" && budgetPlan) {
    return {
      fixedCosts: round2(
        Math.max(
          asNumber(budgetPlan.flowSummary.fixedCostsBudget, 0),
          asNumber(monthToDateExpenses?.fixedCosts, 0),
        ),
      ),
      subscriptions: round2(
        Math.max(
          asNumber(budgetPlan.flowSummary.subscriptionsBudget, 0),
          asNumber(monthToDateExpenses?.subscriptions, 0),
        ),
      ),
      variableCosts: round2(
        Math.max(
          asNumber(budgetPlan.flowSummary.variableBudget, 0),
          asNumber(monthToDateExpenses?.variableCosts, 0),
        ),
      ),
      projectedVariableCostsTotal,
      savingsTransfers: round2(
        Math.max(
          asNumber(budgetPlan.flowSummary.appliedSavingsTarget, 0),
          asNumber(monthToDateExpenses?.savingsTransfer, 0),
        ),
      ),
      source: "budget_settings" as const,
    } satisfies ForecastExpenseBaselines;
  }

  return {
    fixedCosts: round2(
      Math.max(
        asNumber(trendExpenses?.fixedCosts, historyForecast.fixedCosts),
        asNumber(monthToDateExpenses?.fixedCosts, 0),
      ),
    ),
    subscriptions: round2(
      Math.max(
        asNumber(trendExpenses?.subscriptions, historyForecast.subscriptions),
        asNumber(monthToDateExpenses?.subscriptions, 0),
      ),
    ),
    variableCosts: round2(
      Math.max(
        asNumber(trendExpenses?.variableCosts, historyForecast.variableCosts),
        asNumber(monthToDateExpenses?.variableCosts, 0),
      ),
    ),
    projectedVariableCostsTotal,
    savingsTransfers: round2(
      Math.max(
        asNumber(trendExpenses?.savingsTransfer, historyForecast.savingsTransfers),
        asNumber(monthToDateExpenses?.savingsTransfer, 0),
      ),
    ),
    source: "trend" as const,
  } satisfies ForecastExpenseBaselines;
}
