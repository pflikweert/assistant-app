import {
  buildFinancialBalanceSnapshot,
  isBankAccountIncludedInLegacyBudgetScope,
  isBankAccountIncludedInLegacyForecastScope,
  isTransactionIncludedInLegacyBudgetScope,
  isTransactionIncludedInLegacyForecastScope,
  resolveFinancialAccountScopeState,
  resolveFinancialTransactionScopeState,
} from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

function buildForecast(
  input?: Partial<InsightsForecastSummary>,
): InsightsForecastSummary {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: "2026-03-27",
    currentBalanceAnchor: input?.currentBalanceAnchor ?? 1480.32,
    currentBalanceAnchorDate: input?.currentBalanceAnchorDate ?? "2026-03-27",
    currentOperationalBalance:
      input?.currentOperationalBalance ?? input?.currentBalanceAnchor ?? 1480.32,
    currentReservedBalance: input?.currentReservedBalance ?? 180,
    currentNetWorth: input?.currentNetWorth ?? 1700.48,
    freeToSpendNow: input?.freeToSpendNow ?? 1340.48,
    cashRiskFlag: input?.cashRiskFlag ?? "none",
    riskFlag: input?.riskFlag ?? "none",
    expectedEndBalance: input?.expectedEndBalance ?? 1695.12,
    expectedEndOperationalBalance:
      input?.expectedEndOperationalBalance ?? input?.expectedEndBalance ?? 1695.12,
    expectedEndNetWorth:
      input?.expectedEndNetWorth ?? input?.expectedEndOperationalBalance ?? input?.expectedEndBalance ?? 1695.12,
    lowestExpectedBalance: input?.lowestExpectedBalance ?? 1260.1,
    lowestExpectedBalanceDate: input?.lowestExpectedBalanceDate ?? "2026-03-29",
    lowestOperationalPointInMonth:
      input?.lowestOperationalPointInMonth ?? input?.lowestExpectedBalance ?? 1260.1,
    nextExpectedEventDate: input?.nextExpectedEventDate ?? "2026-03-30",
    nextExpectedEventLabel: input?.nextExpectedEventLabel ?? "Salaris",
    expectedIncomeTotal: input?.expectedIncomeTotal ?? 3200,
    remainingExpectedIncomeTotal: input?.remainingExpectedIncomeTotal ?? 1400,
    remainingExpectedExpenseTotal: input?.remainingExpectedExpenseTotal ?? 980,
    remainingExpectedSavingsOutflowTotal:
      input?.remainingExpectedSavingsOutflowTotal ?? 205,
    upcomingCommittedIncomeTotal: input?.upcomingCommittedIncomeTotal ?? 1400,
    upcomingCommittedExpenseTotal: input?.upcomingCommittedExpenseTotal ?? 780,
    expectedFixedCosts: input?.expectedFixedCosts ?? 920,
    expectedSubscriptions: input?.expectedSubscriptions ?? 75,
    expectedVariableCosts: input?.expectedVariableCosts ?? 610,
  };
}

function buildPlan(input?: {
  variableBudget?: number;
  variableSpent?: number;
}): BudgetPlanComputation {
  return {
    flowSummary: {
      variableBudget: input?.variableBudget ?? 640,
    },
    monthToDateExpenses: {
      variableCosts: input?.variableSpent ?? 215,
    },
  } as unknown as BudgetPlanComputation;
}

describe("financial semantics", () => {
  it("splitst accountsemantiek expliciet zonder het legacy-pad te breken", () => {
    const included = resolveFinancialAccountScopeState({ includeInBudget: true });
    const excluded = resolveFinancialAccountScopeState({ includeInBudget: false });

    expect(included.explicit.budget).toBe(true);
    expect(included.explicit.forecast).toBe(true);
    expect(included.explicit.netWorth).toBe(true);

    expect(excluded.explicit.budget).toBe(false);
    expect(excluded.explicit.forecast).toBe(true);
    expect(excluded.explicit.netWorth).toBe(true);
    expect(excluded.explicit.operationalBalance).toBe(true);

    expect(isBankAccountIncludedInLegacyBudgetScope(false)).toBe(false);
    expect(isBankAccountIncludedInLegacyForecastScope(false)).toBe(false);
  });

  it("splitst transactiesemantiek expliciet zonder huidige forecastfiltering al te veranderen", () => {
    const regularExcluded = resolveFinancialTransactionScopeState({
      budgetExcluded: true,
      analysisMainGroup: "expense",
      analysisCategory: "fixed_costs",
    });

    expect(regularExcluded.explicit.budget).toBe(false);
    expect(regularExcluded.explicit.freeToSpend).toBe(false);
    expect(regularExcluded.explicit.forecast).toBe(true);
    expect(regularExcluded.explicit.netWorth).toBe(true);

    expect(
      isTransactionIncludedInLegacyBudgetScope({
        budgetExcluded: true,
        analysisMainGroup: "expense",
        analysisCategory: "fixed_costs",
      }),
    ).toBe(false);
    expect(
      isTransactionIncludedInLegacyForecastScope({
        budgetExcluded: true,
        analysisMainGroup: "expense",
        analysisCategory: "fixed_costs",
      }),
    ).toBe(false);
  });

  it("markeert spaaroverboekingen apart van budget en net worth", () => {
    const semantics = resolveFinancialTransactionScopeState({
      budgetExcluded: false,
      analysisMainGroup: "expense",
      analysisCategory: "savings_transfer",
    });

    expect(semantics.explicit.budget).toBe(true);
    expect(semantics.explicit.forecast).toBe(true);
    expect(semantics.explicit.operationalBalance).toBe(true);
    expect(semantics.explicit.reservedBalance).toBe(true);
    expect(semantics.explicit.netWorth).toBe(false);
  });

  it("bouwt een conservatieve balanssnapshot met expliciete geldbetekenis", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentBalanceAnchor: 1520.48,
        currentOperationalBalance: 1520.48,
        currentReservedBalance: 180,
        currentNetWorth: 1700.48,
        freeToSpendNow: 1340.48,
        expectedEndOperationalBalance: 1600.48,
        expectedEndNetWorth: 1780.48,
        lowestOperationalPointInMonth: 1290.12,
      }),
      plan: buildPlan({ variableBudget: 700, variableSpent: 260.25 }),
    });

    expect(snapshot.operationalBalance).toEqual({
      amount: 1520.48,
      source: "forecast_anchor",
    });
    expect(snapshot.freeToSpend).toEqual({
      amount: 439.75,
      source: "budget_remaining",
    });
    expect(snapshot.currentOperationalBalance).toEqual({
      amount: 1520.48,
      source: "forecast_anchor",
    });
    expect(snapshot.freeToSpendNow).toEqual({
      amount: 1340.48,
      source: "forecast_anchor",
    });
    expect(snapshot.expectedEndOperationalBalance).toEqual({
      amount: 1735.48,
      source: "forecast_anchor",
    });
    expect(snapshot.expectedEndOperationalBalance).not.toEqual(
      snapshot.lowestOperationalPointInMonth,
    );
    expect(snapshot.reservedBalance).toEqual({
      amount: 180,
      source: "value",
    });
    expect(snapshot.netWorth).toEqual({
      amount: 1700.48,
      source: "forecast_anchor",
    });
  });

  it("laat free-to-spend leeg als reserved state niet is gemodelleerd", () => {
    const forecast = buildForecast({
      currentBalanceAnchor: 1520.48,
      currentOperationalBalance: 1520.48,
      freeToSpendNow: 1340.48,
    });
    forecast.currentReservedBalance = null;
    forecast.freeToSpendNow = 999.99;

    const snapshot = buildFinancialBalanceSnapshot({
      forecast,
      plan: buildPlan({ variableBudget: 700, variableSpent: 260.25 }),
    });

    expect(snapshot.currentReservedBalance).toEqual({
      amount: null,
      source: "not_configured",
    });
    expect(snapshot.reservedBalance).toEqual({
      amount: null,
      source: "not_configured",
    });
    expect(snapshot.currentOperationalBalance).toEqual({
      amount: 1520.48,
      source: "forecast_anchor",
    });
    expect(snapshot.freeToSpendNow).toEqual({
      amount: null,
      source: "unavailable",
    });
    expect(snapshot.freeToSpend).toEqual({
      amount: 439.75,
      source: "budget_remaining",
    });
  });

  it("onderscheidt een expliciete nul-reserved van ontbrekende data", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentReservedBalance: 0,
        freeToSpendNow: null,
      }),
      plan: buildPlan({ variableBudget: 700, variableSpent: 260.25 }),
    });

    expect(snapshot.currentReservedBalance).toEqual({
      amount: 0,
      source: "zero",
    });
    expect(snapshot.reservedBalance).toEqual({
      amount: 0,
      source: "zero",
    });
    expect(snapshot.freeToSpendNow.amount).not.toBeNull();
  });

  it("gebruikt de berekende operationele eindstand wanneer legacy eindwaarde afwijkt", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentBalanceAnchor: 2748.36,
        currentOperationalBalance: 2748.36,
        expectedEndBalance: 359.85,
        expectedEndOperationalBalance: 359.85,
        remainingExpectedIncomeTotal: 0.33,
        remainingExpectedExpenseTotal: 945.38,
        remainingExpectedSavingsOutflowTotal: 0,
      }),
      plan: buildPlan({ variableBudget: 700, variableSpent: 260.25 }),
    });

    expect(snapshot.expectedEndOperationalBalance).toEqual({
      amount: 1803.31,
      source: "forecast_anchor",
    });
    expect(snapshot.expectedEndOperationalBalance).not.toEqual(
      snapshot.lowestOperationalPointInMonth,
    );
  });

  it("gebruikt de actuele operationele override boven een stalen forecast-basis", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentBalanceAnchor: 359.85,
        currentOperationalBalance: 359.85,
        currentReservedBalance: 0,
        freeToSpendNow: 359.85,
        expectedEndBalance: 359.85,
        expectedEndOperationalBalance: 359.85,
        remainingExpectedIncomeTotal: 0.33,
        remainingExpectedExpenseTotal: 945.38,
        remainingExpectedSavingsOutflowTotal: 0,
        lowestOperationalPointInMonth: 392.82,
      }),
      plan: buildPlan({ variableBudget: 700, variableSpent: 260.25 }),
      currentBalanceOverride: 2748.36,
    });

    expect(snapshot.currentOperationalBalance).toEqual({
      amount: 2748.36,
      source: "forecast_anchor",
    });
    expect(snapshot.freeToSpendNow).toEqual({
      amount: 2748.36,
      source: "derived",
    });
    expect(snapshot.expectedEndOperationalBalance).toEqual({
      amount: 1803.31,
      source: "forecast_anchor",
    });
    expect(snapshot.expectedEndOperationalBalance).not.toEqual(
      snapshot.lowestOperationalPointInMonth,
    );
  });

  it("berekent free-to-spend vanuit operational minus protected reserve, zonder reserve-account dubbeltelling", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentOperationalBalance: 2748.36,
        currentReservedBalance: 500,
        freeToSpendNow: null,
      }),
      plan: buildPlan({ variableBudget: 857, variableSpent: 857 }),
      currentBalanceOverride: 2748.36,
      reserveSurface: {
        reservedInAccountsNow: 1200,
        reservedProtectedInOperationalNow: 945.05,
        plannedReserveAllocationThisMonth: 120,
        annualObligationMonthlyTotal: 60,
        savingsTargetMonthly: 60,
        source: "modeled",
      },
    });

    expect(snapshot.currentReservedBalance).toEqual({
      amount: 2145.05,
      source: "derived",
    });
    expect(snapshot.freeToSpendNow).toEqual({
      amount: 1803.31,
      source: "derived",
    });
  });

  it("houdt free-to-spend gescheiden van maand- en weekbudgetruimte", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentOperationalBalance: 1000,
        currentReservedBalance: 0,
      }),
      plan: buildPlan({ variableBudget: 200, variableSpent: 150 }),
      reserveSurface: {
        reservedInAccountsNow: 400,
        reservedProtectedInOperationalNow: 100,
        plannedReserveAllocationThisMonth: 100,
        annualObligationMonthlyTotal: 50,
        savingsTargetMonthly: 50,
        source: "modeled",
      },
    });

    expect(snapshot.freeToSpend.amount).toBe(50);
    expect(snapshot.freeToSpendNow.amount).toBe(900);
  });

  it("trekt reserve-account context niet dubbel af als operational protection nul is", () => {
    const snapshot = buildFinancialBalanceSnapshot({
      forecast: buildForecast({
        currentOperationalBalance: 1000,
        currentReservedBalance: 400,
      }),
      plan: buildPlan({ variableBudget: 200, variableSpent: 0 }),
      reserveSurface: {
        reservedInAccountsNow: 400,
        reservedProtectedInOperationalNow: null,
        plannedReserveAllocationThisMonth: 0,
        annualObligationMonthlyTotal: 0,
        savingsTargetMonthly: 0,
        source: "modeled",
      },
    });

    expect(snapshot.currentReservedBalance).toEqual({
      amount: 400,
      source: "derived",
    });
    expect(snapshot.freeToSpendNow).toEqual({
      amount: 1000,
      source: "derived",
    });
  });
});
