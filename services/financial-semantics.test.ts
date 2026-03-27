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
    cashRiskFlag: input?.cashRiskFlag ?? "none",
    riskFlag: input?.riskFlag ?? "none",
    expectedEndBalance: input?.expectedEndBalance ?? 1695.12,
    lowestExpectedBalance: input?.lowestExpectedBalance ?? 1260.1,
    lowestExpectedBalanceDate: input?.lowestExpectedBalanceDate ?? "2026-03-29",
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
      forecast: buildForecast({ currentBalanceAnchor: 1520.48 }),
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
    expect(snapshot.reservedBalance).toEqual({
      amount: null,
      source: "not_modeled_yet",
    });
    expect(snapshot.netWorth).toEqual({
      amount: null,
      source: "not_modeled_yet",
    });
  });
});
