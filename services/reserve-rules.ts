import { requireCurrentUserId } from "@/services/current-user";
import { normalizeMoneyViewScope, type MoneyViewScope } from "@/services/finance-scope";
import type { RareSubscriptionItem } from "@/services/rare-subscriptions";
import { supabase } from "@/services/supabase";

export type AnnualObligationReserveRule = {
  id: string;
  userId: string;
  scopeView: MoneyViewScope;
  label: string;
  semanticTag: string | null;
  annualAmount: number;
  monthlyAmount: number;
  status: "active" | "paused";
  source: "inferred" | "manual";
  fingerprint: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

let annualReserveRulesUnavailable = false;

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const status = Number((error as { status?: number } | null)?.status || 0);
  const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    status === 404 ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("could not find") ||
    message.includes("not found")
  );
}

function markUnavailableIfMissingRelation(error: unknown) {
  // Fase E fallback: if this relation is not rolled out in an environment yet,
  // reserve rules must degrade quietly instead of spamming failed requests.
  if (isMissingRelationError(error)) {
    annualReserveRulesUnavailable = true;
    return true;
  }
  return false;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
}

function normalizeLabel(value: string) {
  return String(value || "").trim();
}

function normalizeFingerprint(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapRow(row: Record<string, unknown>): AnnualObligationReserveRule {
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    scopeView: normalizeMoneyViewScope(row.scope_view),
    label: normalizeLabel(String(row.label || "")),
    semanticTag: row.semantic_tag ? String(row.semantic_tag) : null,
    annualAmount: asNumber(row.annual_amount),
    monthlyAmount: asNumber(row.monthly_amount),
    status: row.status === "paused" ? "paused" : "active",
    source: row.source === "manual" ? "manual" : "inferred",
    fingerprint: row.fingerprint ? String(row.fingerprint) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function toMonthlyAmount(annualAmount: number) {
  return Math.round((Math.max(annualAmount, 0) / 12) * 100) / 100;
}

function resolveSeedingCandidates(rareItems: RareSubscriptionItem[]) {
  return rareItems
    .filter((item) => item.evidence === "confirmed")
    .filter((item) => item.cadence === "yearly" || item.cadence === "semiannual")
    .filter((item) => item.annualSpendEstimate > 0)
    .slice(0, 24);
}

export async function listAnnualObligationReserveRules(params: {
  userId?: string;
  scopeView?: MoneyViewScope;
  includePaused?: boolean;
} = {}): Promise<AnnualObligationReserveRule[]> {
  if (annualReserveRulesUnavailable) return [];
  const userId = params.userId || (await requireCurrentUserId());
  const scopeView = params.scopeView ? normalizeMoneyViewScope(params.scopeView) : null;
  let query = supabase
    .from("annual_obligation_reserve_rules")
    .select(
      "id,user_id,scope_view,label,semantic_tag,annual_amount,monthly_amount,status,source,fingerprint,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (scopeView) query = query.eq("scope_view", scopeView);
  if (!params.includePaused) query = query.eq("status", "active");

  const { data, error } = await query;
  if (error) {
    if (markUnavailableIfMissingRelation(error)) return [];
    throw error;
  }

  return ((data || []) as Record<string, unknown>[]).map(mapRow);
}

export async function upsertAnnualObligationReserveRule(input: {
  id?: string;
  userId?: string;
  scopeView?: MoneyViewScope;
  label: string;
  semanticTag?: string | null;
  annualAmount?: number;
  monthlyAmount?: number;
  status?: "active" | "paused";
  source?: "inferred" | "manual";
  fingerprint?: string | null;
}): Promise<AnnualObligationReserveRule | null> {
  if (annualReserveRulesUnavailable) return null;
  const userId = input.userId || (await requireCurrentUserId());
  const annualAmount = asNumber(input.annualAmount, 0);
  const monthlyAmount =
    input.monthlyAmount == null
      ? toMonthlyAmount(annualAmount)
      : asNumber(input.monthlyAmount, 0);
  const payload = {
    ...(input.id ? { id: input.id } : null),
    user_id: userId,
    scope_view: normalizeMoneyViewScope(input.scopeView || "personal"),
    label: normalizeLabel(input.label),
    semantic_tag: input.semanticTag || null,
    annual_amount: annualAmount,
    monthly_amount: monthlyAmount,
    status: input.status || "active",
    source: input.source || "manual",
    fingerprint: input.fingerprint ? normalizeFingerprint(input.fingerprint) : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("annual_obligation_reserve_rules")
    .upsert(payload, {
      onConflict: payload.fingerprint ? "user_id,scope_view,fingerprint" : "id",
    })
    .select(
      "id,user_id,scope_view,label,semantic_tag,annual_amount,monthly_amount,status,source,fingerprint,created_at,updated_at",
    )
    .maybeSingle();

  if (error) {
    if (markUnavailableIfMissingRelation(error)) return null;
    throw error;
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function setAnnualObligationReserveRuleStatus(params: {
  id: string;
  status: "active" | "paused";
  userId?: string;
}) {
  if (annualReserveRulesUnavailable) return;
  const userId = params.userId || (await requireCurrentUserId());
  const { error } = await supabase
    .from("annual_obligation_reserve_rules")
    .update({
      status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error && !markUnavailableIfMissingRelation(error)) throw error;
}

export async function seedAnnualObligationRulesFromRareSubscriptions(params: {
  rareItems: RareSubscriptionItem[];
  scopeView: MoneyViewScope;
  userId?: string;
}) {
  if (annualReserveRulesUnavailable) return;
  const userId = params.userId || (await requireCurrentUserId());
  const scopeView = normalizeMoneyViewScope(params.scopeView);

  // Keep auto-seeding conservative and rule-first for Fase E.
  const candidates = resolveSeedingCandidates(params.rareItems);

  for (const item of candidates) {
    const baseFingerprint = normalizeFingerprint(
      `${scopeView}:${item.descriptor}:${item.cadence}`,
    );
    await upsertAnnualObligationReserveRule({
      userId,
      scopeView,
      label: item.label,
      semanticTag: `rare_subscription:${item.cadence}`,
      annualAmount: asNumber(item.annualSpendEstimate, 0),
      monthlyAmount: toMonthlyAmount(asNumber(item.annualSpendEstimate, 0)),
      status: "active",
      source: "inferred",
      fingerprint: baseFingerprint,
    }).catch((error) => {
      if (markUnavailableIfMissingRelation(error)) return null;
      throw error;
    });
  }
}
