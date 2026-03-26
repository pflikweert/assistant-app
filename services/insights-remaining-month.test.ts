import {
  getInsightsDisplayExpectedEndBalance,
  getInsightsRemainingExpenseTotal,
  getInsightsRemainingMonthNetTotal,
  getInsightsRemainingPlannedExpenseTotal,
  getInsightsRemainingVariableExpenseEstimate,
} from "@/services/insights-remaining-month";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

function buildForecast(
  input?: Partial<InsightsForecastSummary>,
): InsightsForecastSummary {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: "2026-03-25",
    currentBalanceAnchor: input?.currentBalanceAnchor ?? 428.41,
    currentBalanceAnchorDate: input?.currentBalanceAnchorDate ?? "2026-03-25",
    cashRiskFlag: input?.cashRiskFlag ?? "none",
    riskFlag: input?.riskFlag ?? "none",
    expectedEndBalance: input?.expectedEndBalance ?? 861.75,
    lowestExpectedBalance: input?.lowestExpectedBalance ?? null,
    lowestExpectedBalanceDate: input?.lowestExpectedBalanceDate ?? null,
    nextExpectedEventDate: input?.nextExpectedEventDate ?? null,
    nextExpectedEventLabel: input?.nextExpectedEventLabel ?? null,
    expectedIncomeTotal: input?.expectedIncomeTotal ?? null,
    remainingExpectedIncomeTotal: input?.remainingExpectedIncomeTotal ?? 2456.82,
    remainingExpectedExpenseTotal: input?.remainingExpectedExpenseTotal ?? 952.59,
    remainingExpectedSavingsOutflowTotal:
      input?.remainingExpectedSavingsOutflowTotal ?? 0,
    upcomingCommittedIncomeTotal: input?.upcomingCommittedIncomeTotal ?? null,
    upcomingCommittedExpenseTotal: input?.upcomingCommittedExpenseTotal ?? null,
    expectedFixedCosts: input?.expectedFixedCosts ?? null,
    expectedSubscriptions: input?.expectedSubscriptions ?? null,
    expectedVariableCosts: input?.expectedVariableCosts ?? 524.18,
  };
}

function buildBudgetPlan(input?: {
  variableSpent?: number;
  weeklyRemaining?: number[];
}): BudgetPlanComputation {
  return {
    monthToDateExpenses: {
      variableCosts: input?.variableSpent ?? 0,
    },
    weeklyVariablePlan: (input?.weeklyRemaining ?? [284.36]).map((remaining) => ({
      isPastWeek: false,
      remaining,
    })),
  } as unknown as BudgetPlanComputation;
}

describe("insights remaining month helpers", () => {
  it("gebruikt dezelfde resterende-maand logica voor expense, netto en eindsaldo", () => {
    const forecast = buildForecast();
    const budgetPlan = buildBudgetPlan();

    expect(
      getInsightsRemainingVariableExpenseEstimate({ forecast, budgetPlan }),
    ).toBe(284.36);
    expect(
      getInsightsRemainingPlannedExpenseTotal({ forecast, budgetPlan }),
    ).toBe(428.41);
    expect(getInsightsRemainingExpenseTotal({ forecast, budgetPlan })).toBe(712.77);
    expect(getInsightsRemainingMonthNetTotal({ forecast, budgetPlan })).toBe(1744.05);
    expect(getInsightsDisplayExpectedEndBalance({ forecast, budgetPlan })).toBe(
      2172.46,
    );
  });

  it("kan een actueler saldo gebruiken dan het forecast-anker", () => {
    const forecast = buildForecast({
      currentBalanceAnchor: 428.41,
      currentBalanceAnchorDate: "2026-03-24",
    });
    const budgetPlan = buildBudgetPlan();

    expect(
      getInsightsDisplayExpectedEndBalance({
        forecast,
        budgetPlan,
        currentBalanceOverride: 531.82,
      }),
    ).toBe(2275.87);
  });
});
