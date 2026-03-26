import { debugLog, isRuntimeDebugEnabled } from "./runtime-debug.ts";

type OpenAiUsageBucket<T> = {
  object?: "bucket" | string;
  start_time: number;
  end_time: number;
  results?: T[];
};

type OpenAiUsageCompletionsResult = {
  object?: string;
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
};

type OpenAiCostResult = {
  object?: string;
  amount?: {
    value?: number;
    currency?: string;
  } | null;
};

export type OpenAiOrgUsageSnapshot = {
  totalTokensToday: number;
  totalTokensMonth: number;
  aiCallsToday: number;
  aiCallsMonth: number;
  openAiCostToday: number;
  openAiCostMonth: number;
  currency: string;
  fetchedAt: string;
  source: "openai";
};

type CachedSnapshot = {
  key: string;
  expiresAt: number;
  snapshot: OpenAiOrgUsageSnapshot;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: CachedSnapshot | null = null;

export function clearOpenAiOrgUsageSnapshotCache() {
  cache = null;
}

function getOpenAiAdminCredentials() {
  const adminKey = process.env.OPENAI_ADMIN_KEY?.trim() || null;
  const organizationId =
    process.env.OPENAI_ORG_ID?.trim() ||
    process.env.OPENAI_ORGANIZATION_ID?.trim() ||
    null;

  return {
    adminKey,
    organizationId,
  };
}

function getWindowStartUnix(now: Date, start: "day" | "month") {
  const date =
    start === "day"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1);
  return Math.floor(date.getTime() / 1000);
}

function getNowUnix(now = new Date()) {
  return Math.floor(now.getTime() / 1000);
}

async function fetchOpenAiOrgUsage<T>(
  path: string,
  startTimeUnix: number,
  endTimeUnix: number,
  adminKey: string,
  organizationId: string | null,
) {
  const url = new URL(`https://api.openai.com/v1/organization/${path}`);
  url.searchParams.set("start_time", String(startTimeUnix));
  url.searchParams.set("end_time", String(endTimeUnix));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminKey}`,
      ...(organizationId
        ? { "OpenAI-Organization": organizationId }
        : {}),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI usage API faalde (${response.status}): ${errorText.slice(0, 240)}`,
    );
  }

  return (await response.json()) as {
    data?: OpenAiUsageBucket<T>[];
    has_more?: boolean;
    next_page?: string | null;
  };
}

function sumUsageBuckets(
  buckets: OpenAiUsageBucket<OpenAiUsageCompletionsResult>[],
  startTimeUnix: number,
) {
  return buckets.reduce(
    (totals, bucket) => {
      if (bucket.start_time < startTimeUnix) {
        return totals;
      }

      for (const result of bucket.results || []) {
        totals.totalTokens += Math.max(
          0,
          Number(result.input_tokens || 0) + Number(result.output_tokens || 0),
        );
        totals.aiCalls += Math.max(0, Number(result.num_model_requests || 0));
      }

      return totals;
    },
    {
      totalTokens: 0,
      aiCalls: 0,
    },
  );
}

function sumCostBuckets(
  buckets: OpenAiUsageBucket<OpenAiCostResult>[],
  startTimeUnix: number,
) {
  return buckets.reduce(
    (totals, bucket) => {
      if (bucket.start_time < startTimeUnix) {
        return totals;
      }

      for (const result of bucket.results || []) {
        const amount = result.amount?.value;
        if (!Number.isFinite(Number(amount))) continue;
        totals.cost += Math.max(0, Number(amount || 0));
        totals.currency = result.amount?.currency || totals.currency;
      }

      return totals;
    },
    {
      cost: 0,
      currency: "usd",
    },
  );
}

export async function loadOpenAiOrgUsageSnapshot(options?: {
  forceRefresh?: boolean;
}): Promise<OpenAiOrgUsageSnapshot | null> {
  const { adminKey, organizationId } = getOpenAiAdminCredentials();
  if (!adminKey) {
    if (isRuntimeDebugEnabled()) {
      debugLog("openai org usage skipped", {
        reason: "missing_admin_key",
      });
    }
    return null;
  }

  const now = new Date();
  const monthStartUnix = getWindowStartUnix(now, "month");
  const dayStartUnix = getWindowStartUnix(now, "day");
  const nowUnix = getNowUnix(now);
  const cacheKey = String(monthStartUnix);

  if (
    !options?.forceRefresh &&
    cache &&
    cache.key === cacheKey &&
    cache.expiresAt > Date.now()
  ) {
    if (isRuntimeDebugEnabled()) {
      debugLog("openai org usage cache hit", {
        cacheKey,
      });
    }
    return cache.snapshot;
  }

  try {
    if (isRuntimeDebugEnabled()) {
      debugLog("openai org usage fetch start", {
        cacheKey,
        forceRefresh: Boolean(options?.forceRefresh),
        credentialSource: "OPENAI_ADMIN_KEY",
        hasOrganizationId: Boolean(organizationId),
      });
    }
    const [usagePage, costPage] = await Promise.all([
      fetchOpenAiOrgUsage<OpenAiUsageCompletionsResult>(
        "usage/completions",
        monthStartUnix,
        nowUnix,
        adminKey,
        organizationId,
      ),
      fetchOpenAiOrgUsage<OpenAiCostResult>(
        "costs",
        monthStartUnix,
        nowUnix,
        adminKey,
        organizationId,
      ),
    ]);

    const usageBuckets = usagePage.data || [];
    const costBuckets = costPage.data || [];

    const monthUsage = sumUsageBuckets(usageBuckets, monthStartUnix);
    const dayUsage = sumUsageBuckets(usageBuckets, dayStartUnix);
    const monthCosts = sumCostBuckets(costBuckets, monthStartUnix);
    const dayCosts = sumCostBuckets(costBuckets, dayStartUnix);

    const snapshot: OpenAiOrgUsageSnapshot = {
      totalTokensToday: dayUsage.totalTokens,
      totalTokensMonth: monthUsage.totalTokens,
      aiCallsToday: dayUsage.aiCalls,
      aiCallsMonth: monthUsage.aiCalls,
      openAiCostToday: dayCosts.cost,
      openAiCostMonth: monthCosts.cost,
      currency: monthCosts.currency || dayCosts.currency || "usd",
      fetchedAt: now.toISOString(),
      source: "openai",
    };

    cache = {
      key: cacheKey,
      expiresAt: Date.now() + CACHE_TTL_MS,
      snapshot,
    };

    if (isRuntimeDebugEnabled()) {
      debugLog("openai org usage fetch success", {
        totalTokensMonth: snapshot.totalTokensMonth,
        aiCallsMonth: snapshot.aiCallsMonth,
        openAiCostMonth: snapshot.openAiCostMonth,
        currency: snapshot.currency,
      });
    }

    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (message.includes("Missing scopes: api.usage.read")) {
      if (isRuntimeDebugEnabled()) {
        debugLog("openai org usage unavailable", {
          reason: "missing_usage_scope",
        });
      }
      return null;
    }

    console.warn("[openai-org-usage] live usage fetch failed", error);
    return cache?.snapshot || null;
  }
}
