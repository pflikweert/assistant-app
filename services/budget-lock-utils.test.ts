import { describe, expect, it } from "vitest";

import type { BudgetRecommendationRow } from "../types/categorization";
import {
    allocateWeekBudgetsByMainCategory,
    isAutoModeTrendLock,
    resolveLockedVariableMainCategories,
    shouldPersistCategoryOnBudgetSave,
} from "./budget-lock-utils";
import { buildCalendarWeekRangesForMonth } from "./budget-week-utils";

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe("isAutoModeTrendLock", () => {
  it("returns true in auto mode when monthly value matches baseline", () => {
    expect(isAutoModeTrendLock("active_savings", 210, 210)).toBe(true);
    expect(isAutoModeTrendLock("balanced", 210.4, 211)).toBe(true);
  });

  it("honors explicit lockTrend state", () => {
    expect(isAutoModeTrendLock("active_savings", 210, 190, true)).toBe(true);
    expect(isAutoModeTrendLock("active_savings", 210, 210, false)).toBe(false);
  });

  it("returns false when mode is custom or value is not near baseline", () => {
    expect(isAutoModeTrendLock("custom", 210, 210)).toBe(false);
    expect(isAutoModeTrendLock("active_savings", 210, 206)).toBe(false);
    expect(isAutoModeTrendLock("active_savings", 210, null)).toBe(false);
  });
});

describe("resolveLockedVariableMainCategories", () => {
  it("includes only variable main categories that are explicitly locked", () => {
    const recommendations = [
      {
        categoryKey: "smoking",
        overrideSource: "trend_lock",
      },
      {
        categoryKey: "groceries",
        overrideSource: "monthly_override",
      },
      {
        categoryKey: "subscriptions",
        overrideSource: "trend_lock",
      },
    ] as Pick<BudgetRecommendationRow, "categoryKey" | "overrideSource">[];

    const locked = resolveLockedVariableMainCategories(recommendations);

    expect(locked.has("smoking")).toBe(true);
    expect(locked.has("groceries")).toBe(false);
    expect(locked.has("subscriptions")).toBe(false);
  });

  it("excludes unlocked manual monthly overrides", () => {
    const recommendations = [
      {
        categoryKey: "fuel",
        overrideSource: "monthly_override",
      },
      {
        categoryKey: "other",
        overrideSource: "settings",
      },
      {
        categoryKey: "subscriptions",
        overrideSource: "trend_lock",
      },
    ] as Pick<BudgetRecommendationRow, "categoryKey" | "overrideSource">[];

    const locked = resolveLockedVariableMainCategories(recommendations);

    expect(locked.has("fuel")).toBe(false);
    expect(locked.has("other")).toBe(false);
    expect(locked.has("subscriptions")).toBe(false);
  });

  it("handles multiple locked and unlocked variable categories", () => {
    const recommendations = [
      {
        categoryKey: "groceries",
        overrideSource: "monthly_override",
      },
      {
        categoryKey: "fuel",
        overrideSource: "trend_lock",
      },
      {
        categoryKey: "smoking",
        overrideSource: "trend_lock",
      },
      {
        categoryKey: "subscriptions",
        overrideSource: "monthly_override",
      },
    ] as Pick<BudgetRecommendationRow, "categoryKey" | "overrideSource">[];

    const locked = resolveLockedVariableMainCategories(recommendations);

    expect(locked.has("groceries")).toBe(false);
    expect(locked.has("fuel")).toBe(true);
    expect(locked.has("smoking")).toBe(true);
    expect(locked.has("subscriptions")).toBe(false);
  });
});

describe("allocateWeekBudgetsByMainCategory", () => {
  it("keeps locked smoking budget constant when week totals differ", () => {
    const monthlyBudgets = new Map<string, number>([
      ["groceries", 300],
      ["fuel", 120],
      ["smoking", 204],
      ["other", 60],
    ]);
    const locked = new Set<string>(["smoking"]);
    const weekBudgets = [300, 220, 180];

    const perWeek = weekBudgets.map((weekBudget, weekIndex) =>
      allocateWeekBudgetsByMainCategory({
        monthlyBudgetByMainCategory: monthlyBudgets,
        weekBudget,
        weekIndex,
        weekCount: 3,
        lockedCategoryKeys: locked,
      }),
    );

    expect(perWeek.map((row) => row.get("smoking") || 0)).toEqual([68, 68, 68]);
  });

  it("keeps locked category flat across March 2026 weeks and redistributes remaining budget", () => {
    const monthStart = utcDate("2026-03-01");
    const monthEndExclusive = utcDate("2026-04-01");
    const weekRanges = buildCalendarWeekRangesForMonth(
      monthStart,
      monthEndExclusive,
    );
    expect(weekRanges.length).toBe(6);

    const monthlyBudgets = new Map<string, number>([
      ["groceries", 600],
      ["fuel", 300],
      ["smoking", 210],
      ["other", 90],
    ]);
    const locked = new Set<string>(["smoking"]);
    const weekBudgets = [300, 260, 240, 220, 200, 180];

    const perWeek = weekBudgets.map((weekBudget, weekIndex) =>
      allocateWeekBudgetsByMainCategory({
        monthlyBudgetByMainCategory: monthlyBudgets,
        weekBudget,
        weekIndex,
        weekCount: weekRanges.length,
        lockedCategoryKeys: locked,
      }),
    );

    const smokingBudgets = perWeek.map((row) => row.get("smoking") || 0);
    expect(smokingBudgets).toEqual([35, 35, 35, 35, 35, 35]);

    for (let index = 0; index < perWeek.length; index += 1) {
      const row = perWeek[index];
      const sum =
        (row.get("groceries") || 0) +
        (row.get("fuel") || 0) +
        (row.get("smoking") || 0) +
        (row.get("other") || 0);
      expect(sum).toBe(weekBudgets[index]);
    }

    expect(
      (perWeek[0].get("groceries") || 0) > (perWeek[5].get("groceries") || 0),
    ).toBe(true);
  });
});

describe("unlock save reopen flow", () => {
  it("does not re-lock a category after unlock + save in auto mode", () => {
    const lockedBefore = resolveLockedVariableMainCategories([
      {
        categoryKey: "smoking",
        overrideSource: "trend_lock",
      },
    ]);
    expect(lockedBefore.has("smoking")).toBe(true);

    const shouldPersistSmokingAfterUnlock = shouldPersistCategoryOnBudgetSave({
      categoryKey: "smoking",
      autoManagedVariableBudget: true,
      lockedCategoryKeys: new Set(),
    });
    expect(shouldPersistSmokingAfterUnlock).toBe(false);

    const lockedAfterReopen = resolveLockedVariableMainCategories([
      {
        categoryKey: "smoking",
        overrideSource: "monthly_override",
      },
    ]);
    expect(lockedAfterReopen.has("smoking")).toBe(false);
  });
});

describe("shouldPersistCategoryOnBudgetSave", () => {
  it("persists non-variable categories even in auto mode", () => {
    expect(
      shouldPersistCategoryOnBudgetSave({
        categoryKey: "fixed_costs",
        autoManagedVariableBudget: true,
        lockedCategoryKeys: new Set(),
      }),
    ).toBe(true);
  });

  it("does not persist unlocked variable categories in auto mode", () => {
    expect(
      shouldPersistCategoryOnBudgetSave({
        categoryKey: "groceries",
        autoManagedVariableBudget: true,
        lockedCategoryKeys: new Set(),
      }),
    ).toBe(false);
  });

  it("persists locked variable categories in auto mode", () => {
    expect(
      shouldPersistCategoryOnBudgetSave({
        categoryKey: "groceries",
        autoManagedVariableBudget: true,
        lockedCategoryKeys: new Set(["groceries"]),
      }),
    ).toBe(true);
  });

  it("persists manual variable categories in custom mode", () => {
    expect(
      shouldPersistCategoryOnBudgetSave({
        categoryKey: "groceries",
        autoManagedVariableBudget: false,
        lockedCategoryKeys: new Set(),
      }),
    ).toBe(true);
  });
});
