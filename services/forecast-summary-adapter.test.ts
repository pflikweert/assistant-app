import {
  adaptForecastMonthStateToLegacySummary,
  buildForecastMonthStateFromLegacySummary,
} from "@/services/forecast-summary-adapter";
import type { ForecastMonthState } from "@/services/forecast-domain";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/latest-known-balance", () => ({
  buildForecastCarryoverFromLatestKnownBalance: vi.fn(() => null),
}));

function buildLegacySummary(
  input?: Partial<InsightsForecastSummary>,
): InsightsForecastSummary {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: "2026-03-27",
    currentBalanceAnchor: 1425.5,
    currentBalanceAnchorDate: "2026-03-27",
    cashRiskFlag: "none",
    riskFlag: "none",
    expectedEndBalance: 1610.25,
    lowestExpectedBalance: 1350,
    lowestExpectedBalanceDate: "2026-03-29",
    nextExpectedEventDate: "2026-03-30",
    nextExpectedEventLabel: "Salaris",
    expectedIncomeTotal: 3200,
    remainingExpectedIncomeTotal: 1400,
    remainingExpectedExpenseTotal: 980,
    remainingExpectedSavingsOutflowTotal: 120,
    upcomingCommittedIncomeTotal: 1400,
    upcomingCommittedExpenseTotal: 780,
    expectedFixedCosts: 900,
    expectedSubscriptions: 70,
    expectedVariableCosts: 620,
    ...input,
  };
}

describe("forecast summary adapter", () => {
  it("vertaalt een nieuw forecastmodel terug naar de legacy summary shape", () => {
    const state: ForecastMonthState = {
      monthStart: "2026-03-01",
      referenceDate: "2026-03-27",
      currentBalanceDate: "2026-03-27",
      status: "projected",
      openingOperationalBalance: 1425.5,
      openingReservedBalance: 240,
      openingNetWorth: 1890,
      currentBalance: 1425.5,
      reservedBalance: 240,
      netWorth: 1890,
      freeToSpend: 560,
      expectedIncome: 3200,
      expectedExpenses: 1590,
      expectedInternalTransfers: 0,
      expectedReserveAllocations: 120,
      expectedEndOperationalBalance: 1610.25,
      expectedEndReservedBalance: 240,
      expectedEndNetWorth: 1610.25,
      freeToSpendCarryover: 560,
      expectedEndBalance: 1610.25,
      lowestExpectedBalance: 1350,
      lowestExpectedBalanceDate: "2026-03-29",
      nextExpectedEventDate: "2026-03-30",
      nextExpectedEventLabel: "Salaris",
      expectedIncomeTotal: 3200,
      remainingExpectedIncomeTotal: 1400,
      remainingExpectedExpenseTotal: 980,
      remainingExpectedSavingsOutflowTotal: 120,
      upcomingCommittedIncomeTotal: 1400,
      upcomingCommittedExpenseTotal: 780,
      expectedFixedCosts: 900,
      expectedSubscriptions: 70,
      expectedVariableCosts: 620,
      riskFlag: "none",
      cashRiskFlag: "none",
      certainty: "committed",
      carryover: {
        sourceMonthStart: "2026-02-01",
        targetMonthStart: "2026-03-01",
        sourceMoneyLayer: "operational",
        targetMoneyLayer: "operational",
        amount: 1425.5,
        certainty: "booked",
        sourceEventType: "correction",
        sourceLabel: "2026-03-27",
        reason: "Laatste bekende saldo",
      },
      events: [],
    };

    const legacy = adaptForecastMonthStateToLegacySummary(state);

    expect(legacy).toMatchObject({
      monthStart: "2026-03-01",
      forecastReferenceDate: "2026-03-27",
      currentBalanceAnchor: 1425.5,
      currentBalanceAnchorDate: "2026-03-27",
      expectedEndBalance: 1610.25,
      lowestExpectedBalance: 1350,
      nextExpectedEventLabel: "Salaris",
    });
  });

  it("bouwt een nieuw forecastmodel uit de legacy summary zonder de kern te verliezen", () => {
    const legacy = buildLegacySummary();
    const budgetPlan = {
      flowSummary: {
        variableBudget: 700,
      },
      monthToDateExpenses: {
        variableCosts: 240,
      },
    } as unknown as BudgetPlanComputation;

    const state = buildForecastMonthStateFromLegacySummary(legacy, budgetPlan);

    expect(state).toMatchObject({
      monthStart: "2026-03-01",
      referenceDate: "2026-03-27",
      currentBalanceDate: "2026-03-27",
      currentBalance: 1425.5,
      expectedEndBalance: 1610.25,
      lowestExpectedBalance: 1350,
      nextExpectedEventLabel: "Salaris",
      freeToSpend: 460,
    });
  });
});
