import { buildForecastSurfaceConfidence } from "@/services/confidence-model";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { ReserveSurfaceBreakdown } from "@/services/reserve-surface";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

function balances(overrides?: Partial<FinancialSurfaceBalanceSnapshot>) {
  const value = (
    amount: number | null,
    source: FinancialSurfaceBalanceSnapshot["operationalBalance"]["source"] = "forecast_anchor",
  ) => ({ amount, source });

  return {
    operationalBalance: value(2748.36),
    reservedBalance: value(120, "derived"),
    netWorth: value(3000),
    freeToSpend: value(500, "budget_remaining"),
    currentOperationalBalance: value(2748.36),
    currentReservedBalance: value(120, "derived"),
    currentNetWorth: value(3000),
    freeToSpendNow: value(2648.36, "derived"),
    expectedEndOperationalBalance: value(1803.31),
    expectedEndNetWorth: value(1803.31),
    carryoverIntoNextMonth: value(1803.31),
    lowestOperationalPointInMonth: value(392.82),
    ...overrides,
  } as FinancialSurfaceBalanceSnapshot;
}

function forecast(overrides?: Partial<InsightsForecastSummary>) {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: "2026-03-27",
    currentBalanceAnchor: 2748.36,
    currentBalanceAnchorDate: "2026-03-27",
    currentOperationalBalance: 2748.36,
    currentReservedBalance: 120,
    currentNetWorth: 3000,
    freeToSpendNow: 2648.36,
    cashRiskFlag: "none",
    riskFlag: "none",
    expectedEndBalance: 1803.31,
    expectedEndOperationalBalance: 1803.31,
    expectedEndNetWorth: 1803.31,
    lowestExpectedBalance: 392.82,
    lowestExpectedBalanceDate: "2026-03-28",
    lowestOperationalPointInMonth: 392.82,
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
    ...overrides,
  } as InsightsForecastSummary;
}

function reserve(overrides?: Partial<ReserveSurfaceBreakdown>) {
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
    ...overrides,
  } as ReserveSurfaceBreakdown;
}

describe("buildForecastSurfaceConfidence", () => {
  it("geeft hoog vertrouwen bij stabiele maanddata met harde recurring signalen", () => {
    const result = buildForecastSurfaceConfidence({
      forecast: forecast(),
      plan: {
        weeklyVariablePlan: [{ isPastWeek: false }, { isPastWeek: false }, { isPastWeek: false }],
      } as BudgetPlanComputation,
      balances: balances(),
      reserveBreakdown: reserve(),
    });

    expect(result.expectedEndOperationalBalance.level).toBe("high");
    expect(result.inferredRecurringIncome.level).toBe("high");
    expect(result.freeToSpendNow.level).toBe("high");
  });

  it("valt terug naar indicatief bij beperkte of inconsistente data", () => {
    const result = buildForecastSurfaceConfidence({
      forecast: forecast({
        forecastReferenceDate: null,
        remainingExpectedIncomeTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedVariableCosts: null,
      }),
      plan: null,
      balances: balances({
        currentOperationalBalance: { amount: null, source: "unavailable" },
        freeToSpendNow: { amount: null, source: "unavailable" },
        expectedEndOperationalBalance: { amount: null, source: "unavailable" },
        lowestOperationalPointInMonth: { amount: null, source: "unavailable" },
      }),
      reserveBreakdown: {
        ...reserve(),
        source: "unavailable",
      },
    });

    expect(result.expectedEndOperationalBalance.level).toBe("low");
    expect(result.inferredRecurringIncome.level).toBe("low");
    expect(result.freeToSpendNow.label).toBe("Indicatief");
  });

  it("markeert inferred annual reserve rules als redelijk vertrouwen", () => {
    const result = buildForecastSurfaceConfidence({
      forecast: forecast(),
      plan: null,
      balances: balances(),
      reserveBreakdown: reserve({
        annualObligationMonthlyTotal: 85,
        activeAnnualRuleCount: 2,
        activeManualAnnualRuleCount: 0,
        activeInferredAnnualRuleCount: 2,
      }),
    });

    expect(result.annualObligationReserveRules.level).toBe("medium");
    expect(result.annualObligationReserveRules.provenance).toBe("derived");
  });
});
