import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  queryLog,
  responseQueue,
  recomputeMock,
  requireCurrentUserIdMock,
} = vi.hoisted(() => {
  const responseQueue: { data: unknown; error: unknown }[] = [];
  const queryLog: {
    table: string;
    filters: { method: string; args: unknown[] }[];
    upserts: { payload: Record<string, unknown>; options: unknown }[];
  }[] = [];

  function nextResponse() {
    return responseQueue.shift() || { data: null, error: null };
  }

  function buildQuery(table: string) {
    const entry = {
      table,
      filters: [] as { method: string; args: unknown[] }[],
      upserts: [] as { payload: Record<string, unknown>; options: unknown }[],
    };
    queryLog.push(entry);

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((...args: unknown[]) => {
        entry.filters.push({ method: "eq", args });
        return query;
      }),
      maybeSingle: vi.fn(async () => nextResponse()),
      upsert: vi.fn(async (payload: Record<string, unknown>, options: unknown) => {
        entry.upserts.push({ payload, options });
        return nextResponse();
      }),
    };

    return query;
  }

  return {
    fromMock: vi.fn((table: string) => buildQuery(table)),
    queryLog,
    responseQueue,
    recomputeMock: vi.fn(),
    requireCurrentUserIdMock: vi.fn(),
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/forecasting", () => ({
  recomputeCurrentMonthCashflowForecast: recomputeMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

let ensureForecastFresh: typeof import("./forecast-refresh").ensureForecastFresh;
let markForecastDirty: typeof import("./forecast-refresh").markForecastDirty;
let shouldRefreshForecast: typeof import("./forecast-refresh").shouldRefreshForecast;

describe("forecast-refresh", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({
      ensureForecastFresh,
      markForecastDirty,
      shouldRefreshForecast,
    } = await import("./forecast-refresh"));
    fromMock.mockClear();
    recomputeMock.mockReset();
    requireCurrentUserIdMock.mockReset();
    requireCurrentUserIdMock.mockResolvedValue("user-123");
    queryLog.length = 0;
    responseQueue.length = 0;
  });

  it("marks forecast state dirty without recomputing", async () => {
    responseQueue.push({ data: null, error: null });
    responseQueue.push({ data: null, error: null });

    const result = await markForecastDirty("budget_save");

    expect(result.isDirty).toBe(true);
    expect(result.lastReason).toBe("budget_save");
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(queryLog[0]?.table).toBe("forecast_refresh_state");
    expect(queryLog[0]?.upserts[0]?.payload).toMatchObject({
      user_id: "user-123",
      is_dirty: true,
      last_reason: "budget_save",
    });
  });

  it("skips recompute when the forecast is still fresh", async () => {
    responseQueue.push({
      data: {
        is_dirty: false,
        dirty_at: null,
        last_computed_at: "2026-03-17T10:00:00.000Z",
        last_reason: "insights_open",
        last_error: null,
        updated_at: "2026-03-17T10:00:00.000Z",
      },
      error: null,
    });

    const status = await ensureForecastFresh({
      reason: "insights_open",
      referenceDate: new Date("2026-03-17T12:00:00.000Z"),
    });

    expect(status.isDirty).toBe(false);
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it("recomputes when the forecast is dirty and clears the dirty state", async () => {
    responseQueue.push(
      {
        data: {
          is_dirty: true,
          dirty_at: "2026-03-17T08:00:00.000Z",
          last_computed_at: "2026-03-16T09:00:00.000Z",
          last_reason: "budget_save",
          last_error: null,
          updated_at: "2026-03-17T08:00:00.000Z",
        },
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    );
    recomputeMock.mockResolvedValue({
      monthStart: "2026-03-01",
    });

    const status = await ensureForecastFresh({
      reason: "insights_open",
      referenceDate: new Date("2026-03-17T12:00:00.000Z"),
    });

    expect(recomputeMock).toHaveBeenCalledTimes(1);
    expect(status.isDirty).toBe(false);
    expect(status.lastReason).toBe("insights_open");
    expect(queryLog[1]?.upserts[0]?.payload).toMatchObject({
      user_id: "user-123",
      is_dirty: false,
      last_reason: "insights_open",
    });
  });

  it("treats missing or old refresh timestamps as stale", () => {
    expect(shouldRefreshForecast(null)).toBe(true);
    expect(
      shouldRefreshForecast(
        {
          isDirty: false,
          dirtyAt: null,
          lastComputedAt: null,
          lastReason: null,
          lastError: null,
          updatedAt: null,
        },
        new Date("2026-03-17T12:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      shouldRefreshForecast(
        {
          isDirty: false,
          dirtyAt: null,
          lastComputedAt: "2026-03-17T10:00:00.000Z",
          lastReason: "manual_refresh",
          lastError: null,
          updatedAt: "2026-03-17T10:00:00.000Z",
        },
        new Date("2026-03-17T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
