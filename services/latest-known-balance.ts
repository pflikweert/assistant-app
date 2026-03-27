import { requireCurrentUserId } from "@/services/current-user";
import {
  type ForecastCarryover,
  normalizeForecastCertainty,
} from "@/services/forecast-domain";
import { supabase } from "@/services/supabase";

export type LatestKnownBalanceSnapshot = {
  balance: number | null;
  date: string | null;
};

type BalanceRow = {
  date?: string | null;
  metadata?: Record<string, unknown> | null;
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

export function resolveLatestKnownBalanceSnapshot(
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
): Promise<LatestKnownBalanceSnapshot> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const { data, error } = await supabase
    .from("transactions")
    .select("date,metadata")
    .eq("user_id", resolvedUserId)
    .order("date", { ascending: false })
    .order("metadata->>Volgnr", { ascending: false })
    .limit(50);

  if (error) throw error;
  return resolveLatestKnownBalanceSnapshot((data || []) as BalanceRow[]);
}
