import { requireCurrentUserId } from "@/services/current-user";
import {
  type ForecastCarryover,
  normalizeForecastCertainty,
} from "@/services/forecast-domain";
import {
  isAccountIncludedInOperationalMoneyViewScope,
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";
import { listBankAccountsForUser, type BankAccount } from "@/services/bank-accounts";
import { supabase } from "@/services/supabase";

export type LatestKnownBalanceSnapshot = {
  balance: number | null;
  date: string | null;
};

type BalanceRow = {
  date?: string | null;
  metadata?: Record<string, unknown> | null;
  bank_account_id?: string | null;
};

function parseSequence(metadata: Record<string, unknown> | null | undefined) {
  const rawSeq = String(metadata?.["Volgnr"] || "").replace(/^0+/, "");
  return Number.parseInt(rawSeq || "0", 10) || 0;
}

export function parseRunningBalance(
  metadata: Record<string, unknown> | null | undefined,
) {
  const rawBalance = metadata?.["Saldo na trn"];
  if (rawBalance == null) return null;

  const parsed = parseFloat(
    String(rawBalance).replace(/\./g, "").replace(",", "."),
  );
  return Number.isNaN(parsed) ? null : parsed;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveLegacyLatestKnownBalanceSnapshot(
  rows: BalanceRow[],
): LatestKnownBalanceSnapshot {
  const normalized = rows
    .map((row) => ({
      date: row.date ? String(row.date) : null,
      seq: parseSequence(row.metadata || null),
      balance: parseRunningBalance(row.metadata || null),
    }))
    .filter((row) => row.date);

  normalized.sort((left, right) =>
    left.date === right.date
      ? right.seq - left.seq
      : left.date! < right.date!
        ? 1
        : -1,
  );

  const latest = normalized.find((row) => row.balance != null);
  return {
    balance: latest?.balance ?? null,
    date: latest?.date ?? null,
  };
}

export function resolveLatestKnownBalanceSnapshot(
  rows: BalanceRow[],
  options?: {
    bankAccountsById?: Map<string, BankAccount>;
    moneyViewScope?: MoneyViewScope;
  },
): LatestKnownBalanceSnapshot {
  if (!options?.bankAccountsById || !options.moneyViewScope) {
    return resolveLegacyLatestKnownBalanceSnapshot(rows);
  }

  const normalizedScope = normalizeMoneyViewScope(options.moneyViewScope);
  const includedAccountIds = new Set<string>();
  for (const [accountId, account] of options.bankAccountsById.entries()) {
    if (isAccountIncludedInOperationalMoneyViewScope(account, normalizedScope)) {
      includedAccountIds.add(accountId);
    }
  }

  if (!includedAccountIds.size) {
    return {
      balance: null,
      date: null,
    };
  }

  const latestByAccount = new Map<
    string,
    { date: string; seq: number; balance: number }
  >();

  for (const row of rows) {
    const balance = parseRunningBalance(row.metadata || null);
    const date = row.date ? String(row.date) : null;
    if (balance == null || !date) continue;

    const bankAccountId = row.bank_account_id ? String(row.bank_account_id) : null;
    if (bankAccountId) {
      if (!includedAccountIds.has(bankAccountId)) continue;
    } else if (normalizedScope === "observation") {
      continue;
    }

    const key = bankAccountId || "__legacy__";
    const seq = parseSequence(row.metadata || null);
    const existing = latestByAccount.get(key);
    if (
      !existing ||
      existing.date < date ||
      (existing.date === date && existing.seq < seq)
    ) {
      latestByAccount.set(key, { date, seq, balance });
    }
  }

  if (!latestByAccount.size) {
    return {
      balance: null,
      date: null,
    };
  }

  let balance = 0;
  let latestDate: string | null = null;
  for (const value of latestByAccount.values()) {
    balance += value.balance;
    if (!latestDate || latestDate < value.date) {
      latestDate = value.date;
    }
  }

  return {
    balance: round2(balance),
    date: latestDate,
  };
}

export function buildForecastCarryoverFromLatestKnownBalance(
  snapshot: LatestKnownBalanceSnapshot,
): ForecastCarryover | null {
  if (snapshot.balance == null) return null;

  return {
    sourceMonthStart: null,
    targetMonthStart: null,
    sourceMoneyLayer: "operational",
    targetMoneyLayer: "operational",
    amount: snapshot.balance,
    certainty: normalizeForecastCertainty("booked"),
    sourceEventType: "correction",
    sourceLabel: snapshot.date,
    reason: "Laatste bekende operationele stand",
  };
}

export async function loadLatestKnownBalanceSnapshot(
  userId?: string,
  moneyViewScope?: MoneyViewScope,
): Promise<LatestKnownBalanceSnapshot> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const [accountsResult, txResult] = await Promise.all([
    listBankAccountsForUser(resolvedUserId).catch(() => [] as BankAccount[]),
    supabase
      .from("transactions")
      .select("date,metadata,bank_account_id")
      .eq("user_id", resolvedUserId)
      .order("date", { ascending: false })
      .order("metadata->>Volgnr", { ascending: false })
      .limit(500),
  ]);

  const { data, error } = txResult;
  if (error) throw error;

  const bankAccountsById = new Map(
    accountsResult.map((account) => [account.id, account]),
  );
  return resolveLatestKnownBalanceSnapshot((data || []) as BalanceRow[], {
    bankAccountsById,
    moneyViewScope,
  });
}
