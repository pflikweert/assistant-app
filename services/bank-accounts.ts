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
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id,name,account_type,provider,currency,account_masked")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as BankAccount[];
}

export type CreateBankAccountInput = {
  name: string;
  accountNumber?: string | null;
  accountType: BankAccountType;
  provider?: string | null;
  currency?: string;
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
      account_masked:
        normalizedAccount != null ? maskAccountNumber(normalizedAccount) : null,
      account_hash: accountHash,
    })
    .select("id,name,account_type,provider,currency,account_masked")
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
    .select("id,name,account_type,provider,currency,account_masked")
    .eq("user_id", userId)
    .eq("account_hash", accountHash)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as BankAccount | null;
}
