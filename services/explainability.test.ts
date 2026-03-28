import { buildForecastSurfaceConfidence } from "@/services/confidence-model";
import { buildForecastSurfaceExplainability } from "@/services/explainability";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { ReserveSurfaceBreakdown } from "@/services/reserve-surface";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

function snapshot(): FinancialSurfaceBalanceSnapshot {
  const value = (
    amount: number | null,
    source: FinancialSurfaceBalanceSnapshot["operationalBalance"]["source"] = "forecast_anchor",
  ) => ({ amount, source });
  return {
    operationalBalance: value(2748.36),
    reservedBalance: value(107.16, "derived"),
    netWorth: value(2748.36),
    freeToSpend: value(0, "budget_remaining"),
    currentOperationalBalance: value(2748.36),
    currentReservedBalance: value(107.16, "derived"),
    currentNetWorth: value(2748.36),
    freeToSpendNow: value(2648.36, "derived"),
    expectedEndOperationalBalance: value(1803.31),
    expectedEndNetWorth: value(1803.31),
    carryoverIntoNextMonth: value(1803.31),
    lowestOperationalPointInMonth: value(359.52),
  };
}

function forecast(): InsightsForecastSummary {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: "2026-03-27",
    currentBalanceAnchor: 2748.36,
    currentBalanceAnchorDate: "2026-03-27",
    currentOperationalBalance: 2748.36,
    currentReservedBalance: 107.16,
    currentNetWorth: 2748.36,
    freeToSpendNow: 2648.36,
    cashRiskFlag: "none",
    riskFlag: "none",
    expectedEndBalance: 1803.31,
    expectedEndOperationalBalance: 1803.31,
    expectedEndNetWorth: 1803.31,
    lowestExpectedBalance: 359.52,
    lowestExpectedBalanceDate: "2026-03-28",
    lowestOperationalPointInMonth: 359.52,
    nextExpectedEventDate: null,
    nextExpectedEventLabel: null,
    expectedIncomeTotal: 0.33,
    remainingExpectedIncomeTotal: 0.33,
    remainingExpectedExpenseTotal: 945.38,
    remainingExpectedSavingsOutflowTotal: 0,
    upcomingCommittedIncomeTotal: 0.33,
    upcomingCommittedExpenseTotal: 731.38,
    expectedFixedCosts: 731.38,
    expectedSubscriptions: 0,
    expectedVariableCosts: 214,
  };
}

function reserveBreakdown(): ReserveSurfaceBreakdown {
  return {
    reservedInAccountsNow: 7.16,
    reservedProtectedInOperationalNow: 100,
    plannedReserveAllocationThisMonth: 100,
    annualObligationMonthlyTotal: 0,
    savingsTargetMonthly: 100,
    activeAnnualRuleCount: 0,
    activeManualAnnualRuleCount: 0,
    activeInferredAnnualRuleCount: 0,
    source: "modeled",
  };
}

describe("buildForecastSurfaceExplainability", () => {
  it("houdt free-to-spend uitleg in lijn met reserved semantics", () => {
    const confidence = buildForecastSurfaceConfidence({
      forecast: forecast(),
      plan: null,
      balances: snapshot(),
      reserveBreakdown: reserveBreakdown(),
    });
    const result = buildForecastSurfaceExplainability({
      balances: snapshot(),
      reserveBreakdown: reserveBreakdown(),
      confidence,
    });

    expect(result.items.find((item) => item.key === "free_to_spend")?.message).toContain(
      "gereserveerde buffer",
    );
  });

  it("legt jaarlijkse lasten correct uit op basis van reserve rules", () => {
    const reserveWithAnnual = {
      ...reserveBreakdown(),
      annualObligationMonthlyTotal: 45,
      activeAnnualRuleCount: 1,
      activeInferredAnnualRuleCount: 1,
    };
    const confidence = buildForecastSurfaceConfidence({
      forecast: forecast(),
      plan: null,
      balances: snapshot(),
      reserveBreakdown: reserveWithAnnual,
    });
    const result = buildForecastSurfaceExplainability({
      balances: snapshot(),
      reserveBreakdown: reserveWithAnnual,
      confidence,
    });

    expect(result.items.find((item) => item.key === "annual_obligations")?.message).toContain(
      "per maand opzij",
    );
  });

  it("blijft consistent met de expected-end berekening", () => {
    const confidence = buildForecastSurfaceConfidence({
      forecast: forecast(),
      plan: {
        monthToDateExpenses: { variableCosts: 0 },
        weeklyVariablePlan: [{ remaining: 214, isPastWeek: false }],
      } as BudgetPlanComputation,
      balances: snapshot(),
      reserveBreakdown: reserveBreakdown(),
    });
    const result = buildForecastSurfaceExplainability({
      balances: snapshot(),
      reserveBreakdown: reserveBreakdown(),
      confidence,
    });

    expect(result.items.find((item) => item.key === "expected_end")?.message).toContain(
      "resterende maandmutatie",
    );
  });
});
