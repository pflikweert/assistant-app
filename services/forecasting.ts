import { computeBudgetPlan } from "@/services/budget-plan";
import { supabase } from "@/services/supabase";
import type { RecurringType } from "@/types/categorization";
import { normalizePattern } from "./categorization-repository";

type ForecastTx = {
  id: string;
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
  recurring: boolean;
  recurring_type: RecurringType | null;
  category_id_auto: string | null;
  category_id_user: string | null;
  budget_excluded: boolean;
  metadata: Record<string, unknown>;
};

type CategoryMeta = {
  id: string;
  key: string;
};

type IncomeSourceRow = {
  source_key: string;
  expected_income: number;
  income_frequency: RecurringType;
  income_day_of_month: number | null;
  last_detected_at: string;
};

const PAGE_SIZE = 500;

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthExclusive(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function parseSaldoValue(metadata: Record<string, unknown>) {
  const raw = metadata["Saldo na trn"];
  if (raw == null) return null;
  const normalized = String(raw).replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function monthsDiff(from: Date, to: Date) {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

function frequencyAppliesInMonth(
  frequency: RecurringType,
  anchorDate: Date,
  monthStart: Date,
) {
  const diff = monthsDiff(startOfMonth(anchorDate), monthStart);
  if (diff < 0) return false;

  if (frequency === "monthly") return true;
  if (frequency === "quarterly") return diff % 3 === 0;
  if (frequency === "yearly") return diff % 12 === 0;
  return diff === 0;
}

async function fetchTransactionsInRange(
  startIso: string,
  endIso: string,
): Promise<ForecastTx[]> {
  const rows: ForecastTx[] = [];
  let offset = 0;

  while (true) {
    const to = offset + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id,date,amount,details,counterparty,analysis_main_group,analysis_category,recurring,recurring_type,category_id_auto,category_id_user,budget_excluded,metadata",
      )
      .gte("date", startIso)
      .lt("date", endIso)
      .order("date", { ascending: false })
      .range(offset, to);

    if (error) throw error;

    const page = ((data || []) as any[]).map((row) => ({
      id: String(row.id),
      date: String(row.date || ""),
      amount: asNumber(row.amount, 0),
      details: String(row.details || ""),
      counterparty: row.counterparty ? String(row.counterparty) : null,
      analysis_main_group: row.analysis_main_group || null,
      analysis_category: row.analysis_category || null,
      recurring: Boolean(row.recurring),
      recurring_type: row.recurring_type || null,
      category_id_auto: row.category_id_auto || null,
      category_id_user: row.category_id_user || null,
      budget_excluded: Boolean(row.budget_excluded),
      metadata: (row.metadata || {}) as Record<string, unknown>,
    }));

    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchCategoryMap() {
  const { data, error } = await supabase.from("categories").select("id,key");
  if (error) throw error;

  const map = new Map<string, CategoryMeta>();
  for (const row of (data || []) as any[]) {
    map.set(String(row.id), {
      id: String(row.id),
      key: String(row.key || ""),
    });
  }

  return map;
}

async function getLatestStartingBalance(monthStartIso: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("metadata,date")
    .lt("date", monthStartIso)
    .order("date", { ascending: false })
    .limit(30);

  if (error) throw error;

  for (const row of (data || []) as any[]) {
    const balance = parseSaldoValue(
      (row.metadata || {}) as Record<string, unknown>,
    );
    if (balance != null) return balance;
  }

  return null;
}

async function fetchIncomeSources(): Promise<IncomeSourceRow[]> {
  const { data, error } = await supabase
    .from("forecast_income_sources")
    .select(
      "source_key,expected_income,income_frequency,income_day_of_month,last_detected_at",
    );

  if (error) throw error;

  return ((data || []) as any[]).map((row) => ({
    source_key: String(row.source_key || ""),
    expected_income: asNumber(row.expected_income, 0),
    income_frequency: (row.income_frequency || "irregular") as RecurringType,
    income_day_of_month:
      row.income_day_of_month == null ? null : Number(row.income_day_of_month),
    last_detected_at: String(row.last_detected_at || new Date().toISOString()),
  }));
}

function descriptor(tx: Pick<ForecastTx, "counterparty" | "details">) {
  return normalizePattern(
    tx.counterparty || tx.details.split("|")[0] || tx.details,
  );
}

function buildVariableBucket(
  tx: ForecastTx,
  categoryKey: string | null,
): "groceries" | "fuel" | "smoking" | "other" {
  const haystack = normalizePattern(
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

export async function recomputeCurrentMonthCashflowForecast(
  reference = new Date(),
) {
  const monthStart = startOfMonth(reference);
  const monthEndExclusive = endOfMonthExclusive(reference);

  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);

  const stableIncomePlan = await computeBudgetPlan(reference, "default").catch(
    (error) => {
      console.warn(
        "[forecast] stable income unavailable, using legacy sources",
        error,
      );
      return null;
    },
  );

  const [categoryMap, historyTransactions, startingBalance] = await Promise.all(
    [
      fetchCategoryMap(),
      fetchTransactionsInRange(
        dateToIso(subtractDays(monthStart, 90)),
        monthEndIso,
      ),
      getLatestStartingBalance(monthStartIso),
    ],
  );

  let expectedIncomeTotal = 0;
  if (stableIncomePlan) {
    expectedIncomeTotal = Math.max(
      0,
      asNumber(stableIncomePlan.flowSummary.expectedIncomeMonthly, 0),
    );
  } else {
    const incomeSources = await fetchIncomeSources();
    for (const source of incomeSources) {
      const anchorDate = new Date(source.last_detected_at);
      if (
        !frequencyAppliesInMonth(
          source.income_frequency,
          anchorDate,
          monthStart,
        )
      ) {
        continue;
      }
      expectedIncomeTotal += source.expected_income;
    }
  }

  const recurringGroups = new Map<
    string,
    {
      amount: number;
      recurringType: RecurringType;
      analysisCategory: "fixed_costs" | "subscriptions" | "variable_costs";
      anchorDate: Date;
    }
  >();

  for (const tx of historyTransactions) {
    if (tx.budget_excluded) continue;
    if (!tx.recurring || tx.amount >= 0) continue;
    if (tx.analysis_main_group !== "expense") continue;
    if (
      tx.analysis_category !== "fixed_costs" &&
      tx.analysis_category !== "subscriptions" &&
      tx.analysis_category !== "variable_costs"
    ) {
      continue;
    }

    const recurringType = tx.recurring_type || "irregular";
    const key = descriptor(tx);
    if (!key) continue;

    const existing = recurringGroups.get(key);
    if (!existing || tx.date > dateToIso(existing.anchorDate)) {
      recurringGroups.set(key, {
        amount: Math.abs(tx.amount),
        recurringType,
        analysisCategory: tx.analysis_category,
        anchorDate: toDate(tx.date),
      });
    }
  }

  let expectedFixedCosts = 0;
  let expectedSubscriptions = 0;

  for (const recurringItem of recurringGroups.values()) {
    if (
      !frequencyAppliesInMonth(
        recurringItem.recurringType,
        recurringItem.anchorDate,
        monthStart,
      )
    ) {
      continue;
    }

    if (recurringItem.analysisCategory === "fixed_costs") {
      expectedFixedCosts += recurringItem.amount;
      continue;
    }
    if (recurringItem.analysisCategory === "subscriptions") {
      expectedSubscriptions += recurringItem.amount;
    }
  }

  const variableStats = {
    groceries: { sum: 0, count: 0 },
    fuel: { sum: 0, count: 0 },
    smoking: { sum: 0, count: 0 },
    other: { sum: 0, count: 0 },
  };

  for (const tx of historyTransactions) {
    if (tx.budget_excluded) continue;
    if (tx.amount >= 0) continue;
    if (tx.analysis_main_group !== "expense") continue;
    if (tx.analysis_category !== "variable_costs") continue;

    const categoryId = tx.category_id_user || tx.category_id_auto;
    const categoryKey = categoryId
      ? categoryMap.get(categoryId)?.key || null
      : null;
    const bucket = buildVariableBucket(tx, categoryKey);

    variableStats[bucket].sum += Math.abs(tx.amount);
    variableStats[bucket].count += 1;
  }

  const avgGroceries =
    variableStats.groceries.count > 0
      ? variableStats.groceries.sum / variableStats.groceries.count
      : 0;
  const avgFuel =
    variableStats.fuel.count > 0
      ? variableStats.fuel.sum / variableStats.fuel.count
      : 0;
  const avgSmoking =
    variableStats.smoking.count > 0
      ? variableStats.smoking.sum / variableStats.smoking.count
      : 0;
  const avgOtherVariable =
    variableStats.other.count > 0
      ? variableStats.other.sum / variableStats.other.count
      : 0;

  const expectedVariableCosts =
    avgGroceries + avgFuel + avgSmoking + avgOtherVariable;
  const expectedExpenseTotal =
    expectedFixedCosts + expectedSubscriptions + expectedVariableCosts;

  const expectedEndOfMonthBalance =
    startingBalance == null
      ? null
      : startingBalance + expectedIncomeTotal - expectedExpenseTotal;

  const riskFlag =
    expectedEndOfMonthBalance != null && expectedEndOfMonthBalance < 0
      ? "deficit_warning"
      : "none";

  const costBuckets = [
    { key: "variable_costs", value: expectedVariableCosts },
    { key: "subscriptions", value: expectedSubscriptions },
    { key: "fixed_costs", value: expectedFixedCosts },
  ]
    .sort((left, right) => right.value - left.value)
    .map((entry) => entry.key);

  const { error } = await supabase.from("monthly_cashflow_forecasts").upsert(
    {
      month_start: monthStartIso,
      starting_balance: startingBalance,
      expected_income_total: expectedIncomeTotal,
      expected_expense_total: expectedExpenseTotal,
      expected_fixed_costs: expectedFixedCosts,
      expected_subscriptions: expectedSubscriptions,
      expected_variable_costs: expectedVariableCosts,
      avg_groceries: avgGroceries,
      avg_fuel: avgFuel,
      avg_smoking: avgSmoking,
      avg_other_variable: avgOtherVariable,
      expected_end_of_month_balance: expectedEndOfMonthBalance,
      risk_flag: riskFlag,
      top_cost_bucket_1: costBuckets[0] || null,
      top_cost_bucket_2: costBuckets[1] || null,
      top_cost_bucket_3: costBuckets[2] || null,
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "month_start" },
  );

  if (error) throw error;

  return {
    monthStart: monthStartIso,
    expectedIncomeTotal,
    expectedExpenseTotal,
    expectedEndOfMonthBalance,
    riskFlag,
  };
}
