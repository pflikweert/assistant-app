/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentUserIdMock,
  loadMonthForecastSummaryMock,
  loadBudgetPlanForSurfaceMock,
  getCurrentMonthKeyMock,
  getMonthOptionByKeyMock,
  loadLatestKnownBalanceSnapshotMock,
  listBankAccountBudgetFlagsMock,
  createSupabaseCategorizationRepositoryMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  requireCurrentUserIdMock: vi.fn(),
  loadMonthForecastSummaryMock: vi.fn(),
  loadBudgetPlanForSurfaceMock: vi.fn(),
  getCurrentMonthKeyMock: vi.fn(),
  getMonthOptionByKeyMock: vi.fn(),
  loadLatestKnownBalanceSnapshotMock: vi.fn(),
  listBankAccountBudgetFlagsMock: vi.fn(),
  createSupabaseCategorizationRepositoryMock: vi.fn(),
  supabaseFromMock: vi.fn(),
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

vi.mock("./latest-known-balance", () => ({
  loadLatestKnownBalanceSnapshot: loadLatestKnownBalanceSnapshotMock,
}));

vi.mock("./bank-accounts", () => ({
  listBankAccountBudgetFlags: listBankAccountBudgetFlagsMock,
  isBankAccountIncludedInBudget: (
    bankAccountId: string | null,
    budgetFlags: Map<string, boolean>,
  ) => {
    if (!bankAccountId) return true;
    return budgetFlags.get(bankAccountId) !== false;
  },
}));

vi.mock("./categorization-repository", () => ({
  createSupabaseCategorizationRepository: createSupabaseCategorizationRepositoryMock,
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: supabaseFromMock,
  },
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

const sampleCategories = [
  {
    id: "cat-food-root",
    key: "groceries",
    name: "Boodschappen",
    parent_id: null,
    budget_group: "variable",
    sort_order: 1,
  },
  {
    id: "cat-food-sub",
    key: "supermarket",
    name: "Supermarkt",
    parent_id: "cat-food-root",
    budget_group: "variable",
    sort_order: 2,
  },
  {
    id: "cat-home-root",
    key: "housing",
    name: "Wonen",
    parent_id: null,
    budget_group: "fixed",
    sort_order: 3,
  },
  {
    id: "cat-home-sub",
    key: "rent",
    name: "Huur",
    parent_id: "cat-home-root",
    budget_group: "fixed",
    sort_order: 4,
  },
];

const sampleMonthSpendRows = [
  {
    id: "tx-1",
    date: "2026-03-12",
    amount: -40,
    details: "Jumbo",
    counterparty: "Jumbo",
    bank_account_id: "bank-1",
    category_id_auto: "cat-food-sub",
    category_id_user: null,
    budget_excluded: false,
  },
  {
    id: "tx-2",
    date: "2026-03-15",
    amount: -20,
    details: "Huur",
    counterparty: "Woningstichting",
    bank_account_id: "bank-1",
    category_id_auto: "cat-home-sub",
    category_id_user: null,
    budget_excluded: false,
  },
];

const sampleWeekSpendRows = [
  {
    id: "tx-3",
    date: "2026-03-25",
    amount: -15,
    details: "Albert Heijn",
    counterparty: "Albert Heijn",
    bank_account_id: "bank-1",
    category_id_auto: "cat-food-sub",
    category_id_user: null,
    budget_excluded: false,
  },
];

function createSupabaseRangeResponse(rows: unknown[]) {
  return {
    data: rows,
    error: null,
  };
}

function createSupabaseQueryMock() {
  return vi.fn((table: string) => {
    const state: Record<string, string | undefined> = {};
    const chain = {
      select() {
        return chain;
      },
      eq(column: string, value: string) {
        state[`eq:${column}`] = value;
        return chain;
      },
      gte(column: string, value: string) {
        state[`gte:${column}`] = value;
        return chain;
      },
      lt(column: string, value: string) {
        state[`lt:${column}`] = value;
        return chain;
      },
      order() {
        return chain;
      },
      range() {
        if (table !== "transactions") {
          return Promise.resolve(createSupabaseRangeResponse([]));
        }
        const key = `${state["gte:date"] || ""}|${state["lt:date"] || ""}`;
        if (key === "2026-03-01|2026-04-01") {
          return Promise.resolve(createSupabaseRangeResponse(sampleMonthSpendRows));
        }
        if (key === "2026-03-23|2026-03-30") {
          return Promise.resolve(createSupabaseRangeResponse(sampleWeekSpendRows));
        }
        return Promise.resolve(createSupabaseRangeResponse([]));
      },
    };
    return chain;
  });
}

describe("resolveUnifiedFinancialAdviceContext", () => {
  beforeEach(() => {
    clearUnifiedFinancialAdviceContextCache();
    requireCurrentUserIdMock.mockReset();
    loadMonthForecastSummaryMock.mockReset();
    loadBudgetPlanForSurfaceMock.mockReset();
    getCurrentMonthKeyMock.mockReset();
    getMonthOptionByKeyMock.mockReset();
    loadLatestKnownBalanceSnapshotMock.mockReset();
    listBankAccountBudgetFlagsMock.mockReset();
    createSupabaseCategorizationRepositoryMock.mockReset();
    supabaseFromMock.mockReset();

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
    loadLatestKnownBalanceSnapshotMock.mockResolvedValue({
      balance: 1420,
      date: "2026-03-19",
    });
    listBankAccountBudgetFlagsMock.mockResolvedValue(new Map([["bank-1", true]]));
    createSupabaseCategorizationRepositoryMock.mockReturnValue({
      getCategories: vi.fn().mockResolvedValue(sampleCategories),
    });
    supabaseFromMock.mockImplementation(createSupabaseQueryMock());
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
    expect(result.currentBalance.balance).toBe(1420);
    expect(result.spending.currentMonthTotal).toBe(60);
    expect(result.spending.currentMonthBreakdown.categories[0].label).toBe(
      "Boodschappen",
    );
    expect(result.spending.currentWeekTotal).toBe(15);
    expect(result.budgetPlan.currentWeekBudget).toBe(200);
    expect(result.trend.weekTempoDelta).toBe(80);
    expect(result.quality.hasBalanceSignals).toBe(true);
    expect(result.quality.hasSpendingSignals).toBe(true);
    expect(result.quality.hasCategorySignals).toBe(true);
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
