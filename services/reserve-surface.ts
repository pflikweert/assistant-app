import { listBankAccountsForUser } from "@/services/bank-accounts";
import { requireCurrentUserId } from "@/services/current-user";
import {
  isAccountIncludedInNetWorthMoneyViewScope,
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";
import { parseRunningBalance } from "@/services/latest-known-balance";
import type { AnnualObligationReserveRule } from "@/services/reserve-rules";
import { listAnnualObligationReserveRules } from "@/services/reserve-rules";
import { supabase } from "@/services/supabase";
import type { BudgetPlanComputation } from "@/types/categorization";

export type ReserveSurfaceBreakdown = {
  // Reserve context already present on reserve/goal accounts in scope.
  reservedInAccountsNow: number | null;
  // Amount that should stay protected on the operational layer right now.
  reservedProtectedInOperationalNow: number | null;
  // Total reserve allocation planned for this month (annual obligations + buffer target).
  plannedReserveAllocationThisMonth: number | null;
  annualObligationMonthlyTotal: number | null;
  savingsTargetMonthly: number | null;
  source: "modeled" | "unavailable";
};

type BalanceRow = {
  date?: string | null;
  metadata?: Record<string, unknown> | null;
  bank_account_id?: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseSequence(metadata: Record<string, unknown> | null | undefined) {
  const rawSeq = String(metadata?.["Volgnr"] || "").replace(/^0+/, "");
  return Number.parseInt(rawSeq || "0", 10) || 0;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round2(parsed) : fallback;
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("relation");
}

function sumActiveMonthlyRules(rules: AnnualObligationReserveRule[]) {
  return round2(
    rules
      .filter((rule) => rule.status === "active")
      .reduce((total, rule) => total + Math.max(asNumber(rule.monthlyAmount, 0), 0), 0),
  );
}

function buildUnavailableReserveBreakdown(): ReserveSurfaceBreakdown {
  return {
    reservedInAccountsNow: null,
    reservedProtectedInOperationalNow: null,
    plannedReserveAllocationThisMonth: null,
    annualObligationMonthlyTotal: null,
    savingsTargetMonthly: null,
    source: "unavailable",
  };
}

function computeReservedInAccountsNow(params: {
  rows: BalanceRow[];
  bankAccountsById: Map<string, Awaited<ReturnType<typeof listBankAccountsForUser>>[number]>;
  scopeView: MoneyViewScope;
}) {
  const latestByAccount = new Map<
    string,
    { date: string; seq: number; balance: number }
  >();

  for (const row of params.rows) {
    const bankAccountId = row.bank_account_id ? String(row.bank_account_id) : null;
    if (!bankAccountId) continue;
    const account = params.bankAccountsById.get(bankAccountId);
    if (!account) continue;
    if (!isAccountIncludedInNetWorthMoneyViewScope(account, params.scopeView)) continue;
    if (!(account.forecast_role === "reserve" || account.forecast_role === "goal")) continue;

    const balance = parseRunningBalance(row.metadata || null);
    const date = row.date ? String(row.date) : null;
    if (balance == null || !date) continue;
    const seq = parseSequence(row.metadata || null);
    const existing = latestByAccount.get(bankAccountId);
    if (
      !existing ||
      existing.date < date ||
      (existing.date === date && existing.seq < seq)
    ) {
      latestByAccount.set(bankAccountId, { date, seq, balance });
    }
  }

  if (!latestByAccount.size) return null;
  const total = Array.from(latestByAccount.values()).reduce(
    (sum, item) => sum + Math.max(item.balance, 0),
    0,
  );
  return round2(total);
}

export async function loadReserveSurfaceBreakdown(params: {
  userId?: string;
  moneyViewScope?: MoneyViewScope;
  budgetPlan?: BudgetPlanComputation | null;
}): Promise<ReserveSurfaceBreakdown> {
  const userId = params.userId || (await requireCurrentUserId());
  const scopeView = normalizeMoneyViewScope(params.moneyViewScope || "personal");
  const savingsTargetMonthly =
    params.budgetPlan?.settings?.savingsTargetMonthly != null
      ? round2(Math.max(asNumber(params.budgetPlan.settings.savingsTargetMonthly, 0), 0))
      : null;

  const [bankAccounts, txResult, reserveRules] = await Promise.all([
    listBankAccountsForUser(userId).catch(() => []),
    supabase
      .from("transactions")
      .select("date,metadata,bank_account_id")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("metadata->>Volgnr", { ascending: false })
      .limit(800),
    listAnnualObligationReserveRules({
      userId,
      scopeView,
      includePaused: true,
    }),
  ]);

  const annualObligationMonthlyTotal = sumActiveMonthlyRules(reserveRules);
  const plannedReserveAllocationThisMonth = round2(
    annualObligationMonthlyTotal + Math.max(savingsTargetMonthly || 0, 0),
  );

  const txError = txResult.error;
  if (txError && !isMissingRelationError(txError)) {
    throw txError;
  }

  const reservedInAccountsNow = txError
    ? null
    : computeReservedInAccountsNow({
        rows: (txResult.data || []) as BalanceRow[],
        bankAccountsById: new Map(bankAccounts.map((account) => [account.id, account])),
        scopeView,
      });

  const reservedProtectedInOperationalNow =
    savingsTargetMonthly != null || annualObligationMonthlyTotal > 0
      ? plannedReserveAllocationThisMonth
      : null;

  if (
    reservedInAccountsNow == null &&
    reservedProtectedInOperationalNow == null &&
    savingsTargetMonthly == null &&
    annualObligationMonthlyTotal === 0
  ) {
    return buildUnavailableReserveBreakdown();
  }

  return {
    reservedInAccountsNow,
    reservedProtectedInOperationalNow,
    plannedReserveAllocationThisMonth,
    annualObligationMonthlyTotal:
      annualObligationMonthlyTotal > 0 ? annualObligationMonthlyTotal : 0,
    savingsTargetMonthly: savingsTargetMonthly == null ? 0 : savingsTargetMonthly,
    source: "modeled",
  };
}
