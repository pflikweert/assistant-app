import {
    getBudgetCategoryOverrides,
    getBudgetPlanSettings,
    getMonthlyBudgetValues,
} from "@/services/budget-plan-repository";
import { suggestAutomaticSavingsTarget } from "@/services/budget-coach";
import {
  buildCalendarWeekRangesForMonth,
  rebalanceWeeklyBudgets,
  resolveBaseWeeklyBudgetsByDailyMonthRates,
} from "@/services/budget-week-utils";
import type { CalendarWeekRange } from "@/services/budget-week-utils";
import { normalizePattern } from "@/services/categorization-repository";
import { supabase } from "@/services/supabase";
import type {
    AnalysisCategory,
    AnalysisMainGroup,
    BudgetCategoryKey,
    BudgetCoachReport,
    BudgetExpenseBreakdown,
    BudgetExpenseDetailItem,
    BudgetFlowSummary,
    BudgetIncomeBreakdown,
    BudgetOutsideExpenseItem,
    BudgetOutsideExpenseSummary,
    BudgetOverrideSource,
    BudgetPlanComputation,
    BudgetPlanSettings,
    BudgetRecommendationRow,
    BudgetSavingsTargetSource,
    BudgetSavingsProgress,
    BudgetTrendSnapshot,
    BudgetVariableBreakdown,
    BudgetWarning,
    BudgetWarningSeverity,
    BudgetWeekCategorySpend,
    BudgetWeekPlanRow,
    BudgetWeekSpendBreakdown,
    BudgetWeekSubcategorySpend,
} from "@/types/categorization";

const PAGE_SIZE = 500;
const TREND_WINDOW_DAYS = 90;
const MONTHLY_NORMALIZER_DAYS = 30.4375;
const WEEKS_PER_MONTH = 4.33;
const SAVINGS_TARGET_STEP = 25;

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
  budget_excluded: boolean;
};

type CategoryMeta = {
  id: string;
  key: string;
  name: string | null;
  budget_group: string | null;
};

type IncomeBucket = "salary" | "childBudget" | "structuralOther" | "variable";

type ExpenseBucket =
  | "fixed_costs"
  | "subscriptions"
  | "variable_costs"
  | "savings_transfer";

const EXPENSE_BUCKET_LABELS: Record<ExpenseBucket, string> = {
  fixed_costs: "Vaste lasten",
  subscriptions: "Abonnementen",
  variable_costs: "Variabele uitgaven",
  savings_transfer: "Sparen",
};

type WeekRange = CalendarWeekRange;

type VariableMainCategory = "groceries" | "fuel" | "smoking" | "other";

type CompletedMonthBudgetInsight = {
  recentIncomeTotals: number[];
  recentVariableTotals: number[];
  recentSavingsCapacityTotals: number[];
  incomeVolatility: number;
  variableVolatility: number;
};

const VARIABLE_MAIN_ORDER: VariableMainCategory[] = [
  "groceries",
  "fuel",
  "smoking",
  "other",
];

const VARIABLE_MAIN_LABELS: Record<VariableMainCategory, string> = {
  groceries: "Boodschappen",
  fuel: "Brandstof",
  smoking: "Roken",
  other: "Overig",
};

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
  fixed_costs: "Vaste lasten",
  subscriptions: "Abonnementen",
  variable_costs: "Variabele uitgaven",
  groceries: "Boodschappen",
  fuel: "Brandstof",
  smoking: "Roken",
  other: "Overig",
  savings_target: "Spaardoel",
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

function roundEuro(value: number) {
  return Math.round(value);
}

function snapToEuroStep(value: number, step = SAVINGS_TARGET_STEP) {
  if (step <= 0) return roundEuro(Math.max(value, 0));
  return Math.max(0, Math.round(value / step) * step);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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

function parseIsoDateUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
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

function isVariableBudgetCategoryKey(categoryKey: string) {
  return (
    categoryKey === "variable_costs" ||
    categoryKey === "groceries" ||
    categoryKey === "fuel" ||
    categoryKey === "smoking" ||
    categoryKey === "other"
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

function resolveExpenseBucket(
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
): ExpenseBucket {
  if (
    tx.analysis_main_group === "expense" &&
    (tx.analysis_category === "fixed_costs" ||
      tx.analysis_category === "subscriptions" ||
      tx.analysis_category === "variable_costs" ||
      tx.analysis_category === "savings_transfer")
  ) {
    return tx.analysis_category;
  }

  const categoryKey = categoryMeta
    ? normalizeCategoryKey(categoryMeta.key)
    : "";
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

  if (includesAny(haystack, SAVINGS_TRANSFER_KEYWORDS))
    return "savings_transfer";
  if (includesAny(haystack, SUBSCRIPTION_KEYWORDS)) return "subscriptions";
  if (includesAny(haystack, FIXED_EXPENSE_KEYWORDS)) return "fixed_costs";

  return "variable_costs";
}

function resolveVariableSubbucket(
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
): "groceries" | "fuel" | "smoking" | "other" {
  const categoryKey = categoryMeta
    ? normalizeCategoryKey(categoryMeta.key)
    : "";
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

  if (
    categoryKey.includes("smoking") ||
    includesAny(haystack, SMOKING_KEYWORDS)
  ) {
    return "smoking";
  }

  return "other";
}

function classifyIncome(
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
): IncomeBucket {
  const categoryKey = categoryMeta
    ? normalizeCategoryKey(categoryMeta.key)
    : "";
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

function multiplyIncomeBy(
  value: BudgetIncomeBreakdown,
  factor: number,
): BudgetIncomeBreakdown {
  return {
    salary: round2(value.salary * factor),
    childBudget: round2(value.childBudget * factor),
    structuralOther: round2(value.structuralOther * factor),
    variable: round2(value.variable * factor),
    total: round2(value.total * factor),
  };
}

function resolveIncludedIncomeTotal(
  income: BudgetIncomeBreakdown,
  settings: BudgetPlanSettings,
): number {
  let total = 0;
  if (settings.includeIncome.salary) total += income.salary;
  if (settings.includeIncome.childBudget) total += income.childBudget;
  if (settings.includeIncome.structuralOther) total += income.structuralOther;
  if (settings.includeIncome.variable) total += income.variable;
  return round2(total);
}

function applyIncomeInclusion(
  income: BudgetIncomeBreakdown,
  settings: BudgetPlanSettings,
): BudgetIncomeBreakdown {
  return {
    ...income,
    total: resolveIncludedIncomeTotal(income, settings),
  };
}

function monthKeyFromIsoDate(isoDate: string) {
  return String(isoDate || "").slice(0, 7);
}

function monthStartFromKey(monthKey: string) {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function computeIncludedIncomeTotalsByMonth(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  settings: BudgetPlanSettings,
): Map<string, number> {
  const byMonth = new Map<string, BudgetIncomeBreakdown>();

  for (const row of rows) {
    const amount = asNumber(row.amount, 0);
    if (amount <= 0) continue;

    const monthKey = monthKeyFromIsoDate(row.date);
    if (!monthKey || monthKey.length !== 7) continue;

    const current = byMonth.get(monthKey) || emptyIncomeBreakdown();
    const categoryId = row.category_id_user || row.category_id_auto;
    const categoryMeta = categoryId
      ? categoryMap.get(categoryId) || null
      : null;
    const bucket = classifyIncome(row, categoryMeta);

    if (bucket === "salary") current.salary += amount;
    if (bucket === "childBudget") current.childBudget += amount;
    if (bucket === "structuralOther") current.structuralOther += amount;
    if (bucket === "variable") current.variable += amount;
    current.total += amount;

    byMonth.set(monthKey, current);
  }

  const totals = new Map<string, number>();
  for (const [monthKey, income] of byMonth) {
    totals.set(monthKey, round2(applyIncomeInclusion(income, settings).total));
  }

  return totals;
}

function resolveExpectedIncomeMonthlyFromCompletedMonths(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  settings: BudgetPlanSettings,
  trendStart: Date,
  currentMonthStart: Date,
): number | null {
  const totalsByMonth = computeIncludedIncomeTotalsByMonth(
    rows,
    categoryMap,
    settings,
  );

  const completedMonths = [...totalsByMonth.entries()]
    .map(([monthKey, total]) => {
      const monthStart = monthStartFromKey(monthKey);
      return monthStart ? { monthStart, total } : null;
    })
    .filter(
      (
        row,
      ): row is {
        monthStart: Date;
        total: number;
      } => Boolean(row),
    )
    .filter(
      (row) =>
        row.monthStart < currentMonthStart && row.monthStart >= trendStart,
    )
    .sort(
      (left, right) => right.monthStart.getTime() - left.monthStart.getTime(),
    );

  const recentTotals = completedMonths
    .filter((row) => row.total > 0)
    .slice(0, 3);

  if (!recentTotals.length) return null;
  return round2(median(recentTotals.map((row) => row.total)));
}

function computeExpenseTotalsByMonth(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
): Map<string, BudgetExpenseBreakdown> {
  const byMonth = new Map<string, BudgetExpenseBreakdown>();

  for (const row of rows) {
    if (row.budget_excluded) continue;

    const amount = asNumber(row.amount, 0);
    if (amount >= 0) continue;

    const monthKey = monthKeyFromIsoDate(row.date);
    if (!monthKey || monthKey.length !== 7) continue;

    const current = byMonth.get(monthKey) || emptyExpenseBreakdown();
    const categoryId = row.category_id_user || row.category_id_auto;
    const categoryMeta = categoryId
      ? categoryMap.get(categoryId) || null
      : null;
    const bucket = resolveExpenseBucket(row, categoryMeta);
    const absAmount = Math.abs(amount);

    if (bucket === "fixed_costs") current.fixedCosts += absAmount;
    if (bucket === "subscriptions") current.subscriptions += absAmount;
    if (bucket === "savings_transfer") current.savingsTransfer += absAmount;

    if (bucket === "variable_costs") {
      current.variableCosts += absAmount;
      const subbucket = resolveVariableSubbucket(row, categoryMeta);
      if (subbucket === "groceries") current.variable.groceries += absAmount;
      if (subbucket === "fuel") current.variable.fuel += absAmount;
      if (subbucket === "smoking") current.variable.smoking += absAmount;
      if (subbucket === "other") current.variable.other += absAmount;
    }

    current.total += absAmount;
    byMonth.set(monthKey, current);
  }

  const totals = new Map<string, BudgetExpenseBreakdown>();
  for (const [monthKey, expenses] of byMonth) {
    const rounded: BudgetExpenseBreakdown = {
      fixedCosts: round2(expenses.fixedCosts),
      subscriptions: round2(expenses.subscriptions),
      variableCosts: round2(expenses.variableCosts),
      savingsTransfer: round2(expenses.savingsTransfer),
      total: round2(expenses.total),
      variable: {
        groceries: round2(expenses.variable.groceries),
        fuel: round2(expenses.variable.fuel),
        smoking: round2(expenses.variable.smoking),
        other: round2(expenses.variable.other),
        total: round2(
          expenses.variable.groceries +
            expenses.variable.fuel +
            expenses.variable.smoking +
            expenses.variable.other,
        ),
      },
    };
    totals.set(monthKey, rounded);
  }

  return totals;
}

function resolveExpenseBaselinesFromCompletedMonths(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  trendStart: Date,
  currentMonthStart: Date,
): Map<BudgetCategoryKey, number> {
  const totalsByMonth = computeExpenseTotalsByMonth(rows, categoryMap);
  const completedMonths = [...totalsByMonth.entries()]
    .map(([monthKey, expenses]) => {
      const monthStart = monthStartFromKey(monthKey);
      return monthStart ? { monthStart, expenses } : null;
    })
    .filter(
      (
        row,
      ): row is {
        monthStart: Date;
        expenses: BudgetExpenseBreakdown;
      } => Boolean(row),
    )
    .filter(
      (row) =>
        row.monthStart < currentMonthStart && row.monthStart >= trendStart,
    )
    .sort(
      (left, right) => right.monthStart.getTime() - left.monthStart.getTime(),
    )
    .slice(0, 3);

  const baselines = new Map<BudgetCategoryKey, number>();
  if (!completedMonths.length) return baselines;

  const expenseKeys: BudgetCategoryKey[] = [
    "fixed_costs",
    "subscriptions",
    "variable_costs",
    "groceries",
    "fuel",
    "smoking",
    "other",
  ];

  for (const key of expenseKeys) {
    baselines.set(
      key,
      round2(
        median(
          completedMonths.map((row) =>
            getBudgetCategoryActual(key, row.expenses),
          ),
        ),
      ),
    );
  }

  return baselines;
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
  expectedIncomeMonthly = trend.income.total,
): number {
  if (key === "fixed_costs") return trend.expenses.fixedCosts;
  if (key === "subscriptions") return trend.expenses.subscriptions;
  if (key === "variable_costs") return trend.expenses.variableCosts;
  if (key === "groceries") return trend.expenses.variable.groceries;
  if (key === "fuel") return trend.expenses.variable.fuel;
  if (key === "smoking") return trend.expenses.variable.smoking;
  if (key === "other") return trend.expenses.variable.other;

  return Math.max(
    expectedIncomeMonthly -
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
    if (settings.mode === "active_savings") return 0.95;
    if (settings.mode === "balanced") return 1;
    return 1;
  }
  return 1;
}

function calculateRelativeVolatility(values: number[]) {
  if (values.length < 2) return 0;
  const baseline = Math.max(median(values), 1);
  const spread = Math.max(...values) - Math.min(...values);
  return clamp(spread / baseline, 0, 1.5);
}

function buildCompletedMonthBudgetInsight(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  settings: BudgetPlanSettings,
  trendStart: Date,
  currentMonthStart: Date,
): CompletedMonthBudgetInsight {
  const incomeTotalsByMonth = computeIncludedIncomeTotalsByMonth(
    rows,
    categoryMap,
    settings,
  );
  const expenseTotalsByMonth = computeExpenseTotalsByMonth(rows, categoryMap);

  const recentMonths = [...incomeTotalsByMonth.keys()]
    .map((monthKey) => {
      const monthStart = monthStartFromKey(monthKey);
      return monthStart ? { monthKey, monthStart } : null;
    })
    .filter(
      (
        row,
      ): row is {
        monthKey: string;
        monthStart: Date;
      } => Boolean(row),
    )
    .filter(
      (row) =>
        row.monthStart < currentMonthStart && row.monthStart >= trendStart,
    )
    .sort(
      (left, right) => right.monthStart.getTime() - left.monthStart.getTime(),
    )
    .slice(0, 3);

  const recentIncomeTotals: number[] = [];
  const recentVariableTotals: number[] = [];
  const recentSavingsCapacityTotals: number[] = [];

  for (const row of recentMonths) {
    const incomeTotal = round2(incomeTotalsByMonth.get(row.monthKey) || 0);
    const expenses = expenseTotalsByMonth.get(row.monthKey) || emptyExpenseBreakdown();
    const historicalSavingsCapacity = Math.max(
      incomeTotal -
        expenses.fixedCosts -
        expenses.subscriptions -
        expenses.variableCosts,
      0,
    );

    recentIncomeTotals.push(incomeTotal);
    recentVariableTotals.push(round2(expenses.variableCosts));
    recentSavingsCapacityTotals.push(round2(historicalSavingsCapacity));
  }

  return {
    recentIncomeTotals,
    recentVariableTotals,
    recentSavingsCapacityTotals,
    incomeVolatility: calculateRelativeVolatility(recentIncomeTotals),
    variableVolatility: calculateRelativeVolatility(recentVariableTotals),
  };
}

function resolveDeterministicAutomaticSavingsTargets({
  savingsPotential,
  flexibleBudgetCapacity,
  variableBaselineBudget,
  insight,
  monthProgress,
  projectedMonthlyCoreNet,
}: {
  savingsPotential: number;
  flexibleBudgetCapacity: number;
  variableBaselineBudget: number;
  insight: CompletedMonthBudgetInsight;
  monthProgress: number;
  projectedMonthlyCoreNet: number;
}) {
  const positiveProjectedNet = Math.max(projectedMonthlyCoreNet, 0);
  const historicalMedian = insight.recentSavingsCapacityTotals.length
    ? median(insight.recentSavingsCapacityTotals)
    : savingsPotential;

  const recentVariableMedian = insight.recentVariableTotals.length
    ? median(insight.recentVariableTotals)
    : variableBaselineBudget;
  const variableReference = clamp(
    recentVariableMedian > 0 ? recentVariableMedian : variableBaselineBudget,
    0,
    flexibleBudgetCapacity,
  );
  const activeCapacity = Math.max(
    flexibleBudgetCapacity -
      clamp(
        Math.max(variableReference * 0.78, flexibleBudgetCapacity * 0.45),
        Math.min(250, flexibleBudgetCapacity),
        flexibleBudgetCapacity,
      ),
    0,
  );
  const balancedCapacity = Math.max(
    flexibleBudgetCapacity -
      clamp(
        Math.max(variableReference * 0.93, flexibleBudgetCapacity * 0.7),
        Math.min(325, flexibleBudgetCapacity),
        flexibleBudgetCapacity,
      ),
    0,
  );

  const activeReferenceCandidates = [activeCapacity];
  if (savingsPotential > 0) {
    activeReferenceCandidates.push(Math.min(savingsPotential, activeCapacity));
  }
  if (historicalMedian > 0) {
    activeReferenceCandidates.push(Math.min(historicalMedian, activeCapacity));
  }
  if (positiveProjectedNet > 0) {
    activeReferenceCandidates.push(
      Math.min(positiveProjectedNet * 0.85, activeCapacity),
    );
  }

  const balancedReferenceCandidates = [balancedCapacity];
  if (savingsPotential > 0) {
    balancedReferenceCandidates.push(
      Math.min(savingsPotential, balancedCapacity),
    );
  }
  if (historicalMedian > 0) {
    balancedReferenceCandidates.push(
      Math.min(historicalMedian * 0.7, balancedCapacity),
    );
  }
  if (positiveProjectedNet > 0) {
    balancedReferenceCandidates.push(
      Math.min(positiveProjectedNet * 0.5, balancedCapacity),
    );
  }

  const referenceCandidates = [
    ...activeReferenceCandidates,
    ...balancedReferenceCandidates,
  ];

  const realisticCenter = median(referenceCandidates);
  const riskPenalty = clamp(
    insight.incomeVolatility * 0.18 +
      insight.variableVolatility * 0.22 +
      (positiveProjectedNet <= 0 ? 0.08 : 0) +
      (monthProgress >= 0.5 && positiveProjectedNet < realisticCenter ? 0.08 : 0),
    0,
    0.4,
  );

  const activeBase = Math.min(
    activeCapacity,
    Math.max(
      median(activeReferenceCandidates),
      activeCapacity * 0.72,
      historicalMedian * 0.95,
      positiveProjectedNet > 0 ? positiveProjectedNet * 0.9 : 0,
    ),
  );
  const activeTarget = snapToEuroStep(
    Math.max(activeBase * (1 - riskPenalty * 0.4), 0),
  );

  const balancedBase = Math.min(
    balancedCapacity,
    Math.max(
      median(balancedReferenceCandidates),
      balancedCapacity * 0.55,
      historicalMedian * 0.55,
      positiveProjectedNet > 0 ? positiveProjectedNet * 0.45 : 0,
    ),
  );
  const rawBalancedTarget = snapToEuroStep(
    Math.max(balancedBase * (1 - riskPenalty * 0.2), 0),
  );
  const balancedTarget =
    activeTarget >= SAVINGS_TARGET_STEP
      ? Math.min(rawBalancedTarget, activeTarget - SAVINGS_TARGET_STEP)
      : Math.min(rawBalancedTarget, activeTarget);

  return {
    activeTarget: clamp(activeTarget, 0, activeCapacity),
    balancedTarget: clamp(Math.max(balancedTarget, 0), 0, balancedCapacity),
  };
}

function resolveUtilization(
  monthlyActual: number,
  monthlyBudget: number,
): number {
  if (monthlyBudget <= 0)
    return monthlyActual > 0 ? Number.POSITIVE_INFINITY : 0;
  return monthlyActual / monthlyBudget;
}

function resolveWarningSeverity(utilization: number): BudgetWarningSeverity {
  if (utilization >= 1.25) return "critical";
  if (utilization >= 1.1) return "warning";
  return "info";
}

function formatWarningMessage(label: string, utilization: number): string {
  if (!Number.isFinite(utilization)) {
    return `${label} heeft uitgaven zonder ingesteld budget.`;
  }
  const overByPct = Math.max(Math.round((utilization - 1) * 100), 1);
  return `${label} zit ${overByPct}% boven budget.`;
}

function formatPaceWarningMessage(
  label: string,
  projectedUtilization: number,
): string {
  if (!Number.isFinite(projectedUtilization)) {
    return `${label} loopt deze week boven planning (geen budget ingesteld).`;
  }
  const overByPct = Math.max(Math.round((projectedUtilization - 1) * 100), 1);
  return `${label} loopt deze week ${overByPct}% boven planning.`;
}

function formatCategoryKeyLabel(categoryKey: string) {
  const normalized = String(categoryKey || "").trim();
  if (!normalized) return "Onbekend";

  const WORD_TRANSLATIONS: Record<string, string> = {
    groceries: "Boodschappen",
    fuel: "Brandstof",
    smoking: "Roken",
    health: "Zorg",
    care: "Zorg",
    insurance: "Verzekering",
    provider: "Aanbieder",
    other: "Overig",
  };

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const translated = WORD_TRANSLATIONS[part];
      if (translated) return translated;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function resolveWeeklySubcategory(
  row: BudgetTx,
  categoryMeta: CategoryMeta | null,
): BudgetWeekSubcategorySpend {
  const categoryName = String(categoryMeta?.name || "").trim();
  const categoryKey = normalizeCategoryKey(categoryMeta?.key || "");
  if (categoryKey) {
    return {
      key: categoryKey,
      label: categoryName || formatCategoryKeyLabel(categoryKey),
      amount: 0,
    };
  }

  const fallback = String(row.counterparty || row.details || "Onbekend").trim();
  return {
    key: `counterparty:${normalizePattern(fallback) || "unknown"}`,
    label: fallback || "Onbekend",
    amount: 0,
  };
}

function resolveCategoryMetaForTransaction(
  row: BudgetTx,
  categoryMap: Map<string, CategoryMeta>,
): CategoryMeta | null {
  const categoryId = row.category_id_user || row.category_id_auto;
  if (!categoryId) return null;
  return categoryMap.get(categoryId) || null;
}

function buildMonthWeekRanges(
  monthStart: Date,
  monthEndExclusive: Date,
): WeekRange[] {
  return buildCalendarWeekRangesForMonth(monthStart, monthEndExclusive);
}

function buildExpenseDetailItems(
  monthRows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  bucket: Extract<ExpenseBucket, "fixed_costs" | "subscriptions">,
): BudgetExpenseDetailItem[] {
  const grouped = new Map<
    string,
    {
      label: string;
      amount: number;
      transactionCount: number;
      lastDate: string | null;
    }
  >();

  for (const row of monthRows) {
    if (row.amount >= 0) continue;
    if (row.budget_excluded) continue;
    const categoryMeta = resolveCategoryMetaForTransaction(row, categoryMap);
    const resolvedBucket = resolveExpenseBucket(row, categoryMeta);
    if (resolvedBucket !== bucket) continue;

    const labelRaw = String(
      row.counterparty || row.details || "Onbekend",
    ).trim();
    const label = labelRaw ? labelRaw.slice(0, 48) : "Onbekend";
    const groupKey = normalizePattern(label) || label.toLowerCase();

    const current = grouped.get(groupKey);
    const nextAmount = Math.abs(row.amount);
    if (!current) {
      grouped.set(groupKey, {
        label,
        amount: nextAmount,
        transactionCount: 1,
        lastDate: row.date || null,
      });
      continue;
    }

    current.amount += nextAmount;
    current.transactionCount += 1;
    if (!current.lastDate || row.date > current.lastDate) {
      current.lastDate = row.date || current.lastDate;
    }
  }

  return [...grouped.values()]
    .map((item) => ({
      label: item.label,
      amount: roundEuro(item.amount),
      transactionCount: item.transactionCount,
      lastTransactionDate: item.lastDate,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 12);
}

function buildOutsideBudgetExpenseSummary(
  monthRows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
): BudgetOutsideExpenseSummary {
  let fixedCosts = 0;
  let subscriptions = 0;
  let variableCosts = 0;
  let savingsTransfer = 0;

  const grouped = new Map<
    string,
    {
      label: string;
      amount: number;
      transactionCount: number;
      lastDate: string | null;
      categoryLabel: string;
    }
  >();

  for (const row of monthRows) {
    if (row.amount >= 0) continue;
    if (!row.budget_excluded) continue;

    const categoryMeta = resolveCategoryMetaForTransaction(row, categoryMap);
    const bucket = resolveExpenseBucket(row, categoryMeta);
    const absAmount = Math.abs(row.amount);

    if (bucket === "fixed_costs") fixedCosts += absAmount;
    if (bucket === "subscriptions") subscriptions += absAmount;
    if (bucket === "variable_costs") variableCosts += absAmount;
    if (bucket === "savings_transfer") savingsTransfer += absAmount;

    const labelRaw = String(
      row.counterparty || row.details || "Onbekend",
    ).trim();
    const label = labelRaw ? labelRaw.slice(0, 48) : "Onbekend";
    const groupKey = `${bucket}|${normalizePattern(label) || label.toLowerCase()}`;
    const current = grouped.get(groupKey);

    if (!current) {
      grouped.set(groupKey, {
        label,
        amount: absAmount,
        transactionCount: 1,
        lastDate: row.date || null,
        categoryLabel: EXPENSE_BUCKET_LABELS[bucket],
      });
      continue;
    }

    current.amount += absAmount;
    current.transactionCount += 1;
    if (!current.lastDate || row.date > current.lastDate) {
      current.lastDate = row.date || current.lastDate;
    }
  }

  const items: BudgetOutsideExpenseItem[] = [...grouped.values()]
    .map((item) => ({
      label: item.label,
      amount: roundEuro(item.amount),
      transactionCount: item.transactionCount,
      lastTransactionDate: item.lastDate,
      categoryLabel: item.categoryLabel,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 12);

  return {
    total: roundEuro(
      fixedCosts + subscriptions + variableCosts + savingsTransfer,
    ),
    fixedCosts: roundEuro(fixedCosts),
    subscriptions: roundEuro(subscriptions),
    variableCosts: roundEuro(variableCosts),
    savingsTransfer: roundEuro(savingsTransfer),
    items,
  };
}

function computeWeeklyVariablePlan(
  weekRows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  weekRanges: WeekRange[],
  timelineReferenceDay: Date,
  variableMonthlyBudgetByMonthStartIso: Map<string, number>,
  currentMonthStart: Date,
): BudgetWeekPlanRow[] {
  const ranges = weekRanges;
  if (!ranges.length) return [];

  const baseWeeklyBudgetByIndex = resolveBaseWeeklyBudgetsByDailyMonthRates(
    ranges,
    variableMonthlyBudgetByMonthStartIso,
    currentMonthStart,
  );

  const weekActuals = ranges.map((range) => {
    let total = 0;
    for (const row of weekRows) {
      if (row.amount >= 0) continue;
      if (row.budget_excluded) continue;
      const txDate = parseIsoDateUtc(row.date);
      if (txDate < range.start || txDate >= range.endExclusive) continue;
      const categoryMeta = resolveCategoryMetaForTransaction(row, categoryMap);
      const expenseBucket = resolveExpenseBucket(row, categoryMeta);
      if (expenseBucket !== "variable_costs") continue;
      total += Math.abs(row.amount);
    }
    return roundEuro(total);
  });

  const rebalance = rebalanceWeeklyBudgets(baseWeeklyBudgetByIndex, weekActuals);
  const rows: BudgetWeekPlanRow[] = [];

  ranges.forEach((range, index) => {
    const budget = rebalance.budgets[index] || 0;
    const actual = weekActuals[index];
    const remaining = roundEuro(budget - actual);
    const utilization = resolveUtilization(actual, budget);
    const overrunAmount = remaining < 0 ? Math.abs(remaining) : 0;

    rows.push({
      weekNumber: range.weekNumber,
      label: range.label,
      startDate: dateToIso(range.start),
      endDateExclusive: dateToIso(range.endExclusive),
      budget,
      actual,
      remaining,
      utilization,
      isCurrentWeek:
        timelineReferenceDay >= range.start &&
        timelineReferenceDay < range.endExclusive,
      isPastWeek: timelineReferenceDay >= range.endExclusive,
      wasRebalanced:
        index > 0 && Math.abs(budget - baseWeeklyBudgetByIndex[index]) >= 1,
      overrunAmount,
      daysInCurrentMonth: range.daysInCurrentMonth,
      daysInPreviousMonth: range.daysInPreviousMonth,
      daysInNextMonth: range.daysInNextMonth,
      crossesMonthBoundary: range.crossesMonthBoundary,
    });
  });

  return rows;
}

function buildWeeklySpendBreakdown(
  weekRows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  weekRanges: WeekRange[],
): BudgetWeekSpendBreakdown[] {
  const ranges = weekRanges;

  return ranges.map((range) => {
    const categoryTotals = new Map<
      VariableMainCategory,
      { amount: number; subcategories: Map<string, BudgetWeekSubcategorySpend> }
    >();

    for (const mainCategory of VARIABLE_MAIN_ORDER) {
      categoryTotals.set(mainCategory, {
        amount: 0,
        subcategories: new Map(),
      });
    }

    for (const row of weekRows) {
      if (row.amount >= 0) continue;
      if (row.budget_excluded) continue;
      const txDate = parseIsoDateUtc(row.date);
      if (txDate < range.start || txDate >= range.endExclusive) continue;

      const categoryMeta = resolveCategoryMetaForTransaction(row, categoryMap);
      const resolved = resolveExpenseBucket(row, categoryMeta);
      if (resolved !== "variable_costs") {
        continue;
      }

      const mainCategory = resolveVariableSubbucket(row, categoryMeta);
      const bucket = categoryTotals.get(mainCategory);
      if (!bucket) continue;

      const amount = Math.abs(row.amount);
      bucket.amount += amount;

      const subcategory = resolveWeeklySubcategory(row, categoryMeta);
      const existing = bucket.subcategories.get(subcategory.key);
      if (existing) {
        existing.amount += amount;
      } else {
        bucket.subcategories.set(subcategory.key, {
          ...subcategory,
          amount,
        });
      }
    }

    const categories: BudgetWeekCategorySpend[] = VARIABLE_MAIN_ORDER.map(
      (mainCategory) => {
        const bucket = categoryTotals.get(mainCategory)!;
        const subcategories = [...bucket.subcategories.values()]
          .map((item) => ({
            ...item,
            amount: roundEuro(item.amount),
          }))
          .sort((left, right) => right.amount - left.amount);

        return {
          key: mainCategory,
          label: VARIABLE_MAIN_LABELS[mainCategory],
          amount: roundEuro(bucket.amount),
          subcategories,
        };
      },
    );

    return {
      weekNumber: range.weekNumber,
      startDate: dateToIso(range.start),
      endDateExclusive: dateToIso(range.endExclusive),
      categories,
    };
  });
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
        "id,date,amount,details,counterparty,analysis_main_group,analysis_category,category_id_auto,category_id_user,budget_excluded",
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
      analysis_main_group: (row.analysis_main_group ||
        null) as AnalysisMainGroup | null,
      analysis_category: (row.analysis_category ||
        null) as AnalysisCategory | null,
      category_id_auto: row.category_id_auto
        ? String(row.category_id_auto)
        : null,
      category_id_user: row.category_id_user
        ? String(row.category_id_user)
        : null,
      budget_excluded: Boolean(row.budget_excluded),
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
    .select("id,key,name,budget_group");

  if (error) throw error;

  const map = new Map<string, CategoryMeta>();
  for (const row of (data || []) as Record<string, unknown>[]) {
    const id = String(row.id || "");
    map.set(id, {
      id,
      key: String(row.key || ""),
      name: row.name ? String(row.name) : null,
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
    if (row.budget_excluded) continue;
    const amount = asNumber(row.amount, 0);
    if (amount === 0) continue;

    const categoryId = row.category_id_user || row.category_id_auto;
    const categoryMeta = categoryId
      ? categoryMap.get(categoryId) || null
      : null;

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
    .map(
      (row) =>
        `${row.label} ligt op schema (${Math.round(row.utilization * 100)}% gebruikt).`,
    );

  const risks = warnings.slice(0, 4).map((warning) => warning.message);

  const actions: string[] = [];
  if (warnings.some((warning) => warning.severity === "critical")) {
    actions.push(
      "Beperk variabele uitgaven direct om druk aan het einde van de maand te voorkomen.",
    );
  }
  if (warnings.some((warning) => warning.severity === "warning")) {
    actions.push("Controleer deze week je terugkerende en vrije uitgaven.");
  }
  if (recommendedSavings > 0) {
    actions.push(
      `Reserveer ${round2(recommendedSavings)} voor sparen deze maand.`,
    );
  }
  if (!actions.length) {
    actions.push("Je uitgavenpatroon is gezond. Houd dit plan aan.");
  }

  return {
    generatedAt: new Date().toISOString(),
    sections: {
      summary: `${warnings.length} waarschuwing(en) gevonden, aanbevolen sparen ${round2(
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
  timelineReference = new Date(),
): Promise<BudgetPlanComputation> {
  const referenceDay = startOfUtcDay(reference);
  const timelineReferenceDay = startOfUtcDay(timelineReference);
  const trendEndExclusive = addDays(referenceDay, 1);
  const trendStart = subtractDays(trendEndExclusive, TREND_WINDOW_DAYS);
  const monthStart = startOfMonth(referenceDay);
  const monthEndExclusive = endOfMonthExclusive(referenceDay);

  const weekRanges = buildMonthWeekRanges(monthStart, monthEndExclusive);
  const weekWindowStart = weekRanges.length ? weekRanges[0].start : monthStart;
  const weekWindowEndExclusive = weekRanges.length
    ? weekRanges[weekRanges.length - 1].endExclusive
    : monthEndExclusive;

  const previousMonthStart = startOfMonth(subtractDays(monthStart, 1));
  const nextMonthStart = startOfMonth(monthEndExclusive);

  const dataStart = trendStart < weekWindowStart ? trendStart : weekWindowStart;
  const dataEndExclusive =
    trendEndExclusive > weekWindowEndExclusive
      ? trendEndExclusive
      : weekWindowEndExclusive;

  const trendStartIso = dateToIso(trendStart);
  const trendEndIso = dateToIso(trendEndExclusive);
  const monthStartIso = dateToIso(monthStart);
  const weekWindowStartIso = dateToIso(weekWindowStart);
  const weekWindowEndIso = dateToIso(weekWindowEndExclusive);
  const previousMonthStartIso = dateToIso(previousMonthStart);
  const nextMonthStartIso = dateToIso(nextMonthStart);

  const [
    categoryMap,
    transactions,
    settings,
    categoryOverrides,
    currentMonthBudgetValues,
    previousMonthBudgetValues,
    nextMonthBudgetValues,
  ] = await Promise.all([
    fetchCategoryMap(),
    fetchTransactionsInRange(dateToIso(dataStart), dateToIso(dataEndExclusive)),
    getBudgetPlanSettings(planKey),
    getBudgetCategoryOverrides(planKey),
    getMonthlyBudgetValues(monthStartIso, planKey),
    getMonthlyBudgetValues(previousMonthStartIso, planKey),
    getMonthlyBudgetValues(nextMonthStartIso, planKey),
  ]);

  const trendRows = transactions.filter(
    (row) => row.date >= trendStartIso && row.date < trendEndIso,
  );
  const monthRows = transactions.filter(
    (row) => row.date >= monthStartIso && row.date < trendEndIso,
  );
  const weekRows = transactions.filter(
    (row) => row.date >= weekWindowStartIso && row.date < weekWindowEndIso,
  );
  const includedTrendRows = trendRows.filter((row) => !row.budget_excluded);
  const includedMonthRows = monthRows.filter((row) => !row.budget_excluded);
  const includedWeekRows = weekRows.filter((row) => !row.budget_excluded);
  const excludedMonthRows = monthRows.filter((row) => row.budget_excluded);

  const observedDays = daysBetween(trendStart, trendEndExclusive);
  const monthlyScale = MONTHLY_NORMALIZER_DAYS / observedDays;

  const trendRaw = computeBreakdowns(includedTrendRows, categoryMap);
  const trendIncome = applyIncomeInclusion(
    multiplyIncomeBy(trendRaw.income, monthlyScale),
    settings,
  );
  const trendExpenses = multiplyExpensesBy(trendRaw.expenses, monthlyScale);
  const trend: BudgetTrendSnapshot = {
    windowDays: TREND_WINDOW_DAYS,
    observedDays,
    monthlyScale: round2(monthlyScale),
    income: trendIncome,
    expenses: trendExpenses,
    net: round2(trendIncome.total - trendExpenses.total),
  };

  const monthToDateRaw = computeBreakdowns(includedMonthRows, categoryMap);
  const monthToDate = {
    income: applyIncomeInclusion(monthToDateRaw.income, settings),
    expenses: monthToDateRaw.expenses,
  };
  const monthProgress = Math.min(
    1,
    Math.max(
      0,
      daysBetween(monthStart, trendEndExclusive) /
        daysBetween(monthStart, monthEndExclusive),
    ),
  );

  const expectedIncomeMonthly = round2(
    resolveExpectedIncomeMonthlyFromCompletedMonths(
      includedTrendRows,
      categoryMap,
      settings,
      trendStart,
      monthStart,
    ) ?? trend.income.total,
  );
  const completedMonthExpenseBaselines =
    resolveExpenseBaselinesFromCompletedMonths(
      includedTrendRows,
      categoryMap,
      trendStart,
      monthStart,
    );
  const completedMonthBudgetInsight = buildCompletedMonthBudgetInsight(
    includedTrendRows,
    categoryMap,
    settings,
    trendStart,
    monthStart,
  );

  const overridesByKey = new Map(
    categoryOverrides.map((item) => [item.categoryKey, item]),
  );
  const monthValuesByKey = new Map(
    currentMonthBudgetValues.map((item) => [item.categoryKey, item]),
  );

  const baselineByKey = new Map<BudgetCategoryKey, number>();
  const actualByKey = new Map<BudgetCategoryKey, number>();

  for (const categoryKey of RECOMMENDATION_ORDER) {
    const completedMonthBaseline = completedMonthExpenseBaselines.get(categoryKey);
    const baselineValue =
      completedMonthBaseline != null
        ? completedMonthBaseline
        : getTrendBaselineForCategory(categoryKey, trend, expectedIncomeMonthly);

    baselineByKey.set(
      categoryKey,
      round2(baselineValue),
    );
    actualByKey.set(
      categoryKey,
      round2(getBudgetCategoryActual(categoryKey, monthToDate.expenses)),
    );
  }

  const resolveBudgetInput = (
    categoryKey: BudgetCategoryKey,
    defaultBudget: number,
    defaultFactor: number,
    defaultSource: BudgetOverrideSource,
    allowFactorOverride = true,
  ): {
    monthlyBudget: number;
    appliedFactor: number;
    overrideSource: BudgetOverrideSource;
  } => {
    const baselineMonthly = baselineByKey.get(categoryKey) || 0;
    const override = overridesByKey.get(categoryKey);
    const monthlyValue = monthValuesByKey.get(categoryKey);
    const autoManagedVariableCategory =
      settings.mode !== "custom" && isVariableBudgetCategoryKey(categoryKey);

    if (monthlyValue && !autoManagedVariableCategory) {
      const monthlyBudget = roundEuro(Math.max(monthlyValue.monthlyBudget, 0));
      const appliedFactor =
        baselineMonthly > 0 ? monthlyBudget / baselineMonthly : defaultFactor;
      return {
        monthlyBudget,
        appliedFactor,
        overrideSource: "monthly_override",
      };
    }

    if (!autoManagedVariableCategory && override?.monthlyTargetOverride != null) {
      const monthlyBudget = roundEuro(
        Math.max(override.monthlyTargetOverride, 0),
      );
      const appliedFactor =
        baselineMonthly > 0
          ? monthlyBudget / baselineMonthly
          : (override.factorOverride ?? defaultFactor);
      return {
        monthlyBudget,
        appliedFactor,
        overrideSource: "category_override",
      };
    }

    if (
      !autoManagedVariableCategory &&
      allowFactorOverride &&
      override?.factorOverride != null
    ) {
      return {
        monthlyBudget: roundEuro(
          Math.max(baselineMonthly * override.factorOverride, 0),
        ),
        appliedFactor: override.factorOverride,
        overrideSource: "category_override",
      };
    }

    const monthlyBudget = roundEuro(Math.max(defaultBudget, 0));
    const appliedFactor =
      baselineMonthly > 0 ? monthlyBudget / baselineMonthly : defaultFactor;
    return {
      monthlyBudget,
      appliedFactor,
      overrideSource: defaultSource,
    };
  };

  const recommendationByKey = new Map<
    BudgetCategoryKey,
    BudgetRecommendationRow
  >();

  const setRecommendation = (
    categoryKey: BudgetCategoryKey,
    input: {
      monthlyBudget: number;
      appliedFactor: number;
      overrideSource: BudgetOverrideSource;
    },
  ) => {
    const baselineMonthly = baselineByKey.get(categoryKey) || 0;
    const monthlyActual = actualByKey.get(categoryKey) || 0;
    const monthlyBudget = roundEuro(Math.max(input.monthlyBudget, 0));
    const utilization = resolveUtilization(monthlyActual, monthlyBudget);

    recommendationByKey.set(categoryKey, {
      categoryKey,
      label: RECOMMENDATION_LABELS[categoryKey],
      baselineMonthly,
      appliedFactor: round2(input.appliedFactor),
      monthlyBudget,
      weeklyBudget: roundEuro(monthlyBudget / WEEKS_PER_MONTH),
      monthlyActual,
      monthProgress: round2(monthProgress),
      utilization,
      overrideSource: input.overrideSource,
    });
  };

  const fixedInput = resolveBudgetInput(
    "fixed_costs",
    (baselineByKey.get("fixed_costs") || 0) *
      defaultFactorForCategory("fixed_costs", settings),
    defaultFactorForCategory("fixed_costs", settings),
    "trend",
  );
  setRecommendation("fixed_costs", fixedInput);

  const subscriptionInput = resolveBudgetInput(
    "subscriptions",
    (baselineByKey.get("subscriptions") || 0) *
      defaultFactorForCategory("subscriptions", settings),
    defaultFactorForCategory("subscriptions", settings),
    "trend",
  );
  setRecommendation("subscriptions", subscriptionInput);

  const plannedIncomeBase = roundEuro(Math.max(expectedIncomeMonthly, 0));
  const flexibleBudgetCapacity = roundEuro(
    Math.max(
      plannedIncomeBase -
        fixedInput.monthlyBudget -
        subscriptionInput.monthlyBudget,
      0,
    ),
  );
  const variableBaselineBudget = roundEuro(
    Math.max(
      baselineByKey.get("variable_costs") || trend.expenses.variableCosts,
      0,
    ),
  );
  const projectedMonthlyCoreNet =
    monthProgress > 0
      ? (monthToDate.income.total -
          (monthToDate.expenses.fixedCosts +
            monthToDate.expenses.subscriptions +
            monthToDate.expenses.variableCosts)) /
        monthProgress
      : monthToDate.income.total -
        (monthToDate.expenses.fixedCosts +
          monthToDate.expenses.subscriptions +
          monthToDate.expenses.variableCosts);
  const savingsPotential = roundEuro(
    Math.max(
      flexibleBudgetCapacity - variableBaselineBudget,
      0,
    ),
  );
  const deterministicTargets = resolveDeterministicAutomaticSavingsTargets({
    savingsPotential,
    flexibleBudgetCapacity,
    variableBaselineBudget,
    insight: completedMonthBudgetInsight,
    monthProgress,
    projectedMonthlyCoreNet,
  });

  let appliedSavingsTarget = 0;
  let savingsTargetSource: BudgetSavingsTargetSource = "manual_custom";
  let usedOpenAISavingsTarget = false;

  if (settings.mode === "custom") {
    appliedSavingsTarget = roundEuro(Math.max(settings.savingsTargetMonthly, 0));
    savingsTargetSource = "manual_custom";
  } else {
    const deterministicTarget =
      settings.mode === "active_savings"
        ? deterministicTargets.activeTarget
        : deterministicTargets.balancedTarget;
    const minimumTarget =
      settings.mode === "active_savings"
        ? Math.max(snapToEuroStep(deterministicTarget * 0.65), 0)
        : Math.max(snapToEuroStep(deterministicTarget * 0.5), 0);
    const maximumTarget =
      settings.mode === "active_savings"
        ? Math.max(
            minimumTarget,
            Math.min(
              flexibleBudgetCapacity,
              Math.max(
                deterministicTarget,
                snapToEuroStep(deterministicTarget + 100),
              ),
            ),
          )
        : Math.max(
            minimumTarget,
            Math.min(
              flexibleBudgetCapacity,
              Math.max(
                deterministicTarget,
                snapToEuroStep(deterministicTargets.activeTarget),
              ),
            ),
          );
    const automaticSuggestion = await suggestAutomaticSavingsTarget({
      monthStart: monthStartIso,
      mode: settings.mode,
      expectedIncomeMonthly: round2(expectedIncomeMonthly),
      fixedCostsBudget: fixedInput.monthlyBudget,
      subscriptionsBudget: subscriptionInput.monthlyBudget,
      variableBaselineBudget: round2(variableBaselineBudget),
      savingsPotential,
      deterministicTarget,
      minimumTarget,
      maximumTarget,
      monthProgress: round2(monthProgress),
      projectedMonthlyNet: round2(projectedMonthlyCoreNet),
      recentIncomeTotals: completedMonthBudgetInsight.recentIncomeTotals,
      recentVariableTotals: completedMonthBudgetInsight.recentVariableTotals,
      recentSavingsCapacityTotals:
        completedMonthBudgetInsight.recentSavingsCapacityTotals,
    });

    appliedSavingsTarget = automaticSuggestion.amount;
    usedOpenAISavingsTarget = automaticSuggestion.usedOpenAI;
    savingsTargetSource =
      settings.mode === "active_savings"
        ? "automatic_active"
        : "automatic_balanced";
  }

  const variableDefaultBudget = Math.max(
    plannedIncomeBase -
      fixedInput.monthlyBudget -
      subscriptionInput.monthlyBudget -
      appliedSavingsTarget,
    0,
  );

  const variableInput = resolveBudgetInput(
    "variable_costs",
    variableDefaultBudget,
    defaultFactorForCategory("variable_costs", settings),
    "settings",
    false,
  );
  setRecommendation("variable_costs", variableInput);

  const variableSubkeys: BudgetCategoryKey[] = [
    "groceries",
    "fuel",
    "smoking",
    "other",
  ];

  const unresolvedSubkeys: BudgetCategoryKey[] = [];
  let explicitSubcategoryBudget = 0;

  for (const key of variableSubkeys) {
    const baselineMonthly = baselineByKey.get(key) || 0;
    const override = overridesByKey.get(key);
    const monthlyValue = monthValuesByKey.get(key);
    const autoManagedVariableCategory = settings.mode !== "custom";

    if (monthlyValue && !autoManagedVariableCategory) {
      const monthlyBudget = roundEuro(Math.max(monthlyValue.monthlyBudget, 0));
      explicitSubcategoryBudget += monthlyBudget;
      setRecommendation(key, {
        monthlyBudget,
        appliedFactor:
          baselineMonthly > 0
            ? monthlyBudget / baselineMonthly
            : settings.adjustmentFactor,
        overrideSource: "monthly_override",
      });
      continue;
    }

    if (!autoManagedVariableCategory && override?.monthlyTargetOverride != null) {
      const monthlyBudget = roundEuro(
        Math.max(override.monthlyTargetOverride, 0),
      );
      explicitSubcategoryBudget += monthlyBudget;
      setRecommendation(key, {
        monthlyBudget,
        appliedFactor:
          baselineMonthly > 0
            ? monthlyBudget / baselineMonthly
            : (override.factorOverride ?? settings.adjustmentFactor),
        overrideSource: "category_override",
      });
      continue;
    }

    if (!autoManagedVariableCategory && override?.factorOverride != null) {
      const monthlyBudget = roundEuro(
        Math.max(baselineMonthly * override.factorOverride, 0),
      );
      explicitSubcategoryBudget += monthlyBudget;
      setRecommendation(key, {
        monthlyBudget,
        appliedFactor: override.factorOverride,
        overrideSource: "category_override",
      });
      continue;
    }

    unresolvedSubkeys.push(key);
  }

  const remainingVariablePool = Math.max(
    variableInput.monthlyBudget - explicitSubcategoryBudget,
    0,
  );

  if (unresolvedSubkeys.length > 0) {
    const unresolvedBaselineTotal = unresolvedSubkeys.reduce(
      (sum, key) => sum + (baselineByKey.get(key) || 0),
      0,
    );

    let allocated = 0;
    unresolvedSubkeys.forEach((key, index) => {
      const baselineMonthly = baselineByKey.get(key) || 0;
      const share =
        unresolvedBaselineTotal > 0
          ? baselineMonthly / unresolvedBaselineTotal
          : 1 / unresolvedSubkeys.length;
      const monthlyBudget =
        index === unresolvedSubkeys.length - 1
          ? Math.max(remainingVariablePool - allocated, 0)
          : roundEuro(remainingVariablePool * share);
      allocated += monthlyBudget;

      setRecommendation(key, {
        monthlyBudget,
        appliedFactor:
          baselineMonthly > 0
            ? monthlyBudget / baselineMonthly
            : settings.adjustmentFactor,
        overrideSource: "settings",
      });
    });
  }

  setRecommendation("savings_target", {
    monthlyBudget: appliedSavingsTarget,
    appliedFactor: 1,
    overrideSource: "settings",
  });

  const recommendations = RECOMMENDATION_ORDER.map((categoryKey) =>
    recommendationByKey.get(categoryKey),
  ).filter((row): row is BudgetRecommendationRow => Boolean(row));

  const warnings: BudgetWarning[] = [];
  for (const row of recommendations) {
    if (row.categoryKey === "savings_target") continue;

    if (row.utilization > 1) {
      warnings.push({
        categoryKey: row.categoryKey,
        severity: resolveWarningSeverity(row.utilization),
        utilization: row.utilization,
        message: formatWarningMessage(row.label, row.utilization),
      });
      continue;
    }

    if (monthProgress <= 0) continue;

    const projectedActual = row.monthlyActual / monthProgress;
    const projectedUtilization = resolveUtilization(
      projectedActual,
      row.monthlyBudget,
    );
    if (projectedUtilization > 1) {
      warnings.push({
        categoryKey: row.categoryKey,
        severity: resolveWarningSeverity(projectedUtilization),
        utilization: projectedUtilization,
        message: formatPaceWarningMessage(row.label, projectedUtilization),
      });
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
      utilization: 1 + deficitAmount / Math.max(expectedIncomeMonthly, 1),
      message: `Huidig maandtempo voorspelt een tekort van ${round2(deficitAmount)}.`,
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
  const recommendedSavings = roundEuro(Math.max(appliedSavingsTarget, 0));
  const automaticSavingsTargetPreview = {
    activeSavings: roundEuro(
      Math.max(
        settings.mode === "active_savings"
          ? appliedSavingsTarget
          : deterministicTargets.activeTarget,
        0,
      ),
    ),
    balanced: roundEuro(
      Math.max(
        settings.mode === "balanced"
          ? appliedSavingsTarget
          : deterministicTargets.balancedTarget,
        0,
      ),
    ),
  };

  const monthlyBudgetTotal = roundEuro(Math.max(baseExpenseBudget, 0));

  const weeklyBudgetTotal = roundEuro(monthlyBudgetTotal / WEEKS_PER_MONTH);

  const flowSummary: BudgetFlowSummary = {
    expectedIncomeMonthly: roundEuro(Math.max(expectedIncomeMonthly, 0)),
    actualIncomeMonthToDate: roundEuro(Math.max(monthToDate.income.total, 0)),
    fixedCostsBudget: roundEuro(monthlyBudgetByKey.get("fixed_costs") || 0),
    subscriptionsBudget: roundEuro(
      monthlyBudgetByKey.get("subscriptions") || 0,
    ),
    subtotalAfterFixed: roundEuro(
      Math.max(
        expectedIncomeMonthly - (monthlyBudgetByKey.get("fixed_costs") || 0),
        0,
      ),
    ),
    subtotalAfterSubscriptions: roundEuro(
      Math.max(
        expectedIncomeMonthly -
          (monthlyBudgetByKey.get("fixed_costs") || 0) -
          (monthlyBudgetByKey.get("subscriptions") || 0),
        0,
      ),
    ),
    variableBudget: roundEuro(monthlyBudgetByKey.get("variable_costs") || 0),
    variableSubcategoriesBudgetTotal: roundEuro(
      (monthlyBudgetByKey.get("groceries") || 0) +
        (monthlyBudgetByKey.get("fuel") || 0) +
        (monthlyBudgetByKey.get("smoking") || 0) +
        (monthlyBudgetByKey.get("other") || 0),
    ),
    appliedSavingsTarget,
    automaticSavingsTargetPreview,
    savingsTargetSource,
    usedOpenAISavingsTarget,
  };

  const fallbackVariableMonthlyBudget = roundEuro(
    Math.max(flowSummary.variableBudget, 0),
  );
  const resolveVariableMonthlyBudget = (
    values: Array<{ categoryKey: string; monthlyBudget: number }>,
  ) => {
    const override = values.find((item) => item.categoryKey === "variable_costs");
    if (!override) return fallbackVariableMonthlyBudget;
    return roundEuro(Math.max(override.monthlyBudget, 0));
  };

  const variableMonthlyBudgetByMonthStartIso = new Map<string, number>([
    [
      previousMonthStartIso,
      resolveVariableMonthlyBudget(previousMonthBudgetValues),
    ],
    [monthStartIso, resolveVariableMonthlyBudget(currentMonthBudgetValues)],
    [nextMonthStartIso, resolveVariableMonthlyBudget(nextMonthBudgetValues)],
  ]);

  const weeklyVariablePlan = computeWeeklyVariablePlan(
    includedWeekRows,
    categoryMap,
    weekRanges,
    timelineReferenceDay,
    variableMonthlyBudgetByMonthStartIso,
    monthStart,
  );

  const weeklySpendBreakdown = buildWeeklySpendBreakdown(
    includedWeekRows,
    categoryMap,
    weekRanges,
  );

  for (const row of weeklyVariablePlan) {
    if (!row.isPastWeek || row.overrunAmount <= 0) continue;
    warnings.push({
      categoryKey: "variable_costs",
      severity: row.overrunAmount >= 80 ? "critical" : "warning",
      utilization: row.utilization,
      message: `${row.label} zit ${row.overrunAmount} euro boven weekbudget. Resterende weken zijn herverdeeld.`,
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

  const savingsProgress: BudgetSavingsProgress = {
    recommendedSavings,
    earnedActual: roundEuro(
      monthToDate.income.total -
        (monthToDate.expenses.fixedCosts +
          monthToDate.expenses.subscriptions +
          monthToDate.expenses.variableCosts),
    ),
    earnedOnTrack: roundEuro(recommendedSavings * monthProgress),
    progressActual:
      recommendedSavings > 0
        ? clamp(
            (monthToDate.income.total -
              (monthToDate.expenses.fixedCosts +
                monthToDate.expenses.subscriptions +
                monthToDate.expenses.variableCosts)) /
              recommendedSavings,
            0,
            1.5,
          )
        : 0,
    progressOnTrack:
      recommendedSavings > 0
        ? clamp(
            (recommendedSavings * monthProgress) / recommendedSavings,
            0,
            1.5,
          )
        : 0,
  };

  const expenseDetails = {
    fixedCosts: buildExpenseDetailItems(
      includedMonthRows,
      categoryMap,
      "fixed_costs",
    ),
    subscriptions: buildExpenseDetailItems(
      includedMonthRows,
      categoryMap,
      "subscriptions",
    ),
  };

  const outsideBudgetExpenses = buildOutsideBudgetExpenseSummary(
    excludedMonthRows,
    categoryMap,
  );

  const coachReport = buildCoachReport(
    recommendations,
    warnings,
    recommendedSavings,
  );

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
    automaticSavingsTargetPreview,
    savingsTargetSource,
    usedOpenAISavingsTarget,
    monthlyBudgetTotal,
    weeklyBudgetTotal,
    flowSummary,
    weeklyVariablePlan,
    weeklySpendBreakdown,
    outsideBudgetExpenses,
    expenseDetails,
    savingsProgress,
    coachReport,
  };
}
