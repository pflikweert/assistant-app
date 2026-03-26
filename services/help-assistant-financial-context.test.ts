/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentUserIdMock,
  loadMonthForecastSummaryMock,
  loadBudgetPlanForSurfaceMock,
  getCurrentMonthKeyMock,
  getMonthOptionByKeyMock,
} = vi.hoisted(() => ({
  requireCurrentUserIdMock: vi.fn(),
  loadMonthForecastSummaryMock: vi.fn(),
  loadBudgetPlanForSurfaceMock: vi.fn(),
  getCurrentMonthKeyMock: vi.fn(),
  getMonthOptionByKeyMock: vi.fn(),
}));

vi.mock("./current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("./month-forecast-summary", () => ({
  loadMonthForecastSummary: loadMonthForecastSummaryMock,
}));

vi.mock("./budget-plan-surface", () => ({
  loadBudgetPlanForSurface: loadBudgetPlanForSurfaceMock,
}));

vi.mock("./transaction-month-options", () => ({
  getCurrentMonthKey: getCurrentMonthKeyMock,
  getMonthOptionByKey: getMonthOptionByKeyMock,
}));

import {
  clearUnifiedFinancialAdviceContextCache,
  resolveUnifiedFinancialAdviceContext,
} from "./help-assistant-financial-context";
import { buildHelpAssistantContext } from "./help-assistant-context";

const sampleForecastCurrent = {
  monthStart: "2026-03-01",
  forecastReferenceDate: "2026-03-20",
  currentBalanceAnchor: 1400,
  currentBalanceAnchorDate: "2026-03-20",
  cashRiskFlag: "none" as const,
  riskFlag: "none" as const,
  expectedEndBalance: 1800,
  lowestExpectedBalance: 450,
  lowestExpectedBalanceDate: "2026-03-28",
  nextExpectedEventDate: null,
  nextExpectedEventLabel: null,
  expectedIncomeTotal: 3200,
  remainingExpectedIncomeTotal: 1000,
  remainingExpectedExpenseTotal: 600,
  remainingExpectedSavingsOutflowTotal: 100,
  upcomingCommittedIncomeTotal: 0,
  upcomingCommittedExpenseTotal: 420,
  expectedFixedCosts: 900,
  expectedSubscriptions: 120,
  expectedVariableCosts: 500,
};

const sampleForecastNext = {
  ...sampleForecastCurrent,
  monthStart: "2026-04-01",
  expectedEndBalance: 1650,
  riskFlag: "deficit_warning" as const,
};

const samplePlan = {
  weeklyVariablePlan: [
    {
      isCurrentWeek: true,
      remaining: 80,
      label: "Week 12",
      tone: "good",
      tempoDelta: -10,
      utilization: 0.6,
      actual: 120,
      budget: 200,
      weekNumber: 12,
      startDate: "2026-03-18",
      endDateExclusive: "2026-03-25",
      daysInCurrentMonth: 7,
      daysInPreviousMonth: 0,
      daysInNextMonth: 0,
      crossesMonthBoundary: false,
      baseBudget: 200,
      guardrailBudgetFloor: null,
      isPastWeek: false,
      wasRebalanced: false,
      rebalanceMode: "none",
      overrunAmount: 0,
    },
  ],
  recommendations: [],
  warnings: [],
  planKey: "default",
  referenceDate: "2026-03-20",
  monthStart: "2026-03-01",
  monthProgress: 0.6,
  completedMonthBaselineThrough: null,
  settings: {} as never,
  trend: {} as never,
  monthToDateIncome: {} as never,
  monthToDateExpenses: { variableCosts: 220 } as never,
  savingsPotential: 0,
  recommendedSavings: 0,
  automaticSavingsTargetPreview: { activeSavings: 0, balanced: 0 },
  savingsTargetSource: "manual",
  usedOpenAISavingsTarget: false,
  monthlyBudgetTotal: 0,
  weeklyBudgetTotal: 0,
  projectedMonthNet: 0,
  flowSummary: {
    expectedIncomeMonthly: 0,
    actualIncomeMonthToDate: 0,
    fixedCostsBudget: 900,
    subscriptionsBudget: 120,
    subtotalAfterFixed: 0,
    subtotalAfterSubscriptions: 0,
    variableBudget: 900,
    variableSubcategoriesBudgetTotal: 900,
    appliedSavingsTarget: 0,
    automaticSavingsTargetPreview: { activeSavings: 0, balanced: 0 },
    savingsTargetSource: "manual",
    usedOpenAISavingsTarget: false,
  },
  weeklyBudgetBreakdown: [],
  weeklySpendBreakdown: [],
  outsideBudgetExpenses: {} as never,
  expenseDetails: { fixedCosts: [], subscriptions: [] },
  savingsProgress: {} as never,
  coachReport: {} as never,
};

describe("resolveUnifiedFinancialAdviceContext", () => {
  beforeEach(() => {
    clearUnifiedFinancialAdviceContextCache();
    requireCurrentUserIdMock.mockReset();
    loadMonthForecastSummaryMock.mockReset();
    loadBudgetPlanForSurfaceMock.mockReset();
    getCurrentMonthKeyMock.mockReset();
    getMonthOptionByKeyMock.mockReset();

    requireCurrentUserIdMock.mockResolvedValue("user-1");
    getCurrentMonthKeyMock.mockReturnValue("2026-03");
    getMonthOptionByKeyMock.mockImplementation((key: string) => {
      if (key === "2026-03") {
        return {
          key: "2026-03",
          label: "maart 2026",
          monthLabel: "maart",
          startIso: "2026-03-01",
          endIso: "2026-04-01",
          year: 2026,
          month: 3,
          isCurrentMonth: true,
        };
      }
      if (key === "2026-04") {
        return {
          key: "2026-04",
          label: "april 2026",
          monthLabel: "april",
          startIso: "2026-04-01",
          endIso: "2026-05-01",
          year: 2026,
          month: 4,
          isCurrentMonth: false,
        };
      }
      return null;
    });
    loadMonthForecastSummaryMock.mockResolvedValueOnce(sampleForecastCurrent);
    loadMonthForecastSummaryMock.mockResolvedValueOnce(sampleForecastNext);
    loadBudgetPlanForSurfaceMock.mockResolvedValue({
      plan: samplePlan,
      forecast: sampleForecastCurrent,
    });
  });

  it("builds unified context with next-month signals", async () => {
    const context = buildHelpAssistantContext({
      screenId: "insights",
      selectedPeriod: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
      },
      screenContext: {
        kind: "insights",
        monthLabel: "maart 2026",
        hasForecastData: true,
      },
    });

    const result = await resolveUnifiedFinancialAdviceContext({ context });

    expect(result.period.key).toBe("2026-03");
    expect(result.forecastCurrentMonth.hasData).toBe(true);
    expect(result.forecastNextMonth.hasData).toBe(true);
    expect(result.forecastNextMonth.monthKey).toBe("2026-04");
    expect(result.quality.hasBudgetSignals).toBe(true);
    expect(result.quality.hasPlanningSignals).toBe(true);
  });

  it("falls back to current month when period is missing", async () => {
    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: null,
      screenContext: {
        kind: "transactions",
        activeFilterCount: 1,
      },
    });

    const result = await resolveUnifiedFinancialAdviceContext({ context });

    expect(result.period.usedFallbackPeriod).toBe(true);
    expect(result.quality.dataGaps).toContain("periode_niet_specifiek");
  });

  it("uses cache for repeated calls in same period", async () => {
    const context = buildHelpAssistantContext({
      screenId: "budget",
      selectedPeriod: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
      },
      screenContext: {
        kind: "budget",
        remainingVariableBudget: 120,
      },
    });

    const first = await resolveUnifiedFinancialAdviceContext({ context });
    const second = await resolveUnifiedFinancialAdviceContext({ context });

    expect(first.quality.cacheHit).toBe(false);
    expect(second.quality.cacheHit).toBe(true);
    expect(loadMonthForecastSummaryMock).toHaveBeenCalledTimes(2);
    expect(loadBudgetPlanForSurfaceMock).toHaveBeenCalledTimes(1);
  });
});
