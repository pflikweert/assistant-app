import type {
    BudgetCoachReport,
    BudgetPlanComputation,
    BudgetPlanMode,
} from "@/types/categorization";
import { postOpenAIChatCompletion } from "./openai-proxy";
import { getDefaultAiModel } from "./ai-model-catalog.ts";

const DEFAULT_MODEL = getDefaultAiModel();
const OPENAI_RETRY_ATTEMPTS = 4;
const OPENAI_RETRY_DELAY_MS = 2_000;
const OPENAI_MAX_RETRY_DELAY_MS = 60_000;
const OPENAI_TOKEN_SAFETY_BUFFER = 200;
const OPENAI_CACHE_TTL_MS = 15 * 60 * 1000;

type OpenAIRequestError = Error & {
  status?: number;
  retryAfterMs?: number;
  resetRequestsAt?: number | null;
  resetTokensAt?: number | null;
};

type OpenAIRateLimitState = {
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetRequestsAt: number | null;
  resetTokensAt: number | null;
  nextAllowedAt: number;
};

const openAIRateLimitState: OpenAIRateLimitState = {
  remainingRequests: null,
  remainingTokens: null,
  resetRequestsAt: null,
  resetTokensAt: null,
  nextAllowedAt: 0,
};

const reportCache = new Map<
  string,
  { report: BudgetCoachReport; cachedAt: number }
>();
const savingsTargetCache = new Map<
  string,
  {
    target: {
      amount: number;
      usedOpenAI: boolean;
    };
    cachedAt: number;
  }
>();

type AutomaticSavingsTargetInput = {
  monthStart: string;
  mode: Exclude<BudgetPlanMode, "custom">;
  expectedIncomeMonthly: number;
  fixedCostsBudget: number;
  subscriptionsBudget: number;
  variableBaselineBudget: number;
  savingsPotential: number;
  deterministicTarget: number;
  minimumTarget: number;
  maximumTarget: number;
  monthProgress: number;
  projectedMonthlyNet: number;
  recentIncomeTotals: number[];
  recentVariableTotals: number[];
  recentSavingsCapacityTotals: number[];
};

function clampReportItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseRateLimitNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRateLimitDurationMs(value: string | null): number | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  const numericSeconds = Number(normalized);
  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, Math.ceil(numericSeconds * 1000));
  }

  const dateValue = Date.parse(value);
  if (Number.isFinite(dateValue)) {
    return Math.max(0, dateValue - Date.now());
  }

  let total = 0;
  let found = false;
  const pattern = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  let match = pattern.exec(normalized);

  while (match) {
    found = true;
    const amount = Number(match[1]);
    const unit = match[2];

    if (unit === "ms") total += amount;
    if (unit === "s") total += amount * 1000;
    if (unit === "m") total += amount * 60 * 1000;
    if (unit === "h") total += amount * 60 * 60 * 1000;
    if (unit === "d") total += amount * 24 * 60 * 60 * 1000;

    match = pattern.exec(normalized);
  }

  return found ? Math.ceil(total) : null;
}

function setOpenAINextAllowedAt(timestamp: number | null) {
  if (!timestamp || timestamp <= Date.now()) return;
  openAIRateLimitState.nextAllowedAt = Math.max(
    openAIRateLimitState.nextAllowedAt,
    timestamp,
  );
}

function updateOpenAIRateLimitStateFromHeaders(headers: Headers) {
  const now = Date.now();
  const remainingRequests = parseRateLimitNumber(
    headers.get("x-ratelimit-remaining-requests"),
  );
  const remainingTokens = parseRateLimitNumber(
    headers.get("x-ratelimit-remaining-tokens"),
  );
  const requestResetMs = parseRateLimitDurationMs(
    headers.get("x-ratelimit-reset-requests"),
  );
  const tokenResetMs = parseRateLimitDurationMs(
    headers.get("x-ratelimit-reset-tokens"),
  );

  if (remainingRequests !== null) {
    openAIRateLimitState.remainingRequests = remainingRequests;
  }
  if (remainingTokens !== null) {
    openAIRateLimitState.remainingTokens = remainingTokens;
  }
  if (requestResetMs !== null) {
    openAIRateLimitState.resetRequestsAt = now + requestResetMs;
  }
  if (tokenResetMs !== null) {
    openAIRateLimitState.resetTokensAt = now + tokenResetMs;
  }

  if (
    openAIRateLimitState.remainingRequests !== null &&
    openAIRateLimitState.remainingRequests <= 0
  ) {
    setOpenAINextAllowedAt(openAIRateLimitState.resetRequestsAt);
  }

  if (
    openAIRateLimitState.remainingTokens !== null &&
    openAIRateLimitState.remainingTokens <= 0
  ) {
    setOpenAINextAllowedAt(openAIRateLimitState.resetTokensAt);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateOpenAIRequestTokens(payloadText: string) {
  const promptTokens = Math.ceil(payloadText.length / 4);
  return promptTokens + 900;
}

function getOpenAIRateLimitDelayMs(estimatedTokens: number) {
  const now = Date.now();
  let waitUntil = openAIRateLimitState.nextAllowedAt;

  if (
    openAIRateLimitState.remainingRequests !== null &&
    openAIRateLimitState.remainingRequests <= 0 &&
    openAIRateLimitState.resetRequestsAt
  ) {
    waitUntil = Math.max(waitUntil, openAIRateLimitState.resetRequestsAt);
  }

  if (
    openAIRateLimitState.remainingTokens !== null &&
    openAIRateLimitState.remainingTokens <
      estimatedTokens + OPENAI_TOKEN_SAFETY_BUFFER &&
    openAIRateLimitState.resetTokensAt
  ) {
    waitUntil = Math.max(waitUntil, openAIRateLimitState.resetTokensAt);
  }

  return Math.max(0, waitUntil - now);
}

async function waitForOpenAIRateLimitWindow(estimatedTokens: number) {
  while (true) {
    const delayMs = getOpenAIRateLimitDelayMs(estimatedTokens);
    if (delayMs <= 0) return;
    await wait(delayMs);
  }
}

function getOpenAIRetryDelayMs(attempt: number, error: OpenAIRequestError) {
  const baseDelay = Math.min(
    OPENAI_MAX_RETRY_DELAY_MS,
    OPENAI_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1),
  );
  const jitterMultiplier = 0.85 + Math.random() * 0.3;
  const jitteredDelay = Math.round(baseDelay * jitterMultiplier);
  const resetDelay = Math.max(
    error.retryAfterMs ?? 0,
    error.resetRequestsAt ? Math.max(0, error.resetRequestsAt - Date.now()) : 0,
    error.resetTokensAt ? Math.max(0, error.resetTokensAt - Date.now()) : 0,
  );

  return Math.max(jitteredDelay, resetDelay);
}

function buildCacheKey(plan: BudgetPlanComputation) {
  const recommendationSignature = plan.recommendations
    .map(
      (row) => `${row.categoryKey}:${row.monthlyBudget}:${row.monthlyActual}`,
    )
    .join("|");
  const warningSignature = plan.warnings
    .map(
      (warning) =>
        `${warning.categoryKey}:${warning.severity}:${warning.message}`,
    )
    .join("|");

  return [
    plan.planKey,
    plan.referenceDate,
    plan.monthStart,
    plan.settings.mode,
    plan.settings.adjustmentFactor,
    plan.recommendedSavings,
    plan.savingsPotential,
    recommendationSignature,
    warningSignature,
  ].join("::");
}

function readCachedReport(cacheKey: string): BudgetCoachReport | null {
  const cached = reportCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > OPENAI_CACHE_TTL_MS) {
    reportCache.delete(cacheKey);
    return null;
  }
  return cached.report;
}

function setCachedReport(cacheKey: string, report: BudgetCoachReport) {
  reportCache.set(cacheKey, { report, cachedAt: Date.now() });
}

function buildAutomaticSavingsCacheKey(input: AutomaticSavingsTargetInput) {
  return JSON.stringify(input);
}

function readCachedAutomaticSavingsTarget(cacheKey: string) {
  const cached = savingsTargetCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > OPENAI_CACHE_TTL_MS) {
    savingsTargetCache.delete(cacheKey);
    return null;
  }
  return cached.target;
}

function setCachedAutomaticSavingsTarget(
  cacheKey: string,
  target: {
    amount: number;
    usedOpenAI: boolean;
  },
) {
  savingsTargetCache.set(cacheKey, {
    target,
    cachedAt: Date.now(),
  });
}

function clampToSavingsTargetBounds(
  amount: number,
  minimumTarget: number,
  maximumTarget: number,
) {
  const bounded = Math.min(maximumTarget, Math.max(minimumTarget, amount));
  return Math.max(0, Math.round(bounded / 25) * 25);
}

function parseReportContent(content: string): BudgetCoachReport {
  const parsed = JSON.parse(content) as {
    summary?: unknown;
    strengths?: unknown;
    risks?: unknown;
    actions?: unknown;
  };

  return {
    generatedAt: new Date().toISOString(),
    sections: {
      summary: String(parsed.summary || "Geen samenvatting beschikbaar."),
      strengths: clampReportItems(parsed.strengths),
      risks: clampReportItems(parsed.risks),
      actions: clampReportItems(parsed.actions),
    },
  };
}

function buildCoachPromptPayload(plan: BudgetPlanComputation) {
  return {
    monthStart: plan.monthStart,
    monthProgress: plan.monthProgress,
    mode: plan.settings.mode,
    adjustmentFactor: plan.settings.adjustmentFactor,
    savingsTargetSource: plan.savingsTargetSource,
    usedOpenAISavingsTarget: plan.usedOpenAISavingsTarget,
    trend: {
      incomeTotal: plan.trend.income.total,
      expenseTotal: plan.trend.expenses.total,
      net: plan.trend.net,
      fixedCosts: plan.trend.expenses.fixedCosts,
      subscriptions: plan.trend.expenses.subscriptions,
      variableCosts: plan.trend.expenses.variableCosts,
    },
    monthToDate: {
      incomeTotal: plan.monthToDateIncome.total,
      expenseTotal: plan.monthToDateExpenses.total,
      net: plan.monthToDateIncome.total - plan.monthToDateExpenses.total,
    },
    recommendations: plan.recommendations.map((row) => ({
      categoryKey: row.categoryKey,
      label: row.label,
      monthlyBudget: row.monthlyBudget,
      monthlyActual: row.monthlyActual,
      weeklyBudget: row.weeklyBudget,
      utilization: row.utilization,
    })),
    warnings: plan.warnings.slice(0, 6).map((warning) => ({
      categoryKey: warning.categoryKey,
      severity: warning.severity,
      utilization: warning.utilization,
      message: warning.message,
    })),
    recommendedSavings: plan.recommendedSavings,
    savingsPotential: plan.savingsPotential,
  };
}

async function requestAutomaticSavingsTarget(
  model: string,
  input: AutomaticSavingsTargetInput,
): Promise<number> {
  const payload = {
    model,
    temperature: 0.1,
    max_tokens: 140,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "automatic_budget_savings_target",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            amount: {
              type: "number",
            },
          },
          required: ["amount"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "Je bepaalt een realistisch Nederlands maandspaardoel. Gebruik alleen de aangeleverde data. Geef uitsluitend een bedrag in euro, als veelvoud van 25, tussen de meegegeven minimum- en maximumgrens. Voor active_savings mag het ambitieus maar realistisch zijn. Voor balanced moet het duidelijk minder streng zijn dan active_savings en meer ruimte laten voor uitgaven.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
  };

  const payloadText = JSON.stringify(payload);
  const estimatedTokens = estimateOpenAIRequestTokens(payloadText);

  await waitForOpenAIRateLimitWindow(estimatedTokens);

  const response = await postOpenAIChatCompletion(payload, {
    useCase: "budget_coach",
    agentMode: "analysis",
    responseMode: "json_schema",
    fallbackEnabled: true,
  });

  updateOpenAIRateLimitStateFromHeaders(response.headers);

  if (!response.ok) {
    const errText = await response.text();
    const retryAfterMs = parseRateLimitDurationMs(
      response.headers.get("Retry-After"),
    );

    setOpenAINextAllowedAt(
      retryAfterMs
        ? Date.now() + retryAfterMs
        : openAIRateLimitState.resetRequestsAt,
    );

    const err = new Error(
      `OpenAI automatic savings target request failed (${response.status}): ${errText}`,
    ) as OpenAIRequestError;
    err.status = response.status;
    err.retryAfterMs = retryAfterMs ?? undefined;
    err.resetRequestsAt = openAIRateLimitState.resetRequestsAt;
    err.resetTokensAt = openAIRateLimitState.resetTokensAt;
    throw err;
  }

  const data = (await response.json()) as {
    choices?: {
      finish_reason?: string;
      message?: {
        content?: string;
      };
    }[];
  };

  if (data.choices?.[0]?.finish_reason === "length") {
    throw new Error("OpenAI automatic savings target response was truncated.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI automatic savings target response was empty.");
  }

  const parsed = JSON.parse(content) as { amount?: unknown };
  const rawAmount = Number(parsed.amount);
  if (!Number.isFinite(rawAmount)) {
    throw new Error("OpenAI automatic savings target response was invalid.");
  }

  return clampToSavingsTargetBounds(
    rawAmount,
    input.minimumTarget,
    input.maximumTarget,
  );
}

async function requestAutomaticSavingsTargetWithRetry(
  model: string,
  input: AutomaticSavingsTargetInput,
) {
  let attempt = 0;

  while (true) {
    try {
      return await requestAutomaticSavingsTarget(model, input);
    } catch (error) {
      const typedErr = error as OpenAIRequestError;
      const isRateLimit = typedErr.status === 429;
      const isTransient = !typedErr.status || typedErr.status >= 500;
      const shouldRetry = isRateLimit || isTransient;
      if (!shouldRetry || attempt >= OPENAI_RETRY_ATTEMPTS) throw error;

      attempt += 1;
      const delay = getOpenAIRetryDelayMs(attempt, typedErr);
      setOpenAINextAllowedAt(Date.now() + delay);
      await wait(delay);
    }
  }
}

export async function suggestAutomaticSavingsTarget(
  input: AutomaticSavingsTargetInput,
): Promise<{
  amount: number;
  usedOpenAI: boolean;
}> {
  const boundedDeterministicTarget = clampToSavingsTargetBounds(
    input.deterministicTarget,
    input.minimumTarget,
    input.maximumTarget,
  );

  if (input.maximumTarget <= 0 || boundedDeterministicTarget <= 0) {
    return {
      amount: 0,
      usedOpenAI: false,
    };
  }

  const cacheKey = buildAutomaticSavingsCacheKey({
    ...input,
    deterministicTarget: boundedDeterministicTarget,
  });
  const cached = readCachedAutomaticSavingsTarget(cacheKey);
  if (cached) return cached;

  try {
    const amount = await requestAutomaticSavingsTargetWithRetry(
      DEFAULT_MODEL,
      {
        ...input,
        deterministicTarget: boundedDeterministicTarget,
      },
    );
    const resolved = {
      amount,
      usedOpenAI: true,
    };
    setCachedAutomaticSavingsTarget(cacheKey, resolved);
    return resolved;
  } catch (error) {
    console.warn(
      "[budget-coach] automatic savings target generation failed",
      error,
    );
    return {
      amount: boundedDeterministicTarget,
      usedOpenAI: false,
    };
  }
}

async function requestCoachReport(
  model: string,
  plan: BudgetPlanComputation,
): Promise<BudgetCoachReport> {
  const payload = {
    model,
    temperature: 0.2,
    max_tokens: 900,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "budget_coach_report",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            strengths: {
              type: "array",
              items: { type: "string" },
            },
            risks: {
              type: "array",
              items: { type: "string" },
            },
            actions: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["summary", "strengths", "risks", "actions"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "Je bent een budgetcoach voor Nederlandse huishoudfinancien. Gebruik alleen de aangeleverde data. Geef kort, concreet en uitvoerbaar advies in het Nederlands. Vermijd oordeel of moraliserende toon.",
      },
      {
        role: "user",
        content: JSON.stringify(buildCoachPromptPayload(plan)),
      },
    ],
  };

  const payloadText = JSON.stringify(payload);
  const estimatedTokens = estimateOpenAIRequestTokens(payloadText);

  await waitForOpenAIRateLimitWindow(estimatedTokens);

  const response = await postOpenAIChatCompletion(payload, {
    useCase: "budget_coach",
    agentMode: "analysis",
    responseMode: "json_schema",
    fallbackEnabled: true,
  });

  updateOpenAIRateLimitStateFromHeaders(response.headers);

  if (!response.ok) {
    const errText = await response.text();
    const retryAfterMs = parseRateLimitDurationMs(
      response.headers.get("Retry-After"),
    );

    setOpenAINextAllowedAt(
      retryAfterMs
        ? Date.now() + retryAfterMs
        : openAIRateLimitState.resetRequestsAt,
    );

    const err = new Error(
      `OpenAI budget coach request failed (${response.status}): ${errText}`,
    ) as OpenAIRequestError;
    err.status = response.status;
    err.retryAfterMs = retryAfterMs ?? undefined;
    err.resetRequestsAt = openAIRateLimitState.resetRequestsAt;
    err.resetTokensAt = openAIRateLimitState.resetTokensAt;
    throw err;
  }

  const data = (await response.json()) as {
    choices?: {
      finish_reason?: string;
      message?: {
        content?: string;
      };
    }[];
  };

  if (data.choices?.[0]?.finish_reason === "length") {
    throw new Error("OpenAI budget coach response was truncated.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI budget coach response was empty.");
  }

  return parseReportContent(content);
}

async function requestCoachReportWithRetry(
  model: string,
  plan: BudgetPlanComputation,
) {
  let attempt = 0;

  while (true) {
    try {
      return await requestCoachReport(model, plan);
    } catch (error) {
      const typedErr = error as OpenAIRequestError;
      const isRateLimit = typedErr.status === 429;
      const isTransient = !typedErr.status || typedErr.status >= 500;
      const shouldRetry = isRateLimit || isTransient;
      if (!shouldRetry || attempt >= OPENAI_RETRY_ATTEMPTS) throw error;

      attempt += 1;
      const delay = getOpenAIRetryDelayMs(attempt, typedErr);
      setOpenAINextAllowedAt(Date.now() + delay);
      await wait(delay);
    }
  }
}

export async function generateBudgetCoachReport(
  plan: BudgetPlanComputation,
): Promise<BudgetCoachReport> {
  const cacheKey = buildCacheKey(plan);
  const cached = readCachedReport(cacheKey);
  if (cached) return cached;

  try {
    const report = await requestCoachReportWithRetry(
      DEFAULT_MODEL,
      plan,
    );
    setCachedReport(cacheKey, report);
    return report;
  } catch (error) {
    console.warn("[budget-coach] live coach generation failed", error);
    return plan.coachReport;
  }
}
