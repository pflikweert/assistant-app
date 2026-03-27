import { buildInsightsUpcomingMoments } from "@/services/insights-upcoming-moments";
import type { ForecastTimelineEventRecord } from "@/services/forecast-timeline-events";
import type { InsightsSignalTransaction } from "@/services/insights-highlights";
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
    currentBalanceAnchor: input.currentBalanceAnchor ?? 531.82,
    currentBalanceAnchorDate: input.currentBalanceAnchorDate ?? "2026-03-25",
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
    remainingExpectedSavingsOutflowTotal:
      input.remainingExpectedSavingsOutflowTotal ?? 150,
    upcomingCommittedIncomeTotal: input.upcomingCommittedIncomeTotal ?? 2400,
    upcomingCommittedExpenseTotal: input.upcomingCommittedExpenseTotal ?? 860,
    expectedFixedCosts: input.expectedFixedCosts ?? 900,
    expectedSubscriptions: input.expectedSubscriptions ?? 130,
    expectedVariableCosts: input.expectedVariableCosts ?? 750,
  };
}

function timelineEvent(
  input: Partial<ForecastTimelineEventRecord>,
): ForecastTimelineEventRecord {
  return {
    eventKey: input.eventKey ?? "event-1",
    eventDate: input.eventDate ?? "2026-03-24",
    eventType: input.eventType ?? "fixed_cost",
    label: input.label ?? "Huur",
    amount: input.amount ?? -860,
    source: input.source ?? "recurring_history",
    confidence: input.confidence ?? "high",
    fingerprint: input.fingerprint ?? "fp-1",
  };
}

function signal(input: Partial<InsightsSignalTransaction> & { date?: string }) {
  return {
    id: input.id,
    amount: input.amount ?? -174,
    counterparty: input.counterparty ?? "Zilveren Kruis Zorgverzekeringen NV",
    date: input.date ?? "2026-03-10",
    details: input.details ?? "Zilveren Kruis|Verzekering",
    categoryKey: input.categoryKey ?? "care_health_insurance",
    categoryLabel: input.categoryLabel ?? "Zorgverzekering",
    analysisCategory: input.analysisCategory ?? "fixed_costs",
  } satisfies InsightsSignalTransaction;
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
    expect(result.some((item) => item.title.includes("Laagste punt"))).toBe(true);
  });

  it("begrenst lijst tot maximaal vier regels", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({
      }),
      selectedMonth,
      timelineEvents: [
        timelineEvent({ eventKey: "1", eventDate: "2026-03-20", label: "Impres B.V.", amount: 2456, source: "income_source", eventType: "income" }),
        timelineEvent({ eventKey: "2", eventDate: "2026-03-21", label: "Zilveren Kruis Zorgverzekeringen NV", amount: -174, source: "recurring_history", eventType: "fixed_cost" }),
        timelineEvent({ eventKey: "3", eventDate: "2026-03-22", label: "BELASTINGDIENST", amount: -75, source: "recurring_history", eventType: "fixed_cost" }),
        timelineEvent({ eventKey: "4", eventDate: "2026-03-23", label: "Gemeente Noordoostpolder", amount: -79, source: "recurring_history", eventType: "fixed_cost" }),
        timelineEvent({ eventKey: "5", eventDate: "2026-03-24", label: "Netflix", amount: -15, source: "subscription_profile", eventType: "subscription" }),
      ],
      referenceSignals: [
        signal({ counterparty: "Impres B.V.", amount: 2456, analysisCategory: "income_structural", categoryKey: "income_salary", categoryLabel: "Salaris" }),
        signal({ counterparty: "Zilveren Kruis Zorgverzekeringen NV", amount: -174, analysisCategory: "fixed_costs", categoryLabel: "Zorgverzekering" }),
        signal({ counterparty: "BELASTINGDIENST", amount: -75, analysisCategory: "fixed_costs", categoryLabel: "Wegenbelasting" }),
        signal({ counterparty: "Gemeente Noordoostpolder", amount: -79, analysisCategory: "fixed_costs", categoryLabel: "Gemeentelijke belastingen" }),
        signal({ counterparty: "Netflix", amount: -15, analysisCategory: "subscriptions", categoryLabel: "Streaming" }),
      ],
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("filtert timeline-events met nulbedrag uit komende momenten", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({}),
      timelineEvents: [
        timelineEvent({
          eventKey: "income-zero-1",
          eventDate: "2026-03-26",
          eventType: "income",
          label: "Creditrente",
          amount: 0.42,
          source: "income_source",
          confidence: "medium",
        }),
        timelineEvent({
          eventKey: "income-zero-2",
          eventDate: "2026-03-26",
          eventType: "income",
          label: "Google Ireland Limited",
          amount: 0.91,
          source: "income_source",
          confidence: "medium",
        }),
        timelineEvent({
          eventKey: "income-real-1",
          eventDate: "2026-03-27",
          eventType: "income",
          label: "Impres B.V.",
          amount: 2456,
          source: "income_source",
          confidence: "high",
        }),
      ],
      referenceSignals: [
        signal({
          counterparty: "Impres B.V.",
          amount: 2456,
          analysisCategory: "income_structural",
          categoryKey: "income_salary",
          categoryLabel: "Salaris",
        }),
      ],
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Impres B.V.");
  });

  it("gebruikt timeline-events met titel uit label en subtitel uit signaal", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({}),
      timelineEvents: [
        timelineEvent({
          eventKey: "low-1",
          eventDate: "2026-03-24",
          eventType: "milestone_lowest_balance",
          label: "Laagste punt verwacht",
          amount: 820,
          source: "derived",
          confidence: "high",
        }),
        timelineEvent({
          eventKey: "income-1",
          eventDate: "2026-03-26",
          eventType: "income",
          label: "Salaris Werkgever BV",
          amount: 2400,
          source: "income_source",
          confidence: "medium",
        }),
        timelineEvent({
          eventKey: "fixed-1",
          eventDate: "2026-03-28",
          eventType: "fixed_cost",
          label: "Zilveren Kruis Zorgverzekeringen NV",
          amount: -860,
          source: "recurring_history",
          confidence: "high",
        }),
      ],
      referenceSignals: [
        signal({
          counterparty: "Salaris Werkgever BV",
          amount: 2400,
          analysisCategory: "income_structural",
          categoryKey: "income_salary",
          categoryLabel: "Salaris",
        }),
        signal({
          counterparty: "Zilveren Kruis Zorgverzekeringen NV",
          amount: -174,
          analysisCategory: "fixed_costs",
          categoryLabel: "Zorgverzekering",
        }),
      ],
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.title).toContain("Laagste punt");
    expect(result[1]?.title).toBe("Salaris Werkgever BV");
    expect(result[1]?.subtitle).toBe("Verwacht salaris");
    expect(result[2]?.title).toBe("Zilveren Kruis Zorgverzekeringen NV");
    expect(result[2]?.subtitle).toBe("Vaste lasten zorgverzekering");
  });

  it("toont kosten als uitgave, ook als de timelinebron een positief bedrag bevat", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({}),
      timelineEvents: [
        timelineEvent({
          eventKey: "fixed-positive-1",
          eventDate: "2026-03-28",
          eventType: "fixed_cost",
          label: "Huur",
          amount: 1200,
          source: "recurring_history",
          confidence: "high",
        }),
      ],
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.amountLabel.startsWith("-")).toBe(true);
    expect(result[0]?.amountTone).toBe("expense");
  });

  it("gebruikt de echte categorie uit het transactiesignaal als subtitel", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({}),
      timelineEvents: [
        timelineEvent({
          eventKey: "expense-1",
          eventDate: "2026-03-27",
          eventType: "fixed_cost",
          label: "Zilveren Kruis Zorgverzekeringen NV",
          amount: -174,
          source: "recurring_history",
          confidence: "high",
        }),
      ],
      referenceSignals: [
        signal({
          counterparty: "Zilveren Kruis Zorgverzekeringen NV",
          amount: -174,
          analysisCategory: "fixed_costs",
          categoryLabel: "Zorgverzekering",
        }),
      ],
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.subtitle).toBe("Vaste lasten zorgverzekering");
  });

  it("kiest voor vaste lasten bij dezelfde tegenpartij als ook een salaris-signaal bestaat", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({}),
      timelineEvents: [
        timelineEvent({
          eventKey: "income-1",
          eventDate: "2026-03-25",
          eventType: "income",
          label: "Impres B.V.",
          amount: 2400,
          source: "income_source",
          confidence: "high",
        }),
        timelineEvent({
          eventKey: "fixed-1",
          eventDate: "2026-03-27",
          eventType: "fixed_cost",
          label: "BELASTINGDIENST",
          amount: -75,
          source: "recurring_history",
          confidence: "high",
        }),
      ],
      referenceSignals: [
        signal({
          counterparty: "Impres B.V.",
          amount: 2400,
          analysisCategory: "income_structural",
          categoryKey: "income_salary",
          categoryLabel: "Salaris",
        }),
        signal({
          counterparty: "BELASTINGDIENST",
          amount: -75,
          analysisCategory: "fixed_costs",
          categoryLabel: "Wegenbelasting",
        }),
        signal({
          counterparty: "BELASTINGDIENST",
          amount: 2400,
          analysisCategory: "income_structural",
          categoryKey: "income_salary",
          categoryLabel: "Salaris",
        }),
      ],
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(2);
    expect(result[1]?.title).toBe("BELASTINGDIENST");
    expect(result[1]?.subtitle).toBe("Wegenbelasting");
    expect(result[1]?.amountLabel).toContain("75");
  });

  it("slaat generieke fallback-momenten over en toont dan alleen saldo of niets", () => {
    const selectedMonth = buildMonthOption("2026-03");
    const result = buildInsightsUpcomingMoments({
      forecast: buildForecast({
        lowestExpectedBalance: 0,
        lowestExpectedBalanceDate: "",
      }),
      selectedMonth,
      now: new Date("2026-03-11T12:00:00.000Z"),
    });

    expect(result).toHaveLength(0);
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
