import { describe, expect, it } from "vitest";

import type { BudgetRecommendationRow } from "../types/categorization";
import {
    allocateWeekBudgetsByMainCategory,
    isAutoModeTrendLock,
    resolveLockedVariableMainCategories,
    shouldPersistCategoryOnBudgetSave,
} from "./budget-lock-utils";

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
  it("keeps locked smoking budget fixed and redistributes the rest", () => {
    const locked = new Set<string>(["smoking"]);
    const result = allocateWeekBudgetsByMainCategory({
      baseWeekBudgetByMainCategory: new Map<string, number>([
        ["groceries", 80],
        ["fuel", 20],
        ["smoking", 30],
        ["other", 10],
      ]),
      weekBudget: 180,
      lockedCategoryKeys: locked,
    });

    expect(result.get("smoking")).toBe(30);
    expect(
      (result.get("groceries") || 0) +
        (result.get("fuel") || 0) +
        (result.get("smoking") || 0) +
        (result.get("other") || 0),
    ).toBe(180);
    expect(result.get("groceries")).toBeGreaterThan(result.get("fuel") || 0);
  });

  it("caps locked budgets when the week target drops below the locked total", () => {
    const result = allocateWeekBudgetsByMainCategory({
      baseWeekBudgetByMainCategory: new Map<string, number>([
        ["groceries", 60],
        ["fuel", 20],
        ["smoking", 40],
      ]),
      weekBudget: 25,
      lockedCategoryKeys: new Set<string>(["smoking"]),
    });

    expect(result.get("smoking")).toBe(25);
    expect(result.get("groceries")).toBe(0);
    expect(result.get("fuel")).toBe(0);
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
