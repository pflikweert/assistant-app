import { requireCurrentUserId } from "@/services/current-user";
import {
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";
import { supabase } from "@/services/supabase";

type RowRecord = Record<string, unknown>;

export type MoneyViewScopePreference = {
  scopeView: MoneyViewScope;
  updatedAt: string | null;
};

const DEFAULT_SCOPE_VIEW: MoneyViewScope = "personal";
const preferenceCache = new Map<string, MoneyViewScopePreference>();

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const status = Number((error as { status?: number } | null)?.status || 0);
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (status === 404) return true;
  if (code === "42P01" || code === "PGRST205") return true;
  return (
    message.includes("relation") ||
    message.includes("not found") ||
    message.includes("does not exist")
  );
}

function isMissingColumnError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42703" || code === "PGRST204") return true;
  return message.includes("column") && message.includes("does not exist");
}

function mapRow(row: RowRecord | null): MoneyViewScopePreference {
  return {
    scopeView: normalizeMoneyViewScope(
      row?.money_view_scope || row?.scope_view,
      DEFAULT_SCOPE_VIEW,
    ),
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
  };
}

export async function loadMoneyViewScopePreference(
  userId?: string,
): Promise<MoneyViewScopePreference> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const { data, error } = await supabase
    .from("finance_view_preferences")
    .select("money_view_scope,updated_at")
    .eq("user_id", resolvedUserId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      const cached = preferenceCache.get(resolvedUserId);
      if (cached) return cached;
      return {
        scopeView: DEFAULT_SCOPE_VIEW,
        updatedAt: null,
      };
    }
    throw error;
  }

  if (!data) {
    const cached = preferenceCache.get(resolvedUserId);
    if (cached) return cached;
  }

  const mapped = mapRow((data || null) as RowRecord | null);
  preferenceCache.set(resolvedUserId, mapped);
  return mapped;
}

export async function upsertMoneyViewScopePreference(
  scopeView: MoneyViewScope,
  userId?: string,
): Promise<MoneyViewScopePreference> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const normalizedScopeView = normalizeMoneyViewScope(scopeView, DEFAULT_SCOPE_VIEW);
  const { error } = await supabase
    .from("finance_view_preferences")
    .upsert(
      {
        user_id: resolvedUserId,
        money_view_scope: normalizedScopeView,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      const fallback = {
        scopeView: normalizedScopeView,
        updatedAt: null,
      };
      preferenceCache.set(resolvedUserId, fallback);
      return fallback;
    }
    throw error;
  }

  const next = {
    scopeView: normalizedScopeView,
    updatedAt: new Date().toISOString(),
  };
  preferenceCache.set(resolvedUserId, next);
  return next;
}
