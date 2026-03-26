import type {
    CategoryRecord,
    CategoryRuleRecord,
    TransactionCategorizationRecord,
} from "@/types/categorization";
import Constants from "expo-constants";
import { enrichTransactionAnalysis } from "./analysis";
import {
  createSupabaseCategorizationRepository,
  normalizePattern,
} from "./categorization-repository";
import {
  getTransactionCleanupSuccessMessage,
  resolveTransactionCleanupScopeInfo,
  type TransactionCleanupScope,
} from "./transaction-data-cleanup";
import {
    type CategorizationRunMode,
    resetCategorizationStatus,
    updateCategorizationStatus,
} from "./categorization-status";
import { getLeafCategories } from "./category-display";
import { requestForecastRefresh } from "./forecast-refresh";
import { postOpenAIChatCompletion } from "./openai-proxy";
import {
  resolveOwnAccountTransferHeuristicMatch,
} from "./own-account-transfer-heuristics";
import { listBankAccountHashes } from "./bank-accounts";
const appEnv = ((Constants.expoConfig?.extra as Record<
  string,
  string | undefined
>) || process.env) as Record<string, string | undefined>;
const DEFAULT_MODEL = appEnv.OPENAI_MODEL || "gpt-4.1-mini";
const RULE_CONFIDENCE_THRESHOLD = 0.8;
const BACKGROUND_SWEEP_LIMIT = 100;
const RECAT_ALL_PAGE_SIZE = 500;
const BACKGROUND_PROCESS_BATCH_SIZE = 20;
const OPENAI_BATCH_SIZE = 5;
const OPENAI_INTER_BATCH_DELAY_MS = 2000;
const OPENAI_TOKEN_SAFETY_BUFFER = 250;
const OPENAI_RETRY_ATTEMPTS = 5;
const OPENAI_RETRY_DELAY_MS = 2_000;
const OPENAI_MAX_RETRY_DELAY_MS = 60_000;
const OPENAI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OPENAI_CACHE_MAX_ENTRIES = 1500;
const OPENAI_CACHE_STORAGE_KEY = "categorization_openai_cache_v1";

const queuedTransactionIds = new Set<string>();
let queuedBatchOwnerUserId: string | null = null;

let isBackgroundFlushRunning = false;
let isPendingSweepRunning = false;
let forceQueuedRecategorization = false;
let pauseRequested = false;
let stopRequested = false;

type CategorizationRunOptions = {
  force?: boolean;
  scheduleForecastRefresh?: boolean;
};

type CategorizationResult = {
  transactionId: string;
  categoryId: string;
  confidence: number;
  source: "rule" | "openai";
  model: string;
  reason?: string;
  matchedRuleId?: string;
};

type CategorizationSummary = {
  considered: number;
  updated: number;
  rule: number;
  openai: number;
  skipped: number;
  cleared: number;
};

type OpenAIResult = {
  id: string;
  category_key: string;
  confidence: number;
  reason?: string;
};

type CachedOpenAIDecision = {
  categoryKey: string;
  confidence: number;
  reason?: string;
  model: string;
  cachedAt: number;
  hits: number;
};

type OpenAIRequestError = Error & {
  status?: number;
  code?: string;
  retryAfterMs?: number;
  resetRequestsAt?: number | null;
  resetTokensAt?: number | null;
  remainingRequests?: number | null;
  remainingTokens?: number | null;
};

type OpenAIRateLimitState = {
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetRequestsAt: number | null;
  resetTokensAt: number | null;
  nextAllowedAt: number;
};

const openAIDecisionCache = new Map<string, CachedOpenAIDecision>();
let openAICacheLoaded = false;
const openAIRateLimitState: OpenAIRateLimitState = {
  remainingRequests: null,
  remainingTokens: null,
  resetRequestsAt: null,
  resetTokensAt: null,
  nextAllowedAt: 0,
};

function createCategorizationStoppedError(): OpenAIRequestError {
  const err = new Error("Categorisatie gestopt.") as OpenAIRequestError;
  err.code = "stopped";
  return err;
}

function throwIfCategorizationStopped() {
  if (stopRequested) {
    throw createCategorizationStoppedError();
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return String(error);

  const record = error as Record<string, unknown>;
  const message =
    typeof record.message === "string" ? record.message.trim() : "";
  const detailsRaw =
    typeof record.details === "string" ? record.details.trim() : "";
  const details = detailsRaw ? detailsRaw.split("\n")[0] : "";
  const code = typeof record.code === "string" ? record.code.trim() : "";

  const compact = [message, details, code ? `code=${code}` : ""]
    .filter(Boolean)
    .join(" | ");
  if (compact) return compact;

  try {
    return JSON.stringify(record);
  } catch {
    return String(error);
  }
}

function truncateText(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

async function waitWithStatus(
  totalMs: number,
  buildMessage: (remainingMs: number) => string,
) {
  let remainingMs = totalMs;

  while (remainingMs > 0) {
    throwIfCategorizationStopped();
    updateCategorizationStatus((current) =>
      current.phase === "running"
        ? {
            ...current,
            message: buildMessage(remainingMs),
          }
        : current,
    );

    const sleepMs = Math.min(1000, remainingMs);
    await wait(sleepMs);
    throwIfCategorizationStopped();
    remainingMs -= sleepMs;
  }
}

function getBrowserStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
} | null {
  const candidate = (
    globalThis as {
      localStorage?: {
        getItem?: (key: string) => string | null;
        setItem?: (key: string, value: string) => void;
      };
    }
  ).localStorage;

  if (
    !candidate ||
    typeof candidate.getItem !== "function" ||
    typeof candidate.setItem !== "function"
  ) {
    return null;
  }

  return {
    getItem: candidate.getItem.bind(candidate),
    setItem: candidate.setItem.bind(candidate),
  };
}

function persistOpenAICache() {
  const storage = getBrowserStorage();
  if (!storage) return;

  try {
    storage.setItem(
      OPENAI_CACHE_STORAGE_KEY,
      JSON.stringify(Array.from(openAIDecisionCache.entries())),
    );
  } catch {
    // Ignore local persistence failures.
  }
}

function clearPersistedOpenAICache() {
  const storage = getBrowserStorage();
  if (!storage) return;

  try {
    storage.setItem(OPENAI_CACHE_STORAGE_KEY, JSON.stringify([]));
  } catch {
    // Ignore local persistence failures.
  }
}

function pruneOpenAICache(now = Date.now()) {
  for (const [key, decision] of openAIDecisionCache.entries()) {
    if (now - decision.cachedAt > OPENAI_CACHE_TTL_MS) {
      openAIDecisionCache.delete(key);
    }
  }

  if (openAIDecisionCache.size <= OPENAI_CACHE_MAX_ENTRIES) return;

  const entries = Array.from(openAIDecisionCache.entries()).sort(
    (left, right) => left[1].cachedAt - right[1].cachedAt,
  );
  const toDelete = openAIDecisionCache.size - OPENAI_CACHE_MAX_ENTRIES;
  for (let i = 0; i < toDelete; i += 1) {
    const key = entries[i]?.[0];
    if (key) openAIDecisionCache.delete(key);
  }
}

function loadOpenAICache() {
  if (openAICacheLoaded) return;
  openAICacheLoaded = true;

  const storage = getBrowserStorage();
  if (!storage) return;

  try {
    const raw = storage.getItem(OPENAI_CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as [
      string,
      {
        categoryKey?: unknown;
        confidence?: unknown;
        reason?: unknown;
        model?: unknown;
        cachedAt?: unknown;
        hits?: unknown;
      },
    ][];

    for (const [key, value] of parsed) {
      if (!key || !value) continue;
      const categoryKey =
        typeof value.categoryKey === "string" ? value.categoryKey : "";
      if (!categoryKey) continue;

      openAIDecisionCache.set(key, {
        categoryKey,
        confidence: clampConfidence(Number(value.confidence ?? 0)),
        reason: typeof value.reason === "string" ? value.reason : undefined,
        model:
          typeof value.model === "string" && value.model
            ? value.model
            : DEFAULT_MODEL,
        cachedAt: Number(value.cachedAt ?? Date.now()),
        hits: Number(value.hits ?? 1),
      });
    }

    pruneOpenAICache();
    persistOpenAICache();
  } catch {
    // Ignore invalid persisted cache data.
  }
}

function getTransactionFingerprint(tx: TransactionCategorizationRecord) {
  const normalized = buildSearchText(tx);
  if (normalized) return normalized;

  const fallback = normalizePattern(
    `${tx.counterparty || ""} ${tx.details || ""}`,
  );
  return fallback || tx.id;
}

function getCachedOpenAIDecision(
  fingerprint: string,
): CachedOpenAIDecision | null {
  loadOpenAICache();
  const decision = openAIDecisionCache.get(fingerprint);
  if (!decision) return null;

  if (Date.now() - decision.cachedAt > OPENAI_CACHE_TTL_MS) {
    openAIDecisionCache.delete(fingerprint);
    persistOpenAICache();
    return null;
  }

  return decision;
}

function setCachedOpenAIDecision(
  fingerprint: string,
  decision: CachedOpenAIDecision,
) {
  loadOpenAICache();
  openAIDecisionCache.set(fingerprint, decision);
  pruneOpenAICache();
  persistOpenAICache();
}

function splitDetailSegments(details: string) {
  return details
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isTechnicalDetailSegment(segment: string) {
  const normalized = normalizePattern(segment);
  if (!normalized) return true;

  if (
    normalized.includes("google pay") ||
    normalized.includes("apple pay") ||
    normalized.includes("terminal") ||
    normalized.includes("appr cd") ||
    normalized.includes("pasnr") ||
    normalized.includes("contactloos") ||
    normalized.includes("contactless")
  ) {
    return true;
  }

  if (/\b\d{4}[a-z]{2}\b/.test(normalized) && normalized.includes("nld")) {
    return true;
  }

  return false;
}

function getRelevantDetailSegments(tx: TransactionCategorizationRecord) {
  return splitDetailSegments(tx.details).filter(
    (segment) => !isTechnicalDetailSegment(segment),
  );
}

function getPrimaryMerchantText(tx: TransactionCategorizationRecord) {
  const counterparty = normalizePattern(tx.counterparty || "");
  if (counterparty) return counterparty;

  const detailSegments = getRelevantDetailSegments(tx);
  const merchantSegment =
    detailSegments[detailSegments.length - 1] || tx.details;
  return normalizePattern(merchantSegment);
}

function getRelevantDetailsText(tx: TransactionCategorizationRecord) {
  const detailSegments = getRelevantDetailSegments(tx);
  if (!detailSegments.length) return tx.details || "";
  return detailSegments.join(" | ");
}

function getTransactionSubjectText(tx: TransactionCategorizationRecord) {
  const detailSegments = getRelevantDetailSegments(tx);
  if (!detailSegments.length) return tx.details || "";

  const merchant = getPrimaryMerchantText(tx);
  for (const segment of detailSegments) {
    const normalized = normalizePattern(segment);
    if (!normalized) continue;
    if (normalized !== merchant) return segment;
  }

  return detailSegments[0] || tx.details || "";
}

type RuleHaystackSource = "counterparty" | "merchant" | "details";

type RuleHaystackEntry = {
  text: string;
  priority: number;
  source: RuleHaystackSource;
};

function getRuleHaystacks(tx: TransactionCategorizationRecord) {
  const entries: RuleHaystackEntry[] = [];
  const seen = new Set<string>();

  const push = (
    value: string,
    priority: number,
    source: RuleHaystackSource,
  ) => {
    const normalized = normalizePattern(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ text: normalized, priority, source });
  };

  push(tx.counterparty || "", 3, "counterparty");
  push(getPrimaryMerchantText(tx), 2, "merchant");
  push(getRelevantDetailsText(tx), 1, "details");

  return entries;
}

function tryBelastingdienstHeuristicMatch(
  tx: TransactionCategorizationRecord,
  categoriesByKey: Map<string, CategoryRecord>,
): {
  categoryId: string;
  confidence: number;
  model: string;
  reason: string;
} | null {
  const counterparty = normalizePattern(tx.counterparty || "");
  if (!counterparty.includes("belastingdienst")) return null;

  const detailsRaw = String(tx.details || "");
  const detailsNormalized = normalizePattern(detailsRaw);

  const childBudgetCategory = categoriesByKey.get("income_child_budget");
  if (
    childBudgetCategory &&
    (detailsNormalized.includes("voorschot kit kgb") ||
      detailsNormalized.includes("kindgebonden budget"))
  ) {
    return {
      categoryId: childBudgetCategory.id,
      confidence: 0.99,
      model: "heuristic-belastingdienst-kgb-v1",
      reason: "Belastingdienst voorschot KIT/KGB reference",
    };
  }

  const hasZvwContribution = detailsNormalized.includes("bijdrage zvw");
  const healthInsuranceCategory = categoriesByKey.get("care_health_insurance");
  if (hasZvwContribution && healthInsuranceCategory) {
    return {
      categoryId: healthInsuranceCategory.id,
      confidence: 0.96,
      model: "heuristic-belastingdienst-zvw-v1",
      reason:
        tx.amount < 0
          ? "Belastingdienst ZVW contribution payment"
          : "Belastingdienst ZVW contribution settlement/refund",
    };
  }

  const roadTaxCategory = categoriesByKey.get("auto_transport_road_tax");
  if (!roadTaxCategory) return null;

  const firstSegment = detailsRaw.split("|")[0]?.trim().toLowerCase() || "";
  const hasDateRange = /\b\d{2}-\d{2}-\d{4}\s+t\/m\s+\d{2}-\d{2}-\d{4}\b/.test(
    firstSegment,
  );
  const hasReferencePrefix = /^[a-z0-9-]{4,16}\s+\d{2}-\d{2}-\d{4}\b/.test(
    firstSegment,
  );

  if (hasDateRange && hasReferencePrefix) {
    return {
      categoryId: roadTaxCategory.id,
      confidence: 0.97,
      model: "heuristic-belastingdienst-road-tax-v1",
      reason:
        tx.amount < 0
          ? "Belastingdienst road tax charge with period reference"
          : "Belastingdienst road tax correction with period reference",
    };
  }

  return null;
}

async function resolveDeterministicHeuristicMatch(
  tx: TransactionCategorizationRecord,
  categoriesByKey: Map<string, CategoryRecord>,
  ownAccountHashes: ReadonlySet<string> | null,
): Promise<{
  categoryId: string;
  confidence: number;
  model: string;
  reason: string;
} | null> {
  const belastingdienstMatch = tryBelastingdienstHeuristicMatch(
    tx,
    categoriesByKey,
  );
  if (belastingdienstMatch) return belastingdienstMatch;

  return resolveOwnAccountTransferHeuristicMatch({
    details: tx.details,
    counterparty: tx.counterparty,
    metadata: tx.metadata || null,
    categoriesByKey,
    ownAccountHashes,
  });
}

function doesRuleAllowHaystack(
  patternType: string,
  source: RuleHaystackSource,
) {
  if (patternType === "details_contains") {
    return source === "details";
  }

  return true;
}

function getRuleTypeScoreBonus(patternType: string) {
  if (patternType === "details_contains") return 5000;
  return 0;
}

function buildSearchText(tx: TransactionCategorizationRecord): string {
  return getRuleHaystacks(tx)
    .map((entry) => entry.text)
    .join(" ");
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

function getOpenAIMaxTokens(transactionCount: number) {
  return Math.min(3_000, Math.max(600, transactionCount * 220));
}

function estimateOpenAIRequestTokens(
  payloadText: string,
  transactionCount: number,
) {
  const promptTokens = Math.ceil(payloadText.length / 4);
  return promptTokens + getOpenAIMaxTokens(transactionCount);
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
    throwIfCategorizationStopped();
    const delayMs = getOpenAIRateLimitDelayMs(estimatedTokens);
    if (delayMs <= 0) return;

    await waitWithStatus(
      delayMs,
      (remainingMs) =>
        `Wacht ${Math.ceil(remainingMs / 1000)}s op OpenAI rate limit reset.`,
    );
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

function tryRuleMatch(
  tx: TransactionCategorizationRecord,
  rules: CategoryRuleRecord[],
): { categoryId: string; confidence: number; ruleId: string } | null {
  const haystacks = getRuleHaystacks(tx);
  if (!haystacks.length) return null;

  let best: {
    categoryId: string;
    confidence: number;
    ruleId: string;
    score: number;
  } | null = null;

  for (const rule of rules) {
    if (!rule.is_active) continue;
    const needle = rule.pattern_normalized;
    if (!needle) continue;
    const patternType = String(rule.pattern_type || "counterparty_contains");

    const conf = clampConfidence(Number(rule.confidence));

    for (const haystack of haystacks) {
      if (!doesRuleAllowHaystack(patternType, haystack.source)) continue;
      if (!haystack.text.includes(needle)) continue;

      const score =
        getRuleTypeScoreBonus(patternType) +
        haystack.priority * 1000 +
        needle.length * 10 +
        conf;
      if (!best || score > best.score) {
        best = {
          categoryId: rule.category_id,
          confidence: conf,
          ruleId: rule.id,
          score,
        };
      }
    }
  }

  if (!best) return null;
  return {
    categoryId: best.categoryId,
    confidence: best.confidence,
    ruleId: best.ruleId,
  };
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseOpenAIItems(content: string): OpenAIResult[] {
  const rawJson = extractJsonObject(content);
  if (!rawJson) {
    const err = new Error(
      "OpenAI returned no JSON object.",
    ) as OpenAIRequestError;
    err.code = "invalid_json";
    throw err;
  }

  try {
    const parsed = JSON.parse(rawJson) as { items?: OpenAIResult[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (error) {
    const err = new Error(
      `OpenAI returned invalid JSON: ${formatError(error)} | snippet=${truncateText(
        rawJson,
        240,
      )}`,
    ) as OpenAIRequestError;
    err.code = "invalid_json";
    throw err;
  }
}

function isOpenAIResponseMalformed(error: unknown) {
  const message = formatError(error).toLowerCase();
  const code = (error as OpenAIRequestError | undefined)?.code;
  return (
    code === "invalid_json" ||
    code === "response_truncated" ||
    message.includes("openai returned invalid json") ||
    message.includes("openai returned no json object")
  );
}

async function requestOpenAICategories(
  model: string,
  categories: CategoryRecord[],
  transactions: TransactionCategorizationRecord[],
): Promise<OpenAIResult[]> {
  throwIfCategorizationStopped();
  if (!transactions.length) return [];

  const maxTokens = getOpenAIMaxTokens(transactions.length);
  const payload = {
    model,
    temperature: 0,
    max_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "transaction_categories",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  category_key: { type: "string" },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["id", "category_key", "confidence", "reason"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You classify Dutch bank transactions. Always pick exactly one category_key from the provided list. Focus on the actual purchase subject in the transaction details, then the true merchant. Ignore technical payment-route text such as Google Pay, Apple Pay, terminal ids, approval codes, card/pass details, and location-only fragments unless they are the only clue. For deferred/aggregator payment providers (for example Klarna, PayPal, Riverty, AfterPay), do NOT classify by provider name alone: use subject/details per transaction, because each payment can belong to a different category. For own-account transfers (for example details containing 'eigen rekening', 'overboeking eigen rekening', 'naar eigen rekening', or 'tb = eigen rekening'), classify as a savings/internal-transfer category (prefer 'savings_investing_internal_transfer' or 'savings_transfer' when available), not as peer-to-peer payments. Use peer-to-peer categories only for transfers to other people. Return strict JSON only and always include a short reason string for every item. The reason must always be written in Dutch.",
      },
      {
        role: "user",
        content: JSON.stringify({
          categories: categories.map((c) => ({ key: c.key, name: c.name })),
          transactions: transactions.map((t) => ({
            id: t.id,
            date: t.date,
            amount: t.amount,
            counterparty: t.counterparty || "",
            merchant: getPrimaryMerchantText(t),
            subject: getTransactionSubjectText(t),
            details: getRelevantDetailsText(t),
          })),
        }),
      },
    ],
  };

  const payloadText = JSON.stringify(payload);
  const estimatedTokens = estimateOpenAIRequestTokens(
    payloadText,
    transactions.length,
  );

  await waitForOpenAIRateLimitWindow(estimatedTokens);

  const response = await postOpenAIChatCompletion(payload, {
    useCase: "transaction_categorization",
    agentMode: "classification",
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
      `OpenAI request failed (${response.status}): ${errText}`,
    ) as OpenAIRequestError;
    err.status = response.status;
    err.retryAfterMs = retryAfterMs ?? undefined;
    err.resetRequestsAt = openAIRateLimitState.resetRequestsAt;
    err.resetTokensAt = openAIRateLimitState.resetTokensAt;
    err.remainingRequests = openAIRateLimitState.remainingRequests;
    err.remainingTokens = openAIRateLimitState.remainingTokens;
    throw err;
  }

  const data = (await response.json()) as any;
  const finishReason = data?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    const err = new Error(
      "OpenAI response was truncated because the completion hit max_tokens.",
    ) as OpenAIRequestError;
    err.code = "response_truncated";
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return [];

  return parseOpenAIItems(content);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOpenAICategoriesWithRetry(
  model: string,
  categories: CategoryRecord[],
  transactions: TransactionCategorizationRecord[],
) {
  let attempt = 0;

  while (true) {
    throwIfCategorizationStopped();
    try {
      return await requestOpenAICategories(model, categories, transactions);
    } catch (error) {
      if (stopRequested) throw createCategorizationStoppedError();
      const typedErr = error as OpenAIRequestError;
      const isRateLimit = typedErr.status === 429;
      const isTransient = !typedErr.status || typedErr.status >= 500;
      const shouldRetry = isRateLimit || isTransient;
      if (!shouldRetry || attempt >= OPENAI_RETRY_ATTEMPTS) throw error;
      attempt += 1;
      const delay = getOpenAIRetryDelayMs(attempt, typedErr);
      const errorMessage = truncateText(formatError(error), 220);
      setOpenAINextAllowedAt(Date.now() + delay);
      console.warn(
        `OpenAI ${isRateLimit ? "rate-limited (429)" : "temporary failure"}: ${errorMessage}. Waiting ${Math.round(
          delay / 1000,
        )}s before retry ${attempt}/${OPENAI_RETRY_ATTEMPTS}.`,
      );
      throwIfCategorizationStopped();
      await waitWithStatus(
        delay,
        (remainingMs) =>
          `OpenAI retry ${attempt}/${OPENAI_RETRY_ATTEMPTS} over ${Math.ceil(
            remainingMs / 1000,
          )}s. ${errorMessage}`,
      );
    }
  }
}

async function requestOpenAICategoriesForBatch(
  model: string,
  categories: CategoryRecord[],
  transactions: TransactionCategorizationRecord[],
): Promise<OpenAIResult[]> {
  throwIfCategorizationStopped();
  if (!transactions.length) return [];

  try {
    return await requestOpenAICategoriesWithRetry(model, categories, transactions);
  } catch (error) {
    if (stopRequested || (error as OpenAIRequestError)?.code === "stopped") {
      throw createCategorizationStoppedError();
    }
    if (transactions.length <= 1 || !isOpenAIResponseMalformed(error)) {
      throw error;
    }

    const splitIndex = Math.ceil(transactions.length / 2);
    const leftBatch = transactions.slice(0, splitIndex);
    const rightBatch = transactions.slice(splitIndex);

    updateCategorizationStatus((current) =>
      current.phase === "running"
        ? {
            ...current,
            message: `OpenAI batch opgesplitst naar ${leftBatch.length} + ${rightBatch.length} door onvolledige JSON.`,
          }
        : current,
    );

    const leftResults = await requestOpenAICategoriesForBatch(
      model,
      categories,
      leftBatch,
    );
    const rightResults = await requestOpenAICategoriesForBatch(
      model,
      categories,
      rightBatch,
    );

    return [...leftResults, ...rightResults];
  }
}

export async function categorizeTransactions(
  transactionIds: string[],
  options: CategorizationRunOptions = {},
): Promise<CategorizationSummary> {
  const uniqueIds = Array.from(new Set(transactionIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return {
      considered: 0,
      updated: 0,
      rule: 0,
      openai: 0,
      skipped: 0,
      cleared: 0,
    };
  }

  const repo = createSupabaseCategorizationRepository();
  const [allCategories, allRules, transactions] = await Promise.all([
    repo.getCategories(),
    repo.getActiveRules(),
    repo.getTransactionsByIds(uniqueIds),
  ]);

  if (!allCategories.length || !transactions.length) {
    return {
      considered: 0,
      updated: 0,
      rule: 0,
      openai: 0,
      skipped: 0,
      cleared: 0,
    };
  }

  const leafCategories = getLeafCategories(allCategories, {
    curatedOnly: true,
  });
  const selectableCategories = leafCategories.length
    ? leafCategories
    : getLeafCategories(allCategories);
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const activeRules = allRules.filter((rule) =>
    categoriesById.has(rule.category_id),
  );
  const categoriesByKey = new Map(selectableCategories.map((c) => [c.key, c]));
  const ownAccountHashes = new Set(await listBankAccountHashes());

  const pendingTransactions = transactions.filter(
    (tx) => !tx.category_id_user && (options.force || !tx.category_id_auto),
  );

  if (!pendingTransactions.length) {
    return {
      considered: transactions.length,
      updated: 0,
      rule: 0,
      openai: 0,
      skipped: transactions.length,
      cleared: 0,
    };
  }

  const results: CategorizationResult[] = [];
  const unresolved: TransactionCategorizationRecord[] = [];

  for (const tx of pendingTransactions) {
    const heuristicMatch = await resolveDeterministicHeuristicMatch(
      tx,
      categoriesByKey,
      ownAccountHashes,
    );
    if (heuristicMatch) {
      results.push({
        transactionId: tx.id,
        categoryId: heuristicMatch.categoryId,
        confidence: heuristicMatch.confidence,
        source: "rule",
        model: heuristicMatch.model,
        reason: heuristicMatch.reason,
      });
      continue;
    }

    const matched = tryRuleMatch(tx, activeRules);
    if (matched && matched.confidence >= RULE_CONFIDENCE_THRESHOLD) {
      results.push({
        transactionId: tx.id,
        categoryId: matched.categoryId,
        confidence: matched.confidence,
        source: "rule",
        model: "rules-v1",
        reason: "Matched learned pattern",
        matchedRuleId: matched.ruleId,
      });
      continue;
    }
    unresolved.push(tx);
  }

  if (unresolved.length) {
    const byFingerprint = new Map<string, TransactionCategorizationRecord[]>();
    for (const tx of unresolved) {
      const fingerprint = getTransactionFingerprint(tx);
      const current = byFingerprint.get(fingerprint);
      if (current) {
        current.push(tx);
      } else {
        byFingerprint.set(fingerprint, [tx]);
      }
    }

    const representatives: TransactionCategorizationRecord[] = [];
    const repToFingerprint = new Map<string, string>();

    for (const [fingerprint, group] of byFingerprint.entries()) {
      const cached = getCachedOpenAIDecision(fingerprint);
      const cachedCategory = cached
        ? categoriesByKey.get(cached.categoryKey)
        : null;

      if (cached && cachedCategory) {
        for (const tx of group) {
          results.push({
            transactionId: tx.id,
            categoryId: cachedCategory.id,
            confidence: cached.confidence,
            source: "openai",
            model: `${cached.model}:cache`,
            reason: cached.reason || "Predicted by local cache",
          });
        }
        continue;
      }

      const representative = group[0];
      representatives.push(representative);
      repToFingerprint.set(representative.id, fingerprint);
    }

    if (representatives.length) {
      for (let i = 0; i < representatives.length; i += OPENAI_BATCH_SIZE) {
        throwIfCategorizationStopped();
        if (i > 0) {
          await waitWithStatus(
            OPENAI_INTER_BATCH_DELAY_MS,
            (remainingMs) =>
              `Volgende OpenAI batch over ${Math.ceil(remainingMs / 1000)}s.`,
          );
        }
        const batch = representatives.slice(i, i + OPENAI_BATCH_SIZE);
        let aiItems: OpenAIResult[] = [];

        try {
          aiItems = await requestOpenAICategoriesForBatch(
            DEFAULT_MODEL,
            selectableCategories,
            batch,
          );
        } catch (error) {
          if (stopRequested || (error as OpenAIRequestError)?.code === "stopped") {
            throw createCategorizationStoppedError();
          }
          console.warn("categorization openai error", formatError(error));
          continue;
        }

        for (const item of aiItems) {
          const fingerprint = repToFingerprint.get(item.id);
          if (!fingerprint) continue;

          const targetCategory = categoriesByKey.get(item.category_key);
          if (!targetCategory) continue;

          const group = byFingerprint.get(fingerprint) || [];
          const confidence = clampConfidence(Number(item.confidence ?? 0));
          const reason = item.reason || "Predicted by model";

          setCachedOpenAIDecision(fingerprint, {
            categoryKey: targetCategory.key,
            confidence,
            reason,
            model: DEFAULT_MODEL,
            cachedAt: Date.now(),
            hits: group.length,
          });

          for (const tx of group) {
            results.push({
              transactionId: tx.id,
              categoryId: targetCategory.id,
              confidence,
              source: "openai",
              model: DEFAULT_MODEL,
              reason,
            });
          }
        }
      }
    }
  }

  const txMap = new Map(transactions.map((tx) => [tx.id, tx]));
  const resolvedTransactionIds = new Set(
    results.map((result) => result.transactionId),
  );
  const staleOtherAutoIds: string[] = [];

  if (options.force) {
    for (const tx of pendingTransactions) {
      if (resolvedTransactionIds.has(tx.id)) continue;
      if (!tx.category_id_auto) continue;

      const autoCategory = categoriesById.get(tx.category_id_auto);
      const autoKey = autoCategory?.key || "";
      if (autoKey === "other" || autoKey.startsWith("other_")) {
        staleOtherAutoIds.push(tx.id);
      }
    }
  }

  if (staleOtherAutoIds.length) {
    const chunkSize = 200;
    for (let i = 0; i < staleOtherAutoIds.length; i += chunkSize) {
      await repo.clearAutoCategories(staleOtherAutoIds.slice(i, i + chunkSize));
    }
  }

  for (const result of results) {
    const tx = txMap.get(result.transactionId);
    if (!tx) continue;

    const previousCategoryId =
      tx.category_id_user || tx.category_id_auto || null;
    if (!categoriesById.has(result.categoryId)) continue;

    await repo.updateAutoCategory({
      transactionId: result.transactionId,
      categoryId: result.categoryId,
      confidence: result.confidence,
      source: result.source,
      model: result.model,
    });

    await repo.insertAudit({
      transactionId: result.transactionId,
      previousCategoryId,
      newCategoryId: result.categoryId,
      source: result.source,
      model: result.model,
      confidence: result.confidence,
      reason: result.reason,
    });

    if (result.source === "rule" && result.matchedRuleId) {
      await repo.incrementRuleHit(result.matchedRuleId);
    }
  }

  try {
    await enrichTransactionAnalysis(uniqueIds);
  } catch (error) {
    console.warn("analysis enrichment failed", formatError(error));
  }

  throwIfCategorizationStopped();

  if (options.scheduleForecastRefresh !== false) {
    try {
      await requestForecastRefresh({
        reason: "categorization_batch",
        eager: true,
      });
    } catch (error) {
      console.warn("cashflow forecast refresh scheduling failed", formatError(error));
    }
  }

  const cleared = staleOtherAutoIds.length;
  const updated = results.length + cleared;
  const rule = results.filter((result) => result.source === "rule").length;
  const openai = results.filter((result) => result.source === "openai").length;

  return {
    considered: pendingTransactions.length,
    updated,
    rule,
    openai,
    skipped: Math.max(pendingTransactions.length - updated, 0),
    cleared,
  };
}

async function flushQueuedCategorization() {
  if (isBackgroundFlushRunning) return;
  isBackgroundFlushRunning = true;

  let processedCount = 0;
  let updatedCount = 0;
  let ruleCount = 0;
  let openAiCount = 0;
  let skippedCount = 0;
  let totalCount = queuedTransactionIds.size;

  try {
    updateCategorizationStatus((current) => ({
      ...current,
      phase: "running",
      totalCount: Math.max(current.totalCount, totalCount),
      batchOwnerUserId: queuedBatchOwnerUserId,
      queuedCount: queuedTransactionIds.size,
      processedCount,
      updatedCount,
      ruleCount,
      openAiCount,
      skippedCount,
      message: "Categorisatie draait op de achtergrond.",
      lastError: null,
      lastRunMode: current.mode,
      isPauseRequested: false,
      isStopRequested: false,
    }));

  while (queuedTransactionIds.size > 0) {
      if (stopRequested) {
        queuedTransactionIds.clear();
        updateCategorizationStatus((current) => ({
          ...current,
          phase: "completed",
          batchOwnerUserId: queuedBatchOwnerUserId,
          queuedCount: 0,
          processedCount,
          updatedCount,
          ruleCount,
          openAiCount,
          skippedCount,
          message: "Achtergrondcategorisatie gestopt.",
          lastCompletedAt: new Date().toISOString(),
          isPauseRequested: false,
          isStopRequested: false,
        }));
        stopRequested = false;
        pauseRequested = false;
        break;
      }

      if (pauseRequested) {
        updateCategorizationStatus((current) => ({
          ...current,
          phase: "paused",
          batchOwnerUserId: queuedBatchOwnerUserId,
          queuedCount: queuedTransactionIds.size,
          processedCount,
          updatedCount,
          ruleCount,
          openAiCount,
          skippedCount,
          message: "Achtergrondcategorisatie is gepauzeerd.",
          isPauseRequested: true,
          isStopRequested: false,
        }));
        break;
      }

      const batchIds = Array.from(queuedTransactionIds).slice(
        0,
        BACKGROUND_PROCESS_BATCH_SIZE,
      );
      for (const id of batchIds) queuedTransactionIds.delete(id);

      totalCount = Math.max(
        totalCount,
        processedCount + batchIds.length + queuedTransactionIds.size,
      );
      const summary = await categorizeTransactions(batchIds, {
        force: forceQueuedRecategorization,
        scheduleForecastRefresh: false,
      });
      processedCount += summary.considered;
      updatedCount += summary.updated;
      ruleCount += summary.rule;
      openAiCount += summary.openai;
      skippedCount += summary.skipped;
      const pausedAfterBatch = pauseRequested && !stopRequested;
      const stoppedWithClearedQueue =
        stopRequested && queuedTransactionIds.size === 0;

      if (pausedAfterBatch) {
        updateCategorizationStatus((current) => ({
          ...current,
          phase: "paused",
          queuedCount: queuedTransactionIds.size,
          totalCount: Math.max(
            processedCount + queuedTransactionIds.size,
            totalCount,
          ),
          processedCount,
          updatedCount,
          ruleCount,
          openAiCount,
          skippedCount,
          message: "Achtergrondcategorisatie is gepauzeerd.",
          lastCompletedAt: current.lastCompletedAt,
          lastError: null,
          lastRunMode: current.mode,
          isPauseRequested: true,
          isStopRequested: false,
        }));
        break;
      }

      updateCategorizationStatus((current) => ({
        ...current,
        phase:
          queuedTransactionIds.size > 0 && !stoppedWithClearedQueue
            ? "running"
            : "completed",
        batchOwnerUserId: queuedBatchOwnerUserId,
        queuedCount: queuedTransactionIds.size,
        totalCount: Math.max(
          processedCount + queuedTransactionIds.size,
          totalCount,
        ),
        processedCount,
        updatedCount,
        ruleCount,
        openAiCount,
        skippedCount,
        message: stoppedWithClearedQueue
          ? "Achtergrondcategorisatie gestopt. Wachtrij is leeggemaakt."
          : queuedTransactionIds.size > 0
            ? "Categorisatie draait op de achtergrond."
            : "Achtergrondcategorisatie afgerond.",
        lastCompletedAt:
          queuedTransactionIds.size > 0 && !stoppedWithClearedQueue
            ? current.lastCompletedAt
            : new Date().toISOString(),
        lastError: null,
        lastRunMode: current.mode,
        isPauseRequested: false,
        isStopRequested:
          !stoppedWithClearedQueue && queuedTransactionIds.size > 0,
      }));

      if (queuedTransactionIds.size === 0 && !stoppedWithClearedQueue) {
        try {
          await requestForecastRefresh({
            reason: "categorization_batch",
            eager: true,
          });
        } catch (error) {
          console.warn(
            "background cashflow forecast refresh scheduling failed",
            formatError(error),
          );
        }
      }
    }
  } catch (error) {
    if (stopRequested || (error as OpenAIRequestError)?.code === "stopped") {
      const removedFromQueue = queuedTransactionIds.size;
      queuedTransactionIds.clear();
      updateCategorizationStatus((current) => ({
        ...current,
        phase: "completed",
        batchOwnerUserId: queuedBatchOwnerUserId,
        queuedCount: 0,
        processedCount,
        updatedCount,
        ruleCount,
        openAiCount,
        skippedCount,
        message:
          removedFromQueue > 0
            ? `Achtergrondcategorisatie gestopt. Wachtrij is leeggemaakt (${removedFromQueue}).`
            : "Achtergrondcategorisatie gestopt.",
        lastCompletedAt: new Date().toISOString(),
        lastError: null,
        lastRunMode: current.mode,
        isPauseRequested: false,
        isStopRequested: false,
      }));
      return;
    }
    updateCategorizationStatus((current) => ({
      ...current,
      phase: "error",
      batchOwnerUserId: queuedBatchOwnerUserId,
      queuedCount: queuedTransactionIds.size,
      processedCount,
      updatedCount,
      ruleCount,
      openAiCount,
      skippedCount,
      message: "Achtergrondcategorisatie is mislukt.",
      lastError: formatError(error),
      lastRunMode: current.mode,
      isPauseRequested: false,
      isStopRequested: false,
    }));
    throw error;
  } finally {
    isBackgroundFlushRunning = false;
    forceQueuedRecategorization = false;
    if (!pauseRequested) {
      stopRequested = false;
    }
  }
}

function queueTransactionsForCategorization(
  transactionIds: string[],
  mode: CategorizationRunMode,
  batchOwnerUserId: string | null = null,
) {
  if (mode === "recategorize-all") {
    forceQueuedRecategorization = true;
  }

  if (mode === "import") {
    queuedBatchOwnerUserId = batchOwnerUserId;
  } else if (!queuedTransactionIds.size) {
    queuedBatchOwnerUserId = null;
  }

  for (const id of transactionIds) {
    if (id) queuedTransactionIds.add(id);
  }

  if (!queuedTransactionIds.size) {
    updateCategorizationStatus((current) => ({
      ...current,
      phase: "completed",
      mode,
      batchOwnerUserId: queuedBatchOwnerUserId,
      queuedCount: 0,
      message:
        mode === "recategorize-all"
          ? "Geen transacties gevonden om opnieuw te categoriseren."
          : "Geen transacties gevonden voor achtergrondcategorisatie.",
      lastCompletedAt: new Date().toISOString(),
      lastError: null,
    }));
    return;
  }

  updateCategorizationStatus((current) => ({
    ...current,
    phase: isBackgroundFlushRunning ? current.phase : "queued",
    mode,
    lastRunMode: mode,
    batchOwnerUserId: queuedBatchOwnerUserId,
    queuedCount: queuedTransactionIds.size,
    totalCount: isBackgroundFlushRunning
      ? Math.max(current.totalCount, queuedTransactionIds.size)
      : queuedTransactionIds.size,
    message:
      mode === "recategorize-all"
        ? "Alles staat klaar om opnieuw gecategoriseerd te worden."
        : mode === "pending"
          ? "Bestaande ongecategoriseerde transacties worden ingepland."
          : "Nieuwe import staat klaar voor categorisatie.",
    lastError: null,
    isPauseRequested: false,
    isStopRequested: false,
  }));

  setTimeout(() => {
    void flushQueuedCategorization().catch((err) => {
      console.warn("background categorization failed", formatError(err));
    });
  }, 0);
}

export function runCategorizationInBackground(
  transactionIds: string[],
  batchOwnerUserId: string | null = null,
) {
  queueTransactionsForCategorization(transactionIds, "import", batchOwnerUserId);
}

export function runPendingCategorizationInBackground(
  limit = BACKGROUND_SWEEP_LIMIT,
) {
  if (isPendingSweepRunning) return;

  isPendingSweepRunning = true;
  setTimeout(() => {
    void (async () => {
      try {
        const repo = createSupabaseCategorizationRepository();
        const pendingIds = await repo.getPendingTransactionIds(limit);
        queueTransactionsForCategorization(pendingIds, "pending");
      } catch (error) {
        updateCategorizationStatus((current) => ({
          ...current,
          phase: "error",
          mode: "pending",
          message: "Sweep van ongecategoriseerde transacties mislukt.",
          lastError: formatError(error),
        }));
        console.warn("pending categorization sweep failed", formatError(error));
      } finally {
        isPendingSweepRunning = false;
      }
    })();
  }, 0);
}

export function runRecategorizationForAllInBackground(
  pageSize = RECAT_ALL_PAGE_SIZE,
) {
  setTimeout(() => {
    void (async () => {
      try {
        const repo = createSupabaseCategorizationRepository();
        const ids: string[] = [];
        let offset = 0;

        while (true) {
          const pageIds = await repo.getAllTransactionIds(pageSize, offset);
          if (!pageIds.length) break;

          ids.push(...pageIds);
          if (pageIds.length < pageSize) break;
          offset += pageSize;
        }

        queueTransactionsForCategorization(ids, "recategorize-all");
      } catch (error) {
        updateCategorizationStatus((current) => ({
          ...current,
          phase: "error",
          mode: "recategorize-all",
          message: "Alles hercategoriseren is mislukt.",
          lastError: formatError(error),
        }));
        console.warn("recategorize all failed", formatError(error));
      }
    })();
  }, 0);
}

export function pauseBackgroundCategorization() {
  if (!isBackgroundFlushRunning) return;
  pauseRequested = true;
  updateCategorizationStatus((current) => ({
    ...current,
    phase: "paused",
    queuedCount: queuedTransactionIds.size,
    isPauseRequested: true,
    isStopRequested: false,
    message:
      "Pauzeren aangevraagd. Huidige batch wordt afgerond en daarna stopt de wachtrij.",
  }));
}

export function resumeBackgroundCategorization() {
  if (!pauseRequested && !queuedTransactionIds.size) return;
  pauseRequested = false;
  stopRequested = false;
  updateCategorizationStatus((current) => ({
    ...current,
    phase: queuedTransactionIds.size ? "queued" : "idle",
    isPauseRequested: false,
    isStopRequested: false,
    message: queuedTransactionIds.size
      ? "Categorisatie hervat."
      : "Geen gepauzeerde transacties meer in wachtrij.",
  }));
  if (queuedTransactionIds.size) {
    setTimeout(() => {
      void flushQueuedCategorization().catch((err) => {
        console.warn("background categorization failed", formatError(err));
      });
    }, 0);
  }
}

export function stopBackgroundCategorization() {
  if (!isBackgroundFlushRunning && !queuedTransactionIds.size) return;
  const removedFromQueue = queuedTransactionIds.size;
  queuedTransactionIds.clear();
  stopRequested = true;
  pauseRequested = false;

  if (!isBackgroundFlushRunning) {
    stopRequested = false;
    forceQueuedRecategorization = false;
    updateCategorizationStatus((current) => ({
      ...current,
      phase: "completed",
      queuedCount: 0,
      totalCount: current.processedCount,
      isStopRequested: false,
      isPauseRequested: false,
      message:
        removedFromQueue > 0
          ? `Categorisatie gestopt. Wachtrij geleegd (${removedFromQueue}).`
          : "Categorisatie gestopt.",
      lastCompletedAt: new Date().toISOString(),
    }));
    return;
  }

  updateCategorizationStatus((current) => ({
    ...current,
    phase: "completed",
    queuedCount: 0,
    isStopRequested: true,
    isPauseRequested: false,
    message:
      removedFromQueue > 0
        ? `Stoppen aangevraagd. Wachtrij geleegd (${removedFromQueue}). Huidige batch wordt afgerond.`
        : "Stoppen aangevraagd. Huidige batch wordt afgerond.",
  }));
}

export function clearQueuedCategorizationQueue() {
  if (!queuedTransactionIds.size) return;

  const removedFromQueue = queuedTransactionIds.size;
  queuedTransactionIds.clear();
  forceQueuedRecategorization = false;
  stopRequested = false;
  pauseRequested = false;

  updateCategorizationStatus((current) => ({
    ...current,
    phase: isBackgroundFlushRunning ? current.phase : "idle",
    queuedCount: 0,
    isStopRequested: false,
    isPauseRequested: false,
    message: isBackgroundFlushRunning
      ? `Wachtrij leeggemaakt (${removedFromQueue}). Huidige batch loopt door.`
      : `Wachtrij leeggemaakt (${removedFromQueue}).`,
    lastError: null,
  }));
}

export function clearCategorizationClientState() {
  queuedTransactionIds.clear();
  queuedBatchOwnerUserId = null;
  isBackgroundFlushRunning = false;
  isPendingSweepRunning = false;
  forceQueuedRecategorization = false;
  pauseRequested = false;
  stopRequested = false;
  openAIDecisionCache.clear();
  openAICacheLoaded = false;
  openAIRateLimitState.remainingRequests = null;
  openAIRateLimitState.remainingTokens = null;
  openAIRateLimitState.resetRequestsAt = null;
  openAIRateLimitState.resetTokensAt = null;
  openAIRateLimitState.nextAllowedAt = 0;
  clearPersistedOpenAICache();
  resetCategorizationStatus();
}

export async function clearTransactionData(
  scope: TransactionCleanupScope = "all",
): Promise<string> {
  try {
    console.log("[clearTransactionData] Starting...");
    stopBackgroundCategorization();
    console.log("[clearTransactionData] Background categorization stopped");

    const repo = createSupabaseCategorizationRepository();
    console.log("[clearTransactionData] Repository created");

    const scopeInfo = resolveTransactionCleanupScopeInfo(scope);
    if (
      scope === "current_month" &&
      (!scopeInfo.startIso || !scopeInfo.endIso)
    ) {
      throw new Error("Kon de huidige maand niet bepalen voor opschonen.");
    }
    const deletedCount =
      scope === "current_month"
        ? await repo.clearTransactionDataInDateRange(
            scopeInfo.startIso,
            scopeInfo.endIso,
          )
        : await repo.clearAllTransactionData();
    const message = getTransactionCleanupSuccessMessage(
      scope,
      deletedCount,
    );
    console.log(
      `[clearTransactionData] Transaction data cleared from DB (${deletedCount})`,
    );

    resetCategorizationStatus({
      lastCompletedAt: new Date().toISOString(),
      message,
    });
    console.log("[clearTransactionData] Status updated");
    return message;
  } catch (error) {
    console.error("[clearTransactionData] Error:", error);
    const msg = formatError(error);
    updateCategorizationStatus((current) => ({
      ...current,
      lastError: msg,
      message: `Fout bij wissen: ${msg}`,
    }));
    throw error;
  }
}

export async function clearAllTransactionData() {
  return clearTransactionData("all");
}

export async function clearCurrentMonthTransactionData() {
  return clearTransactionData("current_month");
}

export async function recategorizeSingleTransaction(
  transactionId: string,
): Promise<{
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  confidence: number;
  reason: string;
  model: string;
} | null> {
  const repo = createSupabaseCategorizationRepository();
  const [allCategories, txs, ownAccountHashValues] = await Promise.all([
    repo.getCategories(),
    repo.getTransactionsByIds([transactionId]),
    listBankAccountHashes(),
  ]);

  const tx = txs[0];
  if (!tx || !allCategories.length) return null;

  const leafCategories = getLeafCategories(allCategories, {
    curatedOnly: true,
  });
  const selectableCategories = leafCategories.length
    ? leafCategories
    : getLeafCategories(allCategories);
  const categoriesByKey = new Map(selectableCategories.map((c) => [c.key, c]));
  const ownAccountHashes = new Set(ownAccountHashValues);

  const ownAccountTransferMatch = await resolveDeterministicHeuristicMatch(
    tx,
    categoriesByKey,
    ownAccountHashes,
  );
  if (ownAccountTransferMatch) {
    const category = selectableCategories.find(
      (item) => item.id === ownAccountTransferMatch.categoryId,
    );
    if (!category) return null;

    return {
      categoryId: category.id,
      categoryKey: category.key,
      categoryName: category.name,
      confidence: ownAccountTransferMatch.confidence,
      reason: ownAccountTransferMatch.reason,
      model: ownAccountTransferMatch.model,
    };
  }

  const items = await requestOpenAICategoriesWithRetry(
    DEFAULT_MODEL,
    selectableCategories,
    [tx],
  );

  const item = items[0];
  if (!item) return null;

  const category = categoriesByKey.get(item.category_key);
  if (!category) return null;

  return {
    categoryId: category.id,
    categoryKey: category.key,
    categoryName: category.name,
    confidence: clampConfidence(Number(item.confidence ?? 0)),
    reason: item.reason || "Predicted by model",
    model: DEFAULT_MODEL,
  };
}

export type TransactionRuleMatch = {
  ruleId: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  pattern: string;
  patternType: string;
  confidence: number;
  scope: string;
  userId: string | null;
};

export async function getTransactionRuleMatch(
  transactionId: string,
): Promise<TransactionRuleMatch | null> {
  const repo = createSupabaseCategorizationRepository();
  const [categories, rules, txs] = await Promise.all([
    repo.getCategories(),
    repo.getActiveRules(),
    repo.getTransactionsByIds([transactionId]),
  ]);

  const tx = txs[0];
  if (!tx || !categories.length || !rules.length) return null;

  const matched = tryRuleMatch(tx, rules);
  if (!matched) return null;

  const category = categories.find((item) => item.id === matched.categoryId);
  const rule = rules.find((item) => item.id === matched.ruleId);
  if (!category || !rule) return null;

  return {
    ruleId: matched.ruleId,
    categoryId: category.id,
    categoryKey: category.key,
    categoryName: category.name,
    pattern: rule.pattern,
    patternType: rule.pattern_type,
    confidence: matched.confidence,
    scope: rule.scope || "system",
    userId: rule.user_id || null,
  };
}

export async function resetTransactionRuleMatch(transactionId: string) {
  const repo = createSupabaseCategorizationRepository();
  const [detail, match] = await Promise.all([
    repo.getTransactionsByIds([transactionId]),
    getTransactionRuleMatch(transactionId),
  ]);

  if (!match) return false;
  if (match.scope !== "user") return false;

  const tx = detail[0] || null;
  await repo.setCategoryRuleActive(match.ruleId, false);

  if (tx?.category_source === "rule" && !tx.category_id_user) {
    await repo.clearAutoCategories([transactionId]);
  }

  await requestForecastRefresh({
    reason: "manual_category",
    eager: true,
  }).catch((error) => {
    console.warn(
      "[categorization] forecast refresh scheduling after rule reset failed",
      error,
    );
  });

  return true;
}
