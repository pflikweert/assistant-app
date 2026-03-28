import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  computeBudgetPlanMock,
  applyBudgetWeekRebalanceGuardrailsMock,
  loadMoneyViewScopePreferenceMock,
  loadLatestKnownBalanceSnapshotMock,
  loadMonthForecastSummaryMock,
  buildFinancialBalanceSnapshotMock,
  loadReserveSurfaceBreakdownMock,
} = vi.hoisted(() => ({
  computeBudgetPlanMock: vi.fn(),
  applyBudgetWeekRebalanceGuardrailsMock: vi.fn((value) => value),
  loadMoneyViewScopePreferenceMock: vi.fn(),
  loadLatestKnownBalanceSnapshotMock: vi.fn(),
  loadMonthForecastSummaryMock: vi.fn(),
  buildFinancialBalanceSnapshotMock: vi.fn(),
  loadReserveSurfaceBreakdownMock: vi.fn(),
}));

vi.mock("@/services/budget-plan", () => ({
  computeBudgetPlan: computeBudgetPlanMock,
}));

vi.mock("@/services/budget-week-guardrails", () => ({
  applyBudgetWeekRebalanceGuardrails: applyBudgetWeekRebalanceGuardrailsMock,
}));

vi.mock("@/services/finance-scope-preference", () => ({
  loadMoneyViewScopePreference: loadMoneyViewScopePreferenceMock,
}));

vi.mock("@/services/latest-known-balance", () => ({
  loadLatestKnownBalanceSnapshot: loadLatestKnownBalanceSnapshotMock,
}));

vi.mock("@/services/month-forecast-summary", () => ({
  loadMonthForecastSummary: loadMonthForecastSummaryMock,
}));

vi.mock("@/services/financial-semantics", () => ({
  buildFinancialBalanceSnapshot: buildFinancialBalanceSnapshotMock,
}));

vi.mock("@/services/reserve-surface", () => ({
  loadReserveSurfaceBreakdown: loadReserveSurfaceBreakdownMock,
}));

let loadBudgetPlanForSurface: typeof import("./budget-plan-surface").loadBudgetPlanForSurface;

describe("budget-plan-surface", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ loadBudgetPlanForSurface } = await import("./budget-plan-surface"));
    computeBudgetPlanMock.mockReset();
    applyBudgetWeekRebalanceGuardrailsMock.mockReset();
    loadMoneyViewScopePreferenceMock.mockReset();
    loadLatestKnownBalanceSnapshotMock.mockReset();
    loadMonthForecastSummaryMock.mockReset();
    buildFinancialBalanceSnapshotMock.mockReset();
    loadReserveSurfaceBreakdownMock.mockReset();

    loadMoneyViewScopePreferenceMock.mockResolvedValue({
      scopeView: "shared",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    loadLatestKnownBalanceSnapshotMock.mockResolvedValue({
      balance: 2748.36,
      date: "2026-03-27",
    });
    computeBudgetPlanMock.mockResolvedValue({
      referenceDate: "2026-03-27",
      flowSummary: { variableBudget: 0 },
      monthToDateExpenses: { variableCosts: 0 },
    });
    loadMonthForecastSummaryMock.mockResolvedValue({
      monthStart: "2026-03-01",
      forecastReferenceDate: "2026-03-27",
      currentBalanceAnchor: 2748.36,
      currentBalanceAnchorDate: "2026-03-27",
      cashRiskFlag: "none",
      riskFlag: "none",
      expectedEndBalance: 1803.31,
      lowestExpectedBalance: 392.82,
      lowestExpectedBalanceDate: "2026-03-28",
      nextExpectedEventDate: null,
      nextExpectedEventLabel: null,
      expectedIncomeTotal: null,
      remainingExpectedIncomeTotal: 0.33,
      remainingExpectedExpenseTotal: 945.38,
      remainingExpectedSavingsOutflowTotal: 0,
      upcomingCommittedIncomeTotal: null,
      upcomingCommittedExpenseTotal: null,
      expectedFixedCosts: 731.38,
      expectedSubscriptions: 0,
      expectedVariableCosts: 214,
    });
    buildFinancialBalanceSnapshotMock.mockReturnValue({
      currentOperationalBalance: { amount: 2748.36, source: "forecast_anchor" },
      currentReservedBalance: { amount: null, source: "not_configured" },
      currentNetWorth: { amount: 2748.36, source: "forecast_anchor" },
      freeToSpendNow: { amount: null, source: "unavailable" },
      expectedEndOperationalBalance: {
        amount: 1803.31,
        source: "forecast_anchor",
      },
      expectedEndNetWorth: { amount: 1803.31, source: "forecast_anchor" },
      carryoverIntoNextMonth: { amount: 1803.31, source: "forecast_anchor" },
      lowestOperationalPointInMonth: { amount: 392.82, source: "forecast_anchor" },
    });
    loadReserveSurfaceBreakdownMock.mockResolvedValue({
      reservedInAccountsNow: 200,
      reservedProtectedInOperationalNow: 120,
      plannedReserveAllocationThisMonth: 120,
      annualObligationMonthlyTotal: 60,
      savingsTargetMonthly: 60,
      source: "modeled",
    });
  });

  it("gebruikt één app-level scope preference voor budget, forecast en current balance", async () => {
    const surface = await loadBudgetPlanForSurface({
      referenceDate: new Date("2026-03-27T12:00:00.000Z"),
      planKey: "default",
      timelineReference: new Date("2026-03-27T12:00:00.000Z"),
    });

    expect(loadMoneyViewScopePreferenceMock).toHaveBeenCalledTimes(1);
    expect(loadLatestKnownBalanceSnapshotMock).toHaveBeenCalledWith(
      undefined,
      "shared",
    );
    expect(computeBudgetPlanMock).toHaveBeenCalledWith(
      expect.any(Date),
      "default",
      expect.any(Date),
      "shared",
    );
    expect(loadMonthForecastSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        monthStartIso: "2026-03-01",
        moneyViewScope: "shared",
      }),
    );
    expect(loadReserveSurfaceBreakdownMock).toHaveBeenCalledWith(
      expect.objectContaining({
        moneyViewScope: "shared",
      }),
    );
    expect(surface.scopeView).toBe("shared");
    expect(surface.balances.expectedEndOperationalBalance.amount).toBe(1803.31);
    expect(surface.reserveBreakdown?.annualObligationMonthlyTotal).toBe(60);
  });
});
