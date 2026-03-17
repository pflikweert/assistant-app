import { describe, expect, it } from "vitest";

import { resolveForecastExpenseBaselines } from "./forecast-expense-baseline";

describe("resolveForecastExpenseBaselines", () => {
  it("uses budget plan totals when the forecast source is budget settings", () => {
    const baselines = resolveForecastExpenseBaselines({
      historyForecast: {
        fixedCosts: 820,
        subscriptions: 55,
        variableCosts: 310,
        savingsTransfers: 80,
      },
      budgetPlan: {
        settings: {
          forecastExpenseSource: "budget_settings",
        },
        flowSummary: {
          fixedCostsBudget: 900,
          subscriptionsBudget: 60,
          variableBudget: 280,
          appliedSavingsTarget: 150,
        },
      } as any,
      monthToDateExpenses: {
        fixedCosts: 650,
        subscriptions: 60,
        variableCosts: 120,
        savingsTransfer: 0,
      } as any,
    });

    expect(baselines).toEqual({
      fixedCosts: 900,
      subscriptions: 60,
      variableCosts: 280,
      savingsTransfers: 150,
      source: "budget_settings",
    });
  });

  it("falls back to trend/history when the forecast source is trend", () => {
    const baselines = resolveForecastExpenseBaselines({
      historyForecast: {
        fixedCosts: 820,
        subscriptions: 55,
        variableCosts: 310,
        savingsTransfers: 80,
      },
      budgetPlan: {
        settings: {
          forecastExpenseSource: "trend",
        },
        trend: {
          expenses: {
            fixedCosts: 840,
            subscriptions: 52,
            variableCosts: 330,
            savingsTransfer: 100,
          },
        },
        flowSummary: {
          fixedCostsBudget: 900,
          subscriptionsBudget: 60,
          variableBudget: 280,
          appliedSavingsTarget: 150,
        },
      } as any,
      monthToDateExpenses: {
        fixedCosts: 650,
        subscriptions: 20,
        variableCosts: 90,
        savingsTransfer: 0,
      } as any,
    });

    expect(baselines).toEqual({
      fixedCosts: 840,
      subscriptions: 55,
      variableCosts: 330,
      savingsTransfers: 100,
      source: "trend",
    });
  });
});
