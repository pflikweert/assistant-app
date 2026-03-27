import { suggestAutomaticSavingsTarget } from "@/services/budget-coach";
import {
  applyEffectiveBudgetGroupsToCategories,
  listCategoryBudgetGroupOverrides,
} from "@/services/category-budget-groups";
import { normalizePattern } from "@/services/pattern-normalization";
import { resolveBudgetIncomePreview } from "@/services/budget-income-preview";
import {
    allocateIntegerBudget,
    allocateWeekBudgetsByMainCategory,
    resolveLockedVariableMainCategories,
} from "@/services/budget-lock-utils";
import { requireCurrentUserId } from "@/services/current-user";
import { listBankAccountBudgetFlags } from "@/services/bank-accounts";
import {
    getBudgetCategoryOverrides,
    getBudgetPlanSettings,
    getMonthlyBudgetValues,
} from "@/services/budget-plan-repository";
import type { CalendarWeekRange } from "@/services/budget-week-utils";
import {
    buildCalendarWeekRangesForMonth,
    rebalanceWeeklyBudgets,
    resolveBaseWeeklyBudgetsByDailyMonthRates,
    resolveBaseWeeklyMainCategoryBudgetsByDailyMonthRates,
} from "@/services/budget-week-utils";
import { resolveIncomeSemantics } from "@/services/income-semantics";
import {
  isBankAccountIncludedInLegacyBudgetScope,
  isTransactionExcludedFromLegacyBudgetScope,
  isTransactionIncludedInLegacyBudgetScope,
} from "@/services/financial-semantics";
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
  BudgetIncomeInclusionSettings,
  BudgetPlanSettings,
    BudgetRecommendationRow,
    BudgetSavingsProgress,
    BudgetSavingsTargetSource,
    BudgetTrendSnapshot,
    BudgetVariableBreakdown,
    BudgetWarning,
    BudgetWarningSeverity,
    BudgetWeekBudgetBreakdown,
    BudgetWeekCategorySpend,
    BudgetWeekPlanRow,
    BudgetWeekSpendBreakdown,
    BudgetWeekSubcategorySpend,
    CategoryRecord,
    MonthlyBudgetValue,
} from "@/types/categorization";

const PAGE_SIZE = 500;
const TREND_WINDOW_DAYS = 90;
const MONTHLY_NORMALIZER_DAYS = 30.4375;
const SAVINGS_TARGET_STEP = 25;

type BudgetTx = {
  id: string;
  date: string;
  amount: number;
  details: string;
  counterparty: string | null;
  bank_account_id: string | null;
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

type IncomeBucket =
  | "salary"
  | "childBudget"
  | "structuralOther"
  | "variable"
  | "windfall"
  | "costRefund";

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

const VARIABLE_EXPENSE_KEYWORDS = [
  "zakgeld",
  "kleedgeld",
  "kledinggeld",
  "pocket money",
  "allowance",
];

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

const DEFAULT_INCLUDE_INCOME: BudgetIncomeInclusionSettings = {
  salary: true,
  childBudget: true,
  structuralOther: false,
  variable: false,
};

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

function isCareCategoryKey(categoryKey: string) {
  return (
    categoryKey === "care" ||
    categoryKey === "health" ||
    categoryKey.startsWith("care_") ||
    categoryKey.startsWith("health_")
  );
}

function isCareInsuranceCategoryKey(categoryKey: string) {
  return (
    categoryKey.startsWith("care_health_insurance") ||
    categoryKey.startsWith("insurance_health") ||
    categoryKey.startsWith("health_insurance")
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
  const categoryKey = categoryMeta
    ? normalizeCategoryKey(categoryMeta.key)
    : "";
  const budgetGroup = normalizePattern(categoryMeta?.budget_group || "");
  const haystack = getHaystack(tx);

  if (budgetGroup === "savings") return "savings_transfer";
  if (budgetGroup === "subscriptions") return "subscriptions";
  if (budgetGroup === "fixed") return "fixed_costs";
  if (budgetGroup === "variable") return "variable_costs";

  if (categoryKey) {
    if (isSavingsCategoryKey(categoryKey)) return "savings_transfer";
    if (isSubscriptionCategoryKey(categoryKey)) return "subscriptions";
    if (isCareCategoryKey(categoryKey) && !isCareInsuranceCategoryKey(categoryKey)) {
      return "variable_costs";
    }
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

  if (includesAny(haystack, SAVINGS_TRANSFER_KEYWORDS))
    return "savings_transfer";
  if (includesAny(haystack, SUBSCRIPTION_KEYWORDS)) return "subscriptions";
  if (includesAny(haystack, FIXED_EXPENSE_KEYWORDS)) return "fixed_costs";
  if (includesAny(haystack, VARIABLE_EXPENSE_KEYWORDS)) {
    return "variable_costs";
  }

  if (
    tx.analysis_main_group === "expense" &&
    (tx.analysis_category === "fixed_costs" ||
      tx.analysis_category === "subscriptions" ||
      tx.analysis_category === "variable_costs" ||
      tx.analysis_category === "savings_transfer")
  ) {
    return tx.analysis_category;
  }

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
    categoryKey.includes("supermarket")
  ) {
    return "groceries";
  }

  if (categoryKey.includes("fuel")) {
    return "fuel";
  }

  if (categoryKey.includes("smoking")) {
    return "smoking";
  }

  // If a transaction already has a concrete category key that is not one of the
  // dedicated variable buckets above, keep it in "other" instead of letting
  // merchant-name heuristics override it into groceries/fuel/smoking.
  if (categoryKey) {
    return "other";
  }

  if (includesAny(haystack, GROCERIES_KEYWORDS)) {
    return "groceries";
  }

  if (includesAny(haystack, FUEL_KEYWORDS)) {
    return "fuel";
  }

  if (includesAny(haystack, SMOKING_KEYWORDS)) {
    return "smoking";
  }

  return "other";
}

function classifyIncome(
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
): IncomeBucket {
  const semantics = resolveIncomeSemantics({
    amount: tx.amount,
    counterparty: tx.counterparty,
    details: tx.details,
    categoryKey: categoryMeta?.key || null,
    budgetGroup: categoryMeta?.budget_group || null,
    analysisCategory:
      tx.analysis_category === "income_structural" ||
      tx.analysis_category === "income_variable"
        ? tx.analysis_category
        : null,
  });

  return semantics.budgetBucket || "variable";
}

function addIncomeToBreakdown(
  breakdown: BudgetIncomeBreakdown,
  bucket: IncomeBucket,
  amount: number,
) {
  if (bucket === "salary") breakdown.salary += amount;
  if (bucket === "childBudget") breakdown.childBudget += amount;
  if (bucket === "structuralOther") breakdown.structuralOther += amount;
  if (bucket === "variable") breakdown.variable += amount;
  if (bucket === "windfall") breakdown.windfalls += amount;
  if (bucket === "costRefund") breakdown.costRefunds += amount;
}

function applyExpenseDelta(
  expenses: BudgetExpenseBreakdown,
  bucket: ExpenseBucket,
  amount: number,
  tx: BudgetTx,
  categoryMeta: CategoryMeta | null,
) {
  if (bucket === "fixed_costs") expenses.fixedCosts += amount;
  if (bucket === "subscriptions") expenses.subscriptions += amount;
  if (bucket === "savings_transfer") expenses.savingsTransfer += amount;

  if (bucket === "variable_costs") {
    expenses.variableCosts += amount;
    const subbucket = resolveVariableSubbucket(tx, categoryMeta);
    if (subbucket === "groceries") expenses.variable.groceries += amount;
    if (subbucket === "fuel") expenses.variable.fuel += amount;
    if (subbucket === "smoking") expenses.variable.smoking += amount;
    if (subbucket === "other") expenses.variable.other += amount;
  }

  expenses.total += amount;
}

function emptyIncomeBreakdown(): BudgetIncomeBreakdown {
  return {
    salary: 0,
    childBudget: 0,
    structuralOther: 0,
    variable: 0,
    windfalls: 0,
    costRefunds: 0,
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
    windfalls: round2(value.windfalls * factor),
    costRefunds: round2(value.costRefunds * factor),
    total: round2(value.total * factor),
  };
}

function resolveIncludedIncomeTotal(
  income: BudgetIncomeBreakdown,
  settings: BudgetPlanSettings,
): number {
  const includeIncome = settings.includeIncome ?? DEFAULT_INCLUDE_INCOME;
  let total = 0;
  if (includeIncome.salary) total += income.salary;
  if (includeIncome.childBudget) total += income.childBudget;
  if (includeIncome.structuralOther) total += income.structuralOther;
  if (includeIncome.variable) total += income.variable;
  return round2(total);
}

export type IncludedIncomePreview = {
  total: number;
  structural: number;
  variable: number;
};

export function resolveIncludedIncomePreview(
  income: BudgetIncomeBreakdown,
  settings: BudgetPlanSettings,
): IncludedIncomePreview {
  const preview = resolveBudgetIncomePreview(income, settings.includeIncome);
  return {
    total: preview.total,
    structural: preview.structural,
    variable: preview.variable,
  };
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

const RECENT_INCOME_FORECAST_MONTHS = 2;
const RECENT_EXPENSE_FORECAST_MONTHS = 2;
const RECENT_INSIGHT_MONTHS = 2;

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function weightedRecentAverage(values: number[]) {
  if (!values.length) return 0;
  if (values.length === 1) return round2(values[0]);

  const weights = [0.72, 0.28];
  let weightedTotal = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    const weight = weights[index] ?? Math.max(0.14 / (index + 1), 0);
    weightedTotal += value * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return round2(values[0]);
  return round2(weightedTotal / totalWeight);
}

export function resolveBudgetPlanningTimeline(
  referenceDay: Date,
  timelineReferenceDay: Date,
) {
  const selectedMonthStart = startOfMonth(referenceDay);
  const actualCurrentMonthStart = startOfMonth(timelineReferenceDay);
  const isFuturePlanningMonth =
    selectedMonthStart.getTime() > actualCurrentMonthStart.getTime();
  const observationEndExclusive = isFuturePlanningMonth
    ? actualCurrentMonthStart
    : addDays(referenceDay, 1);
  const observedDataEndExclusive = isFuturePlanningMonth
    ? addDays(timelineReferenceDay, 1)
    : observationEndExclusive;
  const completedMonthCutoffStart = isFuturePlanningMonth
    ? actualCurrentMonthStart
    : selectedMonthStart;
  const completedMonthBaselineThrough =
    completedMonthCutoffStart.getTime() > 0
      ? dateToIso(addDays(completedMonthCutoffStart, -1)).slice(0, 7) + "-01"
      : null;

  return {
    selectedMonthStart,
    actualCurrentMonthStart,
    isFuturePlanningMonth,
    observationEndExclusive,
    observedDataEndExclusive,
    completedMonthCutoffStart,
    completedMonthBaselineThrough,
  };
}

function getRecentCompletedMonthRows<T>(
  byMonth: Map<string, T>,
  trendStart: Date,
  completedMonthCutoffStart: Date,
  limit: number,
) {
  return [...byMonth.entries()]
    .map(([monthKey, value]) => {
      const monthStart = monthStartFromKey(monthKey);
      return monthStart ? { monthStart, value } : null;
    })
    .filter(
      (
        row,
      ): row is {
        monthStart: Date;
        value: T;
      } => Boolean(row),
    )
    .filter(
      (row) =>
        row.monthStart < completedMonthCutoffStart &&
        row.monthStart >= trendStart,
    )
    .sort(
      (left, right) => right.monthStart.getTime() - left.monthStart.getTime(),
    )
    .slice(0, limit);
}

function computeIncomeTotalsByMonth(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
): Map<string, BudgetIncomeBreakdown> {
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
    const semantics = resolveIncomeSemantics({
      amount,
      counterparty: row.counterparty,
      details: row.details,
      categoryKey: categoryMeta?.key || null,
      budgetGroup: categoryMeta?.budget_group || null,
      analysisCategory:
        row.analysis_category === "income_structural" ||
        row.analysis_category === "income_variable"
          ? row.analysis_category
          : null,
    });
    const bucket = classifyIncome(row, categoryMeta);

    addIncomeToBreakdown(current, bucket, amount);
    if (semantics.countsAsIncome) current.total += amount;

    byMonth.set(monthKey, current);
  }

  const totals = new Map<string, BudgetIncomeBreakdown>();
  for (const [monthKey, income] of byMonth) {
    totals.set(monthKey, {
      salary: round2(income.salary),
      childBudget: round2(income.childBudget),
      structuralOther: round2(income.structuralOther),
      variable: round2(income.variable),
      windfalls: round2(income.windfalls),
      costRefunds: round2(income.costRefunds),
      total: round2(income.total),
    });
  }

  return totals;
}

function computeIncludedIncomeTotalsByMonth(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  settings: BudgetPlanSettings,
): Map<string, number> {
  const byMonth = computeIncomeTotalsByMonth(rows, categoryMap);
  const totals = new Map<string, number>();

  for (const [monthKey, income] of byMonth) {
    totals.set(monthKey, round2(applyIncomeInclusion(income, settings).total));
  }

  return totals;
}

export function resolveIncomeForecastFromCompletedMonths(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  settings: BudgetPlanSettings,
  trendStart: Date,
  completedMonthCutoffStart: Date,
): BudgetIncomeBreakdown | null {
  const incomeByMonth = computeIncomeTotalsByMonth(rows, categoryMap);
  const completedMonths = getRecentCompletedMonthRows(
    incomeByMonth,
    trendStart,
    completedMonthCutoffStart,
    RECENT_INCOME_FORECAST_MONTHS,
  ).filter((row) => resolveIncludedIncomeTotal(row.value, settings) > 0);

  if (!completedMonths.length) return null;

  return applyIncomeInclusion(
    {
      salary: weightedRecentAverage(
        completedMonths.map((row) => row.value.salary),
      ),
      childBudget: weightedRecentAverage(
        completedMonths.map((row) => row.value.childBudget),
      ),
      structuralOther: weightedRecentAverage(
        completedMonths.map((row) => row.value.structuralOther),
      ),
      variable: weightedRecentAverage(
        completedMonths.map((row) => row.value.variable),
      ),
      windfalls: weightedRecentAverage(
        completedMonths.map((row) => row.value.windfalls),
      ),
      costRefunds: weightedRecentAverage(
        completedMonths.map((row) => row.value.costRefunds),
      ),
      total: 0,
    },
    settings,
  );
}

export function resolveExpectedIncomeMonthlyFromCompletedMonths(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  settings: BudgetPlanSettings,
  trendStart: Date,
  completedMonthCutoffStart: Date,
): number | null {
  const forecast = resolveIncomeForecastFromCompletedMonths(
    rows,
    categoryMap,
    settings,
    trendStart,
    completedMonthCutoffStart,
  );
  return forecast ? round2(forecast.total) : null;
}

function computeExpenseTotalsByMonth(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
): Map<string, BudgetExpenseBreakdown> {
  const byMonth = new Map<string, BudgetExpenseBreakdown>();

  for (const row of rows) {
    if (
      isTransactionExcludedFromLegacyBudgetScope({
        budgetExcluded: row.budget_excluded,
        analysisMainGroup: row.analysis_main_group,
        analysisCategory: row.analysis_category,
      })
    ) {
      continue;
    }

    const amount = asNumber(row.amount, 0);

    const monthKey = monthKeyFromIsoDate(row.date);
    if (!monthKey || monthKey.length !== 7) continue;

    const current = byMonth.get(monthKey) || emptyExpenseBreakdown();
    const categoryId = row.category_id_user || row.category_id_auto;
    const categoryMeta = categoryId
      ? categoryMap.get(categoryId) || null
      : null;

    if (amount > 0) {
      const semantics = resolveIncomeSemantics({
        amount,
        counterparty: row.counterparty,
        details: row.details,
        categoryKey: categoryMeta?.key || null,
        budgetGroup: categoryMeta?.budget_group || null,
        analysisCategory:
          row.analysis_category === "income_structural" ||
          row.analysis_category === "income_variable"
            ? row.analysis_category
            : null,
      });

      if (semantics.kind !== "expense_refund" || !semantics.expenseOffsetBucket) {
        continue;
      }

      applyExpenseDelta(
        current,
        semantics.expenseOffsetBucket,
        -amount,
        row,
        categoryMeta,
      );
      byMonth.set(monthKey, current);
      continue;
    }

    if (amount >= 0) continue;

    const bucket = resolveExpenseBucket(row, categoryMeta);
    applyExpenseDelta(current, bucket, Math.abs(amount), row, categoryMeta);
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

export function resolveExpenseBaselinesFromCompletedMonths(
  rows: BudgetTx[],
  categoryMap: Map<string, CategoryMeta>,
  trendStart: Date,
  completedMonthCutoffStart: Date,
): Map<BudgetCategoryKey, number> {
  const totalsByMonth = computeExpenseTotalsByMonth(rows, categoryMap);
  const completedMonths = getRecentCompletedMonthRows(
    totalsByMonth,
    trendStart,
    completedMonthCutoffStart,
    RECENT_EXPENSE_FORECAST_MONTHS,
  );

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
      weightedRecentAverage(
        completedMonths.map((row) =>
          Math.max(0, getBudgetCategoryActual(key, row.value)),
        ),
      ),
    );
  }

  return baselines;
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
  completedMonthCutoffStart: Date,
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
        row.monthStart < completedMonthCutoffStart &&
        row.monthStart >= trendStart,
    )
    .sort(
      (left, right) => right.monthStart.getTime() - left.monthStart.getTime(),
    )
    .slice(0, RECENT_INSIGHT_MONTHS);

  const recentIncomeTotals: number[] = [];
  const recentVariableTotals: number[] = [];
  const recentSavingsCapacityTotals: number[] = [];

  for (const row of recentMonths) {
    const incomeTotal = round2(incomeTotalsByMonth.get(row.monthKey) || 0);
    const expenses =
      expenseTotalsByMonth.get(row.monthKey) || emptyExpenseBreakdown();
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
      (monthProgress >= 0.5 && positiveProjectedNet < realisticCenter
        ? 0.08
        : 0),
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

function buildAverageWeeklyBudget(monthlyBudget: number, daysInMonth: number) {
  if (daysInMonth <= 0) return 0;
  return roundEuro((Math.max(monthlyBudget, 0) / daysInMonth) * 7);
}

function buildVariableMainCategoryBudgetMapFromRecommendations(
  recommendations: BudgetRecommendationRow[],
) {
  const recommendationByKey = new Map(
    recommendations.map((row) => [row.categoryKey, row]),
  );
  const budgets = new Map<VariableMainCategory, number>();

  for (const key of VARIABLE_MAIN_ORDER) {
    budgets.set(
      key,
      roundEuro(Math.max(recommendationByKey.get(key)?.monthlyBudget || 0, 0)),
    );
  }

  return budgets;
}

function buildVariableMainCategoryBudgetMapForMonth(params: {
  monthValues: MonthlyBudgetValue[];
  fallbackBudgets: Map<VariableMainCategory, number>;
  fallbackVariableBudget: number;
}) {
  const { monthValues, fallbackBudgets, fallbackVariableBudget } = params;
  const explicitBudgets = new Map<VariableMainCategory, number>();

  for (const key of VARIABLE_MAIN_ORDER) {
    const monthlyValue = monthValues.find((item) => item.categoryKey === key);
    if (!monthlyValue) continue;
    explicitBudgets.set(key, roundEuro(Math.max(monthlyValue.monthlyBudget, 0)));
  }

  const explicitTotal = [...explicitBudgets.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const targetVariableBudget = Math.max(
    roundEuro(
      Math.max(
        monthValues.find((item) => item.categoryKey === "variable_costs")
          ?.monthlyBudget ?? fallbackVariableBudget,
        0,
      ),
    ),
    explicitTotal,
  );

  const missingKeys = VARIABLE_MAIN_ORDER.filter((key) => !explicitBudgets.has(key));
  const remainingBudget = Math.max(targetVariableBudget - explicitTotal, 0);
  const allocations = allocateIntegerBudget(
    remainingBudget,
    missingKeys.map((key) => fallbackBudgets.get(key) || 0),
  );

  const result = new Map<VariableMainCategory, number>();
  let allocationIndex = 0;

  for (const key of VARIABLE_MAIN_ORDER) {
    if (explicitBudgets.has(key)) {
      result.set(key, explicitBudgets.get(key) || 0);
      continue;
    }

    result.set(key, allocations[allocationIndex] || 0);
    allocationIndex += 1;
  }

  return result;
}

function sumVariableMainCategoryBudgetMap(
  budgetByCategory: Map<VariableMainCategory, number>,
) {
  return roundEuro(
    VARIABLE_MAIN_ORDER.reduce(
      (sum, key) => sum + (budgetByCategory.get(key) || 0),
      0,
    ),
  );
}

function buildVariableMonthlyBudgetByMonthStartIso(params: {
  variableMainCategoryBudgetByMonthStartIso: Map<
    string,
    Map<VariableMainCategory, number>
  >;
}) {
  const { variableMainCategoryBudgetByMonthStartIso } = params;

  return new Map<string, number>(
    [...variableMainCategoryBudgetByMonthStartIso.entries()].map(
      ([monthStartIso, budgetByCategory]) => [
        monthStartIso,
        sumVariableMainCategoryBudgetMap(budgetByCategory),
      ],
    ),
  );
}

function resolveLockedVariableMainCategoriesFromMonthValues(
  monthValues: MonthlyBudgetValue[],
): Set<VariableMainCategory> {
  const locked = new Set<VariableMainCategory>();

  for (const key of VARIABLE_MAIN_ORDER) {
    if (monthValues.find((item) => item.categoryKey === key)?.lockTrend) {
      locked.add(key);
    }
  }

  return locked;
}

function buildWeeklyBudgetBreakdown(params: {
  weeklyVariablePlan: BudgetWeekPlanRow[];
  weekRanges: WeekRange[];
  variableMainCategoryBudgetByMonthStartIso: Map<
    string,
    Map<VariableMainCategory, number>
  >;
  currentMonthStart: Date;
  lockedCategoryKeys: ReadonlySet<VariableMainCategory>;
}): BudgetWeekBudgetBreakdown[] {
  const {
    weeklyVariablePlan,
    weekRanges,
    variableMainCategoryBudgetByMonthStartIso,
    currentMonthStart,
    lockedCategoryKeys,
  } = params;

  const baseWeeklyBudgetsByCategory =
    resolveBaseWeeklyMainCategoryBudgetsByDailyMonthRates(
      weekRanges,
      variableMainCategoryBudgetByMonthStartIso as Map<string, Map<string, number>>,
      currentMonthStart,
    );

  return weeklyVariablePlan.map((week, index) => {
    const allocatedBudgets = allocateWeekBudgetsByMainCategory({
      baseWeekBudgetByMainCategory:
        baseWeeklyBudgetsByCategory[index] || new Map<string, number>(),
      weekBudget: week.budget,
      lockedCategoryKeys,
    });

    return {
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDateExclusive: week.endDateExclusive,
      categories: VARIABLE_MAIN_ORDER.map((key) => ({
        key,
        label: VARIABLE_MAIN_LABELS[key],
        amount: allocatedBudgets.get(key) || 0,
      })),
    };
  });
}

export function resolveFutureMonthOverlapCarryover(params: {
  planningTimeline: ReturnType<typeof resolveBudgetPlanningTimeline>;
  timelineReferenceDay: Date;
  transactions: BudgetTx[];
  categoryMap: Map<string, CategoryMeta>;
  selectedWeekRanges: WeekRange[];
  previousMonthStart: Date;
  selectedMonthStart: Date;
  prePreviousMonthVariableMainCategoryBudgets: Map<VariableMainCategory, number>;
  previousMonthVariableMainCategoryBudgets: Map<VariableMainCategory, number>;
  selectedMonthVariableMainCategoryBudgets: Map<VariableMainCategory, number>;
  previousMonthLockedCategoryKeys: ReadonlySet<VariableMainCategory>;
}): {
  weekPlan: BudgetWeekPlanRow;
  weekBudgetBreakdown: BudgetWeekBudgetBreakdown;
} | null {
  const {
    planningTimeline,
    timelineReferenceDay,
    transactions,
    categoryMap,
    selectedWeekRanges,
    previousMonthStart,
    selectedMonthStart,
    prePreviousMonthVariableMainCategoryBudgets,
    previousMonthVariableMainCategoryBudgets,
    selectedMonthVariableMainCategoryBudgets,
    previousMonthLockedCategoryKeys,
  } = params;

  const firstSelectedWeek = selectedWeekRanges[0];
  if (!planningTimeline.isFuturePlanningMonth) return null;
  if (!firstSelectedWeek?.daysInPreviousMonth) return null;
  if (
    previousMonthStart.getTime() !==
    planningTimeline.actualCurrentMonthStart.getTime()
  ) {
    return null;
  }

  const previousMonthWeekRanges = buildMonthWeekRanges(
    previousMonthStart,
    selectedMonthStart,
  );
  if (!previousMonthWeekRanges.length) return null;

  const previousWeekWindowStartIso = dateToIso(previousMonthWeekRanges[0].start);
  const observedDataEndIso = dateToIso(planningTimeline.observedDataEndExclusive);
  const previousMonthWeekRows = transactions.filter(
    (row) =>
      row.date >= previousWeekWindowStartIso && row.date < observedDataEndIso,
  );

  const prePreviousMonthStartIso = dateToIso(
    startOfMonth(subtractDays(previousMonthStart, 1)),
  );
  const previousMonthStartIso = dateToIso(previousMonthStart);
  const selectedMonthStartIso = dateToIso(selectedMonthStart);

  const previousMonthVariableMainCategoryBudgetByMonthStartIso = new Map<
    string,
    Map<VariableMainCategory, number>
  >([
    [
      prePreviousMonthStartIso,
      prePreviousMonthVariableMainCategoryBudgets,
    ],
    [previousMonthStartIso, previousMonthVariableMainCategoryBudgets],
    [selectedMonthStartIso, selectedMonthVariableMainCategoryBudgets],
  ]);
  const previousMonthVariableMonthlyBudgetByMonthStartIso =
    buildVariableMonthlyBudgetByMonthStartIso({
      variableMainCategoryBudgetByMonthStartIso:
        previousMonthVariableMainCategoryBudgetByMonthStartIso,
    });

  const previousMonthWeeklyVariablePlan = computeWeeklyVariablePlan(
    previousMonthWeekRows,
    categoryMap,
    previousMonthWeekRanges,
    timelineReferenceDay,
    previousMonthVariableMonthlyBudgetByMonthStartIso,
    previousMonthStart,
    previousMonthLockedCategoryKeys,
  );
  const previousMonthWeeklyBudgetBreakdown = buildWeeklyBudgetBreakdown({
    weeklyVariablePlan: previousMonthWeeklyVariablePlan,
    weekRanges: previousMonthWeekRanges,
    variableMainCategoryBudgetByMonthStartIso:
      previousMonthVariableMainCategoryBudgetByMonthStartIso,
    currentMonthStart: previousMonthStart,
    lockedCategoryKeys: previousMonthLockedCategoryKeys,
  });

  const matchingWeekPlan = previousMonthWeeklyVariablePlan.find(
    (row) =>
      row.startDate === dateToIso(firstSelectedWeek.start) &&
      row.endDateExclusive === dateToIso(firstSelectedWeek.endExclusive),
  );
  const matchingBudgetBreakdown = previousMonthWeeklyBudgetBreakdown.find(
    (row) =>
      row.startDate === dateToIso(firstSelectedWeek.start) &&
      row.endDateExclusive === dateToIso(firstSelectedWeek.endExclusive),
  );

  if (!matchingWeekPlan || !matchingBudgetBreakdown) return null;

  return {
    weekPlan: matchingWeekPlan,
    weekBudgetBreakdown: matchingBudgetBreakdown,
  };
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
    if (
      isTransactionExcludedFromLegacyBudgetScope({
        budgetExcluded: row.budget_excluded,
        analysisMainGroup: row.analysis_main_group,
        analysisCategory: row.analysis_category,
      })
    ) {
      continue;
    }
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
      groupKey: string;
      transactionIds: string[];
    }
  >();

  for (const row of monthRows) {
    if (row.amount >= 0) continue;
    if (
      isTransactionIncludedInLegacyBudgetScope({
        budgetExcluded: row.budget_excluded,
        analysisMainGroup: row.analysis_main_group,
        analysisCategory: row.analysis_category,
      })
    ) {
      continue;
    }

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
        groupKey,
        transactionIds: [row.id],
      });
      continue;
    }

    current.amount += absAmount;
    current.transactionCount += 1;
    current.transactionIds.push(row.id);
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
      groupKey: item.groupKey,
      transactionIds: item.transactionIds,
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
  excludedMainCategoriesFromRebalance: ReadonlySet<VariableMainCategory>,
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
      if (
        isTransactionExcludedFromLegacyBudgetScope({
          budgetExcluded: row.budget_excluded,
          analysisMainGroup: row.analysis_main_group,
          analysisCategory: row.analysis_category,
        })
      ) {
        continue;
      }
      const txDate = parseIsoDateUtc(row.date);
      if (txDate < range.start || txDate >= range.endExclusive) continue;
      const categoryMeta = resolveCategoryMetaForTransaction(row, categoryMap);
      const expenseBucket = resolveExpenseBucket(row, categoryMeta);
      if (expenseBucket !== "variable_costs") continue;
      total += Math.abs(row.amount);
    }
    return roundEuro(total);
  });

  const weekActualsForRebalance = ranges.map((range) => {
    let total = 0;
    for (const row of weekRows) {
      if (row.amount >= 0) continue;
      if (
        isTransactionExcludedFromLegacyBudgetScope({
          budgetExcluded: row.budget_excluded,
          analysisMainGroup: row.analysis_main_group,
          analysisCategory: row.analysis_category,
        })
      ) {
        continue;
      }
      const txDate = parseIsoDateUtc(row.date);
      if (txDate < range.start || txDate >= range.endExclusive) continue;
      const categoryMeta = resolveCategoryMetaForTransaction(row, categoryMap);
      const expenseBucket = resolveExpenseBucket(row, categoryMeta);
      if (expenseBucket !== "variable_costs") continue;
      const mainCategory = resolveVariableSubbucket(row, categoryMeta);
      if (excludedMainCategoriesFromRebalance.has(mainCategory)) continue;
      total += Math.abs(row.amount);
    }
    return roundEuro(total);
  });

  const rebalance = rebalanceWeeklyBudgets(
    baseWeeklyBudgetByIndex,
    weekActualsForRebalance,
  );
  const rows: BudgetWeekPlanRow[] = [];

  ranges.forEach((range, index) => {
    const baseBudget = roundEuro(baseWeeklyBudgetByIndex[index] || 0);
    const budget = rebalance.budgets[index] || 0;
    const actual = weekActuals[index];
    const rebalanceActual = weekActualsForRebalance[index];
    const remaining = roundEuro(budget - actual);
    const utilization = resolveUtilization(actual, budget);
    const overrunAmount =
      rebalanceActual > budget ? roundEuro(rebalanceActual - budget) : 0;

    rows.push({
      weekNumber: range.weekNumber,
      label: range.label,
      startDate: dateToIso(range.start),
      endDateExclusive: dateToIso(range.endExclusive),
      baseBudget,
      budget,
      guardrailBudgetFloor: null,
      actual,
      remaining,
      utilization,
      isCurrentWeek:
        timelineReferenceDay >= range.start &&
        timelineReferenceDay < range.endExclusive,
      isPastWeek: timelineReferenceDay >= range.endExclusive,
      wasRebalanced:
        index > 0 && Math.abs(budget - baseBudget) >= 1,
      rebalanceMode:
        index > 0 && Math.abs(budget - baseBudget) >= 1 ? "hard" : "none",
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
      if (
        isTransactionExcludedFromLegacyBudgetScope({
          budgetExcluded: row.budget_excluded,
          analysisMainGroup: row.analysis_main_group,
          analysisCategory: row.analysis_category,
        })
      ) {
        continue;
      }
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

// Haal user_id uit SessionContext (hook mag alleen in component, dus geef user_id als param door)
async function fetchTransactionsInRange(
  startIso: string,
  endIso: string,
  userId?: string,
): Promise<BudgetTx[]> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const budgetFlags = await listBankAccountBudgetFlags(resolvedUserId);
  const rows: BudgetTx[] = [];
  let offset = 0;

  while (true) {
    const to = offset + PAGE_SIZE - 1;
    let query = supabase
      .from("transactions")
      .select(
        "id,date,amount,details,counterparty,bank_account_id,analysis_main_group,analysis_category,category_id_auto,category_id_user,budget_excluded",
      )
      .gte("date", startIso)
      .lt("date", endIso)
      .order("date", { ascending: false })
      .range(offset, to);

    query = query.eq("user_id", resolvedUserId);

    const { data, error } = await query;

    if (error) throw error;

    const page = ((data || []) as Record<string, unknown>[])
      .map((row) => {
        const bankAccountId = row.bank_account_id ? String(row.bank_account_id) : null;
        if (
          !isBankAccountIncludedInLegacyBudgetScope(
            budgetFlags.get(bankAccountId || "") !== false,
          )
        ) {
          return null;
        }

        return {
          id: String(row.id || ""),
          date: String(row.date || ""),
          amount: asNumber(row.amount, 0),
          details: String(row.details || ""),
          counterparty: row.counterparty ? String(row.counterparty) : null,
          bank_account_id: bankAccountId,
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
        };
      })
      .filter((row): row is BudgetTx => Boolean(row));

    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchCategoryMap(userId?: string): Promise<Map<string, CategoryMeta>> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  let query = supabase
    .from("categories")
    .select("id,key,name,parent_id,budget_group,sort_order");
  query = query.or(`user_id.is.null,user_id.eq.${resolvedUserId}`);

  const { data, error } = await query;

  if (error) throw error;

  const rawCategories: CategoryRecord[] = ((data || []) as Record<string, unknown>[])
    .map((row) => ({
      id: String(row.id || ""),
      key: String(row.key || ""),
      name: String(row.name || ""),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      budget_group: row.budget_group ? String(row.budget_group) : null,
      sort_order:
        row.sort_order == null ? null : Number(row.sort_order),
    }))
    .filter((row) => row.id);

  const effectiveCategories = applyEffectiveBudgetGroupsToCategories(
    rawCategories,
    await listCategoryBudgetGroupOverrides(resolvedUserId),
  );

  const map = new Map<string, CategoryMeta>();
  for (const row of effectiveCategories) {
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
    if (
      isTransactionExcludedFromLegacyBudgetScope({
        budgetExcluded: row.budget_excluded,
        analysisMainGroup: row.analysis_main_group,
        analysisCategory: row.analysis_category,
      })
    ) {
      continue;
    }
    const amount = asNumber(row.amount, 0);
    if (amount === 0) continue;

    const categoryId = row.category_id_user || row.category_id_auto;
    const categoryMeta = categoryId
      ? categoryMap.get(categoryId) || null
      : null;

    if (amount > 0) {
      const semantics = resolveIncomeSemantics({
        amount,
        counterparty: row.counterparty,
        details: row.details,
        categoryKey: categoryMeta?.key || null,
        budgetGroup: categoryMeta?.budget_group || null,
        analysisCategory:
          row.analysis_category === "income_structural" ||
          row.analysis_category === "income_variable"
            ? row.analysis_category
            : null,
      });
      const incomeBucket = classifyIncome(row, categoryMeta);

      addIncomeToBreakdown(income, incomeBucket, amount);
      if (semantics.countsAsIncome) {
        income.total += amount;
      }
      if (semantics.kind === "expense_refund" && semantics.expenseOffsetBucket) {
        applyExpenseDelta(
          expenses,
          semantics.expenseOffsetBucket,
          -amount,
          row,
          categoryMeta,
        );
      }
      continue;
    }

    const bucket = resolveExpenseBucket(row, categoryMeta);
    applyExpenseDelta(expenses, bucket, Math.abs(amount), row, categoryMeta);
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
  income.windfalls = round2(income.windfalls);
  income.costRefunds = round2(income.costRefunds);
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
  const planningTimeline = resolveBudgetPlanningTimeline(
    referenceDay,
    timelineReferenceDay,
  );
  const baselineObservationEndExclusive =
    planningTimeline.observationEndExclusive;
  const observedDataEndExclusive = planningTimeline.observedDataEndExclusive;
  const trendStart = subtractDays(
    baselineObservationEndExclusive,
    TREND_WINDOW_DAYS,
  );
  const monthStart = planningTimeline.selectedMonthStart;
  const monthEndExclusive = endOfMonthExclusive(referenceDay);

  const weekRanges = buildMonthWeekRanges(monthStart, monthEndExclusive);
  const weekWindowStart = weekRanges.length ? weekRanges[0].start : monthStart;
  const weekWindowEndExclusive = weekRanges.length
    ? weekRanges[weekRanges.length - 1].endExclusive
    : monthEndExclusive;

  const previousMonthStart = startOfMonth(subtractDays(monthStart, 1));
  const prePreviousMonthStart = startOfMonth(subtractDays(previousMonthStart, 1));
  const nextMonthStart = startOfMonth(monthEndExclusive);

  const dataStart = trendStart < weekWindowStart ? trendStart : weekWindowStart;
  const dataEndExclusive = planningTimeline.isFuturePlanningMonth
    ? observedDataEndExclusive
    : baselineObservationEndExclusive > weekWindowEndExclusive
      ? baselineObservationEndExclusive
      : weekWindowEndExclusive;

  const trendStartIso = dateToIso(trendStart);
  const trendEndIso = dateToIso(baselineObservationEndExclusive);
  const observedDataEndIso = dateToIso(observedDataEndExclusive);
  const monthStartIso = dateToIso(monthStart);
  const weekWindowStartIso = dateToIso(weekWindowStart);
  const weekWindowEndIso = dateToIso(weekWindowEndExclusive);
  const prePreviousMonthStartIso = dateToIso(prePreviousMonthStart);
  const previousMonthStartIso = dateToIso(previousMonthStart);
  const nextMonthStartIso = dateToIso(nextMonthStart);

  const [
    categoryMap,
    transactions,
    settings,
    categoryOverrides,
    currentMonthBudgetValues,
    prePreviousMonthBudgetValues,
    previousMonthBudgetValues,
    nextMonthBudgetValues,
  ] = await Promise.all([
    fetchCategoryMap(),
    fetchTransactionsInRange(dateToIso(dataStart), dateToIso(dataEndExclusive)),
    getBudgetPlanSettings(planKey),
    getBudgetCategoryOverrides(planKey),
    getMonthlyBudgetValues(monthStartIso, planKey),
    getMonthlyBudgetValues(prePreviousMonthStartIso, planKey),
    getMonthlyBudgetValues(previousMonthStartIso, planKey),
    getMonthlyBudgetValues(nextMonthStartIso, planKey),
  ]);

  const trendRows = transactions.filter(
    (row) => row.date >= trendStartIso && row.date < trendEndIso,
  );
  const monthRows = transactions.filter(
    (row) => row.date >= monthStartIso && row.date < observedDataEndIso,
  );
  const weekRows = transactions.filter(
    (row) => row.date >= weekWindowStartIso && row.date < weekWindowEndIso,
  );
  const includedTrendRows = trendRows.filter((row) =>
    isTransactionIncludedInLegacyBudgetScope({
      budgetExcluded: row.budget_excluded,
      analysisMainGroup: row.analysis_main_group,
      analysisCategory: row.analysis_category,
    }),
  );
  const includedMonthRows = monthRows.filter((row) =>
    isTransactionIncludedInLegacyBudgetScope({
      budgetExcluded: row.budget_excluded,
      analysisMainGroup: row.analysis_main_group,
      analysisCategory: row.analysis_category,
    }),
  );
  const includedWeekRows = weekRows.filter((row) =>
    isTransactionIncludedInLegacyBudgetScope({
      budgetExcluded: row.budget_excluded,
      analysisMainGroup: row.analysis_main_group,
      analysisCategory: row.analysis_category,
    }),
  );
  const excludedMonthRows = monthRows.filter((row) =>
    isTransactionExcludedFromLegacyBudgetScope({
      budgetExcluded: row.budget_excluded,
      analysisMainGroup: row.analysis_main_group,
      analysisCategory: row.analysis_category,
    }),
  );

  const observedDays = daysBetween(trendStart, baselineObservationEndExclusive);
  const daysInCurrentMonth = daysBetween(monthStart, monthEndExclusive);
  const monthlyScale = MONTHLY_NORMALIZER_DAYS / observedDays;

  const trendRaw = computeBreakdowns(includedTrendRows, categoryMap);
  const monthToDateRaw = computeBreakdowns(includedMonthRows, categoryMap);
  const monthToDate = {
    income: applyIncomeInclusion(monthToDateRaw.income, settings),
    expenses: monthToDateRaw.expenses,
  };
  const monthProgress = Math.min(
    1,
    Math.max(
      0,
      daysBetween(monthStart, baselineObservationEndExclusive) /
        daysBetween(monthStart, monthEndExclusive),
    ),
  );

  const recentIncomeForecast =
    resolveIncomeForecastFromCompletedMonths(
      includedTrendRows,
      categoryMap,
      settings,
      trendStart,
      planningTimeline.completedMonthCutoffStart,
    ) || null;
  const completedMonthExpenseBaselines =
    resolveExpenseBaselinesFromCompletedMonths(
      includedTrendRows,
      categoryMap,
      trendStart,
      planningTimeline.completedMonthCutoffStart,
    );
  const trendIncome =
    recentIncomeForecast ||
    applyIncomeInclusion(multiplyIncomeBy(trendRaw.income, monthlyScale), settings);
  const trendExpenses: BudgetExpenseBreakdown = {
    fixedCosts:
      completedMonthExpenseBaselines.get("fixed_costs") ??
      round2(trendRaw.expenses.fixedCosts * monthlyScale),
    subscriptions:
      completedMonthExpenseBaselines.get("subscriptions") ??
      round2(trendRaw.expenses.subscriptions * monthlyScale),
    variableCosts:
      completedMonthExpenseBaselines.get("variable_costs") ??
      round2(trendRaw.expenses.variableCosts * monthlyScale),
    savingsTransfer: round2(trendRaw.expenses.savingsTransfer * monthlyScale),
    total: 0,
    variable: {
      groceries:
        completedMonthExpenseBaselines.get("groceries") ??
        round2(trendRaw.expenses.variable.groceries * monthlyScale),
      fuel:
        completedMonthExpenseBaselines.get("fuel") ??
        round2(trendRaw.expenses.variable.fuel * monthlyScale),
      smoking:
        completedMonthExpenseBaselines.get("smoking") ??
        round2(trendRaw.expenses.variable.smoking * monthlyScale),
      other:
        completedMonthExpenseBaselines.get("other") ??
        round2(trendRaw.expenses.variable.other * monthlyScale),
      total: 0,
    },
  };
  trendExpenses.variable.total = round2(
    trendExpenses.variable.groceries +
      trendExpenses.variable.fuel +
      trendExpenses.variable.smoking +
      trendExpenses.variable.other,
  );
  trendExpenses.variableCosts = trendExpenses.variable.total;
  trendExpenses.total = round2(
    trendExpenses.fixedCosts +
      trendExpenses.subscriptions +
      trendExpenses.variableCosts +
      trendExpenses.savingsTransfer,
  );
  const trend: BudgetTrendSnapshot = {
    windowDays: TREND_WINDOW_DAYS,
    observedDays,
    monthlyScale: round2(monthlyScale),
    income: trendIncome,
    expenses: trendExpenses,
    net: round2(trendIncome.total - trendExpenses.total),
  };

  const expectedIncomeMonthly = round2(
    Math.max(
      monthToDate.income.total,
      resolveExpectedIncomeMonthlyFromCompletedMonths(
        includedTrendRows,
        categoryMap,
        settings,
        trendStart,
        planningTimeline.completedMonthCutoffStart,
      ) ?? trend.income.total,
    ),
  );
  const completedMonthBudgetInsight = buildCompletedMonthBudgetInsight(
    includedTrendRows,
    categoryMap,
    settings,
    trendStart,
    planningTimeline.completedMonthCutoffStart,
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
    const completedMonthBaseline =
      completedMonthExpenseBaselines.get(categoryKey);
    const baselineValue =
      completedMonthBaseline != null
        ? completedMonthBaseline
        : getTrendBaselineForCategory(
            categoryKey,
            trend,
            expectedIncomeMonthly,
          );

    baselineByKey.set(categoryKey, round2(baselineValue));
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
        overrideSource:
          monthlyValue.lockTrend === true ? "trend_lock" : "monthly_override",
      };
    }

    if (
      !autoManagedVariableCategory &&
      override?.monthlyTargetOverride != null
    ) {
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
      weeklyBudget: buildAverageWeeklyBudget(monthlyBudget, daysInCurrentMonth),
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
    Math.max(flexibleBudgetCapacity - variableBaselineBudget, 0),
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
    appliedSavingsTarget = roundEuro(
      Math.max(settings.savingsTargetMonthly, 0),
    );
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
  const variableAllocationWeights = new Map<BudgetCategoryKey, number>();
  let explicitSubcategoryBudget = 0;

  for (const key of variableSubkeys) {
    const baselineMonthly = baselineByKey.get(key) || 0;
    const override = overridesByKey.get(key);
    const monthlyValue = monthValuesByKey.get(key);
    const autoManagedVariableCategory = settings.mode !== "custom";

    if (monthlyValue?.lockTrend === true) {
      const monthlyBudget = roundEuro(
        Math.max(monthlyValue?.monthlyBudget ?? baselineMonthly, 0),
      );
      explicitSubcategoryBudget += monthlyBudget;
      setRecommendation(key, {
        monthlyBudget,
        appliedFactor:
          baselineMonthly > 0
            ? monthlyBudget / baselineMonthly
            : settings.adjustmentFactor,
        overrideSource:
          monthlyValue?.lockTrend === true ? "trend_lock" : "monthly_override",
        });
      continue;
    }

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

    if (
      !autoManagedVariableCategory &&
      override?.monthlyTargetOverride != null
    ) {
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

    if (monthlyValue && autoManagedVariableCategory) {
      variableAllocationWeights.set(
        key,
        roundEuro(Math.max(monthlyValue.monthlyBudget, 0)),
      );
    }

    unresolvedSubkeys.push(key);
  }

  const remainingVariablePool = Math.max(
    variableInput.monthlyBudget - explicitSubcategoryBudget,
    0,
  );

  if (unresolvedSubkeys.length > 0) {
    const unresolvedWeightTotal = unresolvedSubkeys.reduce(
      (sum, key) =>
        sum +
        (variableAllocationWeights.get(key) ?? (baselineByKey.get(key) || 0)),
      0,
    );

    let allocated = 0;
    unresolvedSubkeys.forEach((key, index) => {
      const baselineMonthly = baselineByKey.get(key) || 0;
      const allocationWeight =
        variableAllocationWeights.get(key) ?? baselineMonthly;
      const share =
        unresolvedWeightTotal > 0
          ? allocationWeight / unresolvedWeightTotal
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
        overrideSource: variableAllocationWeights.has(key)
          ? "monthly_override"
          : "settings",
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

  const weeklyBudgetTotal = buildAverageWeeklyBudget(
    monthlyBudgetTotal,
    daysInCurrentMonth,
  );

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
  const currentMonthVariableMainCategoryBudgets =
    buildVariableMainCategoryBudgetMapFromRecommendations(recommendations);
  const fallbackVariableMainCategoryBudgets =
    currentMonthVariableMainCategoryBudgets;

  const previousMonthVariableMainCategoryBudgets =
    buildVariableMainCategoryBudgetMapForMonth({
      monthValues: previousMonthBudgetValues,
      fallbackBudgets: fallbackVariableMainCategoryBudgets,
      fallbackVariableBudget: fallbackVariableMonthlyBudget,
    });
  const prePreviousMonthVariableMainCategoryBudgets =
    buildVariableMainCategoryBudgetMapForMonth({
      monthValues: prePreviousMonthBudgetValues,
      fallbackBudgets: previousMonthVariableMainCategoryBudgets,
      fallbackVariableBudget: sumVariableMainCategoryBudgetMap(
        previousMonthVariableMainCategoryBudgets,
      ),
    });
  const nextMonthVariableMainCategoryBudgets =
    buildVariableMainCategoryBudgetMapForMonth({
      monthValues: nextMonthBudgetValues,
      fallbackBudgets: fallbackVariableMainCategoryBudgets,
      fallbackVariableBudget: fallbackVariableMonthlyBudget,
    });

  const variableMainCategoryBudgetByMonthStartIso = new Map<
    string,
    Map<VariableMainCategory, number>
  >([
    [previousMonthStartIso, previousMonthVariableMainCategoryBudgets],
    [monthStartIso, currentMonthVariableMainCategoryBudgets],
    [nextMonthStartIso, nextMonthVariableMainCategoryBudgets],
  ]);

  const variableMonthlyBudgetByMonthStartIso =
    buildVariableMonthlyBudgetByMonthStartIso({
      variableMainCategoryBudgetByMonthStartIso,
    });

  const excludedMainCategoriesFromRebalance =
    resolveLockedVariableMainCategories(recommendations) as Set<VariableMainCategory>;

  let weeklyVariablePlan = computeWeeklyVariablePlan(
    includedWeekRows,
    categoryMap,
    weekRanges,
    timelineReferenceDay,
    variableMonthlyBudgetByMonthStartIso,
    monthStart,
    excludedMainCategoriesFromRebalance,
  );

  const weeklySpendBreakdown = buildWeeklySpendBreakdown(
    includedWeekRows,
    categoryMap,
    weekRanges,
  );
  let weeklyBudgetBreakdown = buildWeeklyBudgetBreakdown({
    weeklyVariablePlan,
    weekRanges,
    variableMainCategoryBudgetByMonthStartIso,
    currentMonthStart: monthStart,
    lockedCategoryKeys: excludedMainCategoriesFromRebalance,
  });

  const overlapCarryover = resolveFutureMonthOverlapCarryover({
    planningTimeline,
    timelineReferenceDay,
    transactions,
    categoryMap,
    selectedWeekRanges: weekRanges,
    previousMonthStart,
    selectedMonthStart: monthStart,
    prePreviousMonthVariableMainCategoryBudgets,
    previousMonthVariableMainCategoryBudgets,
    selectedMonthVariableMainCategoryBudgets:
      currentMonthVariableMainCategoryBudgets,
    previousMonthLockedCategoryKeys:
      resolveLockedVariableMainCategoriesFromMonthValues(
        previousMonthBudgetValues,
      ),
  });

  if (overlapCarryover && weeklyVariablePlan.length && weeklyBudgetBreakdown.length) {
    weeklyVariablePlan = weeklyVariablePlan.map((row, index) =>
      index === 0 ? overlapCarryover.weekPlan : row,
    );
    weeklyBudgetBreakdown = weeklyBudgetBreakdown.map((row, index) =>
      index === 0 ? overlapCarryover.weekBudgetBreakdown : row,
    );
  }

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
    completedMonthBaselineThrough:
      planningTimeline.isFuturePlanningMonth
        ? planningTimeline.completedMonthBaselineThrough
        : null,
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
    projectedMonthNet: round2(projectedMonthNet),
    flowSummary,
    weeklyVariablePlan,
    weeklyBudgetBreakdown,
    weeklySpendBreakdown,
    outsideBudgetExpenses,
    expenseDetails,
    savingsProgress,
    coachReport,
  };
}
