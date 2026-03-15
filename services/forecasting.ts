import { computeBudgetPlan } from "@/services/budget-plan";
import { requireCurrentUserId } from "@/services/current-user";
import { estimateRecentExpenseForecastFromHistory } from "@/services/forecast-expense-utils";
import {
  buildForecastTimelineProjection,
  buildScheduledDateForMonth,
  frequencyAppliesInMonth,
  resolveExpectedDayOfMonth,
  type ForecastTimelineEvent,
} from "@/services/forecast-timeline";
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
  source_label: string;
  expected_income: number;
  income_frequency: RecurringType;
  income_day_of_month: number | null;
  last_detected_at: string;
};

type BalanceAnchor = {
  balance: number | null;
  balanceDate: string | null;
};

const PAGE_SIZE = 500;
const HISTORY_LOOKBACK_DAYS = 420;

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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseSaldoValue(metadata: Record<string, unknown>) {
  const raw = metadata["Saldo na trn"];
  if (raw == null) return null;
  const normalized = String(raw).replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
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

function amountIsSimilar(left: number, right: number) {
  const absLeft = Math.abs(left);
  const absRight = Math.abs(right);
  const absoluteDiff = Math.abs(absLeft - absRight);
  return absoluteDiff <= Math.max(1, absLeft * 0.08, absRight * 0.08);
}

function classifyRecurringType(dayIntervals: number[]): RecurringType {
  if (!dayIntervals.length) return "irregular";
  const avg =
    dayIntervals.reduce((sum, value) => sum + value, 0) / dayIntervals.length;

  if (avg >= 26 && avg <= 35) return "monthly";
  if (avg >= 80 && avg <= 100) return "quarterly";
  if (avg >= 350 && avg <= 380) return "yearly";
  return "irregular";
}

async function fetchTransactionsInRange(
  startIso: string,
  endIso: string,
  userId: string,
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
      .eq("user_id", userId)
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
        null) as ForecastTx["analysis_main_group"],
      analysis_category: (row.analysis_category ||
        null) as ForecastTx["analysis_category"],
      recurring: Boolean(row.recurring),
      recurring_type: (row.recurring_type || null) as RecurringType | null,
      category_id_auto: row.category_id_auto ? String(row.category_id_auto) : null,
      category_id_user: row.category_id_user ? String(row.category_id_user) : null,
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
  for (const row of (data || []) as Record<string, unknown>[]) {
    map.set(String(row.id || ""), {
      id: String(row.id || ""),
      key: String(row.key || ""),
    });
  }

  return map;
}

async function getLatestStartingBalance(monthStartIso: string, userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("metadata,date")
    .eq("user_id", userId)
    .lt("date", monthStartIso)
    .order("date", { ascending: false })
    .limit(30);

  if (error) throw error;

  for (const row of (data || []) as Record<string, unknown>[]) {
    const balance = parseSaldoValue(
      (row.metadata || {}) as Record<string, unknown>,
    );
    if (balance != null) return balance;
  }

  return null;
}

async function getLatestKnownBalance(referenceIso: string, userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("metadata,date")
    .eq("user_id", userId)
    .lte("date", referenceIso)
    .order("date", { ascending: false })
    .limit(40);

  if (error) throw error;

  for (const row of (data || []) as Record<string, unknown>[]) {
    const balance = parseSaldoValue(
      (row.metadata || {}) as Record<string, unknown>,
    );
    if (balance != null) {
      return {
        balance,
        balanceDate: row.date ? String(row.date) : null,
      } satisfies BalanceAnchor;
    }
  }

  return {
    balance: null,
    balanceDate: null,
  } satisfies BalanceAnchor;
}

async function fetchIncomeSources(userId: string): Promise<IncomeSourceRow[]> {
  const { data, error } = await supabase
    .from("forecast_income_sources")
    .select(
      "source_key,source_label,expected_income,income_frequency,income_day_of_month,last_detected_at",
    )
    .eq("user_id", userId);

  if (error) throw error;

  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    source_key: String(row.source_key || ""),
    source_label: String(row.source_label || row.source_key || ""),
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

function labelForTransaction(tx: Pick<ForecastTx, "counterparty" | "details">) {
  const label = String(
    tx.counterparty || tx.details.split("|")[0] || tx.details || "",
  ).trim();
  return label || "Onbekend";
}

function buildRecurringHistoryEvents(params: {
  transactions: ForecastTx[];
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
  direction: "income" | "expense";
}) {
  const { transactions, monthStart, monthEndExclusive, referenceDate, direction } =
    params;
  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);
  const referenceIso = dateToIso(referenceDate);

  const grouped = new Map<string, ForecastTx[]>();

  for (const tx of transactions) {
    if (tx.date > referenceIso) continue;
    if (tx.budget_excluded) continue;

    if (direction === "income") {
      if (tx.amount <= 0) continue;
      if (tx.analysis_main_group !== "income") continue;
      if (
        tx.analysis_category !== "income_structural" &&
        tx.analysis_category !== "income_variable"
      ) {
        continue;
      }
    } else {
      if (tx.amount >= 0) continue;
      if (tx.analysis_main_group !== "expense") continue;
      if (
        tx.analysis_category !== "fixed_costs" &&
        tx.analysis_category !== "subscriptions"
      ) {
        continue;
      }
    }

    const key = descriptor(tx);
    if (!key) continue;
    const current = grouped.get(key) || [];
    current.push(tx);
    grouped.set(key, current);
  }

  const events = new Map<string, ForecastTimelineEvent>();

  for (const [key, rows] of grouped.entries()) {
    const sortedDesc = [...rows].sort((left, right) =>
      right.date.localeCompare(left.date),
    );
    const latest = sortedDesc[0];
    if (!latest) continue;

    const similarRows = sortedDesc.filter(
      (row) =>
        row.analysis_category === latest.analysis_category &&
        amountIsSimilar(row.amount, latest.amount),
    );

    const intervals: number[] = [];
    const sortedAsc = [...similarRows].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    for (let index = 1; index < sortedAsc.length; index += 1) {
      const previousDate = toDate(sortedAsc[index - 1].date);
      const nextDate = toDate(sortedAsc[index].date);
      const diffDays = Math.round(
        (nextDate.getTime() - previousDate.getTime()) / 86400000,
      );
      if (diffDays > 0) intervals.push(diffDays);
    }

    const recurringType =
      latest.recurring_type && latest.recurring_type !== "irregular"
        ? latest.recurring_type
        : classifyRecurringType(intervals);

    if (recurringType === "irregular") continue;
    if (!frequencyAppliesInMonth(recurringType, toDate(latest.date), monthStart)) {
      continue;
    }

    const alreadyObservedThisMonth = similarRows.some(
      (row) => row.date >= monthStartIso && row.date < monthEndIso,
    );
    if (alreadyObservedThisMonth) continue;

    const preferredDay =
      resolveExpectedDayOfMonth(similarRows.map((row) => row.date).slice(0, 6)) ??
      toDate(latest.date).getUTCDate();
    const scheduledDate = buildScheduledDateForMonth(monthStart, preferredDay);
    if (scheduledDate <= referenceIso) continue;

    const amount = weightedRecentAverage(
      similarRows.slice(0, 3).map((row) => Math.abs(row.amount)),
    );
    if (amount <= 0) continue;

    events.set(key, {
      date: scheduledDate,
      label: labelForTransaction(latest),
      amount: direction === "income" ? amount : -amount,
      kind:
        direction === "income"
          ? "income"
          : latest.analysis_category === "subscriptions"
            ? "subscription"
            : "fixed_cost",
      source: "recurring_history",
      confidence: similarRows.length >= 3 ? "high" : "medium",
    });
  }

  return events;
}

function mergeIncomeSourceEvents(params: {
  incomeSources: IncomeSourceRow[];
  existingEvents: Map<string, ForecastTimelineEvent>;
  transactions: ForecastTx[];
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
}) {
  const { incomeSources, existingEvents, transactions, monthStart, monthEndExclusive, referenceDate } =
    params;
  const next = new Map(existingEvents);
  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);
  const referenceIso = dateToIso(referenceDate);

  const observedIncomeKeys = new Set(
    transactions
      .filter(
        (tx) =>
          tx.date <= referenceIso &&
          tx.date >= monthStartIso &&
          tx.date < monthEndIso &&
          tx.amount > 0,
      )
      .map((tx) => descriptor(tx))
      .filter(Boolean),
  );

  for (const source of incomeSources) {
    const key = normalizePattern(source.source_key);
    if (!key || source.expected_income <= 0) continue;
    if (observedIncomeKeys.has(key)) continue;

    const anchorDate = new Date(source.last_detected_at);
    if (
      Number.isNaN(anchorDate.getTime()) ||
      !frequencyAppliesInMonth(source.income_frequency, anchorDate, monthStart)
    ) {
      continue;
    }

    const scheduledDate = buildScheduledDateForMonth(
      monthStart,
      source.income_day_of_month ?? anchorDate.getUTCDate(),
    );
    if (scheduledDate <= referenceIso) continue;

    const existing = next.get(key);
    next.set(key, {
      date: scheduledDate,
      label: source.source_label || existing?.label || source.source_key,
      amount: source.expected_income,
      kind: "income",
      source: "income_source",
      confidence: source.income_day_of_month != null ? "high" : "medium",
    });
  }

  return next;
}

export async function recomputeCurrentMonthCashflowForecast(
  reference = new Date(),
) {
  const userId = await requireCurrentUserId();
  const monthStart = startOfMonth(reference);
  const monthEndExclusive = endOfMonthExclusive(reference);

  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);
  const referenceIso = dateToIso(reference);

  const stableIncomePlan = await computeBudgetPlan(reference, "default").catch(
    (error) => {
      console.warn(
        "[forecast] stable income unavailable, using legacy sources",
        error,
      );
      return null;
    },
  );

  const [
    categoryMap,
    historyTransactions,
    startingBalance,
    latestKnownBalance,
    incomeSources,
  ] = await Promise.all([
    fetchCategoryMap(),
    fetchTransactionsInRange(
      dateToIso(subtractDays(monthStart, HISTORY_LOOKBACK_DAYS)),
      monthEndIso,
      userId,
    ),
    getLatestStartingBalance(monthStartIso, userId),
    getLatestKnownBalance(referenceIso, userId),
    fetchIncomeSources(userId).catch((error) => {
      console.warn("[forecast] income sources unavailable", error);
      return [] as IncomeSourceRow[];
    }),
  ]);

  const fallbackExpenseForecast = estimateRecentExpenseForecastFromHistory({
    transactions: historyTransactions,
    categoryMap,
    currentMonthStart: monthStart,
  });

  let expectedIncomeTotal = 0;
  if (stableIncomePlan) {
    expectedIncomeTotal = Math.max(
      0,
      asNumber(stableIncomePlan.flowSummary.expectedIncomeMonthly, 0),
    );
  } else {
    for (const source of incomeSources) {
      const anchorDate = new Date(source.last_detected_at);
      if (
        !Number.isNaN(anchorDate.getTime()) &&
        frequencyAppliesInMonth(source.income_frequency, anchorDate, monthStart)
      ) {
        expectedIncomeTotal += source.expected_income;
      }
    }
  }

  const recurringExpenseEvents = buildRecurringHistoryEvents({
    transactions: historyTransactions,
    monthStart,
    monthEndExclusive,
    referenceDate: reference,
    direction: "expense",
  });
  const recurringIncomeEvents = buildRecurringHistoryEvents({
    transactions: historyTransactions,
    monthStart,
    monthEndExclusive,
    referenceDate: reference,
    direction: "income",
  });
  const mergedIncomeEvents = mergeIncomeSourceEvents({
    incomeSources,
    existingEvents: recurringIncomeEvents,
    transactions: historyTransactions,
    monthStart,
    monthEndExclusive,
    referenceDate: reference,
  });

  let expectedFixedCosts = 0;
  let expectedSubscriptions = 0;

  for (const event of recurringExpenseEvents.values()) {
    if (event.kind === "fixed_cost") {
      expectedFixedCosts += Math.abs(event.amount);
      continue;
    }
    if (event.kind === "subscription") {
      expectedSubscriptions += Math.abs(event.amount);
    }
  }

  const trendExpenses = stableIncomePlan?.trend.expenses || null;
  const monthToDateExpenses = stableIncomePlan?.monthToDateExpenses || null;

  expectedFixedCosts = Math.max(
    expectedFixedCosts,
    fallbackExpenseForecast.fixedCosts,
    asNumber(trendExpenses?.fixedCosts, 0),
    asNumber(monthToDateExpenses?.fixedCosts, 0),
  );
  expectedSubscriptions = Math.max(
    expectedSubscriptions,
    fallbackExpenseForecast.subscriptions,
    asNumber(trendExpenses?.subscriptions, 0),
    asNumber(monthToDateExpenses?.subscriptions, 0),
  );

  let expectedGroceries = 0;
  let expectedFuel = 0;
  let expectedSmoking = 0;
  let expectedOtherVariable = 0;

  if (trendExpenses) {
    expectedGroceries = Math.max(
      fallbackExpenseForecast.variable.groceries,
      asNumber(trendExpenses.variable.groceries, 0),
      asNumber(monthToDateExpenses?.variable.groceries, 0),
    );
    expectedFuel = Math.max(
      fallbackExpenseForecast.variable.fuel,
      asNumber(trendExpenses.variable.fuel, 0),
      asNumber(monthToDateExpenses?.variable.fuel, 0),
    );
    expectedSmoking = Math.max(
      fallbackExpenseForecast.variable.smoking,
      asNumber(trendExpenses.variable.smoking, 0),
      asNumber(monthToDateExpenses?.variable.smoking, 0),
    );
    expectedOtherVariable = Math.max(
      fallbackExpenseForecast.variable.other,
      asNumber(trendExpenses.variable.other, 0),
      asNumber(monthToDateExpenses?.variable.other, 0),
    );
  } else {
    expectedGroceries = fallbackExpenseForecast.variable.groceries;
    expectedFuel = fallbackExpenseForecast.variable.fuel;
    expectedSmoking = fallbackExpenseForecast.variable.smoking;
    expectedOtherVariable = fallbackExpenseForecast.variable.other;
  }

  const expectedVariableCosts =
    expectedGroceries +
    expectedFuel +
    expectedSmoking +
    expectedOtherVariable;
  const expectedExpenseTotal =
    expectedFixedCosts + expectedSubscriptions + expectedVariableCosts;

  const expectedEndOfMonthBalance =
    startingBalance == null
      ? null
      : round2(startingBalance + expectedIncomeTotal - expectedExpenseTotal);

  const riskFlag =
    expectedEndOfMonthBalance != null && expectedEndOfMonthBalance < 0
      ? "deficit_warning"
      : "none";

  const currentBalanceAnchor =
    latestKnownBalance.balance != null
      ? latestKnownBalance.balance
      : startingBalance;
  const currentBalanceAnchorDate =
    latestKnownBalance.balanceDate ||
    (startingBalance != null ? monthStartIso : null);

  const timelineProjection = buildForecastTimelineProjection({
    currentBalanceAnchor,
    referenceDate,
    monthEndExclusive,
    events: [
      ...recurringExpenseEvents.values(),
      ...mergedIncomeEvents.values(),
    ] as ForecastTimelineEvent[],
  });

  const costBuckets = [
    { key: "variable_costs", value: expectedVariableCosts },
    { key: "subscriptions", value: expectedSubscriptions },
    { key: "fixed_costs", value: expectedFixedCosts },
  ]
    .sort((left, right) => right.value - left.value)
    .map((entry) => entry.key);

  const { error } = await supabase.from("monthly_cashflow_forecasts").upsert(
    {
      user_id: userId,
      month_start: monthStartIso,
      starting_balance: startingBalance,
      current_balance_anchor: currentBalanceAnchor,
      current_balance_anchor_date: currentBalanceAnchorDate,
      expected_income_total: expectedIncomeTotal,
      expected_expense_total: expectedExpenseTotal,
      expected_fixed_costs: expectedFixedCosts,
      expected_subscriptions: expectedSubscriptions,
      expected_variable_costs: expectedVariableCosts,
      upcoming_committed_income_total:
        timelineProjection.upcomingCommittedIncomeTotal,
      upcoming_committed_expense_total:
        timelineProjection.upcomingCommittedExpenseTotal,
      lowest_expected_balance: timelineProjection.lowestExpectedBalance,
      lowest_expected_balance_date: timelineProjection.lowestExpectedBalanceDate,
      next_expected_event_date: timelineProjection.nextExpectedEventDate,
      next_expected_event_label: timelineProjection.nextExpectedEventLabel,
      cash_risk_flag: timelineProjection.cashRiskFlag,
      avg_groceries: expectedGroceries,
      avg_fuel: expectedFuel,
      avg_smoking: expectedSmoking,
      avg_other_variable: expectedOtherVariable,
      expected_end_of_month_balance: expectedEndOfMonthBalance,
      risk_flag: riskFlag,
      top_cost_bucket_1: costBuckets[0] || null,
      top_cost_bucket_2: costBuckets[1] || null,
      top_cost_bucket_3: costBuckets[2] || null,
      computed_at: addDays(reference, 0).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month_start" },
  );

  if (error) throw error;

  return {
    monthStart: monthStartIso,
    expectedIncomeTotal,
    expectedExpenseTotal,
    expectedEndOfMonthBalance,
    riskFlag,
    cashRiskFlag: timelineProjection.cashRiskFlag,
    lowestExpectedBalance: timelineProjection.lowestExpectedBalance,
    lowestExpectedBalanceDate: timelineProjection.lowestExpectedBalanceDate,
  };
}
