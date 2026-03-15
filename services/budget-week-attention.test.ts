import { describe, expect, it } from "vitest";

import type {
  BudgetWeekPlanRow,
  BudgetWeekSpendBreakdown,
} from "@/types/categorization";

import {
  buildWeekAttentionRows,
  VARIABLE_BUDGET_BREAKDOWN_KEYS,
} from "./budget-week-attention";

function createWeekStub(): BudgetWeekPlanRow {
  return {
    weekNumber: 2,
    label: "Week 2",
    startDate: "2026-03-09",
    endDateExclusive: "2026-03-16",
    daysInCurrentMonth: 7,
    daysInPreviousMonth: 0,
    daysInNextMonth: 0,
    crossesMonthBoundary: false,
    budget: 250,
    actual: 160,
    remaining: 90,
    utilization: 0.64,
    isCurrentWeek: true,
    isPastWeek: false,
    wasRebalanced: false,
    overrunAmount: 0,
  };
}

function createSpendBreakdown(
  amounts: Partial<Record<string, number>>,
): BudgetWeekSpendBreakdown {
  return {
    weekNumber: 2,
    startDate: "2026-03-09",
    endDateExclusive: "2026-03-16",
    categories: Object.entries(amounts).map(([key, amount]) => ({
      key,
      label: key,
      amount: amount || 0,
      subcategories: [],
    })),
  };
}

describe("buildWeekAttentionRows", () => {
  it("sorts categories by risk first and then by utilization", () => {
    const rows = buildWeekAttentionRows({
      focusWeek: createWeekStub(),
      spendBreakdown: createSpendBreakdown({
        groceries: 110,
        fuel: 90,
        smoking: 0,
        other: 40,
      }),
      weekBudgetByMainCategory: new Map([
        ["groceries", 100],
        ["fuel", 100],
        ["smoking", 100],
        ["other", 100],
      ]),
    });

    expect(rows.map((row) => row.categoryKey)).toEqual([
      "groceries",
      "fuel",
      "other",
      "smoking",
    ]);
    expect(rows[0]?.statusLabel).toBe("Boven tempo");
    expect(rows[1]?.statusLabel).toBe("Let op");
    expect(rows[2]?.statusLabel).toBe("Op schema");
  });

  it("keeps planned categories visible even before spending starts", () => {
    const rows = buildWeekAttentionRows({
      focusWeek: createWeekStub(),
      spendBreakdown: createSpendBreakdown({}),
      weekBudgetByMainCategory: new Map([
        ["groceries", 60],
        ["fuel", 40],
      ]),
    });

    expect(rows.map((row) => row.categoryKey)).toEqual(["groceries", "fuel"]);
    expect(rows.every((row) => row.weeklyActual === 0)).toBe(true);
  });

  it("still surfaces actual spend when a category has no week budget", () => {
    const rows = buildWeekAttentionRows({
      focusWeek: createWeekStub(),
      spendBreakdown: createSpendBreakdown({
        other: 18,
      }),
      weekBudgetByMainCategory: new Map([["groceries", 50]]),
    });

    expect(rows.map((row) => row.categoryKey)).toEqual(["other", "groceries"]);
    expect(rows[0]).toMatchObject({
      categoryKey: "other",
      weeklyBudget: 0,
      weeklyActual: 18,
      statusLabel: "Boven tempo",
    });
  });

  it("returns no rows when there is no focus week", () => {
    const rows = buildWeekAttentionRows({
      focusWeek: null,
      spendBreakdown: createSpendBreakdown({}),
      weekBudgetByMainCategory: new Map(
        VARIABLE_BUDGET_BREAKDOWN_KEYS.map((key) => [key, 25]),
      ),
    });

    expect(rows).toEqual([]);
  });
});
