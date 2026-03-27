import * as Crypto from "expo-crypto";

import { applyForecastAccountRules, resolveForecastAccountRules } from "@/services/forecast-account-rules";
import { isAccountIncludedInBudgetMoneyViewScope } from "@/services/finance-scope";
import { loadMoneyViewScopePreference } from "@/services/finance-scope-preference";
import { supabase } from "@/services/supabase";
import { requireCurrentUserId } from "@/services/current-user";

const BANK_ACCOUNT_SCOPED_SELECT =
  "id,name,account_type,provider,currency,account_masked,is_active,include_in_budget,forecast_role,include_in_cashflow,include_in_net_worth,owner_scope";
const BANK_ACCOUNT_LEGACY_SELECT =
  "id,name,account_type,provider,currency,account_masked,is_active,include_in_budget";

export type BankAccountType =
  | "checking"
  | "savings"
  | "credit"
  | "loan"
  | "investment"
  | "cash"
  | "other";

export type BankAccount = {
  id: string;
  name: string;
  account_type: BankAccountType;
  provider: string | null;
  currency: string;
  account_masked: string | null;
  is_active: boolean;
  include_in_budget?: boolean;
  forecast_role?: import("@/services/forecast-domain").ForecastAccountRole;
  include_in_cashflow?: boolean;
  include_in_net_worth?: boolean;
  owner_scope?: import("@/services/forecast-domain").ForecastOwnerScope;
};

export const ACCOUNT_TYPES: BankAccountType[] = [
  "checking",
  "savings",
  "credit",
  "loan",
  "investment",
  "cash",
  "other",
];

export function normalizeAccountNumber(value?: string | null): string | null {
  if (!value) return null;
  const normalized = String(value)
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return normalized || null;
}

export function maskAccountNumber(value: string): string {
  const length = value.length;
  if (length <= 4) {
    return "*".repeat(length);
  }
  return `${"*".repeat(length - 4)}${value.slice(-4)}`;
}

export async function hashAccountNumber(value: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    value,
  );
}

function toBankAccountRecord(row: Record<string, unknown>): BankAccount {
  return applyForecastAccountRules({
    id: String(row.id || ""),
    name: String(row.name || ""),
    account_type: (row.account_type || "other") as BankAccountType,
    provider: row.provider ? String(row.provider) : null,
    currency: String(row.currency || "EUR"),
    account_masked: row.account_masked ? String(row.account_masked) : null,
    is_active: row.is_active !== false,
    include_in_budget:
      row.include_in_budget == null ? undefined : Boolean(row.include_in_budget),
    forecast_role: row.forecast_role
      ? (String(row.forecast_role) as BankAccount["forecast_role"])
      : undefined,
    include_in_cashflow:
      row.include_in_cashflow == null
        ? undefined
        : Boolean(row.include_in_cashflow),
    include_in_net_worth:
      row.include_in_net_worth == null
        ? undefined
        : Boolean(row.include_in_net_worth),
    owner_scope: row.owner_scope
      ? (String(row.owner_scope) as BankAccount["owner_scope"])
      : undefined,
  });
}

function isMissingColumnError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42703" || code === "PGRST204") return true;
  return message.includes("column") && message.includes("does not exist");
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function buildBankAccountPayload(
  input: CreateBankAccountInput | UpdateBankAccountInput,
  userId: string,
  normalizedAccount: string | null,
  accountHash: string | null,
  includeScopedFields: boolean,
) {
  const basePayload: Record<string, unknown> = {
    user_id: userId,
    name: input.name,
    account_type: input.accountType,
    provider: input.provider || null,
    currency: input.currency || "EUR",
    include_in_budget:
      input.includeInBudget == null ? true : Boolean(input.includeInBudget),
    is_active: input.isActive == null ? true : Boolean(input.isActive),
    account_masked:
      normalizedAccount != null ? maskAccountNumber(normalizedAccount) : null,
    account_hash: accountHash,
  };

  if (!includeScopedFields) {
    return basePayload;
  }

  return {
    ...basePayload,
    ...resolveForecastAccountRules({
      account_type: input.accountType,
      provider: input.provider || null,
      name: input.name,
      forecast_role: input.forecastRole ?? undefined,
      include_in_cashflow: input.includeInCashflow ?? undefined,
      include_in_budget: input.includeInBudget ?? undefined,
      include_in_net_worth: input.includeInNetWorth ?? undefined,
      owner_scope: input.ownerScope ?? undefined,
    }),
  };
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const userId = await requireCurrentUserId();
  return listBankAccountsForUser(userId);
}

export async function listBankAccountsForUser(
  userId: string,
): Promise<BankAccount[]> {
  const fetchAccounts = async (select: string) =>
    supabase
      .from("bank_accounts")
      .select(select)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

  let result = await fetchAccounts(BANK_ACCOUNT_SCOPED_SELECT);
  if (result.error && (isMissingColumnError(result.error) || isMissingRelationError(result.error))) {
    result = await fetchAccounts(BANK_ACCOUNT_LEGACY_SELECT);
  }

  if (result.error) throw result.error;
  return ((result.data || []) as Record<string, unknown>[]).map(toBankAccountRecord);
}

export async function listBankAccountHashes(userId?: string): Promise<string[]> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("account_hash")
    .eq("user_id", resolvedUserId)
    .not("account_hash", "is", null);

  if (error) throw error;

  const seen = new Set<string>();
  for (const row of (data || []) as { account_hash?: unknown }[]) {
    const hash = String(row?.account_hash || "").trim();
    if (!hash) continue;
    seen.add(hash);
  }

  return Array.from(seen);
}

export type CreateBankAccountInput = {
  name: string;
  accountNumber?: string | null;
  accountType: BankAccountType;
  provider?: string | null;
  currency?: string;
  includeInBudget?: boolean;
  isActive?: boolean;
  forecastRole?: BankAccount["forecast_role"];
  includeInCashflow?: boolean;
  includeInNetWorth?: boolean;
  ownerScope?: BankAccount["owner_scope"];
};

export type UpdateBankAccountInput = {
  id: string;
  name: string;
  accountNumber?: string | null;
  accountType: BankAccountType;
  provider?: string | null;
  currency?: string;
  includeInBudget?: boolean;
  isActive?: boolean;
  forecastRole?: BankAccount["forecast_role"];
  includeInCashflow?: boolean;
  includeInNetWorth?: boolean;
  ownerScope?: BankAccount["owner_scope"];
};

export async function createBankAccount(
  input: CreateBankAccountInput,
): Promise<BankAccount> {
  const userId = await requireCurrentUserId();
  const normalizedAccount = normalizeAccountNumber(input.accountNumber);
  const accountHash =
    normalizedAccount != null
      ? await hashAccountNumber(normalizedAccount)
      : null;
  const scopedPayload = buildBankAccountPayload(
    input,
    userId,
    normalizedAccount,
    accountHash,
    true,
  );
  const legacyPayload = buildBankAccountPayload(
    input,
    userId,
    normalizedAccount,
    accountHash,
    false,
  );

  let result = await supabase
    .from("bank_accounts")
    .insert(scopedPayload)
    .select(BANK_ACCOUNT_SCOPED_SELECT)
    .single();

  // Fallback-only bridge for older schemas: if the scoped columns are missing,
  // we still persist the base bank-account row so the app stays usable.
  if (result.error && (isMissingColumnError(result.error) || isMissingRelationError(result.error))) {
    result = await supabase
      .from("bank_accounts")
      .insert(legacyPayload)
      .select(BANK_ACCOUNT_LEGACY_SELECT)
      .single();
  }

  if (!result.data || result.error) {
    throw result.error || new Error("Failed to insert bank account.");
  }

  return toBankAccountRecord(result.data as Record<string, unknown>);
}

export async function findBankAccountByHash(
  accountHash: string,
): Promise<BankAccount | null> {
  const userId = await requireCurrentUserId();
  const fetchAccount = (select: string) =>
    supabase
      .from("bank_accounts")
      .select(select)
      .eq("user_id", userId)
      .eq("account_hash", accountHash)
      .maybeSingle();

  let result = await fetchAccount(BANK_ACCOUNT_SCOPED_SELECT);
  // Fallback-only bridge for older schemas: read the legacy projection when
  // scoped columns are not available yet.
  if (result.error && (isMissingColumnError(result.error) || isMissingRelationError(result.error))) {
    result = await fetchAccount(BANK_ACCOUNT_LEGACY_SELECT);
  }

  if (result.error) throw result.error;
  return result.data ? toBankAccountRecord(result.data as Record<string, unknown>) : null;
}

export async function updateBankAccount(
  input: UpdateBankAccountInput,
): Promise<BankAccount> {
  const userId = await requireCurrentUserId();
  const scopedPayload = buildBankAccountPayload(
    input,
    userId,
    null,
    null,
    true,
  );
  const legacyPayload = buildBankAccountPayload(
    input,
    userId,
    null,
    null,
    false,
  );

  if (Object.prototype.hasOwnProperty.call(input, "accountNumber")) {
    const normalizedAccount = normalizeAccountNumber(input.accountNumber);
    scopedPayload.account_masked =
      normalizedAccount != null ? maskAccountNumber(normalizedAccount) : null;
    scopedPayload.account_hash =
      normalizedAccount != null
        ? await hashAccountNumber(normalizedAccount)
        : null;
    legacyPayload.account_masked = scopedPayload.account_masked;
    legacyPayload.account_hash = scopedPayload.account_hash;
  }

  let result = await supabase
    .from("bank_accounts")
    .update(scopedPayload)
    .eq("user_id", userId)
    .eq("id", input.id)
    .select(BANK_ACCOUNT_SCOPED_SELECT)
    .single();

  // Fallback-only bridge for older schemas: mirror the legacy update path if
  // the scoped projection cannot be written yet.
  if (result.error && (isMissingColumnError(result.error) || isMissingRelationError(result.error))) {
    result = await supabase
      .from("bank_accounts")
      .update(legacyPayload)
      .eq("user_id", userId)
      .eq("id", input.id)
      .select(BANK_ACCOUNT_LEGACY_SELECT)
      .single();
  }

  if (!result.data || result.error) {
    throw result.error || new Error("Failed to update bank account.");
  }

  return toBankAccountRecord(result.data as Record<string, unknown>);
}

export async function getBankAccountTransactionCount(
  bankAccountId: string,
): Promise<number> {
  const userId = await requireCurrentUserId();
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("bank_account_id", bankAccountId);

  if (error) throw error;
  return count ?? 0;
}

export async function deleteBankAccountWithTransactions(
  bankAccountId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "delete_bank_account_with_transactions",
    {
      target_bank_account_id: bankAccountId,
    },
  );

  if (error) throw error;

  const deletedCount =
    typeof data === "number"
      ? data
      : Array.isArray(data)
        ? Number(
            ((data[0] as { deleted_transaction_count?: unknown } | undefined)
              ?.deleted_transaction_count ??
              data[0]) || 0,
          )
        : Number(
            ((data as { deleted_transaction_count?: unknown } | null)
              ?.deleted_transaction_count ??
              data) || 0,
          );

  return Number.isFinite(deletedCount) ? deletedCount : 0;
}

export async function listBankAccountBudgetFlags(
  userId?: string,
  moneyViewScope?: import("@/services/finance-scope").MoneyViewScope,
): Promise<Map<string, boolean>> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const accounts = await listBankAccountsForUser(resolvedUserId);
  const resolvedScope =
    moneyViewScope ||
    // If the caller doesn't provide a scope, fall back to the app-level
    // finance preference instead of inventing a second budget context here.
    (
      await loadMoneyViewScopePreference(resolvedUserId).catch(() => ({
        scopeView: "personal" as const,
      }))
    ).scopeView;
  return new Map(
    accounts.map((account) => {
      const included = isAccountIncludedInBudgetMoneyViewScope(
        account,
        resolvedScope,
      );
      return [account.id, included] as const;
    }),
  );
}

export function isBankAccountIncludedInBudget(
  bankAccountId: string | null,
  budgetFlags: Map<string, boolean>,
): boolean {
  if (!bankAccountId) return true;
  const flag = budgetFlags.get(bankAccountId);
  return flag !== false;
}
