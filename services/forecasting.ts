import { computeBudgetPlan } from "@/services/budget-plan";
import { requireCurrentUserId } from "@/services/current-user";
import { listBankAccounts, listBankAccountBudgetFlags } from "@/services/bank-accounts";
import { createBudgetPlanRequestDescriptors } from "@/services/forecast-budget-plan-requests";
import { buildForecastMonthStateFromEvents, buildForecastMonthMath } from "@/services/forecast-month-math";
import {
  deriveIncomeSourcesFromTransactions,
  mergeForecastIncomeSources,
} from "@/services/forecast-derived-income-sources";
import { normalizeForecastEventsForMonth } from "@/services/forecast-event-normalization";
import { resolveForecastExpenseBaselines } from "@/services/forecast-expense-baseline";
import { estimateRecentExpenseForecastFromHistory } from "@/services/forecast-expense-utils";
import { resolveExpectedCashflowIncomeBaselineBreakdown } from "@/services/forecast-income-baseline";
import {
  isForecastEligibleIncomeTransaction,
  isIncludedForecastIncomeBucket,
  resolveForecastIncomeBucketForTransaction,
  resolveForecastIncomeBucketFromValue,
} from "@/services/forecast-income-utils";
import {
  buildForecastTimelineProjection,
  buildScheduledDateForMonth,
  frequencyAppliesInMonth,
  resolveCommittedForecastEventDate,
  resolveExpectedDayOfMonth,
  type ForecastTimelineEvent,
} from "@/services/forecast-timeline";
import { buildForecastReferenceContext } from "@/services/forecast-reference";
import { buildForecastCarryoverFromLatestKnownBalance } from "@/services/latest-known-balance";
import {
  isBankAccountIncludedInLegacyForecastScope,
  isTransactionExcludedFromLegacyBudgetScope,
  isTransactionIncludedInLegacyForecastScope,
} from "@/services/financial-semantics";
import type {
  ForecastEvent,
  ForecastTimelineStorageEventType,
} from "@/services/forecast-domain";
import { resolveIncomeSemanticsForTransaction } from "@/services/income-semantics";
import { detectRareSubscriptionItems } from "@/services/rare-subscriptions";
import { supabase } from "@/services/supabase";
import { normalizePattern } from "@/services/pattern-normalization";
import type {
  CategoryRecord,
  ForecastIncomeBucket,
  RecurringType,
  SubscriptionProfile,
} from "@/types/categorization";

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
  bank_account_id: string | null;
  budget_excluded: boolean;
  metadata: Record<string, unknown>;
};

type IncomeSourceRow = {
  source_key: string;
  source_label: string;
  expected_income: number;
  income_bucket: ForecastIncomeBucket | null;
  income_frequency: RecurringType;
  income_day_of_month: number | null;
  last_detected_at: string;
  reference_transaction_id: string | null;
  reference_category_id: string | null;
  reference_category_path: string | null;
  reference_label: string | null;
  reference_source_type: "transaction" | "derived";
};

type BalanceAnchor = {
  balance: number | null;
  balanceDate: string | null;
};

type BookedMonthTotals = {
  incomeTotal: number;
  includedForecastEligibleIncomeTotal: number;
  structuralIncomeTotal: number;
  variableIncomeTotal: number;
  expenseTotal: number;
  savingsOutflowTotal: number;
  fixedCosts: number;
  subscriptions: number;
  variableCosts: number;
};

type StoredForecastSummary = {
  monthStart: string;
  forecastReferenceDate: string;
  startingBalance: number | null;
  currentBalanceAnchor: number | null;
  currentBalanceAnchorDate: string | null;
  bookedIncomeTotal: number;
  bookedExpenseTotal: number;
  bookedSavingsOutflowTotal: number;
  remainingExpectedIncomeTotal: number;
  remainingExpectedExpenseTotal: number;
  remainingExpectedSavingsOutflowTotal: number;
  expectedIncomeTotal: number;
  expectedIncomeStructuralTotal: number;
  expectedIncomeVariableTotal: number;
  expectedExpenseTotal: number;
  expectedSavingsOutflowTotal: number;
  expectedCashOutTotal: number;
  expectedFixedCosts: number;
  expectedSubscriptions: number;
  expectedVariableCosts: number;
  upcomingCommittedIncomeTotal: number;
  upcomingCommittedExpenseTotal: number;
  upcomingCommittedSavingsOutflowTotal: number;
  lowestExpectedBalance: number | null;
  lowestExpectedBalanceDate: string | null;
  nextExpectedEventDate: string | null;
  nextExpectedEventLabel: string | null;
  avgGroceries: number;
  avgFuel: number;
  avgSmoking: number;
  avgOtherVariable: number;
  expectedEndOfMonthBalance: number | null;
  riskFlag: "none" | "deficit_warning";
  cashRiskFlag: "none" | "cash_gap_warning";
  topCostBuckets: string[];
};

type StoredForecastTimelineEvent = {
  user_id: string;
  month_start: string;
  event_key: string;
  event_date: string;
  event_type: ForecastTimelineStorageEventType;
  label: string;
  amount: number;
  source:
    | "income_source"
    | "recurring_history"
    | "subscription_profile"
    | "rare_subscription"
    | "derived";
  confidence: "medium" | "high";
  fingerprint: string;
  reference_transaction_id?: string | null;
  reference_category_id?: string | null;
  reference_category_path?: string | null;
  reference_label?: string | null;
  reference_source_type?:
    | "transaction"
    | "income_source"
    | "subscription_profile"
    | "rare_subscription"
    | "derived"
    | null;
  computed_at: string;
  updated_at: string;
};

const PAGE_SIZE = 500;
const HISTORY_LOOKBACK_DAYS = 760;
const FUTURE_FORECAST_MONTHS = 6;

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toUtcDate(isoDate: string) {
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

function subtractDays(date: Date, days: number) {
  return addDays(date, -days);
}

function addMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function isMissingColumnError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || "");
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  if (code === "42703") return true;
  return message.includes("column") && message.includes("does not exist");
}

function isMissingRelationError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || "");
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function parseSaldoValue(metadata: Record<string, unknown>) {
  const raw = metadata["Saldo na trn"];
  if (raw == null) return null;
  const normalized = String(raw).replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
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
  const average =
    dayIntervals.reduce((sum, value) => sum + value, 0) / dayIntervals.length;

  if (average >= 26 && average <= 35) return "monthly";
  if (average >= 80 && average <= 100) return "quarterly";
  if (average >= 350 && average <= 380) return "yearly";
  return "irregular";
}

function monthsDiff(from: Date, to: Date) {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
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

function emptyBookedMonthTotals(): BookedMonthTotals {
  return {
    incomeTotal: 0,
    includedForecastEligibleIncomeTotal: 0,
    structuralIncomeTotal: 0,
    variableIncomeTotal: 0,
    expenseTotal: 0,
    savingsOutflowTotal: 0,
    fixedCosts: 0,
    subscriptions: 0,
    variableCosts: 0,
  };
}

async function fetchTransactionsInRange(
  startIso: string,
  endIso: string,
  userId: string,
): Promise<ForecastTx[]> {
  const budgetFlags = await listBankAccountBudgetFlags(userId);
  const rows: ForecastTx[] = [];
  let offset = 0;

  while (true) {
    const to = offset + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id,date,amount,details,counterparty,bank_account_id,analysis_main_group,analysis_category,recurring,recurring_type,category_id_auto,category_id_user,budget_excluded,metadata",
      )
      .eq("user_id", userId)
      .gte("date", startIso)
      .lt("date", endIso)
      .order("date", { ascending: false })
      .range(offset, to);

    if (error) throw error;

    const page = ((data || []) as Record<string, unknown>[])
      .map((row) => {
        const bankAccountId = row.bank_account_id ? String(row.bank_account_id) : null;
        if (
          !isBankAccountIncludedInLegacyForecastScope(
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
            null) as ForecastTx["analysis_main_group"],
          analysis_category: (row.analysis_category ||
            null) as ForecastTx["analysis_category"],
          recurring: Boolean(row.recurring),
          recurring_type: (row.recurring_type || null) as RecurringType | null,
          category_id_auto: row.category_id_auto ? String(row.category_id_auto) : null,
          category_id_user: row.category_id_user ? String(row.category_id_user) : null,
          budget_excluded: Boolean(row.budget_excluded),
          metadata: (row.metadata || {}) as Record<string, unknown>,
        };
      })
      .filter((row): row is ForecastTx => Boolean(row));

    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchCategoryMap() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,key,name,parent_id,budget_group,sort_order");

  if (error) throw error;

  const categories = ((data || []) as Record<string, unknown>[]).map(
    (row): CategoryRecord => ({
      id: String(row.id || ""),
      key: String(row.key || ""),
      name: String(row.name || row.key || ""),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      budget_group: row.budget_group ? String(row.budget_group) : null,
      sort_order:
        row.sort_order == null ? null : Math.round(Number(row.sort_order)),
    }),
  );

  return {
    categories,
    categoryMap: new Map(categories.map((category) => [category.id, category])),
  };
}

async function fetchIncomeSources(userId: string): Promise<IncomeSourceRow[]> {
  const enhancedSelect =
    "source_key,source_label,expected_income,income_bucket,income_frequency,income_day_of_month,last_detected_at,reference_transaction_id,reference_category_id,reference_category_path,reference_label,reference_source_type";
  const legacySelect =
    "source_key,source_label,expected_income,income_frequency,income_day_of_month,last_detected_at";
  let { data, error } = await supabase
    .from("forecast_income_sources")
    .select(enhancedSelect)
    .eq("user_id", userId);

  if (error && isMissingColumnError(error)) {
    const legacyResult = await supabase
      .from("forecast_income_sources")
      .select(legacySelect)
      .eq("user_id", userId);
    data = legacyResult.data as typeof data;
    error = legacyResult.error;
  }

  if (error) throw error;

  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    source_key: String(row.source_key || ""),
    source_label: String(row.source_label || row.source_key || ""),
    expected_income: asNumber(row.expected_income, 0),
    income_bucket: resolveForecastIncomeBucketFromValue(row.income_bucket as string | null),
    income_frequency: (row.income_frequency || "irregular") as RecurringType,
    income_day_of_month:
      row.income_day_of_month == null ? null : Number(row.income_day_of_month),
    last_detected_at: String(row.last_detected_at || new Date().toISOString()),
    reference_transaction_id: row.reference_transaction_id
      ? String(row.reference_transaction_id)
      : null,
    reference_category_id: row.reference_category_id
      ? String(row.reference_category_id)
      : null,
    reference_category_path: row.reference_category_path
      ? String(row.reference_category_path)
      : null,
    reference_label: row.reference_label ? String(row.reference_label) : null,
    reference_source_type:
      row.reference_source_type === "transaction" ? "transaction" : "derived",
  }));
}

async function fetchActiveSubscriptionProfiles(
  userId: string,
): Promise<SubscriptionProfile[]> {
  const { data, error } = await supabase
    .from("subscription_profiles")
    .select(
      "id,plan_key,name,normalized_name,billing_cycle,expected_amount,amount_tolerance,expected_day_of_month,provider_hint,is_active,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;

  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id || ""),
    planKey: String(row.plan_key || "default"),
    name: String(row.name || ""),
    normalizedName: String(row.normalized_name || row.name || ""),
    billingCycle:
      row.billing_cycle === "quarterly" || row.billing_cycle === "yearly"
        ? row.billing_cycle
        : "monthly",
    expectedAmount:
      row.expected_amount == null ? null : Math.abs(Number(row.expected_amount)),
    amountTolerance: asNumber(row.amount_tolerance, 0),
    expectedDayOfMonth:
      row.expected_day_of_month == null
        ? null
        : Math.round(Number(row.expected_day_of_month)),
    providerHint:
      row.provider_hint === "paypal" ||
      row.provider_hint === "google_play" ||
      row.provider_hint === "apple" ||
      row.provider_hint === "klarna" ||
      row.provider_hint === "other"
        ? row.provider_hint
        : null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }));
}

function getLatestStartingBalanceFromTransactions(
  transactions: ForecastTx[],
  monthStartIso: string,
) {
  for (const tx of transactions) {
    if (tx.date >= monthStartIso) continue;
    const balance = parseSaldoValue(tx.metadata);
    if (balance != null) return balance;
  }

  return null;
}

function getLatestKnownBalanceFromTransactions(
  transactions: ForecastTx[],
  referenceIso: string,
): BalanceAnchor {
  for (const tx of transactions) {
    if (tx.date > referenceIso) continue;
    const balance = parseSaldoValue(tx.metadata);
    if (balance != null) {
      return {
        balance,
        balanceDate: tx.date,
      } satisfies BalanceAnchor;
    }
  }

  return {
    balance: null,
    balanceDate: null,
  } satisfies BalanceAnchor;
}

function sumEventAmounts(
  events: Iterable<ForecastTimelineEvent>,
  kind: ForecastTimelineEvent["kind"],
) {
  let total = 0;
  for (const event of events) {
    if (event.kind !== kind) continue;
    total += Math.abs(event.amount);
  }
  return round2(total);
}

function sumIncomeEventAmounts(
  events: Iterable<ForecastTimelineEvent>,
  predicate?: (event: ForecastTimelineEvent) => boolean,
) {
  let total = 0;
  for (const event of events) {
    if (event.kind !== "income" || event.amount <= 0) continue;
    if (predicate && !predicate(event)) continue;
    total += event.amount;
  }
  return round2(total);
}

function buildRecurringHistoryEvents(params: {
  transactions: ForecastTx[];
  categoryMap: Map<string, CategoryRecord>;
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
  direction: "income" | "expense" | "savings";
}) {
  const {
    transactions,
    categoryMap,
    monthStart,
    monthEndExclusive,
    referenceDate,
    direction,
  } = params;

  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);
  const referenceIso = dateToIso(referenceDate);
  const grouped = new Map<string, ForecastTx[]>();

  for (const tx of transactions) {
    if (tx.date > referenceIso) continue;
    if (
      !isTransactionIncludedInLegacyForecastScope({
        budgetExcluded: tx.budget_excluded,
        analysisMainGroup: tx.analysis_main_group,
        analysisCategory: tx.analysis_category,
      })
    ) {
      continue;
    }

    if (direction === "income") {
      if (!isForecastEligibleIncomeTransaction(tx, categoryMap)) continue;
    } else if (direction === "savings") {
      if (tx.amount >= 0) continue;
      if (tx.analysis_main_group !== "expense") continue;
      if (tx.analysis_category !== "savings_transfer") continue;
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

    const sortedAsc = [...similarRows].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    const intervals: number[] = [];
    for (let index = 1; index < sortedAsc.length; index += 1) {
      const previousDate = toUtcDate(sortedAsc[index - 1].date);
      const nextDate = toUtcDate(sortedAsc[index].date);
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
    if (!frequencyAppliesInMonth(recurringType, toUtcDate(latest.date), monthStart)) {
      continue;
    }

    const alreadyObservedThisMonth = similarRows.some(
      (row) => row.date >= monthStartIso && row.date < monthEndIso,
    );

    const preferredDay =
      resolveExpectedDayOfMonth(similarRows.map((row) => row.date).slice(0, 6)) ??
      toUtcDate(latest.date).getUTCDate();
    const scheduledDate = buildScheduledDateForMonth(monthStart, preferredDay);
    const eventDate = resolveCommittedForecastEventDate({
      alreadyObservedThisMonth,
      scheduledDate,
      referenceDate,
      monthStart,
      monthEndExclusive,
    });
    if (!eventDate) continue;

    const amount = weightedRecentAverage(
      similarRows.slice(0, 3).map((row) => Math.abs(row.amount)),
    );
    if (amount <= 0) continue;
    const reference = buildForecastReferenceContext(latest, categoryMap, "transaction");

    events.set(key, {
      date: eventDate,
      label: labelForTransaction(latest),
      amount:
        direction === "income"
          ? amount
          : direction === "savings"
            ? -amount
            : -amount,
      kind:
        direction === "income"
          ? "income"
          : direction === "savings"
            ? "savings_transfer"
            : latest.analysis_category === "subscriptions"
              ? "subscription"
              : "fixed_cost",
      incomeBucket:
        direction === "income"
          ? resolveForecastIncomeBucketForTransaction(latest, categoryMap)
          : undefined,
      source: "recurring_history",
      confidence: similarRows.length >= 3 ? "high" : "medium",
      referenceTransactionId: reference.referenceTransactionId,
      referenceCategoryId: reference.referenceCategoryId,
      referenceCategoryPath: reference.referenceCategoryPath,
      referenceLabel: reference.referenceLabel,
      referenceSourceType: reference.referenceSourceType,
    });
  }

  return events;
}

function mergeIncomeSourceEvents(params: {
  incomeSources: IncomeSourceRow[];
  existingEvents: Map<string, ForecastTimelineEvent>;
  transactions: ForecastTx[];
  categoryMap: Map<string, CategoryRecord>;
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
}) {
  const {
    incomeSources,
    existingEvents,
    transactions,
    categoryMap,
    monthStart,
    monthEndExclusive,
    referenceDate,
  } = params;

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
          isForecastEligibleIncomeTransaction(tx, categoryMap),
      )
      .map((tx) => descriptor(tx))
      .filter(Boolean),
  );

  for (const source of incomeSources) {
    const key = normalizePattern(source.source_key);
    if (!key || source.expected_income <= 0) continue;

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
    const eventDate = resolveCommittedForecastEventDate({
      alreadyObservedThisMonth: observedIncomeKeys.has(key),
      scheduledDate,
      referenceDate,
      monthStart,
      monthEndExclusive,
    });
    if (!eventDate) continue;

    next.set(key, {
      date: eventDate,
      label: source.source_label || source.source_key,
      amount: source.expected_income,
      kind: "income",
      incomeBucket: source.income_bucket,
      source: "income_source",
      confidence: source.income_day_of_month != null ? "high" : "medium",
      referenceTransactionId: source.reference_transaction_id,
      referenceCategoryId: source.reference_category_id,
      referenceCategoryPath: source.reference_category_path,
      referenceLabel: source.reference_label,
      referenceSourceType: "income_source",
    });
  }

  return next;
}

function mergeSubscriptionProfileEvents(params: {
  profiles: SubscriptionProfile[];
  existingEvents: Map<string, ForecastTimelineEvent>;
  transactions: ForecastTx[];
  categoryMap: Map<string, CategoryRecord>;
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
}) {
  const {
    profiles,
    existingEvents,
    transactions,
    categoryMap,
    monthStart,
    monthEndExclusive,
    referenceDate,
  } = params;

  const next = new Map(existingEvents);
  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);
  const referenceIso = dateToIso(referenceDate);
  const observedThisMonth = new Set<string>();
  const latestByDescriptor = new Map<string, ForecastTx>();
  for (const tx of transactions) {
    if (tx.date > referenceIso || tx.amount >= 0 || tx.analysis_category !== "subscriptions") {
      continue;
    }

    const key = descriptor(tx);
    if (!key) continue;
    const existing = latestByDescriptor.get(key);
    if (!existing || existing.date < tx.date) {
      latestByDescriptor.set(key, tx);
    }
    if (tx.date >= monthStartIso && tx.date < monthEndIso) {
      observedThisMonth.add(key);
    }
  }

  for (const profile of profiles) {
    if (!profile.isActive) continue;
    if (profile.expectedAmount == null || profile.expectedAmount <= 0) continue;
    if (profile.billingCycle !== "monthly") continue;

    const key = normalizePattern(profile.normalizedName || profile.name);
    if (!key || next.has(key)) continue;

    const scheduledDate = buildScheduledDateForMonth(
      monthStart,
      profile.expectedDayOfMonth ?? 1,
    );
    const eventDate = resolveCommittedForecastEventDate({
      alreadyObservedThisMonth: observedThisMonth.has(key),
      scheduledDate,
      referenceDate,
      monthStart,
      monthEndExclusive,
    });
    if (!eventDate) continue;
    const referenceTx = latestByDescriptor.get(key) || null;
    const reference = referenceTx
      ? buildForecastReferenceContext(referenceTx, categoryMap, "transaction")
      : {
          referenceTransactionId: null,
          referenceCategoryId: null,
          referenceCategoryPath: null,
          referenceLabel: profile.name,
          referenceSourceType: "subscription_profile" as const,
        };

    next.set(key, {
      date: eventDate,
      label: profile.name,
      amount: -Math.abs(profile.expectedAmount),
      kind: "subscription",
      source: "subscription_profile",
      confidence: profile.expectedDayOfMonth != null ? "high" : "medium",
      referenceTransactionId: reference.referenceTransactionId,
      referenceCategoryId: reference.referenceCategoryId,
      referenceCategoryPath: reference.referenceCategoryPath,
      referenceLabel: reference.referenceLabel,
      referenceSourceType: reference.referenceSourceType,
    });
  }

  return next;
}

function mergeRareSubscriptionEvents(params: {
  rareItems: ReturnType<typeof detectRareSubscriptionItems>;
  existingEvents: Map<string, ForecastTimelineEvent>;
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
}) {
  const { rareItems, existingEvents, monthStart, monthEndExclusive, referenceDate } =
    params;
  const next = new Map(existingEvents);
  const monthStartIso = dateToIso(monthStart);
  const monthEndIso = dateToIso(monthEndExclusive);
  const referenceIso = dateToIso(referenceDate);

  for (const item of rareItems) {
    if (item.evidence !== "confirmed") continue;
    if (item.cadence === "single") continue;
    if (!item.nextExpectedDate) continue;
    if (item.nextExpectedDate <= referenceIso) continue;
    if (item.nextExpectedDate < monthStartIso || item.nextExpectedDate >= monthEndIso) {
      continue;
    }
    if (next.has(item.id)) continue;

    next.set(item.id, {
      date: item.nextExpectedDate,
      label: item.label,
      amount: -Math.abs(item.expectedAmount),
      kind: "subscription",
      source: "rare_subscription",
      confidence: "medium",
      referenceTransactionId: item.latestTransactionId,
      referenceCategoryId: item.latestCategoryId,
      referenceCategoryPath: item.latestCategoryPath,
      referenceLabel: item.latestReferenceLabel,
      referenceSourceType: "rare_subscription",
    });
  }

  return next;
}

function summarizeBookedMonthTransactions(params: {
  transactions: ForecastTx[];
  categoryMap: Map<string, CategoryRecord>;
  forecastSettings:
    | {
        includeIncome?: {
          salary: boolean;
          childBudget: boolean;
          structuralOther: boolean;
          variable: boolean;
        };
      }
    | null;
  monthStartIso: string;
  monthEndIso: string;
  referenceIso: string;
}) {
  const {
    transactions,
    categoryMap,
    forecastSettings,
    monthStartIso,
    monthEndIso,
    referenceIso,
  } = params;
  const totals = emptyBookedMonthTotals();

  for (const tx of transactions) {
    if (tx.date < monthStartIso || tx.date >= monthEndIso) continue;
    if (tx.date > referenceIso) continue;
    if (
      isTransactionExcludedFromLegacyBudgetScope({
        budgetExcluded: tx.budget_excluded,
        analysisMainGroup: tx.analysis_main_group,
        analysisCategory: tx.analysis_category,
      })
    ) {
      continue;
    }

    if (tx.amount > 0) {
      const semantics = resolveIncomeSemanticsForTransaction(tx, categoryMap);
      if (!semantics.countsAsIncome) continue;
      const incomeBucket = resolveForecastIncomeBucketForTransaction(tx, categoryMap);
      totals.incomeTotal += tx.amount;
      if (incomeBucket === "variable") {
        totals.variableIncomeTotal += tx.amount;
      } else if (incomeBucket) {
        totals.structuralIncomeTotal += tx.amount;
      }
      if (
        semantics.forecastEligible &&
        isIncludedForecastIncomeBucket(incomeBucket, forecastSettings)
      ) {
        totals.includedForecastEligibleIncomeTotal += tx.amount;
      }
      continue;
    }

    if (tx.amount >= 0 || tx.analysis_main_group !== "expense") continue;
    const amount = Math.abs(tx.amount);

    if (tx.analysis_category === "savings_transfer") {
      totals.savingsOutflowTotal += amount;
      continue;
    }

    if (tx.analysis_category === "fixed_costs") {
      totals.fixedCosts += amount;
      totals.expenseTotal += amount;
      continue;
    }

    if (tx.analysis_category === "subscriptions") {
      totals.subscriptions += amount;
      totals.expenseTotal += amount;
      continue;
    }

    if (tx.analysis_category === "variable_costs") {
      totals.variableCosts += amount;
      totals.expenseTotal += amount;
    }
  }

  return {
    incomeTotal: round2(totals.incomeTotal),
    includedForecastEligibleIncomeTotal: round2(
      totals.includedForecastEligibleIncomeTotal,
    ),
    structuralIncomeTotal: round2(totals.structuralIncomeTotal),
    variableIncomeTotal: round2(totals.variableIncomeTotal),
    expenseTotal: round2(totals.expenseTotal),
    savingsOutflowTotal: round2(totals.savingsOutflowTotal),
    fixedCosts: round2(totals.fixedCosts),
    subscriptions: round2(totals.subscriptions),
    variableCosts: round2(totals.variableCosts),
  } satisfies BookedMonthTotals;
}

function resolveForecastMonths(reference: Date, now: Date) {
  const currentMonthStart = startOfMonth(now);
  const targetMonthStart = startOfMonth(reference);
  const diff = monthsDiff(currentMonthStart, targetMonthStart);

  if (diff < 0) {
    return [targetMonthStart];
  }

  const monthsAhead = Math.max(FUTURE_FORECAST_MONTHS, diff);
  return Array.from({ length: monthsAhead + 1 }, (_, index) =>
    addMonths(currentMonthStart, index),
  );
}

function resolveForecastReferenceDate(monthStart: Date, now: Date) {
  const currentMonthStart = startOfMonth(now);
  const monthDiff = monthsDiff(currentMonthStart, monthStart);

  if (monthDiff < 0) {
    return addDays(endOfMonthExclusive(monthStart), -1);
  }
  if (monthDiff === 0) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
  return addDays(monthStart, -1);
}

function buildTopCostBuckets(params: {
  expectedFixedCosts: number;
  expectedSubscriptions: number;
  expectedVariableCosts: number;
  expectedSavingsOutflowTotal: number;
}) {
  const { expectedFixedCosts, expectedSubscriptions, expectedVariableCosts, expectedSavingsOutflowTotal } =
    params;

  return [
    { key: "fixed_costs", value: expectedFixedCosts },
    { key: "subscriptions", value: expectedSubscriptions },
    { key: "variable_costs", value: expectedVariableCosts },
    { key: "savings_transfer", value: expectedSavingsOutflowTotal },
  ]
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map((entry) => entry.key);
}

function normalizeEventKeyPart(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapEventTypeForStorage(
  event: ForecastTimelineEvent | ForecastEvent,
): StoredForecastTimelineEvent["event_type"] {
  if ("timelineKind" in event && event.timelineKind) {
    if (event.timelineKind === "income") return "income";
    if (event.timelineKind === "subscription") return "subscription";
    if (event.timelineKind === "fixed_cost") return "fixed_cost";
    if (event.timelineKind === "savings_transfer") return "savings_transfer";
  }

  if ("type" in event) {
    if (event.type === "income") return "income";
    if (event.type === "expense") return "fixed_cost";
    if (event.type === "reserve_allocation") return "savings_transfer";
    return "savings_transfer";
  }

  if (event.kind === "income") return "income";
  if (event.kind === "fixed_cost") return "fixed_cost";
  if (event.kind === "subscription") return "subscription";
  return "savings_transfer";
}

function mapCertaintyToTimelineConfidence(
  certainty: ForecastEvent["certainty"],
): StoredForecastTimelineEvent["confidence"] {
  if (certainty === "booked" || certainty === "committed") return "high";
  return "medium";
}

function buildTimelineEventRows(params: {
  row: StoredForecastSummary;
  userId: string;
  events: (ForecastTimelineEvent | ForecastEvent)[];
  computedAtIso: string;
}): StoredForecastTimelineEvent[] {
  const { row, userId, events, computedAtIso } = params;
  const mapped: StoredForecastTimelineEvent[] = [];

  for (const event of events) {
    const eventType = mapEventTypeForStorage(event);
    if (
      "type" in event &&
      (event.type === "internal_transfer" || event.type === "correction")
    ) {
      continue;
    }
    const normalizedLabel = normalizeEventKeyPart(event.label) || "event";
    const eventKey = [
      "timelineSource" in event && event.timelineSource
        ? event.timelineSource
        : "source" in event
          ? event.source
          : "derived",
      eventType,
      event.date,
      normalizedLabel,
    ].join("|");

    const amount = event.amount;
    const confidence = "confidence" in event
      ? event.confidence
      : mapCertaintyToTimelineConfidence(event.certainty);
    mapped.push({
      user_id: userId,
      month_start: row.monthStart,
      event_key: eventKey,
      event_date: event.date,
      event_type: eventType,
      label: event.label,
      amount: round2(amount),
      source:
        "timelineSource" in event && event.timelineSource
          ? event.timelineSource
          : "source" in event
            ? event.source
            : "derived",
      confidence,
      fingerprint: [
        "timelineSource" in event && event.timelineSource
          ? event.timelineSource
          : "source" in event
            ? event.source
            : "derived",
        eventType,
        event.date,
        normalizedLabel,
        round2(amount),
        confidence,
        "incomeBucket" in event && event.incomeBucket ? event.incomeBucket : "none",
      ].join("|"),
      computed_at: computedAtIso,
      updated_at: computedAtIso,
    });
  }

  if (
    row.lowestExpectedBalanceDate &&
    row.lowestExpectedBalance != null
  ) {
    mapped.push({
      user_id: userId,
      month_start: row.monthStart,
      event_key: `derived|milestone_lowest_balance|${row.lowestExpectedBalanceDate}`,
      event_date: row.lowestExpectedBalanceDate,
      event_type: "milestone_lowest_balance",
      label: "Laagste saldo verwacht",
      amount: round2(row.lowestExpectedBalance),
      source: "derived",
      confidence: "high",
      fingerprint: [
        "derived",
        "milestone_lowest_balance",
        row.lowestExpectedBalanceDate,
        round2(row.lowestExpectedBalance),
      ].join("|"),
      computed_at: computedAtIso,
      updated_at: computedAtIso,
    });
  }

  return mapped;
}

function toStoredForecastRow(row: StoredForecastSummary, userId: string) {
  return {
    user_id: userId,
    month_start: row.monthStart,
    starting_balance: row.startingBalance,
    forecast_reference_date: row.forecastReferenceDate,
    current_balance_anchor: row.currentBalanceAnchor,
    current_balance_anchor_date: row.currentBalanceAnchorDate,
    booked_income_total: row.bookedIncomeTotal,
    booked_expense_total: row.bookedExpenseTotal,
    booked_savings_outflow_total: row.bookedSavingsOutflowTotal,
    remaining_expected_income_total: row.remainingExpectedIncomeTotal,
    remaining_expected_expense_total: row.remainingExpectedExpenseTotal,
    remaining_expected_savings_outflow_total:
      row.remainingExpectedSavingsOutflowTotal,
    expected_income_total: row.expectedIncomeTotal,
    expected_income_structural_total: row.expectedIncomeStructuralTotal,
    expected_income_variable_total: row.expectedIncomeVariableTotal,
    expected_expense_total: row.expectedExpenseTotal,
    expected_savings_outflow_total: row.expectedSavingsOutflowTotal,
    expected_cash_out_total: row.expectedCashOutTotal,
    expected_fixed_costs: row.expectedFixedCosts,
    expected_subscriptions: row.expectedSubscriptions,
    expected_variable_costs: row.expectedVariableCosts,
    upcoming_committed_income_total: row.upcomingCommittedIncomeTotal,
    upcoming_committed_expense_total: row.upcomingCommittedExpenseTotal,
    upcoming_committed_savings_outflow_total:
      row.upcomingCommittedSavingsOutflowTotal,
    lowest_expected_balance: row.lowestExpectedBalance,
    lowest_expected_balance_date: row.lowestExpectedBalanceDate,
    next_expected_event_date: row.nextExpectedEventDate,
    next_expected_event_label: row.nextExpectedEventLabel,
    cash_risk_flag: row.cashRiskFlag,
    avg_groceries: row.avgGroceries,
    avg_fuel: row.avgFuel,
    avg_smoking: row.avgSmoking,
    avg_other_variable: row.avgOtherVariable,
    expected_end_of_month_balance: row.expectedEndOfMonthBalance,
    risk_flag: row.riskFlag,
    top_cost_bucket_1: row.topCostBuckets[0] || null,
    top_cost_bucket_2: row.topCostBuckets[1] || null,
    top_cost_bucket_3: row.topCostBuckets[2] || null,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function recomputeCurrentMonthCashflowForecast(
  reference = new Date(),
) {
  const userId = await requireCurrentUserId();
  const now = new Date();
  const requestedMonths = resolveForecastMonths(reference, now);
  const earliestMonthStart = requestedMonths[0] || startOfMonth(reference);
  const latestMonthStart =
    requestedMonths[requestedMonths.length - 1] || startOfMonth(reference);
  const latestMonthEndExclusive = endOfMonthExclusive(latestMonthStart);
  const targetMonthStartIso = dateToIso(startOfMonth(reference));

  const currentMonthStart = startOfMonth(now);
  const budgetPlanRequestDescriptors = createBudgetPlanRequestDescriptors(
    requestedMonths,
    now,
  );
  const budgetPlanPromises = budgetPlanRequestDescriptors.map(
    async ({ monthStartIso, planReference }) => {
      const plan = await computeBudgetPlan(planReference, "default", now).catch(
        (error) => {
          console.warn(
            `[forecast] budget baseline unavailable for ${monthStartIso}`,
            error,
          );
          return null;
        },
      );

      return [monthStartIso, plan] as const;
    },
  );

  const [
    { categories, categoryMap },
    transactions,
    bankAccounts,
    incomeSources,
    profiles,
    budgetPlanEntries,
  ] =
    await Promise.all([
      fetchCategoryMap(),
      fetchTransactionsInRange(
        dateToIso(subtractDays(earliestMonthStart, HISTORY_LOOKBACK_DAYS)),
        dateToIso(latestMonthEndExclusive),
        userId,
      ),
      listBankAccounts().catch((error) => {
        console.warn("[forecast] bank accounts unavailable", error);
        return [] as Awaited<ReturnType<typeof listBankAccounts>>;
      }),
      fetchIncomeSources(userId).catch((error) => {
        console.warn("[forecast] income sources unavailable", error);
        return [] as IncomeSourceRow[];
      }),
      fetchActiveSubscriptionProfiles(userId).catch((error) => {
        console.warn("[forecast] subscription profiles unavailable", error);
        return [] as SubscriptionProfile[];
      }),
      Promise.all(budgetPlanPromises),
    ]);

  const budgetPlanByMonthStartIso = new Map(budgetPlanEntries);
  const bankAccountsById = new Map(
    bankAccounts.map((account) => [account.id, account]),
  );

  const resolvedIncomeSources = mergeForecastIncomeSources(
    incomeSources,
    deriveIncomeSourcesFromTransactions(transactions, categoryMap),
  );

  const rareSubscriptionItems = detectRareSubscriptionItems({
    transactions: transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      details: tx.details,
      counterparty: tx.counterparty,
      amount: tx.amount,
      category_id_auto: tx.category_id_auto,
      category_id_user: tx.category_id_user,
      analysis_category: tx.analysis_category,
    })),
    categories,
    referenceDate: dateToIso(now),
  });

  const forecastRows: StoredForecastSummary[] = [];
  const timelineRows: StoredForecastTimelineEvent[] = [];
  let chainedOpeningOperationalBalance: number | null = null;
  let chainedOpeningReservedBalance: number | null = 0;
  let chainedOpeningNetWorth: number | null = null;

  for (const monthStart of requestedMonths) {
    const monthStartIso = dateToIso(monthStart);
    const monthEndExclusive = endOfMonthExclusive(monthStart);
    const monthEndIso = dateToIso(monthEndExclusive);
    const referenceDate = resolveForecastReferenceDate(monthStart, now);
    const referenceIso = dateToIso(referenceDate);
    const monthDiff = monthsDiff(currentMonthStart, monthStart);
    const budgetPlanForMonth = budgetPlanByMonthStartIso.get(monthStartIso) || null;
    const expenseHistoryForecast = estimateRecentExpenseForecastFromHistory({
      transactions,
      categoryMap,
      currentMonthStart: monthDiff < 0 ? monthStart : currentMonthStart,
    });

    const booked = summarizeBookedMonthTransactions({
      transactions,
      categoryMap,
      forecastSettings: budgetPlanForMonth?.settings || null,
      monthStartIso,
      monthEndIso,
      referenceIso,
    });

    const recurringIncomeEvents = buildRecurringHistoryEvents({
      transactions,
      categoryMap,
      monthStart,
      monthEndExclusive,
      referenceDate,
      direction: "income",
    });
    const recurringExpenseEvents = buildRecurringHistoryEvents({
      transactions,
      categoryMap,
      monthStart,
      monthEndExclusive,
      referenceDate,
      direction: "expense",
    });
    const recurringSavingsEvents = buildRecurringHistoryEvents({
      transactions,
      categoryMap,
      monthStart,
      monthEndExclusive,
      referenceDate,
      direction: "savings",
    });

    const incomeEvents = mergeIncomeSourceEvents({
      incomeSources: resolvedIncomeSources,
      existingEvents: recurringIncomeEvents,
      transactions,
      categoryMap,
      monthStart,
      monthEndExclusive,
      referenceDate,
    });

    let expenseEvents = mergeSubscriptionProfileEvents({
      profiles,
      existingEvents: recurringExpenseEvents,
      transactions,
      categoryMap,
      monthStart,
      monthEndExclusive,
      referenceDate,
    });
    expenseEvents = mergeRareSubscriptionEvents({
      rareItems: rareSubscriptionItems,
      existingEvents: expenseEvents,
      monthStart,
      monthEndExclusive,
      referenceDate,
    });

    const includedIncomeEvents = [...incomeEvents.values()].filter((event) =>
      isIncludedForecastIncomeBucket(
        event.incomeBucket,
        budgetPlanForMonth?.settings || null,
      ),
    );
    const remainingCommittedIncomeTotal = sumIncomeEventAmounts(includedIncomeEvents);
    const remainingIncomeStructuralTotal = sumIncomeEventAmounts(
      includedIncomeEvents,
      (event) =>
        event.incomeBucket != null && event.incomeBucket !== "variable",
    );
    const remainingIncomeVariableTotal = sumIncomeEventAmounts(
      includedIncomeEvents,
      (event) => event.incomeBucket === "variable",
    );
    const remainingCommittedFixedCosts = sumEventAmounts(
      expenseEvents.values(),
      "fixed_cost",
    );
    const remainingCommittedSubscriptions = sumEventAmounts(
      expenseEvents.values(),
      "subscription",
    );
    const remainingCommittedSavingsOutflowTotal = sumEventAmounts(
      recurringSavingsEvents.values(),
      "savings_transfer",
    );

    const monthToDateExpenses = monthDiff === 0
      ? budgetPlanForMonth?.monthToDateExpenses || null
      : null;
    const incomeBaselines = resolveExpectedCashflowIncomeBaselineBreakdown({
      monthStart,
      budgetPlan: budgetPlanForMonth,
      incomeSources: resolvedIncomeSources,
    });
    const expectedIncomeBaseline = incomeBaselines.total;
    const expenseBaselines = resolveForecastExpenseBaselines({
      historyForecast: expenseHistoryForecast,
      budgetPlan: budgetPlanForMonth,
      monthToDateExpenses,
    });

    const openingOperationalBalance =
      monthDiff > 0
        ? chainedOpeningOperationalBalance
        : getLatestStartingBalanceFromTransactions(transactions, monthStartIso);
    const openingReservedBalance =
      monthDiff > 0 ? chainedOpeningReservedBalance : 0;
    const openingNetWorth =
      monthDiff > 0 ? chainedOpeningNetWorth : openingOperationalBalance;
    const knownBalance =
      monthDiff > 0
        ? ({
            balance: openingOperationalBalance,
            balanceDate: dateToIso(addDays(monthStart, -1)),
          } satisfies BalanceAnchor)
        : getLatestKnownBalanceFromTransactions(transactions, referenceIso);

    const legacyMath = buildForecastMonthMath({
      startingBalance: openingOperationalBalance,
      currentBalanceAnchor: knownBalance.balance,
      bookedIncomeTotal: booked.incomeTotal,
      bookedForecastEligibleIncomeTotal: booked.includedForecastEligibleIncomeTotal,
      bookedExpenseTotal: booked.expenseTotal,
      bookedSavingsOutflowTotal: booked.savingsOutflowTotal,
      bookedFixedCosts: booked.fixedCosts,
      bookedSubscriptions: booked.subscriptions,
      bookedVariableCosts: booked.variableCosts,
      expectedIncomeBaseline,
      remainingCommittedIncomeTotal,
      expectedFixedCostsBaseline: expenseBaselines.fixedCosts,
      expectedSubscriptionsBaseline: expenseBaselines.subscriptions,
      expectedVariableCostsBaseline: expenseBaselines.variableCosts,
      projectedVariableCostsTotal: expenseBaselines.projectedVariableCostsTotal,
      expectedSavingsOutflowBaseline: expenseBaselines.savingsTransfers,
      remainingCommittedFixedCosts,
      remainingCommittedSubscriptions,
      remainingCommittedSavingsOutflowTotal,
    });

    const timelineEventsForProjection = [
      ...expenseEvents.values(),
      ...recurringSavingsEvents.values(),
      ...includedIncomeEvents,
    ] as ForecastTimelineEvent[];

    const normalizedEvents = normalizeForecastEventsForMonth({
      monthStart,
      monthEndExclusive,
      referenceDate,
      categoryMap,
      bankAccountsById,
      bookedTransactions: transactions,
      timelineEvents: timelineEventsForProjection,
      carryover: buildForecastCarryoverFromLatestKnownBalance({
        balance: knownBalance.balance,
        date: knownBalance.balanceDate,
      }),
    });

    const eventMonthState = buildForecastMonthStateFromEvents({
      opening: {
        monthStart: monthStartIso,
        referenceDate: referenceIso,
        currentBalanceDate: knownBalance.balanceDate,
        openingOperationalBalance,
        openingReservedBalance,
        openingNetWorth,
        carryover: buildForecastCarryoverFromLatestKnownBalance({
          balance: knownBalance.balance,
          date: knownBalance.balanceDate,
        }),
      },
      events: normalizedEvents,
      freeToSpendCarryover:
        openingOperationalBalance == null
          ? null
          : round2(openingOperationalBalance - openingReservedBalance),
    });

    const timelineProjection = buildForecastTimelineProjection({
      currentBalanceAnchor: knownBalance.balance,
      referenceDate,
      monthEndExclusive,
      events: normalizedEvents,
    });

    const expectedIncomeStructuralTotal = round2(
      Math.max(
        booked.structuralIncomeTotal + remainingIncomeStructuralTotal,
        incomeBaselines.structural,
        booked.structuralIncomeTotal,
      ),
    );
    const expectedIncomeVariableTotal = round2(
      Math.max(
        booked.variableIncomeTotal + remainingIncomeVariableTotal,
        incomeBaselines.variable,
        booked.variableIncomeTotal,
      ),
    );

    const monthState = {
      ...eventMonthState,
      expectedIncomeTotal: legacyMath.expectedIncomeTotal,
      remainingExpectedIncomeTotal: legacyMath.remainingExpectedIncomeTotal,
      remainingExpectedExpenseTotal: legacyMath.remainingExpectedExpenseTotal,
      remainingExpectedSavingsOutflowTotal:
        legacyMath.remainingExpectedSavingsOutflowTotal,
      // De expliciete maandstate volgt nu de genormaliseerde eventlaag.
      expectedIncome: eventMonthState.expectedIncome,
      expectedExpenses: eventMonthState.expectedExpenses,
      expectedFixedCosts: legacyMath.expectedFixedCosts,
      expectedSubscriptions: legacyMath.expectedSubscriptions,
      expectedVariableCosts: legacyMath.expectedVariableCosts,
      expectedInternalTransfers: eventMonthState.expectedInternalTransfers,
      expectedReserveAllocations: eventMonthState.expectedReserveAllocations,
      expectedEndReservedBalance: eventMonthState.expectedEndReservedBalance,
      expectedEndNetWorth: eventMonthState.expectedEndNetWorth,
      expectedEndOperationalBalance: eventMonthState.expectedEndOperationalBalance,
      expectedEndBalance: eventMonthState.expectedEndOperationalBalance,
      riskFlag: eventMonthState.riskFlag,
      cashRiskFlag: eventMonthState.cashRiskFlag,
      nextExpectedEventDate: eventMonthState.nextExpectedEventDate,
      nextExpectedEventLabel: eventMonthState.nextExpectedEventLabel,
      lowestExpectedBalance: eventMonthState.lowestExpectedBalance,
      lowestExpectedBalanceDate: eventMonthState.lowestExpectedBalanceDate,
      upcomingCommittedIncomeTotal:
        eventMonthState.upcomingCommittedIncomeTotal,
      upcomingCommittedExpenseTotal:
        eventMonthState.upcomingCommittedExpenseTotal,
      freeToSpend:
        budgetPlanForMonth
          ? Math.max(
              (budgetPlanForMonth.flowSummary?.variableBudget ?? 0) -
                (budgetPlanForMonth.monthToDateExpenses?.variableCosts ?? 0),
              0,
            )
          : eventMonthState.freeToSpendCarryover,
    };

    const topCostBuckets = buildTopCostBuckets({
      expectedFixedCosts: legacyMath.expectedFixedCosts,
      expectedSubscriptions: legacyMath.expectedSubscriptions,
      expectedVariableCosts: legacyMath.expectedVariableCosts,
      expectedSavingsOutflowTotal: legacyMath.expectedSavingsOutflowTotal,
    });

    const row: StoredForecastSummary = {
      monthStart: monthStartIso,
      forecastReferenceDate: referenceIso,
      startingBalance: openingOperationalBalance,
      currentBalanceAnchor: knownBalance.balance,
      currentBalanceAnchorDate: knownBalance.balanceDate,
      bookedIncomeTotal: booked.incomeTotal,
      bookedExpenseTotal: booked.expenseTotal,
      bookedSavingsOutflowTotal: booked.savingsOutflowTotal,
      remainingExpectedIncomeTotal: monthState.remainingExpectedIncomeTotal,
      remainingExpectedExpenseTotal: monthState.remainingExpectedExpenseTotal,
      remainingExpectedSavingsOutflowTotal:
        monthState.remainingExpectedSavingsOutflowTotal,
      expectedIncomeTotal: monthState.expectedIncomeTotal,
      expectedIncomeStructuralTotal,
      expectedIncomeVariableTotal,
      expectedExpenseTotal: monthState.expectedExpenses,
      expectedSavingsOutflowTotal: legacyMath.expectedSavingsOutflowTotal,
      expectedCashOutTotal: legacyMath.expectedCashOutTotal,
      expectedFixedCosts: monthState.expectedFixedCosts,
      expectedSubscriptions: monthState.expectedSubscriptions,
      expectedVariableCosts: monthState.expectedVariableCosts,
      upcomingCommittedIncomeTotal: monthState.upcomingCommittedIncomeTotal,
      upcomingCommittedExpenseTotal: monthState.upcomingCommittedExpenseTotal,
      upcomingCommittedSavingsOutflowTotal:
        timelineProjection.upcomingCommittedSavingsOutflowTotal,
      lowestExpectedBalance: monthState.lowestExpectedBalance,
      lowestExpectedBalanceDate: monthState.lowestExpectedBalanceDate,
      nextExpectedEventDate: monthState.nextExpectedEventDate,
      nextExpectedEventLabel: monthState.nextExpectedEventLabel,
      avgGroceries: expenseHistoryForecast.variable.groceries,
      avgFuel: expenseHistoryForecast.variable.fuel,
      avgSmoking: expenseHistoryForecast.variable.smoking,
      avgOtherVariable: expenseHistoryForecast.variable.other,
      expectedEndOfMonthBalance: monthState.expectedEndBalance,
      riskFlag: monthState.riskFlag,
      cashRiskFlag: monthState.cashRiskFlag,
      topCostBuckets,
    };

    forecastRows.push(row);
    timelineRows.push(
      ...buildTimelineEventRows({
        row,
        userId,
        events: timelineProjection.events,
        computedAtIso: new Date().toISOString(),
      }),
    );
    chainedOpeningOperationalBalance = monthState.expectedEndOperationalBalance;
    chainedOpeningReservedBalance = monthState.expectedEndReservedBalance;
    chainedOpeningNetWorth = monthState.expectedEndNetWorth;
  }

  const upsertRows = forecastRows.map((row) => toStoredForecastRow(row, userId));
  let { error } = await supabase
    .from("monthly_cashflow_forecasts")
    .upsert(upsertRows, { onConflict: "user_id,month_start" });

  if (error && isMissingColumnError(error)) {
    const fallbackRows = upsertRows.map(
      ({
        expected_income_structural_total: _expectedIncomeStructuralTotal,
        expected_income_variable_total: _expectedIncomeVariableTotal,
        ...row
      }) => row,
    );
    error = (
      await supabase
        .from("monthly_cashflow_forecasts")
        .upsert(fallbackRows, { onConflict: "user_id,month_start" })
    ).error;
  }

  if (error) throw error;

  const monthStartValues = forecastRows.map((row) => row.monthStart);
  if (monthStartValues.length > 0) {
    const timelineDeleteResult = await supabase
      .from("forecast_timeline_events")
      .delete()
      .eq("user_id", userId)
      .in("month_start", monthStartValues);

    if (timelineDeleteResult.error) {
      if (
        isMissingRelationError(timelineDeleteResult.error) ||
        isMissingColumnError(timelineDeleteResult.error)
      ) {
        console.warn(
          "[forecast] timeline events table unavailable, continuing without persisted timeline",
        );
      } else {
        console.warn(
          "[forecast] timeline events clear failed, continuing with monthly forecast only",
          timelineDeleteResult.error,
        );
      }
    } else if (timelineRows.length > 0) {
      const timelineInsertResult = await supabase
        .from("forecast_timeline_events")
        .insert(timelineRows);

      if (timelineInsertResult.error) {
        if (
          isMissingRelationError(timelineInsertResult.error) ||
          isMissingColumnError(timelineInsertResult.error)
        ) {
          console.warn(
            "[forecast] timeline events table unavailable, continuing without persisted timeline",
          );
        } else {
          console.warn(
            "[forecast] timeline events write failed, continuing with monthly forecast only",
            timelineInsertResult.error,
          );
        }
      }
    }
  }

  return (
    forecastRows.find((row) => row.monthStart === targetMonthStartIso) ||
    forecastRows[0] || {
      monthStart: targetMonthStartIso,
      expectedIncomeTotal: 0,
      expectedIncomeStructuralTotal: 0,
      expectedIncomeVariableTotal: 0,
      expectedExpenseTotal: 0,
      expectedEndOfMonthBalance: null,
      riskFlag: "none" as const,
      cashRiskFlag: "none" as const,
      lowestExpectedBalance: null,
      lowestExpectedBalanceDate: null,
    }
  );
}
