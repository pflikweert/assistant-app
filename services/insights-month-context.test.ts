import {
  buildInsightsMonthContextSummary,
  formatAttentionCountLabel,
  type InsightsForecastSummary,
} from "@/services/insights-month-context";
import type { TransactionMonthOption } from "@/services/transaction-month-options";
import type { BudgetPlanComputation } from "@/types/categorization";
import { describe, expect, it } from "vitest";

function buildBudgetPlan(options: {
  variableBudget: number;
  variableSpent: number;
  monthProgress: number;
}) {
  return {
    flowSummary: {
      variableBudget: options.variableBudget,
    },
    monthToDateExpenses: {
      variableCosts: options.variableSpent,
    },
    monthProgress: options.monthProgress,
  } as unknown as BudgetPlanComputation;
}

function buildForecast(options: {
  riskFlag?: InsightsForecastSummary["riskFlag"];
  cashRiskFlag?: InsightsForecastSummary["cashRiskFlag"];
  expectedEndBalance?: number | null;
  lowestExpectedBalance?: number | null;
  lowestExpectedBalanceDate?: string | null;
}) {
  return {
    monthStart: "2026-03-01",
    forecastReferenceDate: null,
    currentBalanceAnchor: null,
    currentBalanceAnchorDate: null,
    riskFlag: options.riskFlag ?? "none",
    cashRiskFlag: options.cashRiskFlag ?? "none",
    expectedEndBalance: options.expectedEndBalance ?? null,
    lowestExpectedBalance: options.lowestExpectedBalance ?? null,
    lowestExpectedBalanceDate: options.lowestExpectedBalanceDate ?? null,
    nextExpectedEventDate: null,
    nextExpectedEventLabel: null,
    expectedIncomeTotal: null,
    remainingExpectedIncomeTotal: null,
    remainingExpectedExpenseTotal: null,
    remainingExpectedSavingsOutflowTotal: null,
    upcomingCommittedIncomeTotal: null,
    upcomingCommittedExpenseTotal: null,
    expectedFixedCosts: null,
    expectedSubscriptions: null,
    expectedVariableCosts: null,
  } satisfies InsightsForecastSummary;
}

function getPreviousMonthKey(currentKey: string) {
  const [yearValue, monthValue] = currentKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptionByKey(monthKey: string): TransactionMonthOption {
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

describe("formatAttentionCountLabel", () => {
  it("geeft enkelvoud en meervoud correct terug", () => {
    expect(formatAttentionCountLabel(1)).toBe("1 aandachtspunt");
    expect(formatAttentionCountLabel(2)).toBe("2 aandachtspunten");
  });
});

describe("buildInsightsMonthContextSummary", () => {
  it("toont neutrale fallback bij onvoldoende data", () => {
    const selectedMonth = getMonthOptionByKey(getCurrentMonthKey());
    const summary = buildInsightsMonthContextSummary({
      forecast: null,
      budgetPlan: null,
      selectedMonth,
    });

    expect(summary.statusTone).toBe("neutral");
    expect(summary.statusLabel).toBe("Neutraal");
    expect(summary.contextLine).toContain("We bouwen nog aan je maandbeeld");
  });

  it("geeft Krap prioriteit bij negatief forecast-signaal", () => {
    const selectedMonth = getMonthOptionByKey(getCurrentMonthKey());
    const summary = buildInsightsMonthContextSummary({
      forecast: buildForecast({
        riskFlag: "deficit_warning",
        expectedEndBalance: -120,
      }),
      budgetPlan: buildBudgetPlan({
        variableBudget: 1200,
        variableSpent: 300,
        monthProgress: 0.5,
      }),
      selectedMonth,
    });

    expect(summary.statusTone).toBe("critical");
    expect(summary.statusLabel).toBe("Krap");
    expect(summary.contextLine).toContain("onder druk");
    expect(summary.summaryLine).toContain("eindsaldo");
  });

  it("geeft Op schema bij stabiele maand en voldoende ruimte", () => {
    const selectedMonth = getMonthOptionByKey(getCurrentMonthKey());
    const summary = buildInsightsMonthContextSummary({
      forecast: buildForecast({
        expectedEndBalance: 540,
      }),
      budgetPlan: buildBudgetPlan({
        variableBudget: 1000,
        variableSpent: 320,
        monthProgress: 0.45,
      }),
      selectedMonth,
    });

    expect(summary.statusTone).toBe("good");
    expect(summary.statusLabel).toBe("Op schema");
    expect(summary.contextLine).toContain("loopt rustig");
  });

  it("maakt contextzin terugkijkend voor afgeronde maand", () => {
    const currentMonthKey = getCurrentMonthKey();
    const previousMonth = getMonthOptionByKey(getPreviousMonthKey(currentMonthKey));

    const summary = buildInsightsMonthContextSummary({
      forecast: buildForecast({
        cashRiskFlag: "cash_gap_warning",
        lowestExpectedBalanceDate: "2026-03-22",
      }),
      budgetPlan: buildBudgetPlan({
        variableBudget: 1000,
        variableSpent: 700,
        monthProgress: 0.4,
      }),
      selectedMonth: previousMonth,
    });

    expect(summary.contextLine).toContain("Deze maand is afgerond");
  });
});
