import {
  getAiUseCaseDefinition,
  normalizeAiUseCase,
  type AiProxyEnvelope,
  type AiProxyMeta,
  type AiReviewReasonType,
  type AiReviewRow,
  type AiRouteSetting,
} from "./ai-use-cases.ts";
import { estimateAiUsageCostEur } from "./ai-pricing.ts";

function normalizeUuidOrNull(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

export type AiProxyUsageUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number;
  source: "openai" | "estimated" | "fallback";
};

export type AiProxyResponseUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type AiProxyResponsePayload = {
  id?: string;
  model?: string;
  usage?: AiProxyResponseUsage;
  choices?: {
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }[];
  message?: string;
};

export type AiProxyLogContext = {
  userId: string | null;
  userRole: string | null;
  meta: AiProxyMeta;
  settings: AiRouteSetting;
  httpStatus: number;
  responsePayload?: AiProxyResponsePayload | null;
  error?: string | null;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  estimatedTokens?: number;
  requestPayload?: Record<string, unknown> | null;
};

export type AiReviewCandidate = Pick<
  AiReviewRow,
  | "issue_key"
  | "use_case"
  | "route_name"
  | "screen_id"
  | "screen_title"
  | "reason_type"
  | "summary"
  | "detail"
  | "conversation_excerpt"
  | "confidence"
  | "source_log_id"
  | "user_id"
> & {
  status?: "nieuw";
  occurrence_count?: number;
  first_seen_at?: string;
  last_seen_at?: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseAiProxyEnvelope(body: unknown): AiProxyEnvelope | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const envelope = body as Record<string, unknown>;
  if (!("openai" in envelope) && !("meta" in envelope)) {
    return { openai: body };
  }

  const meta = envelope.meta;
  const openai = envelope.openai;

  if (!openai) {
    return null;
  }

  const rawUseCase = String((meta as Record<string, unknown> | null)?.useCase || "").trim();
  const useCase = normalizeAiUseCase(rawUseCase, "help_general");

  const typedMeta: AiProxyMeta = {
    useCase,
    routeName: normalizeText((meta as Record<string, unknown> | null)?.routeName as string | undefined) || undefined,
    screenId: normalizeText((meta as Record<string, unknown> | null)?.screenId as string | undefined) || undefined,
    screenTitle: normalizeText((meta as Record<string, unknown> | null)?.screenTitle as string | undefined) || undefined,
    platform: normalizeText((meta as Record<string, unknown> | null)?.platform as string | undefined) || undefined,
    periodLabel: normalizeText((meta as Record<string, unknown> | null)?.periodLabel as string | undefined) || undefined,
    agentMode: normalizeText((meta as Record<string, unknown> | null)?.agentMode as string | undefined) || undefined,
    responseMode: normalizeText((meta as Record<string, unknown> | null)?.responseMode as string | undefined) || undefined,
    fallbackEnabled:
      typeof (meta as Record<string, unknown> | null)?.fallbackEnabled === "boolean"
        ? Boolean((meta as Record<string, unknown> | null)?.fallbackEnabled)
        : undefined,
    signalHints: (() => {
      const signals = (meta as Record<string, unknown> | null)?.signalHints;
      if (!signals || typeof signals !== "object" || Array.isArray(signals)) return undefined;
      const typed = signals as Record<string, unknown>;
      const confidence = String(typed.confidence || "").trim();
      const normalizedConfidence =
        confidence === "low" || confidence === "medium" || confidence === "high"
          ? confidence
          : undefined;
      return {
        confidence: normalizedConfidence,
        repeatedQuestion: Boolean(typed.repeatedQuestion),
        issueFlowIncomplete: Boolean(typed.issueFlowIncomplete),
      };
    })(),
    safeFallback: (meta as Record<string, unknown> | null)?.safeFallback,
  };

  return {
    openai,
    meta: typedMeta,
  };
}

export function extractUsageFromResponse(
  responsePayload: AiProxyResponsePayload | null | undefined,
  estimatedTokens = 0,
): AiProxyUsageUsage {
  const usage = responsePayload?.usage;
  const promptTokens = Number.isFinite(Number(usage?.prompt_tokens))
    ? Number(usage?.prompt_tokens)
    : null;
  const completionTokens = Number.isFinite(Number(usage?.completion_tokens))
    ? Number(usage?.completion_tokens)
    : null;
  const totalTokens = Number.isFinite(Number(usage?.total_tokens))
    ? Number(usage?.total_tokens)
    : Math.max(
        0,
        (promptTokens || 0) + (completionTokens || 0) || estimatedTokens || 0,
      );

  if (usage?.total_tokens || promptTokens != null || completionTokens != null) {
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      source: "openai",
    };
  }

  return {
    promptTokens: estimatedTokens > 0 ? estimatedTokens : null,
    completionTokens: 0,
    totalTokens: Math.max(0, estimatedTokens),
    source: "estimated",
  };
}

export function buildAiUsageLogRow(
  input: AiProxyLogContext,
): Record<string, unknown> {
  const useCase = normalizeAiUseCase(input.meta.useCase, "help_general");
  const responseUsage = extractUsageFromResponse(
    input.responsePayload,
    input.estimatedTokens || 0,
  );
  const model = normalizeText(input.responsePayload?.model || input.settings.model);
  const requestTokens = responseUsage.promptTokens;
  const completionTokens = responseUsage.completionTokens;
  const totalTokens = responseUsage.totalTokens;
  const estimatedCostEur = estimateAiUsageCostEur({
    promptTokens: requestTokens,
    completionTokens,
    totalTokens,
    model,
  });

  return {
    user_id: normalizeUuidOrNull(input.userId),
    user_role: input.userRole,
    use_case: useCase,
    route_name: input.meta.routeName || null,
    screen_id: input.meta.screenId || null,
    screen_title: input.meta.screenTitle || null,
    model,
    agent_mode: input.settings.agent_mode || input.meta.agentMode || null,
    response_mode: input.settings.response_mode || input.meta.responseMode || null,
    prompt_tokens: requestTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    estimated_cost_eur: estimatedCostEur,
    usage_source: responseUsage.source,
    used_fallback: Boolean(input.fallbackUsed),
    fallback_reason: input.fallbackReason || null,
    is_error: Boolean(input.error || input.httpStatus >= 400),
    error_code: input.error ? "proxy_error" : null,
    error_message: input.error || null,
    http_status: input.httpStatus,
    response_id: input.responsePayload?.id || null,
    request_meta: {
      useCase,
      routeName: input.meta.routeName || null,
      screenId: input.meta.screenId || null,
      screenTitle: input.meta.screenTitle || null,
      platform: input.meta.platform || null,
      periodLabel: input.meta.periodLabel || null,
      agentMode: input.meta.agentMode || null,
      responseMode: input.meta.responseMode || null,
      fallbackEnabled: input.meta.fallbackEnabled ?? null,
      signalHints: input.meta.signalHints || null,
    },
  };
}

function shortSummaryForReason(reasonType: AiReviewReasonType, useCaseLabel: string) {
  if (reasonType === "fallback_used") return `Fallback nodig in ${useCaseLabel}`;
  if (reasonType === "parse_error") return `Antwoord kon niet worden gelezen in ${useCaseLabel}`;
  if (reasonType === "ai_error") return `AI-fout in ${useCaseLabel}`;
  if (reasonType === "repeated_question") return `Gebruiker stelde dezelfde vraag opnieuw in ${useCaseLabel}`;
  if (reasonType === "issue_flow_incomplete") return `Issue- of feedbackflow bleef hangen in ${useCaseLabel}`;
  if (reasonType === "not_helped") return `Gebruiker lijkt niet goed geholpen in ${useCaseLabel}`;
  if (reasonType === "low_confidence") return `Lage zekerheid in ${useCaseLabel}`;
  return `Er lijkt frictie te zitten in ${useCaseLabel}`;
}

export function buildAiReviewCandidates(
  input: AiProxyLogContext & { logId?: string | null },
): AiReviewCandidate[] {
  const useCase = normalizeAiUseCase(input.meta.useCase, "help_general");
  const useCaseLabel = getAiUseCaseDefinition(useCase).label;
  const responseText = normalizeText(
    input.responsePayload?.choices?.[0]?.message?.content || "",
  );
  const reasonTypes: AiReviewReasonType[] = [];

  if (input.error || input.httpStatus >= 500) {
    reasonTypes.push("ai_error");
  }

  if (input.httpStatus >= 400 && input.httpStatus < 500 && !input.error) {
    reasonTypes.push("parse_error");
  }

  if (input.fallbackUsed) {
    reasonTypes.push("fallback_used");
  }

  const confidence = input.meta.signalHints?.confidence || null;
  if (confidence === "low") {
    reasonTypes.push("low_confidence");
  }

  if (input.meta.signalHints?.repeatedQuestion) {
    reasonTypes.push("repeated_question");
  }

  if (input.meta.signalHints?.issueFlowIncomplete) {
    reasonTypes.push("issue_flow_incomplete");
  }

  const looksUnderHelped =
    responseText.length > 0 &&
    responseText.length < 160 &&
    (responseText.includes("kan je niet helpen") ||
      responseText.includes("ik kan je niet helpen") ||
      responseText.includes("weet ik niet") ||
      responseText.includes("onzeker") ||
      responseText.includes("probeer het later") ||
      responseText.includes("niet genoeg") ||
      responseText.includes("geen idee"));

  if (looksUnderHelped || (input.fallbackUsed && confidence === "low")) {
    reasonTypes.push("not_helped");
  }

  const uniqueReasonTypes = Array.from(new Set(reasonTypes));
  if (!uniqueReasonTypes.length) return [];

  return uniqueReasonTypes.map((reasonType) => ({
    issue_key: [
      useCase,
      input.meta.routeName || "unknown-route",
      reasonType,
      input.meta.screenId || "unknown-screen",
    ].join("|"),
    use_case: useCase,
    route_name: input.meta.routeName || null,
    screen_id: input.meta.screenId || null,
    screen_title: input.meta.screenTitle || null,
    reason_type: reasonType,
    summary: shortSummaryForReason(reasonType, useCaseLabel),
    detail: responseText || input.error || null,
    conversation_excerpt: {
      routeName: input.meta.routeName || null,
      screenTitle: input.meta.screenTitle || null,
      signalHints: input.meta.signalHints || null,
      usedFallback: Boolean(input.fallbackUsed),
      fallbackReason: input.fallbackReason || null,
    },
    confidence,
    source_log_id: input.logId || null,
    user_id: normalizeUuidOrNull(input.userId),
    status: "nieuw",
    occurrence_count: 1,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }));
}
