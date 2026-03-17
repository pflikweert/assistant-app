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

export function resolveForecastExpenseBaselines(params: {
  historyForecast: HistoryExpenseForecast;
  budgetPlan: BudgetPlanComputation | null;
  monthToDateExpenses: BudgetExpenseBreakdown | null;
}) {
  const { historyForecast, budgetPlan, monthToDateExpenses } = params;

  const preferredSource = budgetPlan?.settings.forecastExpenseSource || "trend";
  const trendExpenses = budgetPlan?.trend?.expenses || null;

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
        historyForecast.fixedCosts,
        asNumber(trendExpenses?.fixedCosts, 0),
        asNumber(monthToDateExpenses?.fixedCosts, 0),
      ),
    ),
    subscriptions: round2(
      Math.max(
        historyForecast.subscriptions,
        asNumber(trendExpenses?.subscriptions, 0),
        asNumber(monthToDateExpenses?.subscriptions, 0),
      ),
    ),
    variableCosts: round2(
      Math.max(
        historyForecast.variableCosts,
        asNumber(trendExpenses?.variableCosts, 0),
        asNumber(monthToDateExpenses?.variableCosts, 0),
      ),
    ),
    savingsTransfers: round2(
      Math.max(
        historyForecast.savingsTransfers,
        asNumber(trendExpenses?.savingsTransfer, 0),
        asNumber(monthToDateExpenses?.savingsTransfer, 0),
      ),
    ),
    source: "trend" as const,
  } satisfies ForecastExpenseBaselines;
}
