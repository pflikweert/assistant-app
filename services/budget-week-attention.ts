import type {
  BudgetCategoryKey,
  BudgetWeekPlanRow,
  BudgetWeekSpendBreakdown,
} from "@/types/categorization";

import {
  getBudgetRiskLabel,
  getBudgetRiskTone,
  type BudgetRiskTone,
} from "./budget-risk";

export const VARIABLE_BUDGET_BREAKDOWN_KEYS: BudgetCategoryKey[] = [
  "groceries",
  "fuel",
  "smoking",
  "other",
];

export type VariableBudgetCategoryKey =
  (typeof VARIABLE_BUDGET_BREAKDOWN_KEYS)[number];

export type WeekAttentionRow = {
  categoryKey: VariableBudgetCategoryKey;
  label: string;
  weeklyBudget: number;
  weeklyActual: number;
  utilization: number;
  tone: BudgetRiskTone;
  statusLabel: string;
};

export function getBudgetCategoryDisplayLabel(categoryKey: BudgetCategoryKey) {
  if (categoryKey === "fixed_costs") return "Vaste lasten";
  if (categoryKey === "subscriptions") return "Abonnementen";
  if (categoryKey === "variable_costs") return "Variabele uitgaven";
  if (categoryKey === "groceries") return "Boodschappen";
  if (categoryKey === "fuel") return "Brandstof";
  if (categoryKey === "smoking") return "Roken";
  if (categoryKey === "other") return "Overig";
  return "Spaardoel";
}

export function buildWeekAttentionRows(params: {
  focusWeek: BudgetWeekPlanRow | null;
  spendBreakdown: BudgetWeekSpendBreakdown | null;
  weekBudgetByMainCategory: ReadonlyMap<string, number>;
}) {
  const { focusWeek, spendBreakdown, weekBudgetByMainCategory } = params;
  if (!focusWeek) return [] as WeekAttentionRow[];

  const spendByKey = new Map(
    (spendBreakdown?.categories || []).map((category) => [category.key, category]),
  );

  const rows = VARIABLE_BUDGET_BREAKDOWN_KEYS.map((categoryKey) => {
    const weeklyBudget = Math.round(weekBudgetByMainCategory.get(categoryKey) || 0);
    const weeklyActual = Math.round(spendByKey.get(categoryKey)?.amount || 0);
    const utilization =
      weeklyBudget > 0 ? weeklyActual / weeklyBudget : weeklyActual > 0 ? 1.25 : 0;
    const tone = getBudgetRiskTone(utilization);

    return {
      categoryKey,
      label: getBudgetCategoryDisplayLabel(categoryKey),
      weeklyBudget,
      weeklyActual,
      utilization,
      tone,
      statusLabel: getBudgetRiskLabel(utilization),
    };
  });

  const visibleRows = rows.filter(
    (row) => row.weeklyBudget > 0 || row.weeklyActual > 0,
  );
  const fallbackRows = rows.filter((row) => row.weeklyBudget > 0);
  const relevantRows = visibleRows.length > 0 ? visibleRows : fallbackRows;
  const toneWeight: Record<BudgetRiskTone, number> = {
    neutral: 0,
    good: 1,
    watch: 2,
    critical: 3,
  };

  return relevantRows.sort((left, right) => {
    const toneDiff = toneWeight[right.tone] - toneWeight[left.tone];
    if (toneDiff !== 0) return toneDiff;

    const utilizationDiff = right.utilization - left.utilization;
    if (utilizationDiff !== 0) return utilizationDiff;

    return right.weeklyActual - left.weeklyActual;
  });
}
