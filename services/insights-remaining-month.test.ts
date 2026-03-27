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
    currentOperationalBalance:
      input?.currentOperationalBalance ?? input?.currentBalanceAnchor ?? 428.41,
    cashRiskFlag: input?.cashRiskFlag ?? "none",
    riskFlag: input?.riskFlag ?? "none",
    expectedEndBalance: input?.expectedEndBalance ?? 861.75,
    expectedEndOperationalBalance:
      input?.expectedEndOperationalBalance ?? input?.expectedEndBalance ?? 861.75,
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

  it("valt terug op het actuele saldo als de forecast-eindstand nog ontbreekt", () => {
    const forecast = buildForecast({
      currentBalanceAnchor: 428.41,
      currentBalanceAnchorDate: "2026-03-24",
    });
    forecast.expectedEndBalance = null;
    forecast.expectedEndOperationalBalance = null;
    const budgetPlan = buildBudgetPlan();

    expect(
      getInsightsDisplayExpectedEndBalance({
        forecast,
        budgetPlan,
        currentBalanceOverride: 531.82,
      }),
    ).toBe(2275.87);
  });

  it("houdt de expliciete forecast-eindstand wanneer die gelijk is aan de berekening", () => {
    const forecast = buildForecast({
      currentBalanceAnchor: 428.41,
      expectedEndBalance: 861.75,
      expectedEndOperationalBalance: 861.75,
      remainingExpectedIncomeTotal: 500,
      remainingExpectedExpenseTotal: 170.07,
      remainingExpectedSavingsOutflowTotal: 0,
      expectedVariableCosts: 0,
    });
    const budgetPlan = buildBudgetPlan({
      variableSpent: 0,
      weeklyRemaining: [],
    });

    expect(
      getInsightsDisplayExpectedEndBalance({
        forecast,
        budgetPlan,
        currentBalanceOverride: 531.82,
      }),
    ).toBe(861.75);
  });

  it("vervangt een stalen legacy eindwaarde wanneer de operationele maandmutatie anders uitkomt", () => {
    const forecast = buildForecast({
      currentBalanceAnchor: 2748.36,
      currentOperationalBalance: 2748.36,
      expectedEndBalance: 359.85,
      expectedEndOperationalBalance: 359.85,
      remainingExpectedIncomeTotal: 0.33,
      remainingExpectedExpenseTotal: 945.38,
      remainingExpectedSavingsOutflowTotal: 0,
      expectedVariableCosts: 214,
    });
    const budgetPlan = buildBudgetPlan({
      variableSpent: 214,
      weeklyRemaining: [],
    });

    expect(
      getInsightsDisplayExpectedEndBalance({
        forecast,
        budgetPlan,
        currentBalanceOverride: 2748.36,
      }),
    ).toBe(1803.31);
  });
});
