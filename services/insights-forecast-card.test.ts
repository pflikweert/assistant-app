import { buildInsightsForecastCard } from "@/services/insights-forecast-card";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function buildForecast(
  input: Partial<InsightsForecastSummary>,
): InsightsForecastSummary {
  return {
    monthStart: input.monthStart ?? "2026-03-01",
    forecastReferenceDate: input.forecastReferenceDate ?? "2026-03-10",
    currentBalanceAnchor: input.currentBalanceAnchor ?? null,
    currentBalanceAnchorDate: input.currentBalanceAnchorDate ?? null,
    currentOperationalBalance: input.currentOperationalBalance ?? input.currentBalanceAnchor ?? null,
    currentReservedBalance: input.currentReservedBalance ?? 0,
    currentNetWorth: input.currentNetWorth ?? input.currentBalanceAnchor ?? null,
    freeToSpendNow: input.freeToSpendNow ?? input.currentBalanceAnchor ?? null,
    cashRiskFlag: input.cashRiskFlag ?? "none",
    riskFlag: input.riskFlag ?? "none",
    expectedEndBalance: input.expectedEndBalance ?? 600,
    expectedEndOperationalBalance:
      input.expectedEndOperationalBalance ?? input.expectedEndBalance ?? 600,
    expectedEndNetWorth:
      input.expectedEndNetWorth ?? input.expectedEndOperationalBalance ?? input.expectedEndBalance ?? 600,
    lowestExpectedBalance: input.lowestExpectedBalance ?? 260,
    lowestExpectedBalanceDate: input.lowestExpectedBalanceDate ?? "2026-03-22",
    lowestOperationalPointInMonth:
      input.lowestOperationalPointInMonth ?? input.lowestExpectedBalance ?? 260,
    nextExpectedEventDate: input.nextExpectedEventDate ?? "2026-03-25",
    nextExpectedEventLabel: input.nextExpectedEventLabel ?? "Salaris verwacht",
    expectedIncomeTotal: input.expectedIncomeTotal ?? 3600,
    remainingExpectedIncomeTotal: input.remainingExpectedIncomeTotal ?? 2400,
    remainingExpectedExpenseTotal: input.remainingExpectedExpenseTotal ?? 1250,
    remainingExpectedSavingsOutflowTotal:
      input.remainingExpectedSavingsOutflowTotal ?? 180,
    upcomingCommittedIncomeTotal: input.upcomingCommittedIncomeTotal ?? 2400,
    upcomingCommittedExpenseTotal: input.upcomingCommittedExpenseTotal ?? 860,
    expectedFixedCosts: input.expectedFixedCosts ?? 1200,
    expectedSubscriptions: input.expectedSubscriptions ?? 180,
    expectedVariableCosts: input.expectedVariableCosts ?? 980,
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
    weeklyVariablePlan: (input?.weeklyRemaining ?? []).map((remaining) => ({
      isPastWeek: false,
      remaining,
    })),
  } as unknown as BudgetPlanComputation;
}

describe("buildInsightsForecastCard", () => {
  it("toont fallback bij onvoldoende data", () => {
    const result = buildInsightsForecastCard({
      forecast: null,
      budgetPlan: null,
    });

    expect(result.isFallback).toBe(true);
    expect(result.statusLabel).toBe("Neutraal");
  });

  it("toont verwacht positief bij ruime uitkomst", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        expectedEndBalance: 980,
        lowestExpectedBalance: 380,
      }),
      budgetPlan: null,
    });

    expect(result.statusLabel).toBe("Verwacht positief");
    expect(result.statusTone).toBe("good");
  });

  it("toont krap maar haalbaar bij cash warning", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        expectedEndBalance: 240,
        lowestExpectedBalance: 90,
        cashRiskFlag: "cash_gap_warning",
      }),
      budgetPlan: null,
    });

    expect(result.statusLabel).toBe("Krap maar haalbaar");
    expect(result.statusTone).toBe("watch");
  });

  it("toont let op bij negatief eindsaldo", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        expectedEndBalance: -40,
        riskFlag: "deficit_warning",
      }),
      budgetPlan: null,
    });

    expect(result.statusLabel).toBe("Let op");
    expect(result.statusTone).toBe("critical");
  });

  it("gebruikt historische titel bij oude maand", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({ expectedEndBalance: 350 }),
      budgetPlan: null,
    });

    expect(result.title).toBe("Verwacht eindsaldo");
  });

  it("gebruikt dezelfde resterende-maand berekening als de modal", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        currentBalanceAnchor: 100,
        currentBalanceAnchorDate: "2026-03-25",
        expectedEndBalance: 130,
        expectedEndOperationalBalance: 130,
        remainingExpectedIncomeTotal: 80,
        remainingExpectedExpenseTotal: 50,
        remainingExpectedSavingsOutflowTotal: 0,
        expectedVariableCosts: 30,
        currentOperationalBalance: 100,
        currentReservedBalance: 20,
        freeToSpendNow: 80,
        lowestOperationalPointInMonth: 90,
      }),
      budgetPlan: buildBudgetPlan({
        variableSpent: 0,
        weeklyRemaining: [10],
      }),
    });

    expect(result.amountLabel).toBe(fmt.format(150));
    expect(result.currentOperationalValue).toBe(fmt.format(100));
    expect(result.freeToSpendNowValue).toBe(fmt.format(80));
    expect(result.reservedValue).toBe(fmt.format(20));
    expect(result.lowestOperationalPointValue).toBe(fmt.format(90));
    expect(result.explanation).toContain("Vrij besteedbaar");
  });

  it("toont de expliciete expected-end balance en houdt lowest point apart", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        currentBalanceAnchor: 2748.36,
        currentOperationalBalance: 2748.36,
        freeToSpendNow: 2748.36,
        currentReservedBalance: 0,
        expectedEndBalance: 1803.31,
        expectedEndOperationalBalance: 1803.31,
        remainingExpectedIncomeTotal: 0.33,
        remainingExpectedExpenseTotal: 945.38,
        remainingExpectedSavingsOutflowTotal: 0,
        lowestExpectedBalance: 392.82,
        lowestOperationalPointInMonth: 392.82,
        expectedVariableCosts: 214,
      }),
      budgetPlan: buildBudgetPlan({
        variableSpent: 214,
        weeklyRemaining: [],
      }),
    });

    expect(result.amountLabel).toBe(fmt.format(1803.31));
    expect(result.lowestOperationalPointValue).toBe(fmt.format(392.82));
    expect(result.amountLabel).not.toBe(result.lowestOperationalPointValue);
  });

  it("overrulet een stalen legacy eindwaarde met de berekende operationele maandmutatie", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        currentBalanceAnchor: 2748.36,
        currentOperationalBalance: 2748.36,
        currentReservedBalance: 0,
        expectedEndBalance: 359.85,
        expectedEndOperationalBalance: 359.85,
        remainingExpectedIncomeTotal: 0.33,
        remainingExpectedExpenseTotal: 945.38,
        remainingExpectedSavingsOutflowTotal: 0,
        lowestOperationalPointInMonth: 392.82,
        lowestExpectedBalance: 392.82,
        expectedVariableCosts: 214,
      }),
      budgetPlan: buildBudgetPlan({
        variableSpent: 214,
        weeklyRemaining: [],
      }),
    });

    expect(result.amountLabel).toBe(fmt.format(1803.31));
    expect(result.amountLabel).not.toBe(fmt.format(359.85));
    expect(result.lowestOperationalPointValue).toBe(fmt.format(392.82));
  });

  it("gebruikt canonieke surface-balances boven losse forecastvelden", () => {
    const surfaceBalances = {
      currentOperationalBalance: { amount: 2000, source: "forecast_anchor" },
      currentReservedBalance: { amount: 300, source: "derived" },
      freeToSpendNow: { amount: 1700, source: "derived" },
    } as unknown as FinancialSurfaceBalanceSnapshot;

    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        currentOperationalBalance: 1800,
        currentReservedBalance: 100,
        freeToSpendNow: 1700,
      }),
      budgetPlan: null,
      surfaceBalances,
    });

    expect(result.currentOperationalValue).toBe(fmt.format(2000));
    expect(result.reservedValue).toBe(fmt.format(300));
    expect(result.freeToSpendNowValue).toBe(fmt.format(1700));
  });
});
