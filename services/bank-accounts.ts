import * as Crypto from "expo-crypto";

import { supabase } from "@/services/supabase";
import { requireCurrentUserId } from "@/services/current-user";

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

export async function listBankAccounts(): Promise<BankAccount[]> {
  const userId = await requireCurrentUserId();
  return listBankAccountsForUser(userId);
}

export async function listBankAccountsForUser(
  userId: string,
): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      "id,name,account_type,provider,currency,account_masked,is_active,include_in_budget",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as BankAccount[];
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
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
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
    })
    .select(
      "id,name,account_type,provider,currency,account_masked,is_active,include_in_budget",
    )
    .single();

  if (!data || error) {
    throw error || new Error("Failed to insert bank account.");
  }

  return data as BankAccount;
}

export async function findBankAccountByHash(
  accountHash: string,
): Promise<BankAccount | null> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(
      "id,name,account_type,provider,currency,account_masked,is_active,include_in_budget",
    )
    .eq("user_id", userId)
    .eq("account_hash", accountHash)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as BankAccount | null;
}

export async function updateBankAccount(
  input: UpdateBankAccountInput,
): Promise<BankAccount> {
  const userId = await requireCurrentUserId();
  const payload: Record<string, unknown> = {
    name: input.name,
    account_type: input.accountType,
    provider: input.provider || null,
    currency: input.currency || "EUR",
    include_in_budget:
      input.includeInBudget == null ? true : Boolean(input.includeInBudget),
    is_active: input.isActive == null ? true : Boolean(input.isActive),
  };

  if (Object.prototype.hasOwnProperty.call(input, "accountNumber")) {
    const normalizedAccount = normalizeAccountNumber(input.accountNumber);
    payload.account_masked =
      normalizedAccount != null ? maskAccountNumber(normalizedAccount) : null;
    payload.account_hash =
      normalizedAccount != null
        ? await hashAccountNumber(normalizedAccount)
        : null;
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .update(payload)
    .eq("user_id", userId)
    .eq("id", input.id)
    .select(
      "id,name,account_type,provider,currency,account_masked,is_active,include_in_budget",
    )
    .single();

  if (!data || error) {
    throw error || new Error("Failed to update bank account.");
  }

  return data as BankAccount;
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
): Promise<Map<string, boolean>> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const accounts = await listBankAccountsForUser(resolvedUserId);
  return new Map(accounts.map((account) => [account.id, account.include_in_budget !== false]));
}

export function isBankAccountIncludedInBudget(
  bankAccountId: string | null,
  budgetFlags: Map<string, boolean>,
): boolean {
  if (!bankAccountId) return true;
  const flag = budgetFlags.get(bankAccountId);
  return flag !== false;
}
