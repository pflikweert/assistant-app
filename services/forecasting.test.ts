import { describe, expect, it } from "vitest";

import { resolveExpectedCashflowIncomeBaseline } from "./forecast-income-baseline";

describe("resolveExpectedCashflowIncomeBaseline", () => {
  it("prefers real income sources over the budget planner basis for cashflow", () => {
    const result = resolveExpectedCashflowIncomeBaseline({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      budgetPlan: {
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

  it("uses all expected income sources even when the budget planner excludes some", () => {
    const result = resolveExpectedCashflowIncomeBaseline({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      budgetPlan: {
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
        {
          source_key: "variable_income",
          source_label: "Variabel inkomen",
          expected_income: 650,
          income_frequency: "monthly",
          income_day_of_month: 12,
          last_detected_at: "2026-02-12T09:00:00.000Z",
        },
      ],
    });

    expect(result).toBe(3479);
  });

  it("falls back to the budget planner basis when no income sources are available", () => {
    const result = resolveExpectedCashflowIncomeBaseline({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      budgetPlan: {
        flowSummary: {
          expectedIncomeMonthly: 2829,
        },
      } as any,
      incomeSources: [],
    });

    expect(result).toBe(2829);
  });
});
