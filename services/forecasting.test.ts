import { describe, expect, it } from "vitest";

import { createBudgetPlanRequestDescriptors } from "./forecast-budget-plan-requests";
import {
  resolveExpectedCashflowIncomeBaseline,
  resolveExpectedCashflowIncomeBaselineBreakdown,
} from "./forecast-income-baseline";
import { buildForecastMonthMath } from "./forecast-month-math";

describe("resolveExpectedCashflowIncomeBaseline", () => {
  it("prefers the budget planner basis when budget forecast mode is active", () => {
    const result = resolveExpectedCashflowIncomeBaseline({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      budgetPlan: {
        settings: {
          forecastExpenseSource: "budget_settings",
        },
        flowSummary: {
          expectedIncomeMonthly: 2829,
        },
      } as any,
      incomeSources: [
        {
          source_key: "salary",
          source_label: "Salaris",
          expected_income: 2400,
          income_frequency: "monthly",
          income_day_of_month: 25,
          last_detected_at: "2026-02-25T09:00:00.000Z",
        },
        {
          source_key: "child_budget",
          source_label: "Kindgebonden budget",
          expected_income: 429,
          income_frequency: "monthly",
          income_day_of_month: 20,
          last_detected_at: "2026-02-20T09:00:00.000Z",
        },
      ],
    });

    expect(result).toBe(2829);
  });

  it("respects includeIncome when trend forecast mode is active", () => {
    const result = resolveExpectedCashflowIncomeBaselineBreakdown({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      budgetPlan: {
        settings: {
          forecastExpenseSource: "trend",
          includeIncome: {
            salary: true,
            childBudget: true,
            structuralOther: false,
            variable: false,
          },
        },
        flowSummary: {
          expectedIncomeMonthly: 2829,
        },
      } as any,
      incomeSources: [
        {
          source_key: "salary",
          source_label: "Salaris",
          expected_income: 2400,
          income_bucket: "salary",
          income_frequency: "monthly",
          income_day_of_month: 25,
          last_detected_at: "2026-02-25T09:00:00.000Z",
        },
        {
          source_key: "child_budget",
          source_label: "Kindgebonden budget",
          expected_income: 429,
          income_bucket: "childBudget",
          income_frequency: "monthly",
          income_day_of_month: 20,
          last_detected_at: "2026-02-20T09:00:00.000Z",
        },
        {
          source_key: "variable_income",
          source_label: "Variabel inkomen",
          expected_income: 650,
          income_bucket: "variable",
          income_frequency: "monthly",
          income_day_of_month: 12,
          last_detected_at: "2026-02-12T09:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual({
      total: 2829,
      structural: 2829,
      variable: 0,
    });
  });

  it("falls back to the budget planner basis when no income sources are available", () => {
    const result = resolveExpectedCashflowIncomeBaseline({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      budgetPlan: {
        settings: {
          forecastExpenseSource: "trend",
        },
        flowSummary: {
          expectedIncomeMonthly: 2829,
        },
      } as any,
      incomeSources: [],
    });

    expect(result).toBe(2829);
  });

  it("lets booked additional income stack on top of the budget basis in the current month", () => {
    const result = buildForecastMonthMath({
      startingBalance: 1000,
      currentBalanceAnchor: 1500,
      bookedIncomeTotal: 3300,
      bookedForecastEligibleIncomeTotal: 2400,
      bookedExpenseTotal: 900,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 300,
      bookedSubscriptions: 100,
      bookedVariableCosts: 500,
      expectedIncomeBaseline: 2829,
      remainingCommittedIncomeTotal: 0,
      expectedFixedCostsBaseline: 600,
      expectedSubscriptionsBaseline: 120,
      expectedVariableCostsBaseline: 900,
      expectedSavingsOutflowBaseline: 0,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.remainingExpectedIncomeTotal).toBe(429);
    expect(result.expectedIncomeTotal).toBe(3729);
    expect(result.expectedExpenseTotal).toBe(1620);
  });

  it("keeps actual current-month expense overruns in the forecast totals", () => {
    const result = buildForecastMonthMath({
      startingBalance: 1000,
      currentBalanceAnchor: 1500,
      bookedIncomeTotal: 2500,
      bookedForecastEligibleIncomeTotal: 2500,
      bookedExpenseTotal: 900,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 700,
      bookedSubscriptions: 50,
      bookedVariableCosts: 150,
      expectedIncomeBaseline: 2500,
      remainingCommittedIncomeTotal: 0,
      expectedFixedCostsBaseline: 500,
      expectedSubscriptionsBaseline: 50,
      expectedVariableCostsBaseline: 100,
      expectedSavingsOutflowBaseline: 0,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.expectedFixedCosts).toBe(700);
    expect(result.expectedSubscriptions).toBe(50);
    expect(result.expectedVariableCosts).toBe(150);
    expect(result.expectedExpenseTotal).toBe(900);
    expect(result.remainingExpectedExpenseTotal).toBe(0);
    expect(result.expectedEndOfMonthBalance).toBe(2600);
  });

  it("keeps booked excluded income on top of the included recurring baseline", () => {
    const result = buildForecastMonthMath({
      startingBalance: 1000,
      currentBalanceAnchor: 1800,
      bookedIncomeTotal: 2900,
      bookedForecastEligibleIncomeTotal: 2400,
      bookedExpenseTotal: 700,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 400,
      bookedSubscriptions: 75,
      bookedVariableCosts: 225,
      expectedIncomeBaseline: 2829,
      remainingCommittedIncomeTotal: 429,
      expectedFixedCostsBaseline: 400,
      expectedSubscriptionsBaseline: 75,
      expectedVariableCostsBaseline: 300,
      expectedSavingsOutflowBaseline: 0,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.remainingExpectedIncomeTotal).toBe(429);
    expect(result.expectedIncomeTotal).toBe(3329);
  });

  it("adds booked variable income to remaining variable forecast in the current month", () => {
    const result = buildForecastMonthMath({
      startingBalance: 1000,
      currentBalanceAnchor: 1600,
      bookedIncomeTotal: 2900,
      bookedForecastEligibleIncomeTotal: 2900,
      bookedExpenseTotal: 700,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 400,
      bookedSubscriptions: 75,
      bookedVariableCosts: 225,
      expectedIncomeBaseline: 3479,
      remainingCommittedIncomeTotal: 579,
      expectedFixedCostsBaseline: 400,
      expectedSubscriptionsBaseline: 75,
      expectedVariableCostsBaseline: 300,
      expectedSavingsOutflowBaseline: 0,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.remainingExpectedIncomeTotal).toBe(579);
    expect(result.expectedIncomeTotal).toBe(3479);
  });
});

describe("createBudgetPlanRequestDescriptors", () => {
  it("uses the specific future month as budget reference for future forecasts", () => {
    const descriptors = createBudgetPlanRequestDescriptors(
      [
        new Date("2026-03-01T00:00:00.000Z"),
        new Date("2026-04-01T00:00:00.000Z"),
        new Date("2026-05-01T00:00:00.000Z"),
      ],
      new Date("2026-03-17T12:00:00.000Z"),
    );

    expect(
      descriptors.map((item) => ({
        monthStartIso: item.monthStartIso,
        planReferenceIso: item.planReference.toISOString().slice(0, 10),
      })),
    ).toEqual([
      {
        monthStartIso: "2026-03-01",
        planReferenceIso: "2026-03-17",
      },
      {
        monthStartIso: "2026-04-01",
        planReferenceIso: "2026-04-01",
      },
      {
        monthStartIso: "2026-05-01",
        planReferenceIso: "2026-05-01",
      },
    ]);
  });

  it("keeps historical forecasts anchored to the end of the selected month", () => {
    const descriptors = createBudgetPlanRequestDescriptors(
      [new Date("2026-01-01T00:00:00.000Z")],
      new Date("2026-03-17T12:00:00.000Z"),
    );

    expect(descriptors[0]?.monthStartIso).toBe("2026-01-01");
    expect(descriptors[0]?.planReference.toISOString().slice(0, 10)).toBe(
      "2026-01-31",
    );
  });
});
