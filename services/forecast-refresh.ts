import { requireCurrentUserId } from "@/services/current-user";
import { recomputeCurrentMonthCashflowForecast } from "@/services/forecasting";
import { supabase } from "@/services/supabase";
import type {
  ForecastRefreshReason,
  ForecastRefreshStatus,
} from "@/types/categorization";

type RowRecord = Record<string, unknown>;

export type EnsureForecastFreshOptions = {
  referenceDate?: Date;
  reason: ForecastRefreshReason;
  maxAgeMs?: number;
  force?: boolean;
};

type MarkForecastDirtyOptions = {
  userId?: string;
};

export type RequestForecastRefreshOptions = {
  referenceDate?: Date;
  reason: ForecastRefreshReason;
  delayMs?: number;
};

type ScheduledRefresh = {
  timer: ReturnType<typeof setTimeout>;
  reason: ForecastRefreshReason;
  referenceDate: Date;
};

const DEFAULT_FORECAST_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_FORECAST_RECOMPUTE_DELAY_MS = 30 * 1000;

const inFlightRefreshes = new Map<string, Promise<ForecastRefreshStatus>>();
const scheduledRefreshes = new Map<string, ScheduledRefresh>();

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  return code === "42P01" || code === "PGRST205";
}

function emptyForecastRefreshStatus(): ForecastRefreshStatus {
  return {
    isDirty: true,
    dirtyAt: null,
    lastComputedAt: null,
    lastReason: null,
    lastError: null,
    updatedAt: null,
  };
}

function asReason(value: unknown): ForecastRefreshReason | null {
  switch (value) {
    case "insights_open":
    case "historical_month_open":
    case "future_month_open":
    case "manual_refresh":
    case "budget_save":
    case "budget_toggle":
    case "manual_category":
    case "categorization_batch":
    case "subscription_profile":
    case "forecast_backfill":
      return value;
    default:
      return null;
  }
}

function mapStatusRow(row: RowRecord | null): ForecastRefreshStatus {
  if (!row) return emptyForecastRefreshStatus();
  return {
    isDirty: Boolean(row.is_dirty),
    dirtyAt: row.dirty_at ? String(row.dirty_at) : null,
    lastComputedAt: row.last_computed_at ? String(row.last_computed_at) : null,
    lastReason: asReason(row.last_reason),
    lastError: row.last_error ? String(row.last_error) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export function shouldRefreshForecast(
  status: ForecastRefreshStatus | null,
  now = new Date(),
  maxAgeMs = DEFAULT_FORECAST_MAX_AGE_MS,
) {
  if (!status) return true;
  if (status.isDirty) return true;
  if (!status.lastComputedAt) return true;

  const lastComputedAt = new Date(status.lastComputedAt);
  if (Number.isNaN(lastComputedAt.getTime())) return true;

  return now.getTime() - lastComputedAt.getTime() > maxAgeMs;
}

async function loadForecastRefreshStatusForUser(userId: string) {
  const { data, error } = await supabase
    .from("forecast_refresh_state")
    .select(
      "is_dirty,dirty_at,last_computed_at,last_reason,last_error,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }

  return mapStatusRow((data || null) as RowRecord | null);
}

async function persistForecastRefreshStatus(
  userId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("forecast_refresh_state")
    .upsert(
      {
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...payload,
      },
      { onConflict: "user_id" },
    );

  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

function buildSyntheticStatus(
  current: ForecastRefreshStatus | null,
  patch: Partial<ForecastRefreshStatus>,
): ForecastRefreshStatus {
  return {
    ...(current || emptyForecastRefreshStatus()),
    ...patch,
  };
}

export async function getForecastRefreshStatus(
  userId?: string,
): Promise<ForecastRefreshStatus | null> {
  const resolvedUserId = userId || (await requireCurrentUserId());
  return loadForecastRefreshStatusForUser(resolvedUserId);
}

export async function markForecastDirty(
  reason: ForecastRefreshReason,
  options: MarkForecastDirtyOptions = {},
) {
  const userId = options.userId || (await requireCurrentUserId());
  const dirtyAt = new Date().toISOString();

  await persistForecastRefreshStatus(userId, {
    is_dirty: true,
    dirty_at: dirtyAt,
    last_reason: reason,
    last_error: null,
  });

  return buildSyntheticStatus(null, {
    isDirty: true,
    dirtyAt,
    lastReason: reason,
    lastError: null,
    updatedAt: dirtyAt,
  });
}

async function markForecastRefreshSuccess(
  userId: string,
  reason: ForecastRefreshReason,
) {
  const lastComputedAt = new Date().toISOString();

  await persistForecastRefreshStatus(userId, {
    is_dirty: false,
    dirty_at: null,
    last_computed_at: lastComputedAt,
    last_reason: reason,
    last_error: null,
  });

  return buildSyntheticStatus(null, {
    isDirty: false,
    dirtyAt: null,
    lastComputedAt,
    lastReason: reason,
    lastError: null,
    updatedAt: lastComputedAt,
  });
}

async function markForecastRefreshFailure(
  userId: string,
  reason: ForecastRefreshReason,
  error: unknown,
) {
  const updatedAt = new Date().toISOString();
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string } | null)?.message || error || "");

  await persistForecastRefreshStatus(userId, {
    is_dirty: true,
    dirty_at: updatedAt,
    last_reason: reason,
    last_error: message || "Forecast refresh mislukt.",
  });

  return buildSyntheticStatus(null, {
    isDirty: true,
    dirtyAt: updatedAt,
    lastReason: reason,
    lastError: message || "Forecast refresh mislukt.",
    updatedAt,
  });
}

export async function ensureForecastFresh(
  options: EnsureForecastFreshOptions,
): Promise<ForecastRefreshStatus> {
  const userId = await requireCurrentUserId();
  const referenceDate = options.referenceDate || new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_FORECAST_MAX_AGE_MS;

  if (!options.force) {
    const currentStatus = await loadForecastRefreshStatusForUser(userId);
    if (!shouldRefreshForecast(currentStatus, new Date(), maxAgeMs)) {
      return currentStatus || emptyForecastRefreshStatus();
    }
  }

  const existingRefresh = inFlightRefreshes.get(userId);
  if (existingRefresh) {
    return existingRefresh;
  }

  const refreshPromise = (async () => {
    try {
      await recomputeCurrentMonthCashflowForecast(referenceDate);
      return await markForecastRefreshSuccess(userId, options.reason);
    } catch (error) {
      await markForecastRefreshFailure(userId, options.reason, error);
      throw error;
    }
  })();

  inFlightRefreshes.set(userId, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    if (inFlightRefreshes.get(userId) === refreshPromise) {
      inFlightRefreshes.delete(userId);
    }
  }
}

export async function requestForecastRefresh(
  options: RequestForecastRefreshOptions,
) {
  const userId = await requireCurrentUserId();
  const referenceDate = options.referenceDate || new Date();
  const delayMs = Math.max(options.delayMs ?? DEFAULT_FORECAST_RECOMPUTE_DELAY_MS, 0);

  await markForecastDirty(options.reason, { userId });

  const existing = scheduledRefreshes.get(userId);
  if (existing) {
    clearTimeout(existing.timer);
  }

  const timer = setTimeout(() => {
    scheduledRefreshes.delete(userId);
    void ensureForecastFresh({
      referenceDate,
      reason: options.reason,
    }).catch((error) => {
      console.warn("[forecast-refresh] scheduled recompute failed", error);
    });
  }, delayMs);

  scheduledRefreshes.set(userId, {
    timer,
    reason: options.reason,
    referenceDate,
  });
}
