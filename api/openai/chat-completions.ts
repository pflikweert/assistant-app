import { createClient } from "@supabase/supabase-js";

import {
  buildDefaultAiRouteSettings,
  normalizeAiUseCase,
  type AiProxyMeta,
  type AiRouteSetting,
  type AiUseCase,
} from "../../services/ai-use-cases";
import {
  buildAiReviewCandidates,
  buildAiUsageLogRow,
  parseAiProxyEnvelope,
  type AiProxyResponsePayload,
  type AiProxyLogContext,
} from "../../services/ai-telemetry.ts";
import { debugLog, isRuntimeDebugEnabled } from "../../services/runtime-debug.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 25_000;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const FORWARDED_HEADERS = [
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-tokens",
  "retry-after",
  "content-type",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SpendingAdviceSections = {
  conclusion: string;
  why: string;
  risk: string;
  nextStep: string;
  confidence?: string;
  dataGaps?: string[];
};

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

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase config ontbreekt voor OpenAI proxy (SUPABASE_URL + service role).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is niet geconfigureerd op de server.");
  }
  return apiKey;
}

function withCors(res: any) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

function parseJsonSafely(value: unknown) {
  if (value instanceof Uint8Array) {
    try {
      const decoded = new TextDecoder().decode(value);
      return decoded ? JSON.parse(decoded) : null;
    } catch {
      return null;
    }
  }
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildSyntheticSpendingChatCompletion(
  sections: SpendingAdviceSections,
  idSuffix: string,
) {
  return {
    id: `chatcmpl-help-safe-${idSuffix}`,
    object: "chat.completion",
    model: "proxy-safe-fallback-spending-v1",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify(sections),
        },
      },
    ],
  };
}

function parseSpendingAdviceSchema(content: string): SpendingAdviceSections | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const conclusion = String(parsed.conclusion || "").trim();
      const why = String(parsed.why || "").trim();
      const risk = String(parsed.risk || "").trim();
      const nextStep = String(parsed.nextStep || "").trim();
      if (!conclusion || !why || !risk || !nextStep) continue;

      const confidence = String(parsed.confidence || "").trim() || undefined;
      const dataGaps = Array.isArray(parsed.dataGaps)
        ? parsed.dataGaps.map((item) => String(item || "").trim()).filter(Boolean)
        : undefined;

      return {
        conclusion,
        why,
        risk,
        nextStep,
        confidence,
        dataGaps: dataGaps?.length ? dataGaps : undefined,
      };
    } catch {
      // ignore and continue
    }
  }

  return null;
}

function buildSafeFallbackSections(
  fallback: SpendingAdviceSections | undefined,
): SpendingAdviceSections {
  if (fallback && fallback.conclusion && fallback.why && fallback.risk && fallback.nextStep) {
    return fallback;
  }

  return {
    conclusion: "Ik kan je bestedingsruimte nu niet betrouwbaar bevestigen.",
    why:
      "De adviesberekening via de AI-proxy is op dit moment niet stabiel genoeg voor een scherpe conclusie.",
    risk:
      "Op basis van wat ik nu zie kan ik anders te veel schijnzekerheid geven.",
    nextStep:
      "Open Budget of Inzichten en probeer je vraag opnieuw met bedrag en categorie.",
    confidence: "laag",
    dataGaps: ["proxy_of_schema_fout"],
  };
}

function respondWithSpendingFallback(
  res: any,
  fallback: SpendingAdviceSections | undefined,
  idSuffix: string,
) {
  res.status(200);
  withCors(res);
  res.setHeader("Content-Type", "application/json");
  res.send(
    JSON.stringify(
      buildSyntheticSpendingChatCompletion(
        buildSafeFallbackSections(fallback),
        idSuffix,
      ),
    ),
  );
}

function parseOpenAIMessageContent(payload: unknown) {
  if (!isRecord(payload)) return "";
  const choices = payload.choices;
  if (!Array.isArray(choices) || !choices.length) return "";
  const first = choices[0];
  if (!isRecord(first)) return "";
  const message = first.message;
  if (!isRecord(message)) return "";
  return String(message.content || "").trim();
}

function pickForwardedHeaders(headers: Headers) {
  const forwarded = new Headers();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    forwarded.set(key, value);
  }
  for (const key of FORWARDED_HEADERS) {
    const value = headers.get(key);
    if (value) forwarded.set(key, value);
  }
  return forwarded;
}

function estimateRequestTokens(payloadText: string) {
  return Math.ceil(payloadText.length / 4);
}

async function resolveAuthenticatedUser(req: any) {
  const authHeader = String(req.headers.authorization ?? "");
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token) {
    throw new Error("Missing access token");
  }

  if (isDevAuthEnabled() && token === "dev-access-token") {
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

async function resolveUserRole(userId: string, isDevBypass: boolean) {
  if (isDevBypass) {
    return String(process.env.DEV_AUTH_USER_ROLE || "admin");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return String(data?.role || "user");
}

async function loadRouteSetting(useCase: AiUseCase) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("ai_route_settings")
    .select(
      "use_case,model,agent_mode,temperature,max_tokens,fallback_enabled,response_mode,created_at,updated_at",
    )
    .eq("use_case", useCase)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    return data as AiRouteSetting;
  }

  const defaults = buildDefaultAiRouteSettings().find(
    (row) => row.use_case === useCase,
  );
  if (!defaults) {
    return {
      use_case: useCase,
      model: DEFAULT_OPENAI_MODEL,
      agent_mode: "chat",
      temperature: 0.2,
      max_tokens: 800,
      fallback_enabled: true,
      response_mode: "text",
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("ai_route_settings")
    .upsert(defaults, { onConflict: "use_case" })
    .select(
      "use_case,model,agent_mode,temperature,max_tokens,fallback_enabled,response_mode,created_at,updated_at",
    )
    .maybeSingle();

  if (insertError) throw insertError;
  return (inserted as AiRouteSetting) || defaults;
}

function applyRouteSettingOverrides(
  openAIRequest: Record<string, unknown>,
  routeSetting: AiRouteSetting,
) {
  const payload = { ...openAIRequest };
  payload.model = routeSetting.model || payload.model || DEFAULT_OPENAI_MODEL;
  if (routeSetting.temperature !== null && routeSetting.temperature !== undefined) {
    payload.temperature = routeSetting.temperature;
  }
  if (routeSetting.max_tokens !== null && routeSetting.max_tokens !== undefined) {
    payload.max_tokens = routeSetting.max_tokens;
  }

  if (routeSetting.response_mode === "text") {
    delete payload.response_format;
  } else if (
    routeSetting.response_mode === "json_object" &&
    !payload.response_format
  ) {
    payload.response_format = { type: "json_object" };
  }

  return payload;
}

async function insertUsageLog(
  input: AiProxyLogContext,
  responsePayload: AiProxyResponsePayload | null,
  estimatedTokens: number,
) {
  const supabaseAdmin = getSupabaseAdminClient();
  const usageRow = buildAiUsageLogRow({
    ...input,
    responsePayload,
    estimatedTokens,
  });
  const { data, error } = await supabaseAdmin
    .from("ai_usage_logs")
    .insert(usageRow)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return String((data as { id?: string } | null)?.id || "");
}

async function upsertReviewItems(
  input: AiProxyLogContext & { logId: string },
  responsePayload: AiProxyResponsePayload | null,
) {
  const supabaseAdmin = getSupabaseAdminClient();
  const candidates = buildAiReviewCandidates({
    ...input,
    responsePayload,
  });

  for (const candidate of candidates) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("ai_review_items")
      .select("id,occurrence_count,status")
      .eq("issue_key", candidate.issue_key)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const nextCount = Number(existing.occurrence_count || 0) + 1;
      const { error: updateError } = await supabaseAdmin
        .from("ai_review_items")
        .update({
          occurrence_count: nextCount,
          last_seen_at: new Date().toISOString(),
          summary: candidate.summary,
          detail: candidate.detail,
          conversation_excerpt: candidate.conversation_excerpt,
          confidence: candidate.confidence,
          source_log_id: candidate.source_log_id,
          route_name: candidate.route_name,
          screen_id: candidate.screen_id,
          screen_title: candidate.screen_title,
          reason_type: candidate.reason_type,
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
      continue;
    }

    const { error: insertError } = await supabaseAdmin.from("ai_review_items").insert({
      ...candidate,
      occurrence_count: 1,
      status: "nieuw",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!insertError) continue;

    if (String((insertError as { code?: string } | null)?.code || "") === "23505") {
      const { data: conflicted, error: conflictLookupError } = await supabaseAdmin
        .from("ai_review_items")
        .select("id,occurrence_count")
        .eq("issue_key", candidate.issue_key)
        .maybeSingle();

      if (conflictLookupError) throw conflictLookupError;

      if (conflicted?.id) {
        const nextCount = Number(conflicted.occurrence_count || 0) + 1;
        const { error: conflictUpdateError } = await supabaseAdmin
          .from("ai_review_items")
          .update({
            occurrence_count: nextCount,
            last_seen_at: new Date().toISOString(),
            summary: candidate.summary,
            detail: candidate.detail,
            conversation_excerpt: candidate.conversation_excerpt,
            confidence: candidate.confidence,
            source_log_id: candidate.source_log_id,
            route_name: candidate.route_name,
            screen_id: candidate.screen_id,
            screen_title: candidate.screen_title,
            reason_type: candidate.reason_type,
          })
          .eq("id", conflicted.id);

        if (conflictUpdateError) throw conflictUpdateError;
        continue;
      }

      continue;
    }

    throw insertError;
  }
}

function buildLogContext(input: {
  userId: string | null;
  userRole: string | null;
  meta: AiProxyMeta;
  settings: AiRouteSetting;
  httpStatus: number;
  responsePayload?: AiProxyResponsePayload | null;
  error?: string | null;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  estimatedTokens: number;
  requestPayload: Record<string, unknown> | null;
}): AiProxyLogContext {
  return {
    userId: input.userId,
    userRole: input.userRole,
    meta: input.meta,
    settings: input.settings,
    httpStatus: input.httpStatus,
    responsePayload: input.responsePayload,
    error: input.error,
    fallbackUsed: input.fallbackUsed,
    fallbackReason: input.fallbackReason,
    estimatedTokens: input.estimatedTokens,
    requestPayload: input.requestPayload,
  };
}

export default async function handler(req: any, res: any) {
  withCors(res);

  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ message: "Method not allowed" });
      return;
    }

    const user = await resolveAuthenticatedUser(req);
    const userRole = await resolveUserRole(user.id, user.isDevBypass);
    const body = parseJsonSafely(req.body);
    const envelope = parseAiProxyEnvelope(body);

    if (!envelope) {
      res.status(400).json({ message: "Invalid request body" });
      return;
    }

    const meta = envelope.meta || {
      useCase: "help_general",
    };
    const useCase = normalizeAiUseCase(meta.useCase, "help_general");
    const routeSetting = await loadRouteSetting(useCase);
    if (isRuntimeDebugEnabled()) {
      debugLog("openai request start", {
        useCase,
        routeName: meta.routeName || null,
        screenId: meta.screenId || null,
        screenTitle: meta.screenTitle || null,
        model: routeSetting.model,
        agentMode: routeSetting.agent_mode,
        responseMode: routeSetting.response_mode,
        fallbackEnabled: routeSetting.fallback_enabled,
      });
    }

    const openAIRequest = isRecord(envelope.openai)
      ? (applyRouteSettingOverrides(envelope.openai, routeSetting) as Record<string, unknown>)
      : null;

    if (!openAIRequest) {
      res.status(400).json({ message: "Invalid request body" });
      return;
    }

    const estimatedTokens = estimateRequestTokens(JSON.stringify(openAIRequest));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getOpenAIKey()}`,
        },
        body: JSON.stringify(openAIRequest),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseBody = await response.text();
    const parsedResponse = parseJsonSafely(responseBody) as
      | AiProxyResponsePayload
      | null;

    const responsePayload =
      parsedResponse && typeof parsedResponse === "object"
        ? parsedResponse
        : null;
    const responseMessage = parseOpenAIMessageContent(responsePayload);
    const spendingAdviceQuestion = useCase === "help_spending_advice";
    const fallbackEnabled = routeSetting.fallback_enabled ?? true;
    if (isRuntimeDebugEnabled()) {
      debugLog("openai response received", {
        useCase,
        httpStatus: response.status,
        responseId: responsePayload?.id || null,
        model: responsePayload?.model || null,
        hasUsage: Boolean(responsePayload?.usage),
        fallbackEnabled,
      });
    }

    if (spendingAdviceQuestion) {
      const schema = responseMessage
        ? parseSpendingAdviceSchema(responseMessage)
        : null;

      if (!response.ok || !schema) {
        const fallbackReason = !response.ok
          ? `http_${response.status}`
          : "schema_error";
          const logContext = buildLogContext({
            userId: user.id,
            userRole,
            meta: {
              ...meta,
              useCase,
            fallbackEnabled,
          },
          settings: routeSetting,
          httpStatus: response.ok ? 200 : response.status,
          responsePayload,
          error: response.ok ? null : `OpenAI response failed (${response.status})`,
          fallbackUsed: fallbackEnabled,
          fallbackReason,
          estimatedTokens,
          requestPayload: openAIRequest,
        });

        try {
          const logId = await insertUsageLog(logContext, responsePayload, estimatedTokens);
          await upsertReviewItems(
            {
              ...logContext,
              logId,
            },
            responsePayload,
          );
        } catch (loggingError) {
          console.warn("[api/openai] telemetry logging failed", loggingError);
        }

        if (fallbackEnabled) {
          if (isRuntimeDebugEnabled()) {
            debugLog("openai spending fallback emitted", {
              useCase,
              fallbackReason,
            });
          }
          respondWithSpendingFallback(
            res,
            isRecord(meta.safeFallback)
              ? (meta.safeFallback as SpendingAdviceSections)
              : undefined,
            !response.ok ? `http-${response.status}` : "schema",
          );
          return;
        }

        res.status(response.status).send(responseBody);
        return;
      }

      const finalPayload = responsePayload || buildSyntheticSpendingChatCompletion(schema, "normalized");
      const logContext = buildLogContext({
        userId: user.id,
        userRole,
        meta: {
          ...meta,
          useCase,
          fallbackEnabled,
        },
        settings: routeSetting,
        httpStatus: response.status,
        responsePayload: finalPayload,
        fallbackUsed: false,
        estimatedTokens,
        requestPayload: openAIRequest,
      });

      try {
        const logId = await insertUsageLog(logContext, finalPayload, estimatedTokens);
        await upsertReviewItems({ ...logContext, logId }, finalPayload);
      } catch (loggingError) {
        console.warn("[api/openai] telemetry logging failed", loggingError);
      }

      if (isRuntimeDebugEnabled()) {
        debugLog("openai request completed", {
          useCase,
          httpStatus: response.status,
          responseId: finalPayload?.id || null,
          tokens: finalPayload?.usage?.total_tokens ?? null,
        });
      }

      res.status(200);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(finalPayload));
      return;
    }

    const logContext = buildLogContext({
      userId: user.id,
      userRole,
      meta: {
        ...meta,
        useCase,
        fallbackEnabled,
      },
      settings: routeSetting,
      httpStatus: response.status,
      responsePayload,
      fallbackUsed: false,
      estimatedTokens,
      requestPayload: openAIRequest,
    });

    try {
      const logId = await insertUsageLog(logContext, responsePayload, estimatedTokens);
      await upsertReviewItems({ ...logContext, logId }, responsePayload);
    } catch (loggingError) {
      console.warn("[api/openai] telemetry logging failed", loggingError);
    }

    if (isRuntimeDebugEnabled()) {
      debugLog("openai request completed", {
        useCase,
        httpStatus: response.status,
        responseId: responsePayload?.id || null,
        tokens: responsePayload?.usage?.total_tokens ?? null,
      });
    }

    const headers = pickForwardedHeaders(response.headers);
    headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.status(response.status).send(responseBody);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI proxy onverwachte fout";
    if (message === "Missing access token" || message === "Invalid access token") {
      res.status(401).json({ message });
      return;
    }

    if (error instanceof Error && error.message.includes("rate")) {
      res.status(429).json({ message });
      return;
    }

    console.error("[api/openai] request failed", error);
    res.status(500).json({ message });
  }
}
