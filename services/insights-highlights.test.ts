import {
  selectInsightsHighlights,
  type InsightsSignalTransaction,
} from "@/services/insights-highlights";
import type {
  InsightsHighlightHistoryState,
  InsightsHighlightSignalSource,
} from "@/services/insights-highlight-history";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

function tx(input: Partial<InsightsSignalTransaction>): InsightsSignalTransaction {
  return {
    amount: input.amount ?? -10,
    counterparty: input.counterparty ?? "Albert Heijn",
    date: input.date ?? "2026-03-14",
    analysisCategory: input.analysisCategory ?? "variable_costs",
  };
}

function budgetPlan(input: {
  variableBudget: number;
  variableSpent: number;
  monthProgress: number;
}) {
  return {
    flowSummary: { variableBudget: input.variableBudget },
    monthToDateExpenses: { variableCosts: input.variableSpent },
    monthProgress: input.monthProgress,
  } as unknown as BudgetPlanComputation;
}

function forecast(input?: Partial<InsightsForecastSummary>): InsightsForecastSummary {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: input?.forecastReferenceDate ?? "2026-03-10",
    cashRiskFlag: input?.cashRiskFlag ?? "none",
    riskFlag: input?.riskFlag ?? "none",
    expectedEndBalance: input?.expectedEndBalance ?? 320,
    lowestExpectedBalance: input?.lowestExpectedBalance ?? null,
    lowestExpectedBalanceDate: input?.lowestExpectedBalanceDate ?? null,
    nextExpectedEventDate: input?.nextExpectedEventDate ?? "2026-03-26",
    nextExpectedEventLabel: input?.nextExpectedEventLabel ?? "Salaris verwacht",
    expectedIncomeTotal: input?.expectedIncomeTotal ?? null,
    remainingExpectedIncomeTotal: input?.remainingExpectedIncomeTotal ?? null,
    remainingExpectedExpenseTotal: input?.remainingExpectedExpenseTotal ?? null,
    upcomingCommittedIncomeTotal: input?.upcomingCommittedIncomeTotal ?? null,
    upcomingCommittedExpenseTotal: input?.upcomingCommittedExpenseTotal ?? null,
    expectedFixedCosts: input?.expectedFixedCosts ?? null,
    expectedSubscriptions: input?.expectedSubscriptions ?? null,
    expectedVariableCosts: input?.expectedVariableCosts ?? null,
  };
}

function history(options: {
  meaningKey: string;
  fingerprint: string;
  signalSource?: InsightsHighlightSignalSource;
  seenAt?: string;
}): InsightsHighlightHistoryState {
  const seenAt = options.seenAt ?? "2026-03-23T00:00:00.000Z";
  return {
    version: 1,
    userId: "user-1",
    monthKey: "2026-03",
    updatedAt: seenAt,
    entries: {
      [options.meaningKey]: {
        fingerprint: options.fingerprint,
        lastSeenAt: seenAt,
        signalSource: options.signalSource ?? "hard",
      },
    },
  };
}

describe("selectInsightsHighlights", () => {
  it("toont neutrale no-data kaart bij onvoldoende data", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: null,
      budgetPlan: null,
      currentMonthTransactions: [],
      previousMonthTransactions: [],
      lookbackTransactions: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("neutral");
  });

  it("prioriteert relevant inzicht als eerste kaart", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast({ riskFlag: "deficit_warning", expectedEndBalance: -120 }),
      budgetPlan: budgetPlan({ variableBudget: 600, variableSpent: 780, monthProgress: 0.5 }),
      currentMonthTransactions: [tx({ amount: -120 })],
      previousMonthTransactions: [tx({ amount: -60 })],
      lookbackTransactions: [tx({ amount: -40, date: "2026-02-10" })],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(["attention", "trend"]).toContain(result[0]?.type);
  });

  it("beperkt geruststellende kaarten tot maximaal 1", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast({ expectedEndBalance: 550 }),
      budgetPlan: budgetPlan({ variableBudget: 900, variableSpent: 220, monthProgress: 0.45 }),
      currentMonthTransactions: [tx({ amount: -25 })],
      previousMonthTransactions: [tx({ amount: -22 })],
      lookbackTransactions: [tx({ amount: -18, date: "2026-02-10" })],
    });

    const reassuranceCount = result.filter((item) => item.type === "reassurance").length;
    expect(reassuranceCount).toBeLessThanOrEqual(1);
  });

  it("toont nieuwe kostenpost als tegenpartij nieuw is", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast(),
      budgetPlan: budgetPlan({ variableBudget: 1000, variableSpent: 480, monthProgress: 0.6 }),
      currentMonthTransactions: [
        tx({ counterparty: "Nieuwe Dienst", amount: -50 }),
        tx({ counterparty: "Nieuwe Dienst", amount: -10 }),
      ],
      previousMonthTransactions: [tx({ counterparty: "Albert Heijn", amount: -32 })],
      lookbackTransactions: [tx({ counterparty: "Albert Heijn", amount: -25, date: "2026-02-10" })],
    });

    expect(result.some((item) => item.id === "new-cost")).toBe(true);
  });

  it("verbergt dezelfde insight binnen het herhaalvenster", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast(),
      budgetPlan: budgetPlan({ variableBudget: 1000, variableSpent: 480, monthProgress: 0.6 }),
      currentMonthTransactions: [
        tx({ counterparty: "Nieuwe Dienst", amount: -49 }),
        tx({ counterparty: "Nieuwe Dienst", amount: -9 }),
      ],
      previousMonthTransactions: [tx({ counterparty: "Albert Heijn", amount: -32 })],
      lookbackTransactions: [tx({ counterparty: "Albert Heijn", amount: -25, date: "2026-02-10" })],
      latestTransactionDateIso: "2026-03-23",
      history: history({
        meaningKey: "new-counterparty-cost",
        fingerprint: "new-cost|2026-03|nieuwe dienst|60|2",
        signalSource: "hard",
      }),
    });

    expect(result.some((item) => item.id === "new-cost")).toBe(false);
    expect(result.length).toBeGreaterThan(0);
  });

  it("laat dezelfde meaning weer zien zodra de fingerprint verandert", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast(),
      budgetPlan: budgetPlan({ variableBudget: 1000, variableSpent: 480, monthProgress: 0.6 }),
      currentMonthTransactions: [
        tx({ counterparty: "Nieuwe Dienst", amount: -61 }),
        tx({ counterparty: "Nieuwe Dienst", amount: -9 }),
      ],
      previousMonthTransactions: [tx({ counterparty: "Albert Heijn", amount: -32 })],
      lookbackTransactions: [tx({ counterparty: "Albert Heijn", amount: -25, date: "2026-02-10" })],
      history: history({
        meaningKey: "new-counterparty-cost",
        fingerprint: "new-cost|2026-03|nieuwe dienst|60|2",
        signalSource: "hard",
      }),
    });

    expect(result.some((item) => item.id === "new-cost")).toBe(true);
  });

  it("toont kaarten opnieuw wanneer transactiedata ouder is dan het suppressievenster", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast(),
      budgetPlan: budgetPlan({ variableBudget: 1000, variableSpent: 480, monthProgress: 0.6 }),
      currentMonthTransactions: [
        tx({ counterparty: "Nieuwe Dienst", amount: -49 }),
        tx({ counterparty: "Nieuwe Dienst", amount: -9 }),
      ],
      previousMonthTransactions: [tx({ counterparty: "Albert Heijn", amount: -32 })],
      lookbackTransactions: [tx({ counterparty: "Albert Heijn", amount: -25, date: "2026-02-10" })],
      latestTransactionDateIso: "2026-03-10",
      history: history({
        meaningKey: "new-counterparty-cost",
        fingerprint: "new-cost|2026-03|nieuwe dienst|60|2",
        signalSource: "hard",
        seenAt: "2026-03-22T10:00:00.000Z",
      }),
    });

    expect(result.some((item) => item.id === "new-cost")).toBe(true);
  });

  it("slaat kleine signalen over onder de confidence-drempel", () => {
    const result = selectInsightsHighlights({
      selectedMonthKey: "2026-03",
      selectedMonthLabel: "maart 2026",
      forecast: forecast(),
      budgetPlan: budgetPlan({ variableBudget: 1000, variableSpent: 480, monthProgress: 0.6 }),
      currentMonthTransactions: [tx({ counterparty: "Kleine Dienst", amount: -20 })],
      previousMonthTransactions: [tx({ counterparty: "Albert Heijn", amount: -32 })],
      lookbackTransactions: [tx({ counterparty: "Albert Heijn", amount: -25, date: "2026-02-10" })],
    });

    expect(result.some((item) => item.id === "new-cost")).toBe(false);
  });
});
