require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

const PAGE_SIZE = 500;
const TREND_WINDOW_DAYS = 90;
const MONTHLY_NORMALIZER_DAYS = 30.4375;

const DEFAULT_MODE = "active_savings";
const DEFAULT_ADJUSTMENT_FACTOR = 0.9;
const DEFAULT_APPLY_SAVINGS_TARGET_TO_VARIABLE_BUDGET = false;
const DEFAULT_SAVINGS_TARGET_MONTHLY = 0;
const SAVINGS_TARGET_STEP = 25;
const DEFAULT_INCLUDE_INCOME = {
  salary: true,
  childBudget: true,
  structuralOther: false,
  variable: false,
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

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function roundEuro(value) {
  return Math.round(value);
}

function snapToEuroStep(value, step = SAVINGS_TARGET_STEP) {
  if (step <= 0) return roundEuro(Math.max(value, 0));
  return Math.max(0, Math.round(value / step) * step);
}

function startOfUtcDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthExclusive(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function subtractDays(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function startOfUtcWeekMonday(date) {
  const dayStart = startOfUtcDay(date);
  const weekday = dayStart.getUTCDay();
  const offsetFromMonday = weekday === 0 ? 6 : weekday - 1;
  return subtractDays(dayStart, offsetFromMonday);
}

function dateToIso(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDateUtc(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function daysBetween(startInclusive, endExclusive) {
  const ms = endExclusive.getTime() - startInclusive.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function normalizePattern(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategoryKey(categoryKey) {
  return String(categoryKey || "").toLowerCase();
}

function getHaystack(tx) {
  return normalizePattern(`${tx.counterparty || ""} ${tx.details || ""}`);
}

function isSavingsCategoryKey(categoryKey) {
  return (
    categoryKey === "savings" ||
    categoryKey === "savings_transfer" ||
    categoryKey.startsWith("savings_")
  );
}

function isSubscriptionCategoryKey(categoryKey) {
  return (
    categoryKey === "subscriptions" ||
    categoryKey.startsWith("subscriptions_") ||
    categoryKey.startsWith("subscription_")
  );
}

function isVariableBudgetCategoryKey(categoryKey) {
  return (
    categoryKey === "variable_costs" ||
    categoryKey === "groceries" ||
    categoryKey === "fuel" ||
    categoryKey === "smoking" ||
    categoryKey === "other"
  );
}

function isFixedCategoryKey(categoryKey) {
  return (
    categoryKey.startsWith("housing") ||
    categoryKey.startsWith("care_health_insurance") ||
    categoryKey.startsWith("insurance_health") ||
    categoryKey.startsWith("health_insurance") ||
    categoryKey.startsWith("auto_transport_car_insurance") ||
    categoryKey.startsWith("auto_transport_road_tax")
  );
}

function resolveExpenseBucket(tx, categoryMeta) {
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

function resolveVariableSubbucket(tx, categoryMeta) {
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

function classifyIncome(tx, categoryMeta) {
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

function emptyIncomeBreakdown() {
  return {
    salary: 0,
    childBudget: 0,
    structuralOther: 0,
    variable: 0,
    total: 0,
  };
}

function emptyExpenseBreakdown() {
  return {
    fixedCosts: 0,
    subscriptions: 0,
    variableCosts: 0,
    savingsTransfer: 0,
    total: 0,
    variable: {
      groceries: 0,
      fuel: 0,
      smoking: 0,
      other: 0,
      total: 0,
    },
  };
}

function multiplyIncomeBy(value, factor) {
  return {
    salary: round2(value.salary * factor),
    childBudget: round2(value.childBudget * factor),
    structuralOther: round2(value.structuralOther * factor),
    variable: round2(value.variable * factor),
    total: round2(value.total * factor),
  };
}

function multiplyExpensesBy(value, factor) {
  return {
    fixedCosts: round2(value.fixedCosts * factor),
    subscriptions: round2(value.subscriptions * factor),
    variableCosts: round2(value.variableCosts * factor),
    savingsTransfer: round2(value.savingsTransfer * factor),
    total: round2(value.total * factor),
    variable: {
      groceries: round2(value.variable.groceries * factor),
      fuel: round2(value.variable.fuel * factor),
      smoking: round2(value.variable.smoking * factor),
      other: round2(value.variable.other * factor),
      total: round2(value.variable.total * factor),
    },
  };
}

function resolveIncludedIncomeTotal(income, settings) {
  let total = 0;
  if (settings.includeIncome.salary) total += income.salary;
  if (settings.includeIncome.childBudget) total += income.childBudget;
  if (settings.includeIncome.structuralOther) total += income.structuralOther;
  if (settings.includeIncome.variable) total += income.variable;
  return round2(total);
}

function applyIncomeInclusion(income, settings) {
  return {
    ...income,
    total: resolveIncludedIncomeTotal(income, settings),
  };
}

function monthKeyFromIsoDate(isoDate) {
  return String(isoDate || "").slice(0, 7);
}

function monthStartFromKey(monthKey) {
  const [yearRaw, monthRaw] = String(monthKey).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function computeIncludedIncomeTotalsByMonth(rows, categoryMap, settings) {
  const byMonth = new Map();

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

  const totals = new Map();
  for (const [key, income] of byMonth) {
    totals.set(key, round2(applyIncomeInclusion(income, settings).total));
  }
  return totals;
}

function resolveExpectedIncomeMonthlyFromCompletedMonths(
  rows,
  categoryMap,
  settings,
  trendStart,
  currentMonthStart,
) {
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
    .filter((row) => Boolean(row))
    .filter(
      (row) =>
        row.monthStart < currentMonthStart && row.monthStart >= trendStart,
    )
    .sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime());

  const recentTotals = completedMonths
    .filter((row) => row.total > 0)
    .slice(0, 3);

  if (!recentTotals.length) return null;
  return round2(median(recentTotals.map((row) => row.total)));
}

function getBudgetCategoryActual(categoryKey, expenses) {
  if (categoryKey === "fixed_costs") return expenses.fixedCosts;
  if (categoryKey === "subscriptions") return expenses.subscriptions;
  if (categoryKey === "variable_costs") return expenses.variableCosts;
  if (categoryKey === "groceries") return expenses.variable.groceries;
  if (categoryKey === "fuel") return expenses.variable.fuel;
  if (categoryKey === "smoking") return expenses.variable.smoking;
  if (categoryKey === "other") return expenses.variable.other;
  return 0;
}

function computeExpenseTotalsByMonth(rows, categoryMap) {
  const byMonth = new Map();

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

  const totals = new Map();
  for (const [monthKey, expenses] of byMonth) {
    totals.set(monthKey, {
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
    });
  }

  return totals;
}

function resolveExpenseBaselinesFromCompletedMonths(
  rows,
  categoryMap,
  trendStart,
  currentMonthStart,
) {
  const totalsByMonth = computeExpenseTotalsByMonth(rows, categoryMap);
  const completedMonths = [...totalsByMonth.entries()]
    .map(([monthKey, expenses]) => {
      const monthStart = monthStartFromKey(monthKey);
      return monthStart ? { monthStart, expenses } : null;
    })
    .filter((row) => Boolean(row))
    .filter(
      (row) =>
        row.monthStart < currentMonthStart && row.monthStart >= trendStart,
    )
    .sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime())
    .slice(0, 3);

  const baselines = new Map();
  if (!completedMonths.length) return baselines;

  for (const key of [
    "fixed_costs",
    "subscriptions",
    "variable_costs",
    "groceries",
    "fuel",
    "smoking",
    "other",
  ]) {
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

function calculateRelativeVolatility(values) {
  if (values.length < 2) return 0;
  const baseline = Math.max(median(values), 1);
  const spread = Math.max(...values) - Math.min(...values);
  return Math.min(Math.max(spread / baseline, 0), 1.5);
}

function buildCompletedMonthBudgetInsight(
  rows,
  categoryMap,
  settings,
  trendStart,
  currentMonthStart,
) {
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
    .filter((row) => Boolean(row))
    .filter(
      (row) =>
        row.monthStart < currentMonthStart && row.monthStart >= trendStart,
    )
    .sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime())
    .slice(0, 3);

  const recentIncomeTotals = [];
  const recentVariableTotals = [];
  const recentSavingsCapacityTotals = [];

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
}) {
  const positiveProjectedNet = Math.max(projectedMonthlyCoreNet, 0);
  const historicalMedian = insight.recentSavingsCapacityTotals.length
    ? median(insight.recentSavingsCapacityTotals)
    : savingsPotential;

  const recentVariableMedian = insight.recentVariableTotals.length
    ? median(insight.recentVariableTotals)
    : variableBaselineBudget;
  const variableReference = Math.min(
    flexibleBudgetCapacity,
    Math.max(
      recentVariableMedian > 0 ? recentVariableMedian : variableBaselineBudget,
      0,
    ),
  );
  const activeCapacity = Math.max(
    flexibleBudgetCapacity -
      Math.min(
        flexibleBudgetCapacity,
        Math.max(
          Math.min(250, flexibleBudgetCapacity),
          Math.max(variableReference * 0.78, flexibleBudgetCapacity * 0.45),
        ),
      ),
    0,
  );
  const balancedCapacity = Math.max(
    flexibleBudgetCapacity -
      Math.min(
        flexibleBudgetCapacity,
        Math.max(
          Math.min(325, flexibleBudgetCapacity),
          Math.max(variableReference * 0.93, flexibleBudgetCapacity * 0.7),
        ),
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
  const riskPenalty = Math.min(
    Math.max(
      insight.incomeVolatility * 0.18 +
        insight.variableVolatility * 0.22 +
        (positiveProjectedNet <= 0 ? 0.08 : 0) +
        (monthProgress >= 0.5 && positiveProjectedNet < realisticCenter
          ? 0.08
          : 0),
      0,
    ),
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
    activeTarget: Math.min(Math.max(activeTarget, 0), activeCapacity),
    balancedTarget: Math.min(Math.max(balancedTarget, 0), balancedCapacity),
  };
}

function getTrendBaselineForCategory(
  key,
  trend,
  expectedIncomeMonthly = trend.income.total,
) {
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

function defaultFactorForCategory(categoryKey, settings) {
  if (categoryKey === "fixed_costs" || categoryKey === "subscriptions") {
    return 1;
  }
  if (categoryKey === "variable_costs") {
    return settings.adjustmentFactor;
  }
  return 1;
}

function resolveUtilization(actual, budget) {
  if (budget <= 0) return actual > 0 ? Number.POSITIVE_INFINITY : 0;
  return actual / budget;
}

function buildMonthWeekRanges(monthStart, monthEndExclusive) {
  const resolveOverlapDayCounts = (rangeStart) => {
    let daysInCurrentMonth = 0;
    let daysInPreviousMonth = 0;
    let daysInNextMonth = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const day = addDays(rangeStart, dayOffset);
      if (day < monthStart) {
        daysInPreviousMonth += 1;
        continue;
      }
      if (day >= monthEndExclusive) {
        daysInNextMonth += 1;
        continue;
      }
      daysInCurrentMonth += 1;
    }

    return {
      daysInCurrentMonth,
      daysInPreviousMonth,
      daysInNextMonth,
      crossesMonthBoundary: daysInPreviousMonth > 0 || daysInNextMonth > 0,
    };
  };

  const firstWeekStart = startOfUtcWeekMonday(monthStart);
  const lastWeekStart = startOfUtcWeekMonday(
    subtractDays(monthEndExclusive, 1),
  );
  const weekWindowEndExclusive = addDays(lastWeekStart, 7);

  const ranges = [];
  let cursor = firstWeekStart;
  let weekNumber = 1;

  while (cursor < weekWindowEndExclusive) {
    const endExclusive = addDays(cursor, 7);
    const overlap = resolveOverlapDayCounts(cursor);
    ranges.push({
      weekNumber,
      label: `Week ${weekNumber}`,
      start: cursor,
      endExclusive,
      ...overlap,
    });
    cursor = endExclusive;
    weekNumber += 1;
  }

  return ranges;
}

function computeWeeklyVariablePlanWithTrace(
  weekRows,
  categoryMap,
  weekRanges,
  referenceDay,
  variableMonthlyBudgetByMonthStartIso,
  currentMonthStart,
) {
  const ranges = weekRanges;
  const fallbackMonthBudget = roundEuro(
    Math.max(
      variableMonthlyBudgetByMonthStartIso.get(dateToIso(currentMonthStart)) ||
        0,
      0,
    ),
  );

  const resolveDailyVariableBudget = (day) => {
    const dayMonthStart = startOfMonth(day);
    const monthStartIso = dateToIso(dayMonthStart);
    const monthBudget = roundEuro(
      Math.max(
        variableMonthlyBudgetByMonthStartIso.get(monthStartIso) ??
          fallbackMonthBudget,
        0,
      ),
    );
    const daysInMonth = daysBetween(
      dayMonthStart,
      endOfMonthExclusive(dayMonthStart),
    );
    return daysInMonth > 0 ? monthBudget / daysInMonth : 0;
  };

  const baseWeeklyBudgetByIndex = ranges.map((range) => {
    let budget = 0;
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      budget += resolveDailyVariableBudget(addDays(range.start, dayOffset));
    }
    return roundEuro(budget);
  });

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

  let remainingPool = baseWeeklyBudgetByIndex.reduce(
    (sum, budget) => sum + budget,
    0,
  );
  let remainingWeight = baseWeeklyBudgetByIndex.reduce(
    (sum, budget) => sum + Math.max(budget, 0),
    0,
  );
  const rows = [];
  const trace = [];

  ranges.forEach((range, index) => {
    const weekWeight = Math.max(baseWeeklyBudgetByIndex[index], 0);
    const poolBefore = remainingPool;
    const budget =
      remainingWeight <= weekWeight
        ? roundEuro(Math.max(remainingPool, 0))
        : roundEuro(
            Math.max(
              (remainingPool * weekWeight) / Math.max(remainingWeight, 1),
              0,
            ),
          );
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
        referenceDay >= range.start && referenceDay < range.endExclusive,
      isPastWeek: referenceDay >= range.endExclusive,
      wasRebalanced:
        index > 0 && Math.abs(budget - baseWeeklyBudgetByIndex[index]) >= 1,
      overrunAmount,
      daysInCurrentMonth: range.daysInCurrentMonth,
      daysInPreviousMonth: range.daysInPreviousMonth,
      daysInNextMonth: range.daysInNextMonth,
      crossesMonthBoundary: range.crossesMonthBoundary,
    });

    remainingPool -= Math.max(actual, budget);
    remainingWeight -= weekWeight;

    trace.push({
      weekNumber: range.weekNumber,
      weekDays: 7,
      baseBudget: baseWeeklyBudgetByIndex[index],
      remainingWeightBefore: remainingWeight + weekWeight,
      poolBefore: roundEuro(poolBefore),
      budget,
      actual,
      poolAfter: roundEuro(remainingPool),
    });
  });

  return { rows, trace };
}

function resolveCategoryMetaForTransaction(row, categoryMap) {
  const categoryId = row.category_id_user || row.category_id_auto;
  if (!categoryId) return null;
  return categoryMap.get(categoryId) || null;
}

function computeBreakdowns(rows, categoryMap) {
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

async function fetchTransactionsInRange(startIso, endIso) {
  const rows = [];
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

    const page = (data || []).map((row) => ({
      id: String(row.id || ""),
      date: String(row.date || ""),
      amount: asNumber(row.amount, 0),
      details: String(row.details || ""),
      counterparty: row.counterparty ? String(row.counterparty) : null,
      analysis_main_group: row.analysis_main_group || null,
      analysis_category: row.analysis_category || null,
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

async function fetchCategoryMap() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,key,name,budget_group");

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
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

async function getBudgetPlanSettings(planKey = "default") {
  const { data, error } = await supabase
    .from("budget_plan_settings")
    .select("*")
    .eq("plan_key", planKey)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      planKey,
      mode: DEFAULT_MODE,
      adjustmentFactor: DEFAULT_ADJUSTMENT_FACTOR,
      includeIncome: { ...DEFAULT_INCLUDE_INCOME },
      applySavingsTargetToVariableBudget:
        DEFAULT_APPLY_SAVINGS_TARGET_TO_VARIABLE_BUDGET,
      savingsTargetMonthly: DEFAULT_SAVINGS_TARGET_MONTHLY,
    };
  }

  const modeRaw = String(data.mode || DEFAULT_MODE);
  const mode =
    modeRaw === "active_savings" ||
    modeRaw === "balanced" ||
    modeRaw === "custom"
      ? modeRaw
      : DEFAULT_MODE;

  const adjustmentFactorRaw = Number(data.adjustment_factor);
  const adjustmentFactor =
    Number.isFinite(adjustmentFactorRaw) &&
    adjustmentFactorRaw > 0 &&
    adjustmentFactorRaw <= 1.5
      ? adjustmentFactorRaw
      : DEFAULT_ADJUSTMENT_FACTOR;

  return {
    planKey,
    mode,
    adjustmentFactor,
    applySavingsTargetToVariableBudget:
      data.apply_savings_target_to_variable_budget == null
        ? DEFAULT_APPLY_SAVINGS_TARGET_TO_VARIABLE_BUDGET
        : Boolean(data.apply_savings_target_to_variable_budget),
    savingsTargetMonthly:
      data.savings_target_monthly == null
        ? DEFAULT_SAVINGS_TARGET_MONTHLY
        : Math.max(Number(data.savings_target_monthly) || 0, 0),
    includeIncome: {
      salary:
        data.include_income_salary == null
          ? DEFAULT_INCLUDE_INCOME.salary
          : Boolean(data.include_income_salary),
      childBudget:
        data.include_income_child_budget == null
          ? DEFAULT_INCLUDE_INCOME.childBudget
          : Boolean(data.include_income_child_budget),
      structuralOther:
        data.include_income_structural_other == null
          ? DEFAULT_INCLUDE_INCOME.structuralOther
          : Boolean(data.include_income_structural_other),
      variable:
        data.include_income_variable == null
          ? DEFAULT_INCLUDE_INCOME.variable
          : Boolean(data.include_income_variable),
    },
  };
}

async function getBudgetCategoryOverrides(planKey = "default") {
  const { data, error } = await supabase
    .from("budget_category_overrides")
    .select("plan_key,category_key,monthly_target_override,factor_override")
    .eq("plan_key", planKey);

  if (error) throw error;

  return (data || []).map((row) => ({
    categoryKey: String(row.category_key || ""),
    monthlyTargetOverride:
      row.monthly_target_override == null
        ? null
        : Number(row.monthly_target_override),
    factorOverride:
      row.factor_override == null ? null : Number(row.factor_override),
  }));
}

async function getMonthlyBudgetValues(monthStartIso, planKey = "default") {
  const { data, error } = await supabase
    .from("monthly_budget_values")
    .select("plan_key,month_start,category_key,monthly_budget,source")
    .eq("plan_key", planKey)
    .eq("month_start", monthStartIso)
    .order("category_key", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    categoryKey: String(row.category_key || ""),
    monthlyBudget: Math.max(Number(row.monthly_budget) || 0, 0),
    source: String(row.source || "manual"),
  }));
}

function createBudgetInputResolver(
  overridesByKey,
  monthValuesByKey,
  baselineByKey,
  settings,
) {
  return function resolveBudgetInput(
    categoryKey,
    defaultBudget,
    defaultFactor,
    defaultSource,
    allowFactorOverride = true,
  ) {
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

    if (
      !autoManagedVariableCategory &&
      override &&
      override.monthlyTargetOverride != null
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
      override &&
      override.factorOverride != null
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
}

(async () => {
  const planKey = "default";
  const reference = new Date(Date.UTC(2026, 2, 31));
  const referenceDay = startOfUtcDay(reference);
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
    currentMonthValues,
    previousMonthValues,
    nextMonthValues,
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

  const observedDays = daysBetween(trendStart, trendEndExclusive);
  const monthlyScale = MONTHLY_NORMALIZER_DAYS / observedDays;

  const trendRaw = computeBreakdowns(includedTrendRows, categoryMap);
  const trendIncome = applyIncomeInclusion(
    multiplyIncomeBy(trendRaw.income, monthlyScale),
    settings,
  );
  const trendExpenses = multiplyExpensesBy(trendRaw.expenses, monthlyScale);
  const trend = {
    income: trendIncome,
    expenses: trendExpenses,
  };
  const monthToDateRaw = computeBreakdowns(includedMonthRows, categoryMap);
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

  const overridesByKey = new Map(
    categoryOverrides.map((item) => [item.categoryKey, item]),
  );
  const monthValuesByKey = new Map(
    currentMonthValues.map((item) => [item.categoryKey, item]),
  );

  const baselineByKey = new Map();
  const completedExpenseBaselines = resolveExpenseBaselinesFromCompletedMonths(
    includedTrendRows,
    categoryMap,
    trendStart,
    monthStart,
  );
  for (const key of [
    "fixed_costs",
    "subscriptions",
    "variable_costs",
    "groceries",
    "fuel",
    "smoking",
    "other",
    "savings_target",
  ]) {
    baselineByKey.set(
      key,
      round2(
        completedExpenseBaselines.get(key) ??
          getTrendBaselineForCategory(key, trend, expectedIncomeMonthly),
      ),
    );
  }
  const completedMonthBudgetInsight = buildCompletedMonthBudgetInsight(
    includedTrendRows,
    categoryMap,
    settings,
    trendStart,
    monthStart,
  );

  const resolveBudgetInput = createBudgetInputResolver(
    overridesByKey,
    monthValuesByKey,
    baselineByKey,
    settings,
  );

  const fixedInput = resolveBudgetInput(
    "fixed_costs",
    (baselineByKey.get("fixed_costs") || 0) *
      defaultFactorForCategory("fixed_costs", settings),
    defaultFactorForCategory("fixed_costs", settings),
    "trend",
  );

  const subscriptionInput = resolveBudgetInput(
    "subscriptions",
    (baselineByKey.get("subscriptions") || 0) *
      defaultFactorForCategory("subscriptions", settings),
    defaultFactorForCategory("subscriptions", settings),
    "trend",
  );

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
  const savingsPotential = roundEuro(
    Math.max(flexibleBudgetCapacity - variableBaselineBudget, 0),
  );
  const projectedMonthlyCoreNet =
    monthProgress > 0
      ? (monthToDateRaw.income.total -
          (monthToDateRaw.expenses.fixedCosts +
            monthToDateRaw.expenses.subscriptions +
            monthToDateRaw.expenses.variableCosts)) /
        monthProgress
      : monthToDateRaw.income.total -
        (monthToDateRaw.expenses.fixedCosts +
          monthToDateRaw.expenses.subscriptions +
          monthToDateRaw.expenses.variableCosts);
  const deterministicTargets = resolveDeterministicAutomaticSavingsTargets({
    savingsPotential,
    flexibleBudgetCapacity,
    variableBaselineBudget,
    insight: completedMonthBudgetInsight,
    monthProgress,
    projectedMonthlyCoreNet,
  });
  const appliedSavingsTarget =
    settings.mode === "custom"
      ? roundEuro(Math.max(settings.savingsTargetMonthly, 0))
      : settings.mode === "active_savings"
        ? deterministicTargets.activeTarget
        : deterministicTargets.balancedTarget;
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

  const variableMonthlyBudget = roundEuro(
    Math.max(variableInput.monthlyBudget, 0),
  );

  const resolveVariableMonthlyBudget = (values) => {
    const override = values.find(
      (item) => item.categoryKey === "variable_costs",
    );
    if (!override) return variableMonthlyBudget;
    return roundEuro(Math.max(override.monthlyBudget, 0));
  };

  const variableMonthlyBudgetByMonthStartIso = new Map([
    [previousMonthStartIso, resolveVariableMonthlyBudget(previousMonthValues)],
    [monthStartIso, resolveVariableMonthlyBudget(currentMonthValues)],
    [nextMonthStartIso, resolveVariableMonthlyBudget(nextMonthValues)],
  ]);

  const weekly = computeWeeklyVariablePlanWithTrace(
    includedWeekRows,
    categoryMap,
    weekRanges,
    referenceDay,
    variableMonthlyBudgetByMonthStartIso,
    monthStart,
  );

  const firstWeek = weekly.rows[0] || null;
  const lastWeek = weekly.rows[weekly.rows.length - 1] || null;
  const totalWeeklyBudget = weekly.rows.reduce(
    (sum, row) => sum + row.budget,
    0,
  );
  const totalPoolConsumption = weekly.rows.reduce(
    (sum, row) => sum + Math.max(row.actual, row.budget),
    0,
  );
  const totalBaseBudget = weekly.trace.reduce(
    (sum, item) => sum + (item.baseBudget || 0),
    0,
  );
  const overlapWeeks = weekly.rows.filter((row) => row.crossesMonthBoundary);
  const allWeeksAreSevenDays = weekly.rows.every((row) => {
    const start = parseIsoDateUtc(row.startDate);
    const endExclusive = parseIsoDateUtc(row.endDateExclusive);
    return daysBetween(start, endExclusive) === 7;
  });
  const allWeeksStartOnMonday = weekly.rows.every(
    (row) => parseIsoDateUtc(row.startDate).getUTCDay() === 1,
  );
  const allWeeksEndOnMondayExclusive = weekly.rows.every(
    (row) => parseIsoDateUtc(row.endDateExclusive).getUTCDay() === 1,
  );
  const validateCalendarMonth = (year, monthIndex) => {
    const sampleMonthStart = new Date(Date.UTC(year, monthIndex, 1));
    const sampleMonthEndExclusive = endOfMonthExclusive(sampleMonthStart);
    const sampleRanges = buildMonthWeekRanges(
      sampleMonthStart,
      sampleMonthEndExclusive,
    );

    const allWeeksSevenDays = sampleRanges.every(
      (range) => daysBetween(range.start, range.endExclusive) === 7,
    );
    const firstRange = sampleRanges[0] || null;
    const lastRange = sampleRanges[sampleRanges.length - 1] || null;

    return {
      month: dateToIso(sampleMonthStart).slice(0, 7),
      weekCount: sampleRanges.length,
      allWeeksSevenDays,
      firstStartsMonday: firstRange
        ? firstRange.start.getUTCDay() === 1
        : false,
      lastEndsMondayExclusive: lastRange
        ? lastRange.endExclusive.getUTCDay() === 1
        : false,
      firstHasPrevMonthDays: firstRange
        ? firstRange.daysInPreviousMonth > 0
        : false,
      lastHasNextMonthDays: lastRange ? lastRange.daysInNextMonth > 0 : false,
    };
  };

  const mondayStartSample = validateCalendarMonth(2026, 5);
  const saturdayEndSample = validateCalendarMonth(2026, 0);

  const result = {
    ok: true,
    planKey,
    month: monthStartIso.slice(0, 7),
    referenceDate: dateToIso(referenceDay),
    monthlyVariableBudget: variableMonthlyBudget,
    budgetInputs: {
      expectedIncomeMonthly,
      fixedCostsBudget: fixedInput.monthlyBudget,
      subscriptionsBudget: subscriptionInput.monthlyBudget,
      appliedSavingsTarget,
      savingsTargetSource:
        settings.mode === "custom"
          ? "manual_custom"
          : settings.mode === "active_savings"
            ? "automatic_active"
            : "automatic_balanced",
      variableDefaultBudget: roundEuro(variableDefaultBudget),
      variableOverrideSource: variableInput.overrideSource,
    },
    weekRanges: weekly.rows.map((row) => ({
      weekNumber: row.weekNumber,
      startDate: row.startDate,
      endDateExclusive: row.endDateExclusive,
      daysInCurrentMonth: row.daysInCurrentMonth,
      daysInPreviousMonth: row.daysInPreviousMonth,
      daysInNextMonth: row.daysInNextMonth,
      crossesMonthBoundary: row.crossesMonthBoundary,
    })),
    weeklyVariablePlan: weekly.rows.map((row) => ({
      weekNumber: row.weekNumber,
      budget: row.budget,
      actual: row.actual,
      remaining: row.remaining,
      utilization: Number.isFinite(row.utilization)
        ? round2(row.utilization)
        : null,
      wasRebalanced: row.wasRebalanced,
    })),
    rebalanceTrace: weekly.trace,
    variableMonthlyBudgetByMonth: {
      [previousMonthStartIso]: variableMonthlyBudgetByMonthStartIso.get(
        previousMonthStartIso,
      ),
      [monthStartIso]: variableMonthlyBudgetByMonthStartIso.get(monthStartIso),
      [nextMonthStartIso]:
        variableMonthlyBudgetByMonthStartIso.get(nextMonthStartIso),
    },
    calendarSamples: {
      mondayStartSample,
      saturdayEndSample,
    },
    assertions: {
      weekCountExpected6: weekly.rows.length === 6,
      allWeeksAreSevenDays,
      allWeeksStartOnMonday,
      allWeeksEndOnMondayExclusive,
      firstWeekMatchesCalendarOverlap: firstWeek
        ? firstWeek.startDate === "2026-02-23" &&
          firstWeek.endDateExclusive === "2026-03-02" &&
          firstWeek.daysInPreviousMonth === 6 &&
          firstWeek.daysInCurrentMonth === 1
        : false,
      lastWeekMatchesCalendarOverlap: lastWeek
        ? lastWeek.startDate === "2026-03-30" &&
          lastWeek.endDateExclusive === "2026-04-06" &&
          lastWeek.daysInCurrentMonth === 2 &&
          lastWeek.daysInNextMonth === 5
        : false,
      overlapWeekCountExpected2: overlapWeeks.length === 2,
      overlapWeekMetadataConsistent: overlapWeeks.every(
        (row) =>
          row.daysInCurrentMonth < 7 &&
          (row.daysInPreviousMonth > 0 || row.daysInNextMonth > 0),
      ),
      mondayStartMonthCalendarWeeksValid:
        mondayStartSample.allWeeksSevenDays &&
        mondayStartSample.firstStartsMonday &&
        mondayStartSample.lastEndsMondayExclusive,
      saturdayEndMonthCalendarWeeksValid:
        saturdayEndSample.allWeeksSevenDays &&
        saturdayEndSample.firstStartsMonday &&
        saturdayEndSample.lastEndsMondayExclusive &&
        saturdayEndSample.firstHasPrevMonthDays &&
        saturdayEndSample.lastHasNextMonthDays,
      rebalancePoolEndsAtZero:
        weekly.trace.length > 0
          ? weekly.trace[weekly.trace.length - 1].poolAfter <= 0
          : false,
      totalPoolConsumption,
      rawWeeklyBudgetDeltaFromBase: totalWeeklyBudget - totalBaseBudget,
      rawWeeklyBudgetDeltaFromCurrentMonthBudget:
        totalWeeklyBudget - variableMonthlyBudget,
      firstWeekBudgetActual: firstWeek ? firstWeek.budget : null,
      lastWeekBudgetActual: lastWeek ? lastWeek.budget : null,
    },
  };

  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
});
