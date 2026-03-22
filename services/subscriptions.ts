import {
  normalizePattern,
  setTransactionManualCategory,
} from "@/services/categorization-repository";
import { requireCurrentUserId } from "@/services/current-user";
import { requestForecastRefresh } from "@/services/forecast-refresh";
import { supabase } from "@/services/supabase";
import type {
  CategoryRecord,
  SubscriptionBillingCycle,
  SubscriptionMatchSource,
  SubscriptionProfile,
  SubscriptionProfileRule,
  SubscriptionProfileRuleType,
  SubscriptionProviderHint,
  SubscriptionQueueItem,
  SubscriptionSuggestion,
  SubscriptionValidationCandidate,
  TransactionSubscriptionMatch,
} from "@/types/categorization";

const DEFAULT_PLAN_KEY = "default";
const MS_PER_DAY = 1000 * 60 * 60 * 24;

type RowRecord = Record<string, unknown>;

type QueueTransactionRow = {
  id: string;
  date: string;
  counterparty: string | null;
  details: string;
  amount: number;
  analysisCategory: string | null;
  categoryIdAuto: string | null;
  categoryIdUser: string | null;
};

type SubscriptionHistoryItem = {
  date: string;
  amount: number;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

type LoadedSubscriptionProfiles = {
  profiles: SubscriptionProfile[];
  activeProfiles: SubscriptionProfile[];
  rulesByProfileId: SubscriptionRulesByProfileId;
};

export type CreateSubscriptionProfileInput = {
  planKey?: string;
  name: string;
  billingCycle?: SubscriptionBillingCycle;
  expectedAmount?: number | null;
  amountTolerance?: number;
  expectedDayOfMonth?: number | null;
  providerHint?: SubscriptionProviderHint | null;
  isActive?: boolean;
};

export type UpdateSubscriptionProfileInput = {
  name?: string;
  billingCycle?: SubscriptionBillingCycle;
  expectedAmount?: number | null;
  amountTolerance?: number;
  expectedDayOfMonth?: number | null;
  providerHint?: SubscriptionProviderHint | null;
  isActive?: boolean;
};

export type UpsertSubscriptionProfileRuleInput = {
  id?: string;
  subscriptionProfileId: string;
  pattern: string;
  patternType: SubscriptionProfileRuleType;
  weight?: number;
  isActive?: boolean;
};

export type UpsertTransactionSubscriptionMatchInput = {
  transactionId: string;
  subscriptionProfileId: string | null;
  matchSource: SubscriptionMatchSource;
  confidence?: number | null;
  notes?: string | null;
};

export type TransactionSubscriptionMatchWithProfile = {
  match: TransactionSubscriptionMatch;
  profile: SubscriptionProfile | null;
};

export type SubscriptionRulesByProfileId = Record<
  string,
  SubscriptionProfileRule[]
>;

export type SubscriptionDashboardData = {
  profiles: SubscriptionProfile[];
  rulesByProfileId: SubscriptionRulesByProfileId;
  queueItems: SubscriptionQueueItem[];
};

export type LinkTransactionToSubscriptionInput = {
  transactionId: string;
  subscriptionProfileId: string;
  notes?: string | null;
  confidence?: number | null;
  setCategoryToSubscriptions?: boolean;
};

export type LinkTransactionsToSubscriptionInput = {
  transactionIds: string[];
  subscriptionProfileId: string;
  notes?: string | null;
  confidence?: number | null;
  setCategoryToSubscriptions?: boolean;
};

export type MonthlyValidationCandidatesInput = {
  sourceTransactionId: string;
  sourceDate: string;
  sourceProviderHint: SubscriptionProviderHint | null;
  expectedAmount: number | null;
  amountTolerance: number;
  expectedDayOfMonth: number | null;
  maxCandidates?: number;
};

export type SubscriptionRuleValidationCandidatesInput = {
  profileId?: string | null;
  sourceTransactionId?: string | null;
  sourceDate?: string | null;
  name: string;
  billingCycle: SubscriptionBillingCycle;
  expectedAmount: number | null;
  amountTolerance: number;
  expectedDayOfMonth: number | null;
  providerHint?: SubscriptionProviderHint | null;
  rules: {
    pattern: string;
    patternType: SubscriptionProfileRuleType;
  }[];
  maxCandidates?: number;
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function normalizePlanKey(planKey?: string): string {
  const trimmed = String(planKey || DEFAULT_PLAN_KEY).trim();
  return trimmed || DEFAULT_PLAN_KEY;
}

function normalizeBillingCycle(value: unknown): SubscriptionBillingCycle {
  const raw = String(value || "monthly");
  if (raw === "quarterly" || raw === "yearly" || raw === "monthly") {
    return raw;
  }
  return "monthly";
}

function normalizeProviderHint(
  value: unknown,
): SubscriptionProviderHint | null {
  if (value == null) return null;
  const raw = String(value || "").trim();
  if (
    raw === "paypal" ||
    raw === "google_play" ||
    raw === "apple" ||
    raw === "klarna" ||
    raw === "other"
  ) {
    return raw;
  }
  return null;
}

function normalizeRuleType(value: unknown): SubscriptionProfileRuleType {
  const raw = String(value || "counterparty_contains");
  return raw === "details_contains"
    ? "details_contains"
    : "counterparty_contains";
}

function normalizeMatchSource(value: unknown): SubscriptionMatchSource {
  const raw = String(value || "heuristic");
  if (
    raw === "manual" ||
    raw === "rule" ||
    raw === "heuristic" ||
    raw === "ignored"
  ) {
    return raw;
  }
  return "heuristic";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAmountTolerance(value: unknown): number {
  return Math.max(0, asNumber(value, 0));
}

function normalizeExpectedDayOfMonth(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 31) return null;
  return parsed;
}

function normalizeExpectedAmount(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed);
}

function normalizeRuleWeight(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 50;
  return clamp(parsed, 1, 100);
}

function isMissingSubscriptionRelationError(
  error: SupabaseLikeError | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;

  const message = String(error.message || "").toLowerCase();
  if (!message) return false;

  return (
    message.includes("could not find the table") &&
    (message.includes("subscription_profiles") ||
      message.includes("subscription_profile_rules") ||
      message.includes("transaction_subscription_matches"))
  );
}

function parseUtcDate(dateIso: string): Date | null {
  const parsed = new Date(
    `${String(dateIso || "").slice(0, 10)}T00:00:00.000Z`,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function dayOfMonthUtc(dateIso: string): number | null {
  const parsed = parseUtcDate(dateIso);
  if (!parsed) return null;
  return parsed.getUTCDate();
}

function daysBetween(leftDateIso: string, rightDateIso: string): number | null {
  const left = parseUtcDate(leftDateIso);
  const right = parseUtcDate(rightDateIso);
  if (!left || !right) return null;
  return Math.round(Math.abs(left.getTime() - right.getTime()) / MS_PER_DAY);
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [values];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function createRulesByProfileId(
  profileIds: string[],
): SubscriptionRulesByProfileId {
  return Array.from(new Set(profileIds)).reduce<SubscriptionRulesByProfileId>(
    (acc, profileId) => {
      acc[profileId] = [];
      return acc;
    },
    {},
  );
}

function mapProfileRow(row: RowRecord): SubscriptionProfile {
  return {
    id: String(row.id || ""),
    planKey: String(row.plan_key || DEFAULT_PLAN_KEY),
    name: String(row.name || ""),
    normalizedName: String(row.normalized_name || ""),
    billingCycle: normalizeBillingCycle(row.billing_cycle),
    expectedAmount: normalizeExpectedAmount(row.expected_amount),
    amountTolerance: normalizeAmountTolerance(row.amount_tolerance),
    expectedDayOfMonth: normalizeExpectedDayOfMonth(row.expected_day_of_month),
    providerHint: normalizeProviderHint(row.provider_hint),
    isActive: asBoolean(row.is_active, true),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function mapRuleRow(row: RowRecord): SubscriptionProfileRule {
  return {
    id: String(row.id || ""),
    subscriptionProfileId: String(row.subscription_profile_id || ""),
    pattern: String(row.pattern || ""),
    patternNormalized: String(row.pattern_normalized || ""),
    patternType: normalizeRuleType(row.pattern_type),
    weight: normalizeRuleWeight(row.weight),
    isActive: asBoolean(row.is_active, true),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function mapMatchRow(row: RowRecord): TransactionSubscriptionMatch {
  return {
    transactionId: String(row.transaction_id || ""),
    subscriptionProfileId: row.subscription_profile_id
      ? String(row.subscription_profile_id)
      : null,
    matchSource: normalizeMatchSource(row.match_source),
    confidence: asNullableNumber(row.confidence),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function normalizeQueueTransaction(row: RowRecord): QueueTransactionRow {
  return {
    id: String(row.id || ""),
    date: String(row.date || ""),
    counterparty: row.counterparty == null ? null : String(row.counterparty),
    details: String(row.details || ""),
    amount: asNumber(row.amount, 0),
    analysisCategory: row.analysis_category
      ? String(row.analysis_category)
      : null,
    categoryIdAuto: row.category_id_auto ? String(row.category_id_auto) : null,
    categoryIdUser: row.category_id_user ? String(row.category_id_user) : null,
  };
}

const PROVIDER_RULES: {
  provider: SubscriptionProviderHint;
  tokens: string[];
}[] = [
  {
    provider: "paypal",
    tokens: ["paypal"],
  },
  {
    provider: "google_play",
    tokens: ["google play", "google*play", "g.co/helppay"],
  },
  {
    provider: "apple",
    tokens: ["apple", "itunes", "apple.com/bill", "apple services"],
  },
  {
    provider: "klarna",
    tokens: ["klarna", "riverty", "afterpay", "billink", "in3", "sprinque"],
  },
];

const GENERIC_PSP_PROVIDER_TOKENS = [
  "payment provider",
  "merchant of record",
  "mangopay",
  "adyen",
  "mollie",
  "stripe",
  "checkout com",
  "paddle",
  "fastspring",
];

function containsProviderToken(haystack: string, tokenRaw: string): boolean {
  const token = normalizePattern(tokenRaw);
  if (!token) return false;

  const tokenWords = token.split(" ").filter(Boolean);
  if (tokenWords.length === 1) {
    const haystackWords = haystack.split(" ").filter(Boolean);
    return haystackWords.includes(token);
  }

  return haystack.includes(token);
}

function detectProvider(
  counterparty: string | null,
  details: string,
): SubscriptionProviderHint | null {
  const haystack = normalizePattern(`${counterparty || ""} ${details || ""}`);
  if (!haystack) return null;

  for (const rule of PROVIDER_RULES) {
    if (rule.tokens.some((token) => containsProviderToken(haystack, token))) {
      return rule.provider;
    }
  }

  if (
    GENERIC_PSP_PROVIDER_TOKENS.some((token) =>
      containsProviderToken(haystack, token),
    )
  ) {
    return "other";
  }

  return null;
}

function isKnownSubscriptionTransaction(
  tx: QueueTransactionRow,
  subscriptionCategoryIds: Set<string>,
): boolean {
  if (tx.analysisCategory === "subscriptions") return true;
  const categoryId = tx.categoryIdUser || tx.categoryIdAuto;
  if (!categoryId) return false;
  return subscriptionCategoryIds.has(categoryId);
}

async function listSubscriptionCategoryIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .like("key", "subscriptions%");

  if (error) throw error;

  const ids = new Set<string>();
  for (const row of (data || []) as RowRecord[]) {
    const id = String(row.id || "");
    if (!id) continue;
    ids.add(id);
  }
  return ids;
}

function getFrequencyWindowDays(cycle: SubscriptionBillingCycle): {
  min: number;
  max: number;
} {
  if (cycle === "quarterly") {
    return { min: 80, max: 100 };
  }
  if (cycle === "yearly") {
    return { min: 350, max: 380 };
  }
  return { min: 25, max: 35 };
}

function formatCycleLabel(cycle: SubscriptionBillingCycle): string {
  if (cycle === "quarterly") return "per kwartaal";
  if (cycle === "yearly") return "jaarlijks";
  return "maandelijks";
}

function findPreviousHistoryItem(
  history: SubscriptionHistoryItem[],
  txDate: string,
): SubscriptionHistoryItem | null {
  for (const entry of history) {
    if (String(entry.date) < String(txDate)) {
      return entry;
    }
  }
  return null;
}

export function scoreSubscriptionSuggestion(
  tx: QueueTransactionRow,
  profile: SubscriptionProfile,
  rules: SubscriptionProfileRule[],
  history: SubscriptionHistoryItem[],
): {
  confidence: number;
  confidenceLabel: "hoog" | "middel" | null;
  reason: string;
} {
  const normalizedCounterparty = normalizePattern(tx.counterparty || "");
  const normalizedDetails = normalizePattern(tx.details || "");
  const normalizedCombined =
    `${normalizedCounterparty} ${normalizedDetails}`.trim();

  let score = 0;
  const reasons: string[] = [];

  const matchingRules = rules.filter((rule) => {
    if (!rule.isActive || !rule.patternNormalized) return false;
    if (rule.patternType === "counterparty_contains") {
      return normalizedCounterparty.includes(rule.patternNormalized);
    }
    return normalizedDetails.includes(rule.patternNormalized);
  });

  if (matchingRules.length > 0) {
    score += 0.5;
    reasons.push("regelmatch");
  }

  const hasNameMatch =
    profile.normalizedName.length > 0 &&
    normalizedCombined.includes(profile.normalizedName);
  const hasAliasMatchInDetails = rules.some(
    (rule) =>
      rule.isActive &&
      rule.patternType === "details_contains" &&
      normalizedDetails.includes(rule.patternNormalized),
  );

  if (hasNameMatch || hasAliasMatchInDetails) {
    score += 0.2;
    reasons.push("naam/alias in omschrijving");
  }

  const txAmount = Math.abs(asNumber(tx.amount, 0));
  const expectedAmount = profile.expectedAmount;
  if (expectedAmount != null) {
    const difference = Math.abs(txAmount - expectedAmount);
    if (difference <= profile.amountTolerance) {
      score += 0.2;
      reasons.push("bedrag binnen tolerantie");
    }
  }

  const previousMatch = findPreviousHistoryItem(history, tx.date);

  let frequencyMatched = false;
  if (previousMatch) {
    const gapDays = daysBetween(tx.date, previousMatch.date);
    if (gapDays != null) {
      const range = getFrequencyWindowDays(profile.billingCycle);
      frequencyMatched = gapDays >= range.min && gapDays <= range.max;
    }
  } else if (profile.expectedDayOfMonth != null) {
    const txDay = dayOfMonthUtc(tx.date);
    if (txDay != null) {
      frequencyMatched = Math.abs(txDay - profile.expectedDayOfMonth) <= 3;
    }
  }

  if (frequencyMatched) {
    score += 0.1;
    reasons.push(`ritme past bij ${formatCycleLabel(profile.billingCycle)}`);
  }

  const confidence = clamp(score, 0, 1);
  const confidenceLabel =
    confidence >= 0.85 ? "hoog" : confidence >= 0.65 ? "middel" : null;

  return {
    confidence,
    confidenceLabel,
    reason: reasons.length ? reasons.join(" + ") : "beperkte overeenkomst",
  };
}

export async function listSubscriptionProfiles(
  planKey = DEFAULT_PLAN_KEY,
): Promise<SubscriptionProfile[]> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(planKey);
  const { data, error } = await supabase
    .from("subscription_profiles")
    .select(
      "id,plan_key,name,normalized_name,billing_cycle,expected_amount,amount_tolerance,expected_day_of_month,provider_hint,is_active,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("plan_key", normalizedPlanKey)
    .order("name", { ascending: true });

  if (error) {
    if (isMissingSubscriptionRelationError(error)) return [];
    throw error;
  }
  return ((data || []) as RowRecord[]).map(mapProfileRow);
}

export async function createSubscriptionProfile(
  input: CreateSubscriptionProfileInput,
): Promise<SubscriptionProfile> {
  const userId = await requireCurrentUserId();
  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("Naam van abonnement is verplicht.");
  }

  const normalizedName = normalizePattern(name);
  if (!normalizedName) {
    throw new Error("Naam van abonnement is ongeldig.");
  }

  const payload = {
    user_id: userId,
    plan_key: normalizePlanKey(input.planKey),
    name,
    normalized_name: normalizedName,
    billing_cycle: normalizeBillingCycle(input.billingCycle),
    expected_amount: normalizeExpectedAmount(input.expectedAmount),
    amount_tolerance: normalizeAmountTolerance(input.amountTolerance),
    expected_day_of_month: normalizeExpectedDayOfMonth(
      input.expectedDayOfMonth,
    ),
    provider_hint: normalizeProviderHint(input.providerHint),
    is_active: input.isActive == null ? true : Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("subscription_profiles")
    .insert(payload)
    .select(
      "id,plan_key,name,normalized_name,billing_cycle,expected_amount,amount_tolerance,expected_day_of_month,provider_hint,is_active,created_at,updated_at",
    )
    .single();

  if (error) throw error;
  const profile = mapProfileRow(data as RowRecord);
  await requestForecastRefresh({
    reason: "subscription_profile",
    delayMs: 15000,
  }).catch((refreshError) => {
    console.warn("[subscriptions] forecast refresh scheduling failed", refreshError);
  });
  return profile;
}

export async function updateSubscriptionProfile(
  id: string,
  input: UpdateSubscriptionProfileInput,
): Promise<SubscriptionProfile> {
  const userId = await requireCurrentUserId();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name != null) {
    const name = String(input.name).trim();
    if (!name) {
      throw new Error("Naam van abonnement is verplicht.");
    }
    payload.name = name;
    payload.normalized_name = normalizePattern(name);
  }
  if (input.billingCycle != null) {
    payload.billing_cycle = normalizeBillingCycle(input.billingCycle);
  }
  if (input.expectedAmount !== undefined) {
    payload.expected_amount = normalizeExpectedAmount(input.expectedAmount);
  }
  if (input.amountTolerance !== undefined) {
    payload.amount_tolerance = normalizeAmountTolerance(input.amountTolerance);
  }
  if (input.expectedDayOfMonth !== undefined) {
    payload.expected_day_of_month = normalizeExpectedDayOfMonth(
      input.expectedDayOfMonth,
    );
  }
  if (input.providerHint !== undefined) {
    payload.provider_hint = normalizeProviderHint(input.providerHint);
  }
  if (input.isActive != null) {
    payload.is_active = Boolean(input.isActive);
  }

  const { data, error } = await supabase
    .from("subscription_profiles")
    .update(payload)
    .eq("user_id", userId)
    .eq("id", id)
    .select(
      "id,plan_key,name,normalized_name,billing_cycle,expected_amount,amount_tolerance,expected_day_of_month,provider_hint,is_active,created_at,updated_at",
    )
    .single();

  if (error) throw error;
  const profile = mapProfileRow(data as RowRecord);
  await requestForecastRefresh({
    reason: "subscription_profile",
    delayMs: 15000,
  }).catch((refreshError) => {
    console.warn("[subscriptions] forecast refresh scheduling failed", refreshError);
  });
  return profile;
}

export async function setSubscriptionProfileActive(
  id: string,
  isActive: boolean,
): Promise<SubscriptionProfile> {
  return updateSubscriptionProfile(id, { isActive });
}

export async function deleteSubscriptionProfile(id: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from("subscription_profiles")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) throw error;
  await requestForecastRefresh({
    reason: "subscription_profile",
    delayMs: 15000,
  }).catch((refreshError) => {
    console.warn("[subscriptions] forecast refresh scheduling failed", refreshError);
  });
}

export async function listSubscriptionProfileRules(
  profileId: string,
): Promise<SubscriptionProfileRule[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("subscription_profile_rules")
    .select(
      "id,subscription_profile_id,pattern,pattern_normalized,pattern_type,weight,is_active,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("subscription_profile_id", profileId)
    .order("weight", { ascending: false })
    .order("pattern", { ascending: true });

  if (error) {
    if (isMissingSubscriptionRelationError(error)) return [];
    throw error;
  }
  return ((data || []) as RowRecord[]).map(mapRuleRow);
}

export async function listSubscriptionProfileRulesByProfileIds(
  profileIds: string[],
): Promise<SubscriptionRulesByProfileId> {
  const userId = await requireCurrentUserId();
  const rulesByProfileId = createRulesByProfileId(profileIds);
  const uniqueProfileIds = Array.from(new Set(profileIds.filter(Boolean)));
  if (!uniqueProfileIds.length) return rulesByProfileId;

  const rows: SubscriptionProfileRule[] = [];

  for (const chunk of chunkArray(uniqueProfileIds, 200)) {
      const { data, error } = await supabase
        .from("subscription_profile_rules")
        .select(
          "id,subscription_profile_id,pattern,pattern_normalized,pattern_type,weight,is_active,created_at,updated_at",
        )
        .eq("user_id", userId)
        .in("subscription_profile_id", chunk)
      .order("subscription_profile_id", { ascending: true })
      .order("weight", { ascending: false })
      .order("pattern", { ascending: true });

    if (error) {
      if (isMissingSubscriptionRelationError(error)) return rulesByProfileId;
      throw error;
    }

    rows.push(...((data || []) as RowRecord[]).map(mapRuleRow));
  }

  for (const rule of rows) {
    if (!rulesByProfileId[rule.subscriptionProfileId]) {
      rulesByProfileId[rule.subscriptionProfileId] = [];
    }
    rulesByProfileId[rule.subscriptionProfileId].push(rule);
  }

  return rulesByProfileId;
}

async function loadSubscriptionProfiles(
  planKey = DEFAULT_PLAN_KEY,
): Promise<LoadedSubscriptionProfiles> {
  const profiles = await listSubscriptionProfiles(planKey);
  const rulesByProfileId = await listSubscriptionProfileRulesByProfileIds(
    profiles.map((profile) => profile.id),
  );

  return {
    profiles,
    activeProfiles: profiles.filter((profile) => profile.isActive),
    rulesByProfileId,
  };
}

export async function upsertSubscriptionProfileRule(
  input: UpsertSubscriptionProfileRuleInput,
): Promise<SubscriptionProfileRule> {
  const userId = await requireCurrentUserId();
  const pattern = String(input.pattern || "").trim();
  if (!pattern) {
    throw new Error("Pattern is verplicht.");
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    subscription_profile_id: input.subscriptionProfileId,
    pattern,
    pattern_normalized: normalizePattern(pattern),
    pattern_type: normalizeRuleType(input.patternType),
    weight: normalizeRuleWeight(input.weight),
    is_active: input.isActive == null ? true : Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    payload.id = input.id;
  }

  const onConflict = input.id
    ? "id"
    : "subscription_profile_id,pattern_normalized,pattern_type";

  const { data, error } = await supabase
    .from("subscription_profile_rules")
    .upsert(payload, { onConflict })
    .select(
      "id,subscription_profile_id,pattern,pattern_normalized,pattern_type,weight,is_active,created_at,updated_at",
    )
    .single();

  if (error) throw error;
  return mapRuleRow(data as RowRecord);
}

export async function deleteSubscriptionProfileRule(id: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from("subscription_profile_rules")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) throw error;
}

export async function upsertTransactionSubscriptionMatch(
  input: UpsertTransactionSubscriptionMatchInput,
): Promise<TransactionSubscriptionMatch> {
  const userId = await requireCurrentUserId();
  const payload = {
    user_id: userId,
    transaction_id: input.transactionId,
    subscription_profile_id: input.subscriptionProfileId,
    match_source: normalizeMatchSource(input.matchSource),
    confidence:
      input.confidence == null ? null : clamp(Number(input.confidence), 0, 1),
    notes: input.notes == null ? null : String(input.notes),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("transaction_subscription_matches")
    .upsert(payload, { onConflict: "transaction_id" })
    .select(
      "transaction_id,subscription_profile_id,match_source,confidence,notes,created_at,updated_at",
    )
    .single();

  if (error) throw error;
  return mapMatchRow(data as RowRecord);
}

export async function markTransactionAsNotSubscription(
  transactionId: string,
  notes?: string,
): Promise<TransactionSubscriptionMatch> {
  return upsertTransactionSubscriptionMatch({
    transactionId,
    subscriptionProfileId: null,
    matchSource: "ignored",
    confidence: null,
    notes: notes || null,
  });
}

export async function clearTransactionSubscriptionMatch(
  transactionId: string,
): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from("transaction_subscription_matches")
    .delete()
    .eq("user_id", userId)
    .eq("transaction_id", transactionId);

  if (error) throw error;
}

async function getTransactionRowsByIds(
  transactionIds: string[],
  userId: string,
): Promise<Record<string, QueueTransactionRow>> {
  if (!transactionIds.length) return {};

  const rows: QueueTransactionRow[] = [];
  for (const chunk of chunkArray(transactionIds, 200)) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,date,counterparty,details,amount")
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) throw error;
    rows.push(...((data || []) as RowRecord[]).map(normalizeQueueTransaction));
  }

  return rows.reduce<Record<string, QueueTransactionRow>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

async function getProfileHistoryByMatchedTransactions(
  profileIds: string[],
  userId: string,
): Promise<Record<string, SubscriptionHistoryItem[]>> {
  const emptyHistory = profileIds.reduce<
    Record<string, SubscriptionHistoryItem[]>
  >((acc, profileId) => {
    acc[profileId] = [];
    return acc;
  }, {});
  if (!profileIds.length) return emptyHistory;

  const { data: matchRows, error: matchError } = await supabase
    .from("transaction_subscription_matches")
    .select("transaction_id,subscription_profile_id,match_source")
    .eq("user_id", userId)
    .in("subscription_profile_id", profileIds)
    .neq("match_source", "ignored");

  if (matchError) {
    if (isMissingSubscriptionRelationError(matchError)) return emptyHistory;
    throw matchError;
  }

  const matches = ((matchRows || []) as RowRecord[])
    .map((row) => ({
      transactionId: String(row.transaction_id || ""),
      subscriptionProfileId: String(row.subscription_profile_id || ""),
    }))
    .filter((row) => row.transactionId && row.subscriptionProfileId);

  const allTransactionIds = Array.from(
    new Set(matches.map((row) => row.transactionId)),
  );
  const transactionById = await getTransactionRowsByIds(allTransactionIds, userId);

  for (const row of matches) {
    const tx = transactionById[row.transactionId];
    if (!tx) continue;
    if (!emptyHistory[row.subscriptionProfileId]) {
      emptyHistory[row.subscriptionProfileId] = [];
    }
    emptyHistory[row.subscriptionProfileId].push({
      date: tx.date,
      amount: tx.amount,
    });
  }

  for (const profileId of Object.keys(emptyHistory)) {
    emptyHistory[profileId].sort((left, right) =>
      String(right.date).localeCompare(String(left.date)),
    );
  }

  return emptyHistory;
}

function toSuggestion(
  tx: QueueTransactionRow,
  profile: SubscriptionProfile,
  rules: SubscriptionProfileRule[],
  history: SubscriptionHistoryItem[],
): SubscriptionSuggestion | null {
  const scored = scoreSubscriptionSuggestion(tx, profile, rules, history);
  if (!scored.confidenceLabel) return null;

  return {
    subscriptionProfileId: profile.id,
    subscriptionName: profile.name,
    confidence: scored.confidence,
    confidenceLabel: scored.confidenceLabel,
    reason: scored.reason,
  };
}

function toValidationCandidate(
  tx: QueueTransactionRow,
  providerDetected: SubscriptionProviderHint | null,
): SubscriptionValidationCandidate {
  return {
    transactionId: tx.id,
    date: tx.date,
    counterparty: tx.counterparty,
    details: tx.details,
    amount: tx.amount,
    providerDetected,
  };
}

function isWithinDayWindow(
  dateIso: string,
  expectedDayOfMonth: number,
  window = 3,
): boolean {
  const txDay = dayOfMonthUtc(dateIso);
  if (txDay == null) return false;
  return Math.abs(txDay - expectedDayOfMonth) <= window;
}

export async function listMonthlySubscriptionValidationCandidates(
  input: MonthlyValidationCandidatesInput,
): Promise<SubscriptionValidationCandidate[]> {
  const userId = await requireCurrentUserId();
  const sourceTransactionId = String(input.sourceTransactionId || "").trim();
  const sourceDate = String(input.sourceDate || "").slice(0, 10);
  const sourceProvider = normalizeProviderHint(input.sourceProviderHint);

  if (!sourceTransactionId || !sourceDate || !sourceProvider) {
    return [];
  }

  const expectedAmount = normalizeExpectedAmount(input.expectedAmount);
  const amountTolerance = normalizeAmountTolerance(input.amountTolerance);
  const expectedDayOfMonth = normalizeExpectedDayOfMonth(
    input.expectedDayOfMonth,
  );
  const maxCandidates = clamp(Math.round(input.maxCandidates || 3), 1, 10);

  let query = supabase
    .from("transactions")
    .select(
      "id,date,counterparty,details,amount,analysis_category,category_id_auto,category_id_user",
    )
    .eq("user_id", userId)
    .lt("date", sourceDate)
    .lt("amount", 0)
    .order("date", { ascending: false })
    .limit(300);

  if (expectedAmount != null) {
    const minAmount = Math.max(0, expectedAmount - amountTolerance);
    const maxAmount = expectedAmount + amountTolerance;

    // Amounts are negative in expenses, so bounds are mirrored.
    query = query.gte("amount", -maxAmount).lte("amount", -minAmount);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data || []) as RowRecord[])
    .map(normalizeQueueTransaction)
    .filter((tx) => tx.id && tx.id !== sourceTransactionId);

  if (!rows.length) return [];

  const { data: matchRows, error: matchError } = await supabase
    .from("transaction_subscription_matches")
    .select("transaction_id")
    .eq("user_id", userId)
    .in(
      "transaction_id",
      rows.map((row) => row.id),
    );

  if (matchError) {
    if (!isMissingSubscriptionRelationError(matchError)) {
      throw matchError;
    }
  }

  const alreadyMatchedIds = new Set(
    ((matchRows || []) as RowRecord[]).map((row) =>
      String(row.transaction_id || ""),
    ),
  );

  return rows
    .filter((tx) => !alreadyMatchedIds.has(tx.id))
    .map((tx) => ({
      tx,
      providerDetected: detectProvider(tx.counterparty, tx.details),
    }))
    .filter((row) => row.providerDetected === sourceProvider)
    .filter((row) => {
      if (expectedAmount == null) return true;
      const diff = Math.abs(Math.abs(row.tx.amount) - expectedAmount);
      return diff <= amountTolerance;
    })
    .filter((row) => {
      if (expectedDayOfMonth == null) return true;
      return isWithinDayWindow(row.tx.date, expectedDayOfMonth, 3);
    })
    .slice(0, maxCandidates)
    .map((row) => toValidationCandidate(row.tx, row.providerDetected));
}

export async function listSubscriptionRuleValidationCandidates(
  input: SubscriptionRuleValidationCandidatesInput,
): Promise<SubscriptionValidationCandidate[]> {
  const userId = await requireCurrentUserId();
  const sourceTransactionId = String(input.sourceTransactionId || "").trim();
  const sourceDate = String(input.sourceDate || "").slice(0, 10);
  const expectedAmount = normalizeExpectedAmount(input.expectedAmount);
  const amountTolerance = normalizeAmountTolerance(input.amountTolerance);
  const expectedDayOfMonth = normalizeExpectedDayOfMonth(
    input.expectedDayOfMonth,
  );
  const maxCandidates = clamp(Math.round(input.maxCandidates || 6), 1, 20);
  const normalizedName = normalizePattern(String(input.name || "").trim());

  const normalizedRules = (input.rules || [])
    .map((rule, index) => {
      const pattern = String(rule.pattern || "").trim();
      const patternNormalized = normalizePattern(pattern);
      if (!pattern || !patternNormalized) return null;
      return {
        id: `draft-${index}`,
        subscriptionProfileId: String(input.profileId || "draft"),
        pattern,
        patternNormalized,
        patternType: normalizeRuleType(rule.patternType),
        weight: 50,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      } satisfies SubscriptionProfileRule;
    })
    .filter((rule): rule is SubscriptionProfileRule => Boolean(rule));

  if (!normalizedName && normalizedRules.length === 0 && expectedAmount == null) {
    return [];
  }

  let query = supabase
    .from("transactions")
    .select(
      "id,date,counterparty,details,amount,analysis_category,category_id_auto,category_id_user",
    )
    .eq("user_id", userId)
    .lt("amount", 0)
    .order("date", { ascending: false })
    .limit(400);

  if (sourceDate) {
    query = query.lt("date", sourceDate);
  }

  if (expectedAmount != null) {
    const minAmount = Math.max(0, expectedAmount - amountTolerance);
    const maxAmount = expectedAmount + amountTolerance;
    query = query.gte("amount", -maxAmount).lte("amount", -minAmount);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data || []) as RowRecord[])
    .map(normalizeQueueTransaction)
    .filter((tx) => tx.id && tx.id !== sourceTransactionId);

  if (!rows.length) return [];

  const { data: matchRows, error: matchError } = await supabase
    .from("transaction_subscription_matches")
    .select("transaction_id")
    .eq("user_id", userId)
    .in(
      "transaction_id",
      rows.map((row) => row.id),
    );

  if (matchError) {
    if (!isMissingSubscriptionRelationError(matchError)) {
      throw matchError;
    }
  }

  const alreadyMatchedIds = new Set(
    ((matchRows || []) as RowRecord[]).map((row) =>
      String(row.transaction_id || ""),
    ),
  );

  const historyByProfileId = input.profileId
    ? await getProfileHistoryByMatchedTransactions([input.profileId], userId)
    : {};
  const history = input.profileId ? historyByProfileId[input.profileId] || [] : [];

  const draftProfile: SubscriptionProfile = {
    id: String(input.profileId || "draft"),
    planKey: DEFAULT_PLAN_KEY,
    name: String(input.name || "").trim(),
    normalizedName,
    billingCycle: normalizeBillingCycle(input.billingCycle),
    expectedAmount,
    amountTolerance,
    expectedDayOfMonth,
    providerHint: normalizeProviderHint(input.providerHint),
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };

  return rows
    .filter((tx) => !alreadyMatchedIds.has(tx.id))
    .map((tx) => ({
      tx,
      providerDetected: detectProvider(tx.counterparty, tx.details),
      score: scoreSubscriptionSuggestion(tx, draftProfile, normalizedRules, history),
    }))
    .filter((row) => row.score.confidenceLabel != null)
    .sort((left, right) => {
      if (right.score.confidence !== left.score.confidence) {
        return right.score.confidence - left.score.confidence;
      }
      return String(right.tx.date).localeCompare(String(left.tx.date));
    })
    .slice(0, maxCandidates)
    .map((row) => toValidationCandidate(row.tx, row.providerDetected));
}

async function buildSubscriptionQueue(
  monthStartIso: string,
  monthEndIso: string,
  activeProfiles: SubscriptionProfile[],
  rulesByProfileId: SubscriptionRulesByProfileId,
): Promise<SubscriptionQueueItem[]> {
  const userId = await requireCurrentUserId();
  const profileHistoryById = await getProfileHistoryByMatchedTransactions(
    activeProfiles.map((profile) => profile.id),
    userId,
  );
  const subscriptionCategoryIds = await listSubscriptionCategoryIds();

  const { data: txRows, error: txError } = await supabase
    .from("transactions")
    .select(
      "id,date,counterparty,details,amount,analysis_category,category_id_auto,category_id_user",
    )
    .eq("user_id", userId)
    .gte("date", monthStartIso)
    .lt("date", monthEndIso)
    .lt("amount", 0)
    .order("date", { ascending: false });

  if (txError) throw txError;

  const allCandidates = ((txRows || []) as RowRecord[])
    .map(normalizeQueueTransaction)
    .map((tx) => ({
      tx,
      providerDetected: detectProvider(tx.counterparty, tx.details),
      isKnownSubscription: isKnownSubscriptionTransaction(
        tx,
        subscriptionCategoryIds,
      ),
    }))
    .filter(
      (row) => row.providerDetected != null && !row.isKnownSubscription,
    );

  const candidateIds = allCandidates.map((row) => row.tx.id);
  if (!candidateIds.length) return [];

  const { data: matchRows, error: matchError } = await supabase
    .from("transaction_subscription_matches")
    .select("transaction_id")
    .eq("user_id", userId)
    .in("transaction_id", candidateIds);

  if (matchError) {
    if (isMissingSubscriptionRelationError(matchError)) {
      return allCandidates
        .map(({ tx, providerDetected }) => ({
          transactionId: tx.id,
          date: tx.date,
          counterparty: tx.counterparty,
          details: tx.details,
          amount: tx.amount,
          providerDetected,
          suggestions: activeProfiles
            .map((profile) =>
              toSuggestion(
                tx,
                profile,
                rulesByProfileId[profile.id] || [],
                profileHistoryById[profile.id] || [],
              ),
            )
            .filter((suggestion): suggestion is SubscriptionSuggestion =>
              Boolean(suggestion),
            )
            .sort((left, right) => right.confidence - left.confidence),
        }))
        .sort((left, right) =>
          String(right.date).localeCompare(String(left.date)),
        );
    }
    throw matchError;
  }

  const matchedTxIds = new Set(
    ((matchRows || []) as RowRecord[]).map((row) =>
      String(row.transaction_id || ""),
    ),
  );

  return allCandidates
    .filter((row) => !matchedTxIds.has(row.tx.id))
    .map(({ tx, providerDetected }) => {
      const suggestions = activeProfiles
        .map((profile) =>
          toSuggestion(
            tx,
            profile,
            rulesByProfileId[profile.id] || [],
            profileHistoryById[profile.id] || [],
          ),
        )
        .filter((suggestion): suggestion is SubscriptionSuggestion =>
          Boolean(suggestion),
        )
        .sort((left, right) => right.confidence - left.confidence);

      return {
        transactionId: tx.id,
        date: tx.date,
        counterparty: tx.counterparty,
        details: tx.details,
        amount: tx.amount,
        providerDetected,
        suggestions,
      };
    })
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

export async function getSubscriptionQueue(
  monthStartIso: string,
  monthEndIso: string,
  planKey = DEFAULT_PLAN_KEY,
): Promise<SubscriptionQueueItem[]> {
  const normalizedPlanKey = normalizePlanKey(planKey);
  const { activeProfiles, rulesByProfileId } =
    await loadSubscriptionProfiles(normalizedPlanKey);

  return buildSubscriptionQueue(
    monthStartIso,
    monthEndIso,
    activeProfiles,
    rulesByProfileId,
  );
}

export async function getSubscriptionDashboardData(
  monthStartIso: string,
  monthEndIso: string,
  planKey = DEFAULT_PLAN_KEY,
): Promise<SubscriptionDashboardData> {
  const normalizedPlanKey = normalizePlanKey(planKey);
  const { profiles, activeProfiles, rulesByProfileId } =
    await loadSubscriptionProfiles(normalizedPlanKey);

  return {
    profiles,
    rulesByProfileId,
    queueItems: await buildSubscriptionQueue(
      monthStartIso,
      monthEndIso,
      activeProfiles,
      rulesByProfileId,
    ),
  };
}

export async function getTransactionSubscriptionMatch(
  transactionId: string,
): Promise<TransactionSubscriptionMatchWithProfile | null> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("transaction_subscription_matches")
    .select(
      "transaction_id,subscription_profile_id,match_source,confidence,notes,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error) {
    if (isMissingSubscriptionRelationError(error)) return null;
    throw error;
  }
  if (!data) return null;

  const mapped = mapMatchRow(data as RowRecord);
  if (!mapped.subscriptionProfileId) {
    return {
      match: mapped,
      profile: null,
    };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("subscription_profiles")
    .select(
      "id,plan_key,name,normalized_name,billing_cycle,expected_amount,amount_tolerance,expected_day_of_month,provider_hint,is_active,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("id", mapped.subscriptionProfileId)
    .maybeSingle();

  if (profileError) {
    if (isMissingSubscriptionRelationError(profileError)) {
      return {
        match: mapped,
        profile: null,
      };
    }
    throw profileError;
  }

  return {
    match: mapped,
    profile: profileRow ? mapProfileRow(profileRow as RowRecord) : null,
  };
}

export async function listTransactionSubscriptionProfileNames(
  transactionIds: string[],
): Promise<Record<string, string>> {
  const userId = await requireCurrentUserId();
  const uniqueTransactionIds = Array.from(
    new Set(
      (transactionIds || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  if (!uniqueTransactionIds.length) return {};

  const matchRows: { transactionId: string; subscriptionProfileId: string }[] =
    [];

  for (const chunk of chunkArray(uniqueTransactionIds, 200)) {
    const { data, error } = await supabase
      .from("transaction_subscription_matches")
      .select("transaction_id,subscription_profile_id")
      .eq("user_id", userId)
      .in("transaction_id", chunk);

    if (error) {
      if (isMissingSubscriptionRelationError(error)) return {};
      throw error;
    }

    for (const row of (data || []) as RowRecord[]) {
      const transactionId = String(row.transaction_id || "");
      const subscriptionProfileId = String(row.subscription_profile_id || "");
      if (!transactionId || !subscriptionProfileId) continue;
      matchRows.push({ transactionId, subscriptionProfileId });
    }
  }

  if (!matchRows.length) return {};

  const profileIds = Array.from(
    new Set(matchRows.map((row) => row.subscriptionProfileId)),
  );
  const profileNamesById: Record<string, string> = {};

  for (const chunk of chunkArray(profileIds, 200)) {
    const { data, error } = await supabase
      .from("subscription_profiles")
      .select("id,name")
      .eq("user_id", userId)
      .in("id", chunk);

    if (error) {
      if (isMissingSubscriptionRelationError(error)) return {};
      throw error;
    }

    for (const row of (data || []) as RowRecord[]) {
      const id = String(row.id || "");
      const name = String(row.name || "").trim();
      if (!id || !name) continue;
      profileNamesById[id] = name;
    }
  }

  return matchRows.reduce<Record<string, string>>((acc, row) => {
    const profileName = profileNamesById[row.subscriptionProfileId];
    if (!profileName) return acc;
    acc[row.transactionId] = profileName;
    return acc;
  }, {});
}

async function findSubscriptionCategoryId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,key,sort_order")
    .like("key", "subscriptions%")
    .order("sort_order", { ascending: true })
    .order("key", { ascending: true })
    .limit(1);

  if (error) throw error;
  const first = ((data || []) as CategoryRecord[])[0] || null;
  return first ? String(first.id) : null;
}

export async function linkTransactionToSubscription(
  input: LinkTransactionToSubscriptionInput,
): Promise<TransactionSubscriptionMatch> {
  const mapped = await upsertTransactionSubscriptionMatch({
    transactionId: input.transactionId,
    subscriptionProfileId: input.subscriptionProfileId,
    matchSource: "manual",
    confidence: input.confidence ?? 1,
    notes: input.notes ?? null,
  });

  if (input.setCategoryToSubscriptions) {
    const categoryId = await findSubscriptionCategoryId();
    if (categoryId) {
      await setTransactionManualCategory(input.transactionId, categoryId, {
        reason: "abonnement gekoppeld",
        learnFromCounterparty: false,
      });
    }
  }

  return mapped;
}

export async function linkTransactionsToSubscription(
  input: LinkTransactionsToSubscriptionInput,
): Promise<TransactionSubscriptionMatch[]> {
  const uniqueTransactionIds = Array.from(
    new Set(
      (input.transactionIds || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  const results: TransactionSubscriptionMatch[] = [];
  for (const transactionId of uniqueTransactionIds) {
    const match = await linkTransactionToSubscription({
      transactionId,
      subscriptionProfileId: input.subscriptionProfileId,
      notes: input.notes,
      confidence: input.confidence,
      setCategoryToSubscriptions: input.setCategoryToSubscriptions,
    });
    results.push(match);
  }

  return results;
}
