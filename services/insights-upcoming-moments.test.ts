import { buildInsightsUpcomingMoments } from "@/services/insights-upcoming-moments";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { TransactionMonthOption } from "@/services/transaction-month-options";
import { describe, expect, it } from "vitest";

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
    label: start.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }),
    monthLabel: start.toLocaleDateString("nl-NL", { month: "long" }),
    startIso: toIso(start),
    endIso: toIso(end),
    year,
    month,
    isCurrentMonth: monthKey === getCurrentMonthKey(),
  };
}

function buildForecast(input: Partial<InsightsForecastSummary>): InsightsForecastSummary {
  return {
    monthStart: input.monthStart ?? "2026-03-01",
    forecastReferenceDate: input.forecastReferenceDate ?? "2026-03-10",
    cashRiskFlag: input.cashRiskFlag ?? "none",
    riskFlag: input.riskFlag ?? "none",
    expectedEndBalance: input.expectedEndBalance ?? 900,
    lowestExpectedBalance: input.lowestExpectedBalance ?? 820,
    lowestExpectedBalanceDate: input.lowestExpectedBalanceDate ?? "2026-03-24",
    nextExpectedEventDate: input.nextExpectedEventDate ?? "2026-03-26",
    nextExpectedEventLabel: input.nextExpectedEventLabel ?? "Salaris verwacht",
    expectedIncomeTotal: input.expectedIncomeTotal ?? 2400,
    remainingExpectedIncomeTotal: input.remainingExpectedIncomeTotal ?? 2400,
    remainingExpectedExpenseTotal: input.remainingExpectedExpenseTotal ?? 860,
    upcomingCommittedIncomeTotal: input.upcomingCommittedIncomeTotal ?? 2400,
    upcomingCommittedExpenseTotal: input.upcomingCommittedExpenseTotal ?? 860,
    expectedFixedCosts: input.expectedFixedCosts ?? 900,
    expectedSubscriptions: input.expectedSubscriptions ?? 130,
    expectedVariableCosts: input.expectedVariableCosts ?? 750,
  };
}

describe("buildInsightsUpcomingMoments", () => {
  it("bouwt betekenisvolle regels voor huidige maand", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({}),
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((item) => item.title.includes("Laagste saldo"))).toBe(true);
  });

  it("begrenst lijst tot maximaal vier regels", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({
        nextExpectedEventLabel: "Grote incasso",
      }),
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("verbergt blok voor historische maand", () => {
    const selectedMonth = buildMonthOption("2026-02");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({
        monthStart: "2026-02-01",
      }),
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(0);
  });
});

