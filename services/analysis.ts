import { supabase } from "@/services/supabase";
import { requireCurrentUserId } from "@/services/current-user";
import type {
    AnalysisCategory,
    AnalysisMainGroup,
    ExpenseAnalysisCategory,
    ForecastIncomeSource,
    RecurringType,
    TransactionAnalysisUpdate,
} from "@/types/categorization";
import { normalizePattern } from "./categorization-repository";

type AnalysisCategoryMeta = {
  id: string;
  key: string;
  budget_group: string | null;
};

type AnalysisTx = {
  id: string;
  date: string;
  details: string;
  counterparty: string | null;
  amount: number;
  category_id_auto: string | null;
  category_id_user: string | null;
  analysis_main_group: AnalysisMainGroup | null;
  analysis_category: AnalysisCategory | null;
  recurring: boolean;
  recurring_type: RecurringType | null;
  spending_pattern: "frequent_small_expense" | null;
};

type AnalysisSummary = {
  scanned: number;
  updated: number;
  incomeSourcesUpserted: number;
};

const PAGE_SIZE = 500;
const RECURRING_LOOKBACK_DAYS = 420;

const STRUCTURAL_INCOME_KEYWORDS = [
  "impres",
  "salaris",
  "loon",
  "kindgebonden",
  "toeslag",
  "teruggave",
  "declaratie",
  "refund",
  "uitkering",
];

const FIXED_EXPENSE_KEYWORDS = [
  "hypotheek",
  "rabobank",
  "zorgverzekering",
  "zilveren kruis",
  "zonneplan",
  "energie",
  "vitens",
  "water",
  "gblt",
  "gemeente",
  "noordoostpolder",
  "unive",
  "wegenbelasting",
  "veenstra",
  "verwarming",
  "cv installatie",
  "mrb",
  "motorrijtuig",
];

const SUBSCRIPTION_KEYWORDS = [
  "ziggo",
  "youfone",
  "vodafone",
  "netflix",
  "spotify",
  "google",
  "google cloud",
  "sony",
  "playstation",
  "paypal",
  "abonnement",
  "icloud",
  "adobe",
];

const SAVINGS_TRANSFER_KEYWORDS = [
  "spaar",
  "sparen",
  "spaarrekening",
  "belegging",
  "beleggen",
  "investering",
  "invest",
  "crypto",
  "overboeking eigen rekening",
  "naar sparen",
];

const VARIABLE_EXPENSE_KEYWORDS = [
  "jumbo",
  "plus",
  "albert heijn",
  "shell",
  "bp",
  "esso",
  "tango",
  "tinq",
  "total",
  "tabak",
  "sigaret",
  "rook",
  "snack",
  "therapie",
  "fysio",
  "psycholoog",
  "huisarts",
  "apotheek",
  "zorgkosten",
];

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function getDescriptor(tx: Pick<AnalysisTx, "counterparty" | "details">) {
  const base = normalizePattern(tx.counterparty || "");
  if (base) return base;
  const firstSegment =
    String(tx.details || "").split("|")[0] || tx.details || "";
  return normalizePattern(firstSegment);
}

function textHaystack(tx: Pick<AnalysisTx, "counterparty" | "details">) {
  return normalizePattern(`${tx.counterparty || ""} ${tx.details || ""}`);
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
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

function amountIsSimilar(left: number, right: number) {
  const absLeft = Math.abs(left);
  const absRight = Math.abs(right);
  const absoluteDiff = Math.abs(absLeft - absRight);
  return absoluteDiff <= Math.max(1, absLeft * 0.03, absRight * 0.03);
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

function resolveExpenseAnalysisCategory(
  haystack: string,
  categoryKey: string | null,
  budgetGroup: string | null,
): ExpenseAnalysisCategory {
  if (categoryKey) {
    if (isSavingsCategoryKey(categoryKey)) return "savings_transfer";
    if (isSubscriptionCategoryKey(categoryKey)) return "subscriptions";

    const isCareInsurance = isCareInsuranceCategoryKey(categoryKey);
    const isCareOther = isCareCategoryKey(categoryKey) && !isCareInsurance;
    if (isCareOther) return "variable_costs";

    if (
      categoryKey.startsWith("housing") ||
      isCareInsurance ||
      categoryKey.startsWith("auto_transport_car_insurance") ||
      categoryKey.startsWith("auto_transport_road_tax")
    ) {
      return "fixed_costs";
    }
  }

  if (budgetGroup === "savings") return "savings_transfer";
  if (budgetGroup === "fixed") return "fixed_costs";
  if (budgetGroup === "variable") return "variable_costs";

  if (includesAny(haystack, SAVINGS_TRANSFER_KEYWORDS)) {
    return "savings_transfer";
  }
  if (includesAny(haystack, SUBSCRIPTION_KEYWORDS)) return "subscriptions";

  if (haystack.includes("belastingdienst")) {
    const autoRelated =
      haystack.includes("auto") ||
      haystack.includes("mrb") ||
      haystack.includes("motorrijtuig") ||
      haystack.includes("wegenbelasting");
    return autoRelated ? "fixed_costs" : "variable_costs";
  }

  if (includesAny(haystack, FIXED_EXPENSE_KEYWORDS)) return "fixed_costs";
  if (includesAny(haystack, VARIABLE_EXPENSE_KEYWORDS)) return "variable_costs";
  return "variable_costs";
}

function resolveIncomeAnalysisCategory(haystack: string): AnalysisCategory {
  if (includesAny(haystack, STRUCTURAL_INCOME_KEYWORDS)) {
    return "income_structural";
  }
  return "income_variable";
}

async function getCategoryMetaMap(): Promise<
  Map<string, AnalysisCategoryMeta>
> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,key,budget_group");

  if (error) throw error;

  const map = new Map<string, AnalysisCategoryMeta>();
  for (const row of (data || []) as any[]) {
    map.set(String(row.id), {
      id: String(row.id),
      key: String(row.key || ""),
      budget_group: row.budget_group ? String(row.budget_group) : null,
    });
  }
  return map;
}

async function getTransactionsByIds(
  ids: string[],
  userId: string,
): Promise<AnalysisTx[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,date,details,counterparty,amount,category_id_auto,category_id_user,analysis_main_group,analysis_category,recurring,recurring_type,spending_pattern",
    )
    .eq("user_id", userId)
    .in("id", ids);

  if (error) throw error;

  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    date: String(row.date || ""),
    details: String(row.details || ""),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    amount: asNumber(row.amount, 0),
    category_id_auto: row.category_id_auto || null,
    category_id_user: row.category_id_user || null,
    analysis_main_group: (row.analysis_main_group ||
      null) as AnalysisMainGroup | null,
    analysis_category: (row.analysis_category ||
      null) as AnalysisCategory | null,
    recurring: Boolean(row.recurring),
    recurring_type: (row.recurring_type || null) as RecurringType | null,
    spending_pattern: row.spending_pattern || null,
  }));
}

async function getTransactionsInWindow(
  startIso: string,
  endIso: string,
  userId: string,
): Promise<AnalysisTx[]> {
  const rows: AnalysisTx[] = [];
  let offset = 0;

  while (true) {
    const to = offset + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id,date,details,counterparty,amount,category_id_auto,category_id_user,analysis_main_group,analysis_category,recurring,recurring_type,spending_pattern",
      )
      .eq("user_id", userId)
      .gte("date", startIso)
      .lt("date", endIso)
      .order("date", { ascending: false })
      .range(offset, to);

    if (error) throw error;

    const page = ((data || []) as any[]).map((row) => ({
      id: String(row.id),
      date: String(row.date || ""),
      details: String(row.details || ""),
      counterparty: row.counterparty ? String(row.counterparty) : null,
      amount: asNumber(row.amount, 0),
      category_id_auto: row.category_id_auto || null,
      category_id_user: row.category_id_user || null,
      analysis_main_group: (row.analysis_main_group ||
        null) as AnalysisMainGroup | null,
      analysis_category: (row.analysis_category ||
        null) as AnalysisCategory | null,
      recurring: Boolean(row.recurring),
      recurring_type: (row.recurring_type || null) as RecurringType | null,
      spending_pattern: row.spending_pattern || null,
    }));

    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function buildRecurringInfo(tx: AnalysisTx, history: AnalysisTx[]) {
  const descriptor = getDescriptor(tx);
  if (!descriptor) {
    return { recurring: false, recurringType: null as RecurringType | null };
  }

  const candidates = history
    .filter((item) => {
      if (item.amount >= 0 !== tx.amount >= 0) return false;
      if (!amountIsSimilar(item.amount, tx.amount)) return false;
      return getDescriptor(item) === descriptor;
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  if (candidates.length < 3) {
    return { recurring: false, recurringType: null as RecurringType | null };
  }

  const intervals: number[] = [];
  for (let i = 1; i < candidates.length; i += 1) {
    const prev = toDate(candidates[i - 1].date);
    const next = toDate(candidates[i].date);
    const days = Math.round((next.getTime() - prev.getTime()) / 86400000);
    if (days > 0) intervals.push(days);
  }

  if (!intervals.length) {
    return { recurring: false, recurringType: null as RecurringType | null };
  }

  return {
    recurring: true,
    recurringType: classifyRecurringType(intervals),
  };
}

function buildSpendingPattern(
  tx: AnalysisTx,
  allWindowTransactions: AnalysisTx[],
  analysisCategory: AnalysisCategory,
) {
  if (tx.amount >= 0 || analysisCategory !== "variable_costs") return null;

  const descriptor = getDescriptor(tx);
  if (!descriptor) return null;

  const txDate = toDate(tx.date);
  const monthStartIso = dateToIso(startOfMonth(txDate));
  const monthEndIso = dateToIso(
    new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth() + 1, 1)),
  );

  const monthRows = allWindowTransactions.filter((item) => {
    if (item.date < monthStartIso || item.date >= monthEndIso) return false;
    if (item.amount >= 0) return false;
    if (getDescriptor(item) !== descriptor) return false;
    return Math.abs(item.amount) < 25;
  });

  if (!monthRows.length) return null;

  const avg =
    monthRows.reduce((sum, item) => sum + Math.abs(item.amount), 0) /
    monthRows.length;

  if (monthRows.length > 8 && avg < 25) {
    return "frequent_small_expense" as const;
  }

  return null;
}

function buildAnalysisUpdate(
  tx: AnalysisTx,
  categoryMap: Map<string, AnalysisCategoryMeta>,
  allWindowTransactions: AnalysisTx[],
): TransactionAnalysisUpdate {
  const effectiveCategoryId = tx.category_id_user || tx.category_id_auto;
  const categoryMeta = effectiveCategoryId
    ? categoryMap.get(effectiveCategoryId)
    : null;
  const haystack = textHaystack(tx);

  const analysisMainGroup: AnalysisMainGroup =
    tx.amount >= 0 ? "income" : "expense";

  const analysisCategory =
    analysisMainGroup === "income"
      ? resolveIncomeAnalysisCategory(haystack)
      : resolveExpenseAnalysisCategory(
          haystack,
          categoryMeta?.key || null,
          categoryMeta?.budget_group || null,
        );

  const recurringInfo = buildRecurringInfo(tx, allWindowTransactions);
  const spendingPattern = buildSpendingPattern(
    tx,
    allWindowTransactions,
    analysisCategory,
  );

  return {
    transactionId: tx.id,
    analysisMainGroup,
    analysisCategory,
    recurring: recurringInfo.recurring,
    recurringType: recurringInfo.recurringType,
    spendingPattern,
  };
}

function updateChanged(
  current: AnalysisTx,
  next: TransactionAnalysisUpdate,
): boolean {
  return (
    current.analysis_main_group !== next.analysisMainGroup ||
    current.analysis_category !== next.analysisCategory ||
    Boolean(current.recurring) !== Boolean(next.recurring) ||
    current.recurring_type !== next.recurringType ||
    current.spending_pattern !== next.spendingPattern
  );
}

function mergeIncomeSources(
  tx: AnalysisTx,
  update: TransactionAnalysisUpdate,
  collector: Map<string, ForecastIncomeSource>,
) {
  if (update.analysisMainGroup !== "income") return;

  const descriptor = getDescriptor(tx);
  if (!descriptor) return;

  const date = toDate(tx.date);
  const detectedAtIso = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  ).toISOString();
  const sourceLabel = (
    tx.counterparty ||
    tx.details.split("|")[0] ||
    "Inkomst"
  ).trim();
  const nextFrequency = update.recurringType || "irregular";
  const nextValue = Math.abs(tx.amount);

  const existing = collector.get(descriptor);
  if (!existing) {
    collector.set(descriptor, {
      sourceKey: descriptor,
      sourceLabel,
      expectedIncome: nextValue,
      incomeFrequency: nextFrequency,
      incomeDayOfMonth: date.getUTCDate(),
      lastDetectedAt: detectedAtIso,
    });
    return;
  }

  const expectedIncome = (existing.expectedIncome + nextValue) / 2;
  const incomeFrequency =
    existing.incomeFrequency === "irregular"
      ? nextFrequency
      : existing.incomeFrequency;

  collector.set(descriptor, {
    ...existing,
    sourceLabel,
    expectedIncome,
    incomeFrequency,
    incomeDayOfMonth: date.getUTCDate(),
    lastDetectedAt:
      detectedAtIso > existing.lastDetectedAt
        ? detectedAtIso
        : existing.lastDetectedAt,
  });
}

async function applyAnalysisUpdates(
  updates: TransactionAnalysisUpdate[],
  userId: string,
) {
  for (const update of updates) {
    const { error } = await supabase
      .from("transactions")
      .update({
        analysis_main_group: update.analysisMainGroup,
        analysis_category: update.analysisCategory,
        recurring: update.recurring,
        recurring_type: update.recurringType,
        spending_pattern: update.spendingPattern,
        analysis_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", update.transactionId);

    if (error) throw error;
  }
}

async function upsertIncomeSources(
  sources: ForecastIncomeSource[],
  userId: string,
) {
  if (!sources.length) return;

  const payload = sources.map((source) => ({
    user_id: userId,
    source_key: source.sourceKey,
    source_label: source.sourceLabel,
    expected_income: source.expectedIncome,
    income_frequency: source.incomeFrequency,
    income_day_of_month: source.incomeDayOfMonth,
    last_detected_at: source.lastDetectedAt,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("forecast_income_sources")
    .upsert(payload, { onConflict: "user_id,source_key" });

  if (error) throw error;
}

export async function enrichTransactionAnalysis(
  transactionIds: string[],
): Promise<AnalysisSummary> {
  const userId = await requireCurrentUserId();
  const uniqueIds = Array.from(new Set(transactionIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return { scanned: 0, updated: 0, incomeSourcesUpserted: 0 };
  }

  const currentRows = await getTransactionsByIds(uniqueIds, userId);
  if (!currentRows.length) {
    return { scanned: 0, updated: 0, incomeSourcesUpserted: 0 };
  }

  const newestDate = currentRows
    .map((row) => row.date)
    .sort((left, right) => right.localeCompare(left))[0];

  const endDate = toDate(newestDate || dateToIso(new Date()));
  const startDate = subtractDays(endDate, RECURRING_LOOKBACK_DAYS);
  const allWindowTransactions = await getTransactionsInWindow(
    dateToIso(startDate),
    dateToIso(new Date(endDate.getTime() + 24 * 60 * 60 * 1000)),
    userId,
  );

  const categoryMap = await getCategoryMetaMap();
  const updates: TransactionAnalysisUpdate[] = [];
  const incomeCollector = new Map<string, ForecastIncomeSource>();

  for (const tx of currentRows) {
    const update = buildAnalysisUpdate(tx, categoryMap, allWindowTransactions);
    if (!updateChanged(tx, update)) continue;
    updates.push(update);
    mergeIncomeSources(tx, update, incomeCollector);
  }

  if (updates.length) {
    await applyAnalysisUpdates(updates, userId);
  }

  const incomeSources = Array.from(incomeCollector.values());
  if (incomeSources.length) {
    await upsertIncomeSources(incomeSources, userId);
  }

  return {
    scanned: currentRows.length,
    updated: updates.length,
    incomeSourcesUpserted: incomeSources.length,
  };
}
