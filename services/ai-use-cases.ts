export const AI_USE_CASES = [
  {
    key: "help_general",
    label: "Algemene hulp",
    description: "Schermuitleg, probleemhulp en algemene assistentvragen.",
    defaultAgentMode: "chat",
    defaultResponseMode: "text",
    defaultTemperature: 0.2,
    defaultMaxTokens: 800,
    fallbackEnabled: true,
  },
  {
    key: "help_spending_advice",
    label: "Bestedingsadvies",
    description: "Ruimtevraag en uitgavebeslissingen in de hulpassistent.",
    defaultAgentMode: "chat",
    defaultResponseMode: "json_object",
    defaultTemperature: 0.2,
    defaultMaxTokens: 800,
    fallbackEnabled: true,
  },
  {
    key: "budget_coach",
    label: "Budgetcoach",
    description: "Samenvatting en advies op basis van budget- en forecastdata.",
    defaultAgentMode: "analysis",
    defaultResponseMode: "json_schema",
    defaultTemperature: 0.2,
    defaultMaxTokens: 900,
    fallbackEnabled: true,
  },
  {
    key: "transaction_categorization",
    label: "Transactiecategorisatie",
    description: "AI-classificatie van transacties en tegenpartijen.",
    defaultAgentMode: "classification",
    defaultResponseMode: "json_schema",
    defaultTemperature: 0,
    defaultMaxTokens: 700,
    fallbackEnabled: true,
  },
  {
    key: "import_pdf_mapping",
    label: "PDF importmapping",
    description: "Mapping van bank-PDF-transacties naar canonieke regels.",
    defaultAgentMode: "extraction",
    defaultResponseMode: "json_object",
    defaultTemperature: 0,
    defaultMaxTokens: 1600,
    fallbackEnabled: true,
  },
] as const;

export type AiUseCase = (typeof AI_USE_CASES)[number]["key"];
export type AiAgentMode = (typeof AI_USE_CASES)[number]["defaultAgentMode"];
export type AiResponseMode = (typeof AI_USE_CASES)[number]["defaultResponseMode"];

export type AiUseCaseDefinition = (typeof AI_USE_CASES)[number];

export type AiRouteSetting = {
  use_case: AiUseCase;
  model: string;
  agent_mode: string;
  temperature: number;
  max_tokens: number;
  fallback_enabled: boolean;
  response_mode: string;
  created_at?: string;
  updated_at?: string;
};

export type AiProxySignalHints = {
  confidence?: "low" | "medium" | "high";
  repeatedQuestion?: boolean;
  issueFlowIncomplete?: boolean;
};

export type AiProxyMeta = {
  useCase: AiUseCase;
  routeName?: string;
  screenId?: string;
  screenTitle?: string;
  platform?: string;
  periodLabel?: string;
  agentMode?: string;
  responseMode?: string;
  fallbackEnabled?: boolean;
  signalHints?: AiProxySignalHints;
  safeFallback?: unknown;
};

export type AiProxyEnvelope = {
  openai: unknown;
  meta?: AiProxyMeta;
};

export type AiUsageRow = {
  id: string;
  user_id: string | null;
  user_role: string | null;
  use_case: AiUseCase | string;
  route_name: string | null;
  screen_id: string | null;
  screen_title: string | null;
  model: string | null;
  agent_mode: string | null;
  response_mode: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number;
  estimated_cost_eur: number;
  usage_source: string | null;
  used_fallback: boolean;
  fallback_reason: string | null;
  is_error: boolean;
  error_code: string | null;
  error_message: string | null;
  http_status: number | null;
  response_id: string | null;
  request_meta: Record<string, unknown> | null;
  created_at: string;
};

export type AiReviewItemStatus = "nieuw" | "bekeken" | "opgelost";

export type AiReviewReasonType =
  | "low_confidence"
  | "repeated_question"
  | "fallback_used"
  | "parse_error"
  | "ai_error"
  | "issue_flow_incomplete"
  | "not_helped";

export type AiReviewRow = {
  id: string;
  issue_key: string;
  user_id: string | null;
  use_case: string;
  route_name: string | null;
  screen_id: string | null;
  screen_title: string | null;
  reason_type: AiReviewReasonType | string;
  status: AiReviewItemStatus | string;
  summary: string;
  detail: string | null;
  conversation_excerpt: unknown;
  confidence: string | null;
  source_log_id: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export function getDefaultAiModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export function listAiUseCases(): AiUseCaseDefinition[] {
  return [...AI_USE_CASES];
}

export function isAiUseCase(value: string | null | undefined): value is AiUseCase {
  return AI_USE_CASES.some((definition) => definition.key === value);
}

export function normalizeAiUseCase(
  value: string | null | undefined,
  fallback: AiUseCase = "help_general",
): AiUseCase {
  return isAiUseCase(value) ? value : fallback;
}

export function getAiUseCaseDefinition(useCase: AiUseCase | string) {
  return (
    AI_USE_CASES.find((definition) => definition.key === useCase) ||
    AI_USE_CASES[0]
  );
}

export function buildDefaultAiRouteSettings(): AiRouteSetting[] {
  const model = getDefaultAiModel();
  return AI_USE_CASES.map((definition) => ({
    use_case: definition.key,
    model,
    agent_mode: definition.defaultAgentMode,
    temperature: definition.defaultTemperature,
    max_tokens: definition.defaultMaxTokens,
    fallback_enabled: definition.fallbackEnabled,
    response_mode: definition.defaultResponseMode,
  }));
}
