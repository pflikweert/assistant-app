import type {
    BudgetCategoryKey,
    BudgetPlanMode,
    BudgetRecommendationRow,
} from "@/types/categorization";

export const VARIABLE_MAIN_CATEGORY_KEYS: BudgetCategoryKey[] = [
  "groceries",
  "fuel",
  "smoking",
  "other",
];

export function isVariableBudgetCategory(categoryKey: BudgetCategoryKey) {
  return (
    categoryKey === "variable_costs" ||
    VARIABLE_MAIN_CATEGORY_KEYS.includes(categoryKey)
  );
}

export function isAutoModeTrendLock(
  mode: BudgetPlanMode,
  baselineMonthly: number,
  monthlyBudgetValue: number | null | undefined,
  lockTrend: boolean | null | undefined = null,
  toleranceEuro = 1,
) {
  if (mode === "custom") return false;
  if (lockTrend === true) return true;
  if (lockTrend === false) return false;
  if (monthlyBudgetValue == null) return false;
  return (
    Math.abs(Math.round(monthlyBudgetValue) - Math.round(baselineMonthly)) <=
    Math.max(toleranceEuro, 0)
  );
}

export function resolveLockedVariableMainCategories(
  recommendations: {
    categoryKey: BudgetRecommendationRow["categoryKey"];
    overrideSource: BudgetRecommendationRow["overrideSource"];
  }[],
) {
  const locked = new Set<BudgetCategoryKey>();

  for (const recommendation of recommendations) {
    if (!VARIABLE_MAIN_CATEGORY_KEYS.includes(recommendation.categoryKey)) {
      continue;
    }

    if (recommendation.overrideSource !== "trend_lock") continue;
    locked.add(recommendation.categoryKey);
  }

  return locked;
}

export function shouldPersistCategoryOnBudgetSave(params: {
  categoryKey: BudgetCategoryKey;
  autoManagedVariableBudget: boolean;
  lockedCategoryKeys: ReadonlySet<BudgetCategoryKey>;
}) {
  const { categoryKey, autoManagedVariableBudget, lockedCategoryKeys } = params;
  if (!autoManagedVariableBudget) return true;
  if (!isVariableBudgetCategory(categoryKey)) return true;
  return lockedCategoryKeys.has(categoryKey);
}

export function allocateIntegerBudget(total: number, weights: number[]) {
  const normalizedTotal = Math.max(Math.round(total), 0);
  if (!weights.length) return [] as number[];
  if (normalizedTotal <= 0) return weights.map(() => 0);

  let normalizedWeights = weights.map((weight) =>
    Math.max(Number(weight) || 0, 0),
  );
  let weightTotal = normalizedWeights.reduce((sum, weight) => sum + weight, 0);

  if (weightTotal <= 0) {
    normalizedWeights = weights.map(() => 1);
    weightTotal = normalizedWeights.length;
  }

  const rawAllocations = normalizedWeights.map(
    (weight) => (normalizedTotal * weight) / weightTotal,
  );
  const allocations = rawAllocations.map((value) => Math.floor(value));
  let remainder =
    normalizedTotal - allocations.reduce((sum, value) => sum + value, 0);

  const rankedRemainders = rawAllocations
    .map((value, index) => ({
      index,
      remainder: value - Math.floor(value),
    }))
    .sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }
      return left.index - right.index;
    });

  let cursor = 0;
  while (remainder > 0 && rankedRemainders.length > 0) {
    allocations[rankedRemainders[cursor % rankedRemainders.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return allocations;
}

export function allocateWeekBudgetsByMainCategory(params: {
  baseWeekBudgetByMainCategory: Map<string, number>;
  weekBudget: number;
  lockedCategoryKeys: ReadonlySet<string>;
}) {
  const {
    baseWeekBudgetByMainCategory,
    weekBudget,
    lockedCategoryKeys,
  } = params;
  const targetWeekBudget = Math.max(Math.round(weekBudget), 0);
  const rows = [...baseWeekBudgetByMainCategory.entries()];
  const lockedRows = rows.filter(([key]) => lockedCategoryKeys.has(key));
  const unlockedRows = rows.filter(([key]) => !lockedCategoryKeys.has(key));

  const lockedRawBudgetTotal = lockedRows.reduce(
    (sum, [, budget]) => sum + Math.max(Number(budget) || 0, 0),
    0,
  );

  const result = new Map<string, number>();

  if (lockedRawBudgetTotal >= targetWeekBudget) {
    const lockedAllocations = allocateIntegerBudget(
      targetWeekBudget,
      lockedRows.map(([, budget]) => Math.max(Number(budget) || 0, 0)),
    );

    lockedRows.forEach(([key], index) => {
      result.set(key, lockedAllocations[index] || 0);
    });
    unlockedRows.forEach(([key]) => {
      result.set(key, 0);
    });

    return result;
  }

  const lockedWeekBudgets = new Map<string, number>();
  lockedRows.forEach(([key, budget]) => {
    lockedWeekBudgets.set(key, Math.max(Math.round(Number(budget) || 0), 0));
  });

  const lockedWeekTotal = [...lockedWeekBudgets.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const remainingWeekBudget = Math.max(targetWeekBudget - lockedWeekTotal, 0);
  const unlockedAllocations = allocateIntegerBudget(
    remainingWeekBudget,
    unlockedRows.map(([, budget]) => Math.max(Number(budget) || 0, 0)),
  );

  let unlockedIndex = 0;
  rows.forEach(([key]) => {
    if (lockedWeekBudgets.has(key)) {
      result.set(key, lockedWeekBudgets.get(key) || 0);
      return;
    }

    result.set(key, unlockedAllocations[unlockedIndex] || 0);
    unlockedIndex += 1;
  });

  return result;
}
