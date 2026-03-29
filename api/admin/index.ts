import { createClient } from "@supabase/supabase-js";

import {
  buildDefaultAiRouteSetting,
  buildDefaultAiRouteSettings,
  getAiUseCaseDefinition,
  listAiUseCases,
  normalizeAiUseCase,
  type AiRouteSetting,
  type AiReviewItemStatus,
  type AiReviewRow,
  type AiUsageRow,
} from "../../services/ai-use-cases.ts";
import { isKnownAiModelId } from "../../services/ai-model-catalog.ts";
import {
  clearOpenAiOrgUsageSnapshotCache,
  loadOpenAiOrgUsageSnapshot,
} from "../../services/openai-org-usage.ts";
import { debugLog, isRuntimeDebugEnabled } from "../../services/runtime-debug.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

type AuthenticatedAdminUser = {
  id: string;
  email: string | null;
  role: string;
  isDevBypass: boolean;
};

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin config ontbreekt voor Budio beheer.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isDevAuthEnabled() {
  return isTruthy(
    process.env.DEV_AUTH_BYPASS || process.env.DEV_BYPASS_LOGIN_ENABLED,
  );
}

function getDevAuthUser(): AuthenticatedAdminUser | null {
  if (!isDevAuthEnabled()) return null;
  return {
    id: process.env.DEV_AUTH_USER_ID || "dev-local-user",
    email:
      process.env.DEV_AUTH_USER_EMAIL ||
      process.env.DEV_BYPASS_LOGIN_EMAIL ||
      "dev@localhost",
    role: process.env.DEV_AUTH_USER_ROLE || "admin",
    isDevBypass: true,
  };
}

async function resolveAuthenticatedAdmin(
  req: any,
): Promise<AuthenticatedAdminUser> {
  const devUser = getDevAuthUser();
  const authHeader = String(req.headers.authorization ?? "");
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";

  if (devUser && token === "dev-access-token") {
    return devUser;
  }

  if (!token) {
    throw new Error("Missing access token");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const userResult = await supabaseAdmin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    throw new Error("Invalid access token");
  }

  return {
    id: userResult.data.user.id,
    email: userResult.data.user.email || null,
    role: String(userResult.data.user.role || "authenticated"),
    isDevBypass: false,
  };
}

async function resolveAdminRole(userId: string, isDevBypass: boolean) {
  if (isDevBypass) return "admin";

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return String(data?.role || "user");
}

function getStartOfMonthIso(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function getStartOfDayIso(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function roundValue(value: number) {
  return Math.round(value * 100) / 100;
}

async function loadAiRouteSettings() {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("ai_route_settings")
    .select(
      "use_case,model,agent_mode,temperature,max_tokens,fallback_enabled,response_mode,created_at,updated_at",
    )
    .order("use_case", { ascending: true });

  if (error) throw error;

  const rows = (data || []) as AiRouteSetting[];
  if (rows.length) return rows;

  const seedRows = buildDefaultAiRouteSettings();
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("ai_route_settings")
    .upsert(seedRows, { onConflict: "use_case" })
    .select(
      "use_case,model,agent_mode,temperature,max_tokens,fallback_enabled,response_mode,created_at,updated_at",
    );

  if (insertError) throw insertError;
  return ((inserted || []) as AiRouteSetting[]).length
    ? ((inserted || []) as AiRouteSetting[])
    : seedRows;
}

async function loadAiUsageOverview(forceRefresh = false) {
  const supabaseAdmin = getSupabaseAdminClient();
  const monthStartIso = getStartOfMonthIso();
  const dayStartIso = getStartOfDayIso();
  if (isRuntimeDebugEnabled()) {
    debugLog("admin usage overview load", { forceRefresh });
  }
  const liveUsage = await loadOpenAiOrgUsageSnapshot({ forceRefresh });

  const { data, error } = await supabaseAdmin
    .from("ai_usage_logs")
    .select(
      "id,user_id,user_role,use_case,route_name,screen_id,screen_title,model,agent_mode,response_mode,prompt_tokens,completion_tokens,total_tokens,estimated_cost_eur,usage_source,used_fallback,fallback_reason,is_error,error_code,error_message,http_status,response_id,request_meta,created_at",
    )
    .gte("created_at", monthStartIso)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data || []) as AiUsageRow[];
  const monthRows = rows;
  const todayRows = rows.filter((row) => row.created_at >= dayStartIso);
  const useCaseMap = new Map<string, {
    model: string;
    calls: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    errors: number;
    fallback_count: number;
    estimated_cost_eur: number;
  }>();

  for (const definition of listAiUseCases()) {
    useCaseMap.set(definition.key, {
      model: buildDefaultAiRouteSetting(definition.key).model,
      calls: 0,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      errors: 0,
      fallback_count: 0,
      estimated_cost_eur: 0,
    });
  }

  for (const row of monthRows) {
    const useCase = normalizeAiUseCase(row.use_case, "help_general");
    const current = useCaseMap.get(useCase) || {
      model: row.model || buildDefaultAiRouteSetting(useCase).model,
      calls: 0,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      errors: 0,
      fallback_count: 0,
      estimated_cost_eur: 0,
    };

    current.model = row.model || current.model;
    current.calls += 1;
    current.total_tokens += Number(row.total_tokens || 0);
    current.prompt_tokens += Number(row.prompt_tokens || 0);
    current.completion_tokens += Number(row.completion_tokens || 0);
    current.errors += row.is_error ? 1 : 0;
    current.fallback_count += row.used_fallback ? 1 : 0;
    current.estimated_cost_eur = roundValue(
      current.estimated_cost_eur + Number(row.estimated_cost_eur || 0),
    );
    useCaseMap.set(useCase, current);
  }

  const overviewRows = Array.from(useCaseMap.entries()).map(([use_case, row]) => ({
    use_case,
    model: row.model,
    calls: row.calls,
    total_tokens: row.total_tokens,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    errors: row.errors,
    fallback_count: row.fallback_count,
    estimated_cost_eur: row.estimated_cost_eur,
  }));

  return {
    totalTokensToday:
      liveUsage?.totalTokensToday ??
      todayRows.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0),
    totalTokensMonth:
      liveUsage?.totalTokensMonth ??
      monthRows.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0),
    aiCallsToday: liveUsage?.aiCallsToday ?? todayRows.length,
    aiCallsMonth: liveUsage?.aiCallsMonth ?? monthRows.length,
    errorsMonth: monthRows.filter((row) => row.is_error).length,
    fallbackMonth: monthRows.filter((row) => row.used_fallback).length,
    estimatedCostMonth: roundValue(
      monthRows.reduce((sum, row) => sum + Number(row.estimated_cost_eur || 0), 0),
    ),
    openAiCostToday: liveUsage?.openAiCostToday ?? null,
    openAiCostMonth: liveUsage?.openAiCostMonth ?? null,
    openAiCostCurrency: liveUsage?.currency ?? null,
    usageFetchedAt: liveUsage?.fetchedAt ?? null,
    useCaseRows: overviewRows,
  };
}

async function loadReviewItems() {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("ai_review_items")
    .select(
      "id,issue_key,user_id,use_case,route_name,screen_id,screen_title,reason_type,status,summary,detail,conversation_excerpt,confidence,source_log_id,occurrence_count,first_seen_at,last_seen_at,created_at,updated_at",
    )
    .order("last_seen_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as AiReviewRow[];
}

async function loadBootstrap(user: AuthenticatedAdminUser) {
  const role = await resolveAdminRole(user.id, user.isDevBypass);
  if (role !== "admin") {
    const err = new Error("Je hebt geen toegang tot Budio beheer.");
    (err as Error & { code?: string }).code = "forbidden";
    throw err;
  }
  const [profile, routeSettings, usageOverview, reviewItems] = await Promise.all([
    Promise.resolve({
      userId: user.id,
      role,
      email: user.email,
    }),
    loadAiRouteSettings(),
    loadAiUsageOverview(),
    loadReviewItems(),
  ]);

  return {
    profile,
    routeSettings,
    usageOverview,
    reviewItems,
  };
}

async function updateRouteSetting(body: Record<string, unknown>) {
  const useCase = normalizeAiUseCase(String(body.use_case || body.useCase || ""), "help_general");
  const definition = getAiUseCaseDefinition(useCase);
  const defaultRouteSetting = buildDefaultAiRouteSettings().find(
    (row) => row.use_case === useCase,
  );
  const supabaseAdmin = getSupabaseAdminClient();
  const allowedModes = new Set(["text", "json_object", "json_schema"]);
  const payload = {
    use_case: useCase,
    model: (() => {
      const requestedModel = String(body.model || defaultRouteSetting?.model || "").trim();
      if (isKnownAiModelId(requestedModel)) return requestedModel;
      return buildDefaultAiRouteSetting(useCase).model;
    })(),
    agent_mode:
      String(body.agent_mode || body.agentMode || definition.defaultAgentMode).trim() ||
      definition.defaultAgentMode,
    temperature: Number.isFinite(Number(body.temperature))
      ? Number(body.temperature)
      : definition.defaultTemperature,
    max_tokens: Number.isFinite(Number(body.max_tokens || body.maxTokens))
      ? Number(body.max_tokens || body.maxTokens)
      : definition.defaultMaxTokens,
    fallback_enabled:
      typeof body.fallback_enabled === "boolean"
        ? body.fallback_enabled
        : Boolean(body.fallbackEnabled),
    response_mode: allowedModes.has(
      String(body.response_mode || body.responseMode || definition.defaultResponseMode).trim(),
    )
      ? String(body.response_mode || body.responseMode || definition.defaultResponseMode).trim()
      : definition.defaultResponseMode,
  };

  const { data, error } = await supabaseAdmin
    .from("ai_route_settings")
    .upsert(payload, { onConflict: "use_case" })
    .select(
      "use_case,model,agent_mode,temperature,max_tokens,fallback_enabled,response_mode,created_at,updated_at",
    )
    .maybeSingle();

  if (error) throw error;
  return data as AiRouteSetting | null;
}

async function updateReviewItem(body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim() as AiReviewItemStatus;
  if (!id || !["nieuw", "bekeken", "opgelost"].includes(status)) {
    throw new Error("Ongeldige reviewstatus.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("ai_review_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id,issue_key,user_id,use_case,route_name,screen_id,screen_title,reason_type,status,summary,detail,conversation_excerpt,confidence,source_log_id,occurrence_count,first_seen_at,last_seen_at,created_at,updated_at",
    )
    .maybeSingle();

  if (error) throw error;
  return data as AiReviewRow | null;
}

export default async function handler(req: any, res: any) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const user = await resolveAuthenticatedAdmin(req);

    if (req.method === "GET") {
      const bootstrap = await loadBootstrap(user);
      res.status(200).json(bootstrap);
      return;
    }

    if (req.method !== "PATCH") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body =
      typeof req.body === "string"
        ? (() => {
            try {
              return JSON.parse(req.body);
            } catch {
              return {};
            }
          })()
        : req.body || {};

    const resource = String(body.resource || "").trim();
    if (resource === "route-settings") {
      const routeSetting = await updateRouteSetting(body);
      res.status(200).json({ routeSetting });
      return;
    }

    if (resource === "review-items") {
      const reviewItem = await updateReviewItem(body);
      res.status(200).json({ reviewItem });
      return;
    }

    if (resource === "usage-refresh") {
      clearOpenAiOrgUsageSnapshotCache();
      const usageOverview = await loadAiUsageOverview(true);
      if (isRuntimeDebugEnabled()) {
        debugLog("admin usage refreshed", {
          liveOpenAi: Boolean(usageOverview.openAiCostMonth != null),
          usageFetchedAt: usageOverview.usageFetchedAt,
        });
      }
      res.status(200).json({ usageOverview });
      return;
    }

    res.status(400).json({ error: "Onbekende beheeractie." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Budio beheer request mislukt.";
    const code = String((error as { code?: string } | null)?.code || "");
    if (code === "forbidden") {
      res.status(403).json({ error: message });
      return;
    }

    if (message === "Missing access token" || message === "Invalid access token") {
      res.status(401).json({ error: message });
      return;
    }

    console.error("[api/admin] request failed", error);
    res.status(500).json({ error: message });
  }
}
