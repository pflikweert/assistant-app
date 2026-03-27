import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  responseQueue,
  ensureForecastFreshMock,
  loadLatestKnownBalanceSnapshotMock,
  requireCurrentUserIdMock,
} = vi.hoisted(() => {
  const responseQueue: { data: unknown; error: unknown }[] = [];

  function nextResponse() {
    return responseQueue.shift() || { data: null, error: null };
  }

  function buildQuery(table: string) {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => nextResponse()),
    };

    return query;
  }

  return {
    fromMock: vi.fn((table: string) => buildQuery(table)),
    responseQueue,
    ensureForecastFreshMock: vi.fn(),
    loadLatestKnownBalanceSnapshotMock: vi.fn(),
    requireCurrentUserIdMock: vi.fn(),
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/forecast-refresh", () => ({
  ensureForecastFresh: ensureForecastFreshMock,
}));

vi.mock("@/services/latest-known-balance", () => ({
  loadLatestKnownBalanceSnapshot: loadLatestKnownBalanceSnapshotMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

let loadMonthForecastSummary: typeof import("./month-forecast-summary").loadMonthForecastSummary;

function buildMonthlyRow(input: {
  currentBalanceAnchor: number;
  lowestExpectedBalance: number;
  lowestExpectedBalanceDate: string;
  expectedEndOfMonthBalance: number;
}) {
  return {
    month_start: "2026-03-01",
    forecast_reference_date: "2026-03-27",
    current_balance_anchor: input.currentBalanceAnchor,
    current_balance_anchor_date: "2026-03-27",
    cash_risk_flag: "none",
    risk_flag: "none",
    expected_end_of_month_balance: input.expectedEndOfMonthBalance,
    lowest_expected_balance: input.lowestExpectedBalance,
    lowest_expected_balance_date: input.lowestExpectedBalanceDate,
    next_expected_event_date: "2026-03-30",
    next_expected_event_label: "Salaris",
    expected_income_total: 3200,
    remaining_expected_income_total: 0.33,
    remaining_expected_expense_total: 945.38,
    remaining_expected_savings_outflow_total: 0,
    upcoming_committed_income_total: 1400,
    upcoming_committed_expense_total: 780,
    expected_fixed_costs: 731.38,
    expected_subscriptions: 0,
    expected_variable_costs: 214,
  };
}

describe("month-forecast-summary", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ loadMonthForecastSummary } = await import("./month-forecast-summary"));
    fromMock.mockClear();
    responseQueue.length = 0;
    ensureForecastFreshMock.mockReset();
    loadLatestKnownBalanceSnapshotMock.mockReset();
    requireCurrentUserIdMock.mockReset();
    requireCurrentUserIdMock.mockResolvedValue("user-123");
    ensureForecastFreshMock.mockResolvedValue({ isDirty: false });
    loadLatestKnownBalanceSnapshotMock.mockResolvedValue({
      balance: 2748.36,
      date: "2026-03-27",
    });
  });

  it("ververst de huidige maand opnieuw wanneer de operationele anchor is verschoven", async () => {
    responseQueue.push(
      {
        data: buildMonthlyRow({
          currentBalanceAnchor: 359.85,
          lowestExpectedBalance: 359.52,
          lowestExpectedBalanceDate: "2026-03-28",
          expectedEndOfMonthBalance: 359.85,
        }),
        error: null,
      },
      {
        data: buildMonthlyRow({
          currentBalanceAnchor: 2748.36,
          lowestExpectedBalance: 392.82,
          lowestExpectedBalanceDate: "2026-03-28",
          expectedEndOfMonthBalance: 1803.31,
        }),
        error: null,
      },
    );

    const summary = await loadMonthForecastSummary({
      monthStartIso: "2026-03-01",
      referenceDate: new Date("2026-03-27T12:00:00.000Z"),
      userId: "user-123",
      reason: "insights_open",
      moneyViewScope: "shared",
    });

    expect(ensureForecastFreshMock).toHaveBeenCalledTimes(2);
    expect(ensureForecastFreshMock.mock.calls[1][0]).toMatchObject({
      force: true,
      reason: "insights_open",
      moneyViewScope: "shared",
    });
    expect(loadLatestKnownBalanceSnapshotMock).toHaveBeenCalledWith(
      "user-123",
      "shared",
    );
    expect(summary?.expectedEndOperationalBalance).toBe(1803.31);
    expect(summary?.lowestOperationalPointInMonth).toBe(392.82);
    expect(summary?.lowestExpectedBalanceDate).toBe("2026-03-28");
  });
});
