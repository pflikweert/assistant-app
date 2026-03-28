import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  computeBudgetPlanMock,
  applyBudgetWeekRebalanceGuardrailsMock,
  loadMoneyViewScopePreferenceMock,
  loadLatestKnownBalanceSnapshotMock,
  loadLatestKnownNetWorthSnapshotMock,
  loadMonthForecastSummaryMock,
  buildFinancialBalanceSnapshotMock,
  loadReserveSurfaceBreakdownMock,
  buildForecastSurfaceConfidenceMock,
  buildForecastSurfaceExplainabilityMock,
  buildSafetySpendWindowSummaryMock,
} = vi.hoisted(() => ({
  computeBudgetPlanMock: vi.fn(),
  applyBudgetWeekRebalanceGuardrailsMock: vi.fn((value) => value),
  loadMoneyViewScopePreferenceMock: vi.fn(),
  loadLatestKnownBalanceSnapshotMock: vi.fn(),
  loadLatestKnownNetWorthSnapshotMock: vi.fn(),
  loadMonthForecastSummaryMock: vi.fn(),
  buildFinancialBalanceSnapshotMock: vi.fn(),
  loadReserveSurfaceBreakdownMock: vi.fn(),
  buildForecastSurfaceConfidenceMock: vi.fn(),
  buildForecastSurfaceExplainabilityMock: vi.fn(),
  buildSafetySpendWindowSummaryMock: vi.fn(),
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
  loadLatestKnownNetWorthSnapshot: loadLatestKnownNetWorthSnapshotMock,
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

vi.mock("@/services/confidence-model", () => ({
  buildForecastSurfaceConfidence: buildForecastSurfaceConfidenceMock,
}));

vi.mock("@/services/explainability", () => ({
  buildForecastSurfaceExplainability: buildForecastSurfaceExplainabilityMock,
}));

vi.mock("@/services/safety-spend-window", () => ({
  buildSafetySpendWindowSummary: buildSafetySpendWindowSummaryMock,
}));

import { loadBudgetPlanForSurface } from "./budget-plan-surface";

describe("budget-plan-surface", () => {
  beforeEach(() => {
    computeBudgetPlanMock.mockReset();
    applyBudgetWeekRebalanceGuardrailsMock.mockReset();
    loadMoneyViewScopePreferenceMock.mockReset();
    loadLatestKnownBalanceSnapshotMock.mockReset();
    loadLatestKnownNetWorthSnapshotMock.mockReset();
    loadMonthForecastSummaryMock.mockReset();
    buildFinancialBalanceSnapshotMock.mockReset();
    loadReserveSurfaceBreakdownMock.mockReset();
    buildForecastSurfaceConfidenceMock.mockReset();
    buildForecastSurfaceExplainabilityMock.mockReset();
    buildSafetySpendWindowSummaryMock.mockReset();
    applyBudgetWeekRebalanceGuardrailsMock.mockImplementation(
      ({ plan }) => plan,
    );

    loadMoneyViewScopePreferenceMock.mockResolvedValue({
      scopeView: "shared",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    loadLatestKnownBalanceSnapshotMock.mockResolvedValue({
      balance: 2748.36,
      date: "2026-03-27",
    });
    loadLatestKnownNetWorthSnapshotMock.mockResolvedValue({
      balance: 2755.52,
      date: "2026-03-27",
    });
    computeBudgetPlanMock.mockResolvedValue({
      referenceDate: "2026-03-27",
      flowSummary: {
        variableBudget: 857,
        expectedIncomeMonthly: 3200,
        fixedCostsBudget: 731.38,
        subscriptionsBudget: 0,
      },
      monthToDateExpenses: { variableCosts: 1169.53 },
      settings: {
        includeIncome: {
          salary: true,
          childBudget: true,
          structuralOther: false,
          variable: false,
        },
      },
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
      activeAnnualRuleCount: 1,
      activeManualAnnualRuleCount: 0,
      activeInferredAnnualRuleCount: 1,
      source: "modeled",
    });
    buildForecastSurfaceConfidenceMock.mockReturnValue({
      expectedEndOperationalBalance: {
        level: "high",
        label: "Hoog vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      lowestOperationalPointInMonth: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      currentReservedBalance: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      freeToSpendNow: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      safeToSpendUntilNextIncome: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      annualObligationReserveRules: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      inferredRecurringIncome: {
        level: "high",
        label: "Hoog vertrouwen",
        provenance: "hard",
        reasons: [],
      },
      inferredVariableSpending: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
    });
    buildForecastSurfaceExplainabilityMock.mockReturnValue({
      budgetHint: "Reservering actief.",
      insightsBullets: ["a", "b"],
      items: [],
    });
    buildSafetySpendWindowSummaryMock.mockResolvedValue({
      safeToSpendUntilNextIncome: 1690.95,
      projectedNetUntilNextIncome: -957.41,
      nextIncomeDateAnchor: "2026-04-24",
      nextIncomeLabelAnchor: "Salaris",
      anchorType: "configured",
      isEstimatedAnchorDate: false,
      bridgeCrossMonthCostsUntilIncome: 120.5,
      safeToSpendExplanation:
        "We rekenen tot je salaris op 24 april, rekening houdend met € 950,25 aan verwachte lasten.",
      safeToSpendExplanationParts: {
        incomeLabel: "Salaris",
        incomeDate: "2026-04-24",
        projectedCosts: 950.25,
        projectedIncome: 0,
        windowStart: "2026-03-25",
        windowEnd: "2026-04-24",
        confidence: "medium",
      },
      confidenceScore: "MEDIUM",
      deltaReasonLabel: "Huur",
      deltaReasonAmount: 736.58,
    });
  });

  it("gebruikt één app-level scope preference voor budget, forecast en current balance", async () => {
    const surface = await loadBudgetPlanForSurface({
      referenceDate: new Date("2026-03-27T12:00:00.000Z"),
      planKey: "default",
      timelineReference: new Date("2026-03-27T12:00:00.000Z"),
      userId: "user-1",
    });

    expect(loadMoneyViewScopePreferenceMock).toHaveBeenCalledTimes(1);
    expect(loadLatestKnownBalanceSnapshotMock).toHaveBeenCalledWith(
      "user-1",
      "shared",
    );
    expect(loadLatestKnownNetWorthSnapshotMock).toHaveBeenCalledWith(
      "user-1",
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
        userId: "user-1",
        moneyViewScope: "shared",
      }),
    );
    expect(buildSafetySpendWindowSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        moneyViewScope: "shared",
      }),
    );
    expect(surface.scopeView).toBe("shared");
    expect(surface.balances.expectedEndOperationalBalance.amount).toBe(1803.31);
    expect(surface.reserveBreakdown?.annualObligationMonthlyTotal).toBe(60);
    expect(surface.confidence.expectedEndOperationalBalance.label).toBe(
      "Hoog vertrouwen",
    );
    expect(surface.explainability.budgetHint).toContain("Reservering");
    expect(surface.safeToSpendUntilNextIncome).toBe(1690.95);
    expect(surface.nextIncomeDateAnchor).toBe("2026-04-24");
    expect(surface.safeToSpendAnchorType).toBe("configured");
    expect(surface.safeToSpendIsEstimatedAnchorDate).toBe(false);
    expect(surface.confidenceLayer.safeToSpendUntilNextIncome.score).toBe("MEDIUM");
  });
});
