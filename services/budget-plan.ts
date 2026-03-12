import { supabase } from "@/services/supabase";
import {
  getBudgetCategoryOverrides,
  getBudgetPlanSettings,
  getMonthlyBudgetValues,
} from "@/services/budget-plan-repository";
import { normalizePattern } from "@/services/categorization-repository";
import type {
  AnalysisCategory,
  AnalysisMainGroup,
  BudgetCategoryKey,
  BudgetCoachReport,
  BudgetExpenseBreakdown,
  BudgetIncomeBreakdown,
  BudgetOverrideSource,
  BudgetPlanComputation,
  BudgetPlanSettings,
  BudgetRecommendationRow,
  BudgetTrendSnapshot,
  BudgetVariableBreakdown,
  BudgetWarning,
  BudgetWarningSeverity,
} from "@/types/categorization";

const PAGE_SIZE = 500;
const TREND_WINDOW_DAYS = 90;
const MONTHLY_NORMALIZER_DAYS = 30.4375;
const WEEKS_PER_MONTH = 4.33;

type BudgetTx = {
  id: string;
  date: string;
  amount: number;
  details: string;
  counterparty: string | null;
  analysis_main_group: AnalysisMainGroup | null;
  analysis_category: AnalysisCategory | null;
  category_id_auto: string | null;
  category_id_user: string | null;
};

type CategoryMeta = {
  id: string;
  key: string;
  budget_group: string | null;
};

type IncomeBucket = "salary" | "childBudget" | "structuralOther" | "variable";

type ExpenseBucket =
  | "fixed_costs"
  | "subscriptions"
  | "variable_costs"
  | "savings_transfer";

const RECOMMENDATION_ORDER: BudgetCategoryKey[] = [
  "fixed_costs",
  "subscriptions",
  "variable_costs",
  "groceries",
  "fuel",
  "smoking",
  "other",
  "savings_target",
];

const RECOMMENDATION_LABELS: Record<BudgetCategoryKey, string> = {
  fixed_costs: "Fixed costs",
  subscriptions: "Subscriptions",
  variable_costs: "Variable costs",
  groceries: "Groceries",
  fuel: "Fuel",
  smoking: "Smoking",
  other: "Other variable",
  savings_target: "Savings target",
};

const STRUCTURAL_INCOME_KEYWORDS = [
  "salaris",
  "loon",
  "salary",
  "kindgebonden",
  "kgb",
  "toeslag",
  "uitkering",
  "refund",
  "declaratie",
  "teruggave",
];

const FIXED_EXPENSE_KEYWORDS = [
  "hypotheek",
  "huur",
  "energie",
  "water",
  "zorgverzekering",
  "verzekering",
  "wegenbelasting",
  "mrb",
  "motorrijtuig",
  "gemeente",
  "belasting",
  "internet",
  "elektra",
  "gas",
];

const SUBSCRIPTION_KEYWORDS = [
  "abonnement",
  "netflix",
  "spotify",
  "youtube",
  "google one",
  "icloud",
  "adobe",
  "youfone",
  "ziggo",
  "vodafone",
  "playstation",
];

const SAVINGS_TRANSFER_KEYWORDS = [
  "spaar",
  "sparen",
  "beleggen",
  "belegging",
  "invest",
  "naar eigen rekening",
  "overboeking",
  "transfer",
];

const GROCERIES_KEYWORDS = [
  "jumbo",
  "plus",
  "albert heijn",
  "ah",
  "lidl",
  "aldi",
  "coop",
  "boodschap",
];

const FUEL_KEYWORDS = [
  "shell",
  "bp",
  "esso",
  "tango",
  "tinq",
  "total",
  "fuel",
  "benzine",
  "diesel",
  "tank",
];

const SMOKING_KEYWORDS = ["tabak", "sigaret", "sigaretten", "rook", "vape"];

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthExclusive(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysBetween(startInclusive: Date, endExclusive: Date) {
  const ms = endExclusive.getTime() - startInclusive.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function isSavingsCategoryKey(categoryKey: string) {
  return (
    categoryKey === "savings" ||
    categoryKey === "savings_transfer" ||
    categoryKey.startsWith("savings_")
  );
}

function isSubscriptionCategoryKey(categoryKey: string) {
  return (
    categoryKey === "subscriptions" ||
    categoryKey.startsWith("subscriptions_") ||
    categoryKey.startsWith("subscription_")
  );
}

function isFixedCategoryKey(categoryKey: string) {
  return (
    categoryKey.startsWith("housing") ||
    categoryKey.startsWith("care_health_insurance") ||
    categoryKey.startsWith("insurance_health") ||
    categoryKey.startsWith("health_insurance") ||
    categoryKey.startsWith("auto_transport_car_insurance") ||
    categoryKey.startsWith("auto_transport_road_tax")
  );
}

function normalizeCategoryKey(categoryKey: string | null): string {
  return String(categoryKey || "").toLowerCase();
}

function getHaystack(tx: Pick<BudgetTx, "counterparty" | "details">) {
  return normalizePattern(`${tx.counterparty || ""} ${tx.details || ""}`);
}

function resolveExpenseBucket(tx: BudgetTx, categoryMeta: CategoryMeta | null): ExpenseBucket {
  if (
    tx.analysis_main_group === "expense" &&
    (tx.analysis_category === "fixed_costs" ||
      tx.analysis_category === "subscriptions" ||
      tx.analysis_category === "variable_costs" ||
      tx.analysis_category === "savings_transfer")
  ) {
    return tx.analysis_category;
  }

  const categoryKey = categoryMeta ? normalizeCategoryKey(categoryMeta.key) : "";
  const budgetGroup = normalizePattern(categoryMeta?.budget_group || "");
  const haystack = getHaystack(tx);

  if (categoryKey) {
    if (isSavingsCategoryKey(categoryKey)) return "savings_transfer";
    if (isSubscriptionCategoryKey(categoryKey)) return "subscriptions";
    if (isFixedCategoryKey(categoryKey)) return "fixed_costs";

    if (
      categoryKey.startsWith("groceries") ||
      categoryKey.startsWith("fuel") ||
      categoryKey.startsWith("smoking") ||
      categoryKey.startsWith("care") ||
      categoryKey.startsWith("health") ||
      categoryKey.startsWith("shopping")
    ) {
      return "variable_costs";
    }
  }

  if (budgetGroup === "savings") return "savings_transfer";
  if (budgetGroup === "fixed") return "fixed_costs";
  if (budgetGroup === "variable") return "variable_costs";

  if (includesAny(haystack, SAVINGS_TRANSFER_KEYWORDS)) return "savings_transfer";
  if (includesAny(haystack, SUBSCRIPTION_KEYWORDS)) return "subscriptions";
  if (includesAny(haystack, FIXED_EXPENSE_KEYWORDS)) return "fixed_costs";

  return "variable_costs";
}

function resolveVariableSubbucket(
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
): "groceries" | "fuel" | "smoking" | "other" {
  const categoryKey = categoryMeta ? normalizeCategoryKey(categoryMeta.key) : "";
  const haystack = getHaystack(tx);

  if (
    categoryKey.includes("groceries") ||
    categoryKey.includes("supermarket") ||
    includesAny(haystack, GROCERIES_KEYWORDS)
  ) {
    return "groceries";
  }

  if (categoryKey.includes("fuel") || includesAny(haystack, FUEL_KEYWORDS)) {
    return "fuel";
  }

  if (categoryKey.includes("smoking") || includesAny(haystack, SMOKING_KEYWORDS)) {
    return "smoking";
  }

  return "other";
}

function classifyIncome(
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
): IncomeBucket {
  const categoryKey = categoryMeta ? normalizeCategoryKey(categoryMeta.key) : "";
  const haystack = getHaystack(tx);

  if (
    categoryKey.includes("income_salary") ||
    haystack.includes("salaris") ||
    haystack.includes("loon") ||
    haystack.includes("salary")
  ) {
    return "salary";
  }

  if (
    categoryKey.includes("income_child_budget") ||
    haystack.includes("kindgebonden budget") ||
    haystack.includes("kgb") ||
    haystack.includes("child budget")
  ) {
    return "childBudget";
  }

  if (
    tx.analysis_category === "income_structural" ||
    categoryKey.startsWith("income_") ||
    includesAny(haystack, STRUCTURAL_INCOME_KEYWORDS)
  ) {
    return "structuralOther";
  }

  return "variable";
}

function emptyIncomeBreakdown(): BudgetIncomeBreakdown {
  return {
    salary: 0,
    childBudget: 0,
    structuralOther: 0,
    variable: 0,
    total: 0,
  };
}

function emptyVariableBreakdown(): BudgetVariableBreakdown {
  return {
    groceries: 0,
    fuel: 0,
    smoking: 0,
    other: 0,
    total: 0,
  };
}

function emptyExpenseBreakdown(): BudgetExpenseBreakdown {
  return {
    fixedCosts: 0,
    subscriptions: 0,
    variableCosts: 0,
    savingsTransfer: 0,
    total: 0,
    variable: emptyVariableBreakdown(),
  };
}

function multiplyIncomeBy(value: BudgetIncomeBreakdown, factor: number): BudgetIncomeBreakdown {
  return {
    salary: round2(value.salary * factor),
    childBudget: round2(value.childBudget * factor),
    structuralOther: round2(value.structuralOther * factor),
    variable: round2(value.variable * factor),
    total: round2(value.total * factor),
  };
}

function multiplyVariableBy(
  value: BudgetVariableBreakdown,
  factor: number,
): BudgetVariableBreakdown {
  return {
    groceries: round2(value.groceries * factor),
    fuel: round2(value.fuel * factor),
    smoking: round2(value.smoking * factor),
    other: round2(value.other * factor),
    total: round2(value.total * factor),
  };
}

function multiplyExpensesBy(
  value: BudgetExpenseBreakdown,
  factor: number,
): BudgetExpenseBreakdown {
  return {
    fixedCosts: round2(value.fixedCosts * factor),
    subscriptions: round2(value.subscriptions * factor),
    variableCosts: round2(value.variableCosts * factor),
    savingsTransfer: round2(value.savingsTransfer * factor),
    total: round2(value.total * factor),
    variable: multiplyVariableBy(value.variable, factor),
  };
}

function getBudgetCategoryActual(
  key: BudgetCategoryKey,
  monthToDate: BudgetExpenseBreakdown,
): number {
  if (key === "fixed_costs") return monthToDate.fixedCosts;
  if (key === "subscriptions") return monthToDate.subscriptions;
  if (key === "variable_costs") return monthToDate.variableCosts;
  if (key === "groceries") return monthToDate.variable.groceries;
  if (key === "fuel") return monthToDate.variable.fuel;
  if (key === "smoking") return monthToDate.variable.smoking;
  if (key === "other") return monthToDate.variable.other;
  return monthToDate.savingsTransfer;
}

function getTrendBaselineForCategory(
  key: BudgetCategoryKey,
  trend: BudgetTrendSnapshot,
): number {
  if (key === "fixed_costs") return trend.expenses.fixedCosts;
  if (key === "subscriptions") return trend.expenses.subscriptions;
  if (key === "variable_costs") return trend.expenses.variableCosts;
  if (key === "groceries") return trend.expenses.variable.groceries;
  if (key === "fuel") return trend.expenses.variable.fuel;
  if (key === "smoking") return trend.expenses.variable.smoking;
  if (key === "other") return trend.expenses.variable.other;

  return Math.max(
    trend.income.total -
      (trend.expenses.fixedCosts +
        trend.expenses.subscriptions +
        trend.expenses.variableCosts),
    0,
  );
}

function defaultFactorForCategory(
  categoryKey: BudgetCategoryKey,
  settings: BudgetPlanSettings,
): number {
  if (categoryKey === "fixed_costs" || categoryKey === "subscriptions") {
    return 1;
  }
  if (
    categoryKey === "variable_costs" ||
    categoryKey === "groceries" ||
    categoryKey === "fuel" ||
    categoryKey === "smoking" ||
    categoryKey === "other"
  ) {
    return settings.adjustmentFactor;
  }
  return 1;
}

function resolveUtilization(monthlyActual: number, monthlyBudget: number): number {
  if (monthlyBudget <= 0) return monthlyActual > 0 ? Number.POSITIVE_INFINITY : 0;
  return monthlyActual / monthlyBudget;
}

function resolveWarningSeverity(utilization: number): BudgetWarningSeverity {
  if (utilization >= 1.25) return "critical";
  if (utilization >= 1.1) return "warning";
  return "info";
}

function formatWarningMessage(label: string, utilization: number): string {
  if (!Number.isFinite(utilization)) {
    return `${label} has spend while no budget is set.`;
  }
  const overByPct = Math.max(Math.round((utilization - 1) * 100), 1);
  return `${label} is ${overByPct}% above budget.`;
}

function formatPaceWarningMessage(label: string, projectedUtilization: number): string {
  if (!Number.isFinite(projectedUtilization)) {
    return `${label} week pace is above plan (no budget set).`;
  }
  const overByPct = Math.max(Math.round((projectedUtilization - 1) * 100), 1);
  return `${label} week pace is ${overByPct}% above plan.`;
}

async function fetchTransactionsInRange(
  startIso: string,
  endIso: string,
): Promise<BudgetTx[]> {
  const rows: BudgetTx[] = [];
  let offset = 0;

  while (true) {
    const to = offset + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id,date,amount,details,counterparty,analysis_main_group,analysis_category,category_id_auto,category_id_user",
      )
      .gte("date", startIso)
      .lt("date", endIso)
      .order("date", { ascending: false })
      .range(offset, to);

    if (error) throw error;

    const page = ((data || []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id || ""),
      date: String(row.date || ""),
      amount: asNumber(row.amount, 0),
      details: String(row.details || ""),
      counterparty: row.counterparty ? String(row.counterparty) : null,
      analysis_main_group: (row.analysis_main_group || null) as AnalysisMainGroup | null,
      analysis_category: (row.analysis_category || null) as AnalysisCategory | null,
      category_id_auto: row.category_id_auto ? String(row.category_id_auto) : null,
      category_id_user: row.category_id_user ? String(row.category_id_user) : null,
    }));

    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchCategoryMap(): Promise<Map<string, CategoryMeta>> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,key,budget_group");

  if (error) throw error;

  const map = new Map<string, CategoryMeta>();
  for (const row of (data || []) as Record<string, unknown>[]) {
    const id = String(row.id || "");
    map.set(id, {
      id,
      key: String(row.key || ""),
      budget_group: row.budget_group ? String(row.budget_group) : null,
    });
  }

  return map;
}

function computeBreakdowns(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
): { income: BudgetIncomeBreakdown; expenses: BudgetExpenseBreakdown } {
  const income = emptyIncomeBreakdown();
  const expenses = emptyExpenseBreakdown();

  for (const row of rows) {
    const amount = asNumber(row.amount, 0);
    if (amount === 0) continue;

    const categoryId = row.category_id_user || row.category_id_auto;
    const categoryMeta = categoryId ? categoryMap.get(categoryId) || null : null;

    if (amount > 0) {
      const incomeBucket = classifyIncome(row, categoryMeta);
      if (incomeBucket === "salary") income.salary += amount;
      if (incomeBucket === "childBudget") income.childBudget += amount;
      if (incomeBucket === "structuralOther") income.structuralOther += amount;
      if (incomeBucket === "variable") income.variable += amount;
      income.total += amount;
      continue;
    }

    const absAmount = Math.abs(amount);
    const bucket = resolveExpenseBucket(row, categoryMeta);

    if (bucket === "fixed_costs") expenses.fixedCosts += absAmount;
    if (bucket === "subscriptions") expenses.subscriptions += absAmount;
    if (bucket === "savings_transfer") expenses.savingsTransfer += absAmount;

    if (bucket === "variable_costs") {
      expenses.variableCosts += absAmount;
      const subbucket = resolveVariableSubbucket(row, categoryMeta);
      if (subbucket === "groceries") expenses.variable.groceries += absAmount;
      if (subbucket === "fuel") expenses.variable.fuel += absAmount;
      if (subbucket === "smoking") expenses.variable.smoking += absAmount;
      if (subbucket === "other") expenses.variable.other += absAmount;
    }

    expenses.total += absAmount;
  }

  expenses.variable.total =
    expenses.variable.groceries +
    expenses.variable.fuel +
    expenses.variable.smoking +
    expenses.variable.other;

  income.salary = round2(income.salary);
  income.childBudget = round2(income.childBudget);
  income.structuralOther = round2(income.structuralOther);
  income.variable = round2(income.variable);
  income.total = round2(income.total);

  expenses.fixedCosts = round2(expenses.fixedCosts);
  expenses.subscriptions = round2(expenses.subscriptions);
  expenses.variableCosts = round2(expenses.variableCosts);
  expenses.savingsTransfer = round2(expenses.savingsTransfer);
  expenses.total = round2(expenses.total);
  expenses.variable.groceries = round2(expenses.variable.groceries);
  expenses.variable.fuel = round2(expenses.variable.fuel);
  expenses.variable.smoking = round2(expenses.variable.smoking);
  expenses.variable.other = round2(expenses.variable.other);
  expenses.variable.total = round2(expenses.variable.total);

  return { income, expenses };
}

function buildCoachReport(
  recommendations: BudgetRecommendationRow[],
  warnings: BudgetWarning[],
  recommendedSavings: number,
): BudgetCoachReport {
  const strengths = recommendations
    .filter(
      (row) =>
        row.categoryKey !== "savings_target" &&
        row.monthlyActual > 0 &&
        Number.isFinite(row.utilization) &&
        row.utilization <= 0.9,
    )
    .sort((left, right) => left.utilization - right.utilization)
    .slice(0, 3)
    .map((row) => `${row.label} is on track (${Math.round(row.utilization * 100)}% used).`);

  const risks = warnings.slice(0, 4).map((warning) => warning.message);

  const actions: string[] = [];
  if (warnings.some((warning) => warning.severity === "critical")) {
    actions.push("Reduce variable spending immediately to prevent month-end pressure.");
  }
  if (warnings.some((warning) => warning.severity === "warning")) {
    actions.push("Review recurring and discretionary expenses this week.");
  }
  if (recommendedSavings > 0) {
    actions.push(`Reserve ${round2(recommendedSavings)} for savings this month.`);
  }
  if (!actions.length) {
    actions.push("Current spending is healthy. Keep following this plan.");
  }

  return {
    generatedAt: new Date().toISOString(),
    sections: {
      summary: `${warnings.length} warning(s) detected, recommended savings ${round2(
        recommendedSavings,
      )}.`,
      strengths,
      risks,
      actions,
    },
  };
}

export async function computeBudgetPlan(
  reference = new Date(),
  planKey = "default",
): Promise<BudgetPlanComputation> {
  const referenceDay = startOfUtcDay(reference);
  const trendEndExclusive = addDays(referenceDay, 1);
  const trendStart = subtractDays(trendEndExclusive, TREND_WINDOW_DAYS);
  const monthStart = startOfMonth(referenceDay);
  const monthEndExclusive = endOfMonthExclusive(referenceDay);

  const dataStart = trendStart < monthStart ? trendStart : monthStart;

  const trendStartIso = dateToIso(trendStart);
  const trendEndIso = dateToIso(trendEndExclusive);
  const monthStartIso = dateToIso(monthStart);

  const [
    categoryMap,
    transactions,
    settings,
    categoryOverrides,
    monthlyBudgetValues,
  ] = await Promise.all([
    fetchCategoryMap(),
    fetchTransactionsInRange(dateToIso(dataStart), trendEndIso),
    getBudgetPlanSettings(planKey),
    getBudgetCategoryOverrides(planKey),
    getMonthlyBudgetValues(monthStartIso, planKey),
  ]);

  const trendRows = transactions.filter(
    (row) => row.date >= trendStartIso && row.date < trendEndIso,
  );
  const monthRows = transactions.filter(
    (row) => row.date >= monthStartIso && row.date < trendEndIso,
  );

  const observedDays = daysBetween(trendStart, trendEndExclusive);
  const monthlyScale = MONTHLY_NORMALIZER_DAYS / observedDays;

  const trendRaw = computeBreakdowns(trendRows, categoryMap);
  const trend: BudgetTrendSnapshot = {
    windowDays: TREND_WINDOW_DAYS,
    observedDays,
    monthlyScale: round2(monthlyScale),
    income: multiplyIncomeBy(trendRaw.income, monthlyScale),
    expenses: multiplyExpensesBy(trendRaw.expenses, monthlyScale),
    net: round2((trendRaw.income.total - trendRaw.expenses.total) * monthlyScale),
  };

  const monthToDate = computeBreakdowns(monthRows, categoryMap);
  const monthProgress = Math.min(
    1,
    Math.max(0, daysBetween(monthStart, trendEndExclusive) / daysBetween(monthStart, monthEndExclusive)),
  );

  const overridesByKey = new Map(categoryOverrides.map((item) => [item.categoryKey, item]));
  const monthValuesByKey = new Map(
    monthlyBudgetValues.map((item) => [item.categoryKey, item]),
  );

  const recommendations: BudgetRecommendationRow[] = [];
  const warnings: BudgetWarning[] = [];

  for (const categoryKey of RECOMMENDATION_ORDER) {
    const baselineMonthly = round2(getTrendBaselineForCategory(categoryKey, trend));
    const actualMonthly = round2(getBudgetCategoryActual(categoryKey, monthToDate.expenses));

    const override = overridesByKey.get(categoryKey);
    const monthlyValue = monthValuesByKey.get(categoryKey);

    const defaultFactor = defaultFactorForCategory(categoryKey, settings);
    const resolvedFactor = override?.factorOverride ?? defaultFactor;

    let overrideSource: BudgetOverrideSource = "trend";
    let monthlyBudget = 0;
    let appliedFactor = resolvedFactor;

    if (monthlyValue) {
      monthlyBudget = round2(Math.max(monthlyValue.monthlyBudget, 0));
      appliedFactor = baselineMonthly > 0 ? monthlyBudget / baselineMonthly : resolvedFactor;
      overrideSource = "monthly_override";
    } else if (override?.monthlyTargetOverride != null) {
      monthlyBudget = round2(Math.max(override.monthlyTargetOverride, 0));
      appliedFactor =
        baselineMonthly > 0
          ? monthlyBudget / baselineMonthly
          : override.factorOverride ?? resolvedFactor;
      overrideSource = "category_override";
    } else {
      monthlyBudget = round2(Math.max(baselineMonthly * resolvedFactor, 0));
      if (override?.factorOverride != null) {
        overrideSource = "category_override";
      } else if (
        categoryKey === "variable_costs" ||
        categoryKey === "groceries" ||
        categoryKey === "fuel" ||
        categoryKey === "smoking" ||
        categoryKey === "other"
      ) {
        overrideSource = "settings";
      }
    }

    const weeklyBudget = round2(monthlyBudget / WEEKS_PER_MONTH);
    const utilization = resolveUtilization(actualMonthly, monthlyBudget);

    const recommendation: BudgetRecommendationRow = {
      categoryKey,
      label: RECOMMENDATION_LABELS[categoryKey],
      baselineMonthly,
      appliedFactor: round2(appliedFactor),
      monthlyBudget,
      weeklyBudget,
      monthlyActual: actualMonthly,
      monthProgress: round2(monthProgress),
      utilization,
      overrideSource,
    };
    recommendations.push(recommendation);

    if (categoryKey !== "savings_target" && utilization > 1) {
      warnings.push({
        categoryKey,
        severity: resolveWarningSeverity(utilization),
        utilization,
        message: formatWarningMessage(RECOMMENDATION_LABELS[categoryKey], utilization),
      });
      continue;
    }

    if (categoryKey !== "savings_target" && monthProgress > 0) {
      const projectedActual = actualMonthly / monthProgress;
      const projectedUtilization = resolveUtilization(projectedActual, monthlyBudget);

      if (projectedUtilization > 1) {
        warnings.push({
          categoryKey,
          severity: resolveWarningSeverity(projectedUtilization),
          utilization: projectedUtilization,
          message: formatPaceWarningMessage(
            RECOMMENDATION_LABELS[categoryKey],
            projectedUtilization,
          ),
        });
      }
    }
  }

  const projectedMonthNet =
    monthProgress > 0
      ? (monthToDate.income.total - monthToDate.expenses.total) / monthProgress
      : monthToDate.income.total - monthToDate.expenses.total;

  if (projectedMonthNet < 0) {
    const deficitAmount = Math.abs(projectedMonthNet);
    warnings.push({
      categoryKey: "savings_target",
      severity: deficitAmount >= 250 ? "critical" : "warning",
      utilization: 1 + deficitAmount / Math.max(trend.income.total, 1),
      message: `Current month pace projects a deficit of ${round2(deficitAmount)}.`,
    });
  }

  warnings.sort((left, right) => {
    const severityWeight = {
      critical: 3,
      warning: 2,
      info: 1,
    } as const;

    const severityDiff =
      severityWeight[right.severity] - severityWeight[left.severity];
    if (severityDiff !== 0) return severityDiff;
    return right.utilization - left.utilization;
  });

  const monthlyBudgetByKey = new Map(
    recommendations.map((item) => [item.categoryKey, item.monthlyBudget]),
  );

  const baseExpenseBudget =
    (monthlyBudgetByKey.get("fixed_costs") || 0) +
    (monthlyBudgetByKey.get("subscriptions") || 0) +
    (monthlyBudgetByKey.get("variable_costs") || 0);

  const savingsPotential = round2(Math.max(trend.income.total - baseExpenseBudget, 0));
  const configuredSavingsTarget = monthlyBudgetByKey.get("savings_target") || 0;

  let recommendedSavings = configuredSavingsTarget;
  if (settings.mode === "active_savings") {
    recommendedSavings = Math.max(configuredSavingsTarget, savingsPotential);
  } else if (settings.mode === "balanced") {
    recommendedSavings = Math.max(configuredSavingsTarget, savingsPotential * 0.75);
  }
  recommendedSavings = round2(Math.max(recommendedSavings, 0));

  const monthlyBudgetTotal = round2(
    recommendations.reduce((sum, row) => sum + row.monthlyBudget, 0),
  );

  const weeklyBudgetTotal = round2(monthlyBudgetTotal / WEEKS_PER_MONTH);
  const coachReport = buildCoachReport(recommendations, warnings, recommendedSavings);

  return {
    planKey,
    referenceDate: dateToIso(referenceDay),
    monthStart: monthStartIso,
    monthProgress: round2(monthProgress),
    settings,
    trend,
    monthToDateIncome: monthToDate.income,
    monthToDateExpenses: monthToDate.expenses,
    recommendations,
    warnings,
    savingsPotential,
    recommendedSavings,
    monthlyBudgetTotal,
    weeklyBudgetTotal,
    coachReport,
  };
}
