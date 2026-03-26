import { fetchAdminBootstrap, fetchAdminJson } from "@/services/admin-api";
import type { AiUsageRow } from "@/services/ai-use-cases";
import { formatEstimatedAiCostEur } from "@/services/ai-pricing";

export type AiUsageUseCaseRow = {
  use_case: string;
  model: string;
  calls: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  errors: number;
  fallback_count: number;
  estimated_cost_eur: number;
};

export type AiUsageOverview = {
  totalTokensToday: number;
  totalTokensMonth: number;
  aiCallsToday: number;
  aiCallsMonth: number;
  errorsMonth: number;
  fallbackMonth: number;
  estimatedCostMonth: number;
  openAiCostToday: number | null;
  openAiCostMonth: number | null;
  openAiCostCurrency: string | null;
  usageFetchedAt: string | null;
  useCaseRows: AiUsageUseCaseRow[];
};

type BootstrapUsagePayload = {
  usageOverview: AiUsageOverview;
};

export function formatAiUsageCount(value: number) {
  return new Intl.NumberFormat("nl-NL").format(Math.max(0, Math.round(value)));
}

export function formatAiUsageCost(value: number) {
  return formatEstimatedAiCostEur(value);
}

export function formatOpenAiCost(value: number | null, currency: string | null) {
  if (value == null) return "—";
  const normalizedCurrency = (currency || "usd").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

export async function loadAiUsageOverview() {
  try {
    const bootstrap = await fetchAdminBootstrap<BootstrapUsagePayload>();
    return bootstrap.usageOverview;
  } catch (error) {
    console.warn("[ai-usage] bootstrap load failed", error);
    return {
      totalTokensToday: 0,
      totalTokensMonth: 0,
      aiCallsToday: 0,
      aiCallsMonth: 0,
      errorsMonth: 0,
      fallbackMonth: 0,
      estimatedCostMonth: 0,
      openAiCostToday: null,
      openAiCostMonth: null,
      openAiCostCurrency: null,
      usageFetchedAt: null,
      useCaseRows: [],
    } satisfies AiUsageOverview;
  }
}

export async function refreshAiUsageOverview() {
  return fetchAdminJson<{ usageOverview: AiUsageOverview }>("/api/admin", {
    method: "PATCH",
    body: JSON.stringify({
      resource: "usage-refresh",
    }),
  });
}

export type { AiUsageRow };
