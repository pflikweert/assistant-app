import type {
  HelpAssistantMessage,
  HelpAssistantThreadState,
} from "./help-assistant-chat";
import Constants from "expo-constants";

const appEnv = ((Constants.expoConfig?.extra as Record<
  string,
  string | undefined
>) || process.env) as Record<string, string | undefined>;

export const DEFAULT_MODEL = appEnv.OPENAI_MODEL || "gpt-4.1-mini";
export const MAX_CONTEXT_MESSAGES = 12;
export const MAX_PLANNER_MESSAGES = 6;
export const HELP_ASSISTANT_DEBUG_ENABLED =
  String(appEnv.EXPO_PUBLIC_HELP_ASSISTANT_DEBUG || "") === "1";

export type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  model?: string;
  id?: string;
};

export type HelpAssistantTurnRoute =
  | "issue_intake"
  | "spending_advice"
  | "general"
  | "transactions_insight"
  | "category_insight"
  | "screen_explanation";

export type HelpAssistantResponseMode =
  | "general_help"
  | "issue_intake"
  | "space_summary"
  | "spending_decision"
  | "transaction_lookup"
  | "category_summary"
  | "screen_help";

export type HelpAssistantActiveFlowInfluence = "none" | "low" | "medium" | "high";

export type HelpAssistantPlannerRequires = {
  monthBudget: boolean;
  cashflowSafety: boolean;
  expectedEndBalance: boolean;
  categorySummary: boolean;
  transactionFacts: boolean;
  screenExplanation: boolean;
};

export type HelpAssistantPlannerMonthScope =
  | "current"
  | "previous"
  | "specified"
  | "none";

export type HelpAssistantPlannerTransactionQuestionType =
  | "merchant_total"
  | "merchant_frequency"
  | "category_places"
  | "category_total"
  | "none";

export type HelpAssistantPlannerScopeSlug = string | "none" | "unknown";

export type HelpAssistantPlannerInsightsFlow =
  | "general_reasoning"
  | "spending_overview"
  | "category_summary"
  | "transaction_facts"
  | "screen_context"
  | "issue_intake"
  | "none";

export type HelpAssistantPlannerDataRequests = {
  monthScope: HelpAssistantPlannerMonthScope;
  categoryScope: HelpAssistantPlannerScopeSlug;
  merchantScope: HelpAssistantPlannerScopeSlug;
  transactionQuestionType: HelpAssistantPlannerTransactionQuestionType;
};

export type HelpAssistantAvailableCategoryScope = {
  slug: string;
  label: string;
  source: "spending" | "subcategory" | "budget";
};

export type HelpAssistantPlannerDecision = {
  route: HelpAssistantTurnRoute;
  mode: HelpAssistantResponseMode;
  insightsFlow: HelpAssistantPlannerInsightsFlow;
  confidence: "low" | "medium" | "high";
  needsClarification: boolean;
  continueActiveFlow: boolean;
  activeFlowInfluence: HelpAssistantActiveFlowInfluence;
  requires: HelpAssistantPlannerRequires;
  dataRequests: HelpAssistantPlannerDataRequests;
  useScreenContext: boolean;
};

export type HelpAssistantActiveFlowDescriptor = {
  route: HelpAssistantTurnRoute | string;
  mode?: HelpAssistantResponseMode | string | null;
  status?: string | null;
  anchorMessageId?: string | null;
  reason?: string | null;
};

export type NormalizedActiveFlow = {
  route: HelpAssistantTurnRoute | "unknown";
  mode: HelpAssistantResponseMode | "unknown";
  status: string | null;
  anchorMessageId: string | null;
  reason: string | null;
};

export type HelpAssistantIntentHint = {
  intent: string;
  confidence?: "low" | "medium" | "high";
} | null;

export type SpendingAdviceSections = {
  conclusion: string;
  why: string;
  risk: string;
  nextStep: string;
};

export type HelpAssistantStructuredResponseType =
  | "general"
  | "idea"
  | "issue"
  | "feedback"
  | "bug";

export type HelpAssistantStructuredResponseContext = {
  screenId: string;
  screenTitle: string;
  routeName: string;
  platform: string;
  periodLabel: string | null;
};

export type HelpAssistantIssueDraftResponse = {
  meta: {
    route: "issue_intake";
    type: HelpAssistantStructuredResponseType;
    subtype: "general" | "idea" | "issue" | "feedback" | "bug";
    confidence: "low" | "medium" | "high";
    state: "collecting" | "ready_to_review";
    needsClarification: boolean;
    context: HelpAssistantStructuredResponseContext;
  };
  answerText: string;
  summary: string;
  featureArea: string;
  userNeed: string;
  proposedChange: string;
  isReadyForSubmission: boolean;
  followUpQuestion?: string;
};

export type SpendingAdviceResponseSchema = SpendingAdviceSections & {
  meta?: {
    route: "spending_advice";
    type: "spending_advice";
    context: HelpAssistantStructuredResponseContext;
  };
  confidence?: string;
  dataGaps?: string[];
};

export type HelpAssistantHydrationAnswerability =
  | "answerable"
  | "partial"
  | "blocked";

export type HelpAssistantHydrationPeriodMatch = "exact" | "mismatch" | "unknown";

export type HelpAssistantHydrationResult = {
  financialSnapshotBlock: string | null;
  categorySummaryBlock: string | null;
  transactionFactsBlock: string | null;
  loadedBlocks: string[];
  limitations: string[];
  answerability: HelpAssistantHydrationAnswerability;
  periodMatch: HelpAssistantHydrationPeriodMatch;
};

export function toOpenAIRole(role: HelpAssistantMessage["role"]) {
  return role === "assistant" ? "assistant" : "user";
}

export function pickThreadMessagesForModel(thread: HelpAssistantThreadState) {
  const candidates = thread.messages.filter((message) =>
    message.status !== "error" && message.role !== "assistant"
      ? true
      : message.status === "ready",
  );

  return candidates.slice(-MAX_CONTEXT_MESSAGES);
}

export function pickPlannerMessagesForModel(thread: HelpAssistantThreadState) {
  return pickThreadMessagesForModel(thread).slice(-MAX_PLANNER_MESSAGES);
}

export function logHelpAssistantDebug(
  label: string,
  payload: Record<string, unknown>,
) {
  if (!HELP_ASSISTANT_DEBUG_ENABLED) return;
  try {
    console.info(`[help-assistant][${label}] ${JSON.stringify(payload)}`);
  } catch {
    // ignore debug logging failures
  }
}

export function parseJsonObject(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      // keep trying other candidates
    }
  }

  return null;
}

export function cleanInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function getLatestUserMessage(thread: HelpAssistantThreadState) {
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message.role === "user") return message;
  }
  return null;
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function hasRepeatedUserQuestion(thread: HelpAssistantThreadState) {
  const recentUserMessages = thread.messages.filter(
    (message) => message.role === "user",
  );
  if (recentUserMessages.length < 2) return false;

  const last = recentUserMessages[recentUserMessages.length - 1];
  const previous = recentUserMessages[recentUserMessages.length - 2];
  return normalizeText(last.text) === normalizeText(previous.text);
}

export function normalizeQuestionText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function sanitizeScopeSlug(
  value: unknown,
  fallback: "none" | "unknown",
): HelpAssistantPlannerScopeSlug {
  const placeholderTokens = new Set([
    "slug",
    "category_slug",
    "merchant_slug",
    "categoryscope",
    "merchantscope",
    "category_scope",
    "merchant_scope",
    "category",
    "merchant",
  ]);
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "none" || raw === "unknown") return raw;
  if (placeholderTokens.has(raw)) return fallback;
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!slug) return fallback;
  if (placeholderTokens.has(slug)) return fallback;
  return slug;
}

export function tokenizeScopeText(value: string | null | undefined) {
  return normalizeQuestionText(value)
    .split(/[\s_]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        ![
          "de",
          "het",
          "een",
          "aan",
          "van",
          "met",
          "voor",
          "naar",
          "mijn",
          "deze",
          "dit",
          "die",
          "dat",
          "nog",
          "wel",
        ].includes(token),
    );
}

export function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function buildPlannerRequiresDefaults(): HelpAssistantPlannerRequires {
  return {
    monthBudget: false,
    cashflowSafety: false,
    expectedEndBalance: false,
    categorySummary: false,
    transactionFacts: false,
    screenExplanation: false,
  };
}

export function buildPlannerDataRequestsDefaults(): HelpAssistantPlannerDataRequests {
  return {
    monthScope: "none",
    categoryScope: "none",
    merchantScope: "none",
    transactionQuestionType: "none",
  };
}

export function formatAmount(value: number | null | undefined) {
  if (!Number.isFinite(value as number)) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function isHelpAssistantTurnRoute(
  value: string | null | undefined,
): value is HelpAssistantTurnRoute {
  return (
    value === "issue_intake" ||
    value === "spending_advice" ||
    value === "general" ||
    value === "transactions_insight" ||
    value === "category_insight" ||
    value === "screen_explanation"
  );
}

export function isHelpAssistantResponseMode(
  value: string | null | undefined,
): value is HelpAssistantResponseMode {
  return (
    value === "general_help" ||
    value === "issue_intake" ||
    value === "space_summary" ||
    value === "spending_decision" ||
    value === "transaction_lookup" ||
    value === "category_summary" ||
    value === "screen_help"
  );
}

export function isHelpAssistantPlannerInsightsFlow(
  value: string | null | undefined,
): value is HelpAssistantPlannerInsightsFlow {
  return (
    value === "general_reasoning" ||
    value === "spending_overview" ||
    value === "category_summary" ||
    value === "transaction_facts" ||
    value === "screen_context" ||
    value === "issue_intake" ||
    value === "none"
  );
}

export function resolveDefaultModeForRoute(route: HelpAssistantTurnRoute) {
  if (route === "issue_intake") return "issue_intake" as const;
  if (route === "spending_advice") return "spending_decision" as const;
  if (route === "transactions_insight") return "transaction_lookup" as const;
  if (route === "category_insight") return "category_summary" as const;
  if (route === "screen_explanation") return "screen_help" as const;
  return "general_help" as const;
}

export function resolveDefaultInsightsFlowForRoute(
  route: HelpAssistantTurnRoute,
): HelpAssistantPlannerInsightsFlow {
  if (route === "issue_intake") return "issue_intake";
  if (route === "spending_advice") return "spending_overview";
  if (route === "transactions_insight") return "transaction_facts";
  if (route === "category_insight") return "category_summary";
  if (route === "screen_explanation") return "screen_context";
  return "general_reasoning";
}

export function detectRequestedTimeScope(
  question: string | null | undefined,
): {
  monthScopeHint: HelpAssistantPlannerMonthScope | null;
  unsupported: "year" | "trend" | null;
} {
  const normalized = normalizeQuestionText(question);
  if (!normalized) {
    return { monthScopeHint: null, unsupported: null };
  }
  if (
    normalized.includes("dit jaar") ||
    normalized.includes("afgelopen jaar") ||
    normalized.includes("vorig jaar") ||
    normalized.includes("jaarlijks")
  ) {
    return { monthScopeHint: null, unsupported: "year" };
  }
  if (
    normalized.includes("trend") ||
    normalized.includes("ontwikkeling") ||
    normalized.includes("verloop")
  ) {
    return { monthScopeHint: null, unsupported: "trend" };
  }
  if (normalized.includes("vorige maand") || normalized.includes("afgelopen maand")) {
    return { monthScopeHint: "previous", unsupported: null };
  }
  if (
    normalized.includes("deze maand") ||
    normalized.includes("deze periode") ||
    normalized.includes("nu")
  ) {
    return { monthScopeHint: "current", unsupported: null };
  }
  return { monthScopeHint: null, unsupported: null };
}

export function resolveContextMonthKey(selectedPeriod: {
  key?: string | null;
  startIso?: string | null;
} | null | undefined) {
  const explicitKey = String(selectedPeriod?.key || "").trim();
  if (/^\d{4}-\d{2}$/.test(explicitKey)) return explicitKey;
  const fromStartIso = String(selectedPeriod?.startIso || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(fromStartIso)) return fromStartIso;
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number) {
  const [yearValue, monthValue] = String(monthKey || "").split("-");
  const year = Number.parseInt(yearValue || "", 10);
  const month = Number.parseInt(monthValue || "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const shiftedDate = new Date(year, month - 1 + deltaMonths, 1);
  const start = new Date(shiftedDate.getFullYear(), shiftedDate.getMonth(), 1);
  const end = new Date(shiftedDate.getFullYear(), shiftedDate.getMonth() + 1, 1);
  const toIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  return {
    key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    startIso: toIso(start),
    endIso: toIso(end),
  };
}
