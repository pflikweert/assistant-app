import { buildInsightsForecastCard } from "@/services/insights-forecast-card";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { TransactionMonthOption } from "@/services/transaction-month-options";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonthKey(currentKey: string) {
  const [yearValue, monthValue] = currentKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthOption(monthKey: string): TransactionMonthOption {
  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const toIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;

  return {
    key: monthKey,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    monthLabel: start.toLocaleDateString("nl-NL", {
      month: "long",
    }),
    startIso: toIso(start),
    endIso: toIso(end),
    year,
    month,
    isCurrentMonth: monthKey === getCurrentMonthKey(),
  };
}

function buildForecast(
  input: Partial<InsightsForecastSummary>,
): InsightsForecastSummary {
  return {
    monthStart: input.monthStart ?? "2026-03-01",
    forecastReferenceDate: input.forecastReferenceDate ?? "2026-03-10",
    currentBalanceAnchor: input.currentBalanceAnchor ?? null,
    currentBalanceAnchorDate: input.currentBalanceAnchorDate ?? null,
    cashRiskFlag: input.cashRiskFlag ?? "none",
    riskFlag: input.riskFlag ?? "none",
    expectedEndBalance: input.expectedEndBalance ?? 600,
    lowestExpectedBalance: input.lowestExpectedBalance ?? 260,
    lowestExpectedBalanceDate: input.lowestExpectedBalanceDate ?? "2026-03-22",
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
      selectedMonth: buildMonthOption(getCurrentMonthKey()),
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
      selectedMonth: buildMonthOption(getCurrentMonthKey()),
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
      selectedMonth: buildMonthOption(getCurrentMonthKey()),
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
      selectedMonth: buildMonthOption(getCurrentMonthKey()),
    });

    expect(result.statusLabel).toBe("Let op");
    expect(result.statusTone).toBe("critical");
  });

  it("gebruikt historische titel bij oude maand", () => {
    const previousKey = getPreviousMonthKey(getCurrentMonthKey());
    const result = buildInsightsForecastCard({
      forecast: buildForecast({ expectedEndBalance: 350 }),
      budgetPlan: null,
      selectedMonth: buildMonthOption(previousKey),
    });

    expect(result.title).toBe("Eindsaldo deze maand");
  });

  it("gebruikt dezelfde resterende-maand berekening als de modal", () => {
    const result = buildInsightsForecastCard({
      forecast: buildForecast({
        currentBalanceAnchor: 100,
        currentBalanceAnchorDate: "2026-03-25",
        expectedEndBalance: 130,
        remainingExpectedIncomeTotal: 80,
        remainingExpectedExpenseTotal: 50,
        remainingExpectedSavingsOutflowTotal: 0,
        expectedVariableCosts: 30,
      }),
      budgetPlan: buildBudgetPlan({
        variableSpent: 0,
        weeklyRemaining: [10],
      }),
      selectedMonth: buildMonthOption(getCurrentMonthKey()),
    });

    expect(result.amountLabel).toBe(fmt.format(150));
  });
});
