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
      projectedVariableCostsTotal: 120,
      savingsTransfers: 150,
      source: "budget_settings",
    });
  });

  it("projects current-month variable costs as actual spent plus remaining weekly budget forecast", () => {
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
        weeklyVariablePlan: [
          {
            isPastWeek: true,
            remaining: -25,
          },
          {
            isPastWeek: false,
            remaining: -10,
          },
          {
            isPastWeek: false,
            remaining: 45,
          },
          {
            isPastWeek: false,
            remaining: 60,
          },
        ],
      } as any,
      monthToDateExpenses: {
        fixedCosts: 650,
        subscriptions: 60,
        variableCosts: 190,
        savingsTransfer: 0,
      } as any,
    });

    expect(baselines.projectedVariableCostsTotal).toBe(295);
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
      projectedVariableCostsTotal: null,
      savingsTransfers: 100,
      source: "trend",
    });
  });
});
