type ForecastCategoryMeta = {
  id: string;
  key: string;
};

type ForecastExpenseTxInput = {
  date: string;
  amount: number;
  details: string;
  counterparty: string | null;
  analysis_main_group: "income" | "expense" | null;
  analysis_category:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
  category_id_auto: string | null;
  category_id_user: string | null;
  budget_excluded: boolean;
};

const RECENT_EXPENSE_FORECAST_MONTHS = 2;

function normalizePatternValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
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

type ExpenseMonthTotals = {
  fixedCosts: number;
  subscriptions: number;
  variableCosts: number;
  savingsTransfers: number;
  variable: {
    groceries: number;
    fuel: number;
    smoking: number;
    other: number;
  };
};

function emptyExpenseMonthTotals(): ExpenseMonthTotals {
  return {
    fixedCosts: 0,
    subscriptions: 0,
    variableCosts: 0,
    savingsTransfers: 0,
    variable: {
      groceries: 0,
      fuel: 0,
      smoking: 0,
      other: 0,
    },
  };
}

function getRecentCompletedMonthTotals(
  totalsByMonth: Map<string, ExpenseMonthTotals>,
  currentMonthStart: Date,
  limit: number,
) {
  return [...totalsByMonth.entries()]
    .map(([monthKey, totals]) => {
      const monthStart = monthStartFromKey(monthKey);
      return monthStart ? { monthStart, totals } : null;
    })
    .filter(
      (
        row,
      ): row is {
        monthStart: Date;
        totals: ExpenseMonthTotals;
      } => Boolean(row),
    )
    .filter((row) => row.monthStart < currentMonthStart)
    .sort(
      (left, right) => right.monthStart.getTime() - left.monthStart.getTime(),
    )
    .slice(0, limit);
}

function buildVariableBucket(
  tx: ForecastExpenseTxInput,
  categoryKey: string | null,
): "groceries" | "fuel" | "smoking" | "other" {
  const haystack = normalizePatternValue(
    `${tx.counterparty || ""} ${tx.details || ""}`,
  );

  if (
    haystack.includes("jumbo") ||
    haystack.includes("plus") ||
    haystack.includes("albert heijn") ||
    (categoryKey && categoryKey.includes("groceries"))
  ) {
    return "groceries";
  }

  if (
    haystack.includes("shell") ||
    haystack.includes("bp") ||
    haystack.includes("esso") ||
    haystack.includes("tango") ||
    haystack.includes("tinq") ||
    haystack.includes("total") ||
    (categoryKey && categoryKey.includes("fuel"))
  ) {
    return "fuel";
  }

  if (
    haystack.includes("tabak") ||
    haystack.includes("sigaret") ||
    haystack.includes("rook") ||
    (categoryKey && categoryKey.includes("smoking"))
  ) {
    return "smoking";
  }

  return "other";
}

export function estimateRecentExpenseForecastFromHistory(params: {
  transactions: ForecastExpenseTxInput[];
  categoryMap: Map<string, ForecastCategoryMeta>;
  currentMonthStart: Date;
}) {
  const { transactions, categoryMap, currentMonthStart } = params;
  const totalsByMonth = new Map<string, ExpenseMonthTotals>();

  for (const tx of transactions) {
    if (tx.budget_excluded) continue;
    if (tx.amount >= 0) continue;
    if (tx.analysis_main_group !== "expense") continue;

    const monthKey = monthKeyFromIsoDate(tx.date);
    if (!monthKey || monthKey.length !== 7) continue;

    const current = totalsByMonth.get(monthKey) || emptyExpenseMonthTotals();
    const amount = Math.abs(tx.amount);

    if (tx.analysis_category === "fixed_costs") {
      current.fixedCosts += amount;
    } else if (tx.analysis_category === "subscriptions") {
      current.subscriptions += amount;
    } else if (tx.analysis_category === "savings_transfer") {
      current.savingsTransfers += amount;
    } else if (tx.analysis_category === "variable_costs") {
      const categoryId = tx.category_id_user || tx.category_id_auto;
      const categoryKey = categoryId
        ? categoryMap.get(categoryId)?.key || null
        : null;
      const bucket = buildVariableBucket(tx, categoryKey);
      current.variable[bucket] += amount;
      current.variableCosts += amount;
    } else {
      continue;
    }

    totalsByMonth.set(monthKey, current);
  }

  const currentMonthKey = dateToIso(currentMonthStart).slice(0, 7);
  const currentMonthTotals =
    totalsByMonth.get(currentMonthKey) || emptyExpenseMonthTotals();
  const completedMonths = getRecentCompletedMonthTotals(
    totalsByMonth,
    currentMonthStart,
    RECENT_EXPENSE_FORECAST_MONTHS,
  );

  const resolveBaseline = (
    selector: (totals: ExpenseMonthTotals) => number,
    currentValue: number,
  ) => {
    const values = completedMonths.map((row) => selector(row.totals));
    if (!values.length) return round2(currentValue);
    return round2(Math.max(weightedRecentAverage(values), currentValue));
  };

  const fixedCosts = resolveBaseline(
    (totals) => totals.fixedCosts,
    currentMonthTotals.fixedCosts,
  );
  const subscriptions = resolveBaseline(
    (totals) => totals.subscriptions,
    currentMonthTotals.subscriptions,
  );
  const groceries = resolveBaseline(
    (totals) => totals.variable.groceries,
    currentMonthTotals.variable.groceries,
  );
  const fuel = resolveBaseline(
    (totals) => totals.variable.fuel,
    currentMonthTotals.variable.fuel,
  );
  const smoking = resolveBaseline(
    (totals) => totals.variable.smoking,
    currentMonthTotals.variable.smoking,
  );
  const other = resolveBaseline(
    (totals) => totals.variable.other,
    currentMonthTotals.variable.other,
  );
  const savingsTransfers = resolveBaseline(
    (totals) => totals.savingsTransfers,
    currentMonthTotals.savingsTransfers,
  );

  return {
    fixedCosts,
    subscriptions,
    savingsTransfers,
    variable: {
      groceries,
      fuel,
      smoking,
      other,
    },
    variableCosts: round2(groceries + fuel + smoking + other),
  };
}
