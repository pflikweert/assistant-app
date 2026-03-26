import { describe, expect, it } from "vitest";

import { applyBudgetWeekRebalanceGuardrails } from "@/services/budget-week-guardrails";
import type {
  BudgetPlanComputation,
  BudgetWeekBudgetBreakdown,
  BudgetWeekPlanRow,
} from "@/types/categorization";

function createWeek(input: Partial<BudgetWeekPlanRow>): BudgetWeekPlanRow {
  return {
    weekNumber: input.weekNumber ?? 1,
    label: input.label ?? `Week ${input.weekNumber ?? 1}`,
    startDate: input.startDate ?? "2026-03-03",
    endDateExclusive: input.endDateExclusive ?? "2026-03-10",
    daysInCurrentMonth: 7,
    daysInPreviousMonth: 0,
    daysInNextMonth: 0,
    crossesMonthBoundary: false,
    baseBudget: input.baseBudget ?? 200,
    budget: input.budget ?? 200,
    guardrailBudgetFloor: input.guardrailBudgetFloor ?? null,
    actual: input.actual ?? 0,
    remaining: input.remaining ?? (input.budget ?? 200),
    utilization: input.utilization ?? 0,
    isCurrentWeek: input.isCurrentWeek ?? false,
    isPastWeek: input.isPastWeek ?? false,
    wasRebalanced: input.wasRebalanced ?? false,
    rebalanceMode: input.rebalanceMode ?? "none",
    overrunAmount: input.overrunAmount ?? 0,
  };
}

function createBreakdown(
  weekNumber: number,
  startDate: string,
  endDateExclusive: string,
  groceries: number,
  fuel: number,
): BudgetWeekBudgetBreakdown {
  return {
    weekNumber,
    startDate,
    endDateExclusive,
    categories: [
      { key: "groceries", label: "Boodschappen", amount: groceries },
      { key: "fuel", label: "Brandstof", amount: fuel },
      { key: "smoking", label: "Roken", amount: 0 },
      { key: "other", label: "Overig", amount: 0 },
    ],
  };
}

function createPlan(overrides?: Partial<BudgetPlanComputation>): BudgetPlanComputation {
  const weeklyVariablePlan = overrides?.weeklyVariablePlan ?? [
    createWeek({
      weekNumber: 1,
      label: "Week 1",
      startDate: "2026-03-03",
      endDateExclusive: "2026-03-10",
      baseBudget: 200,
      budget: 200,
      actual: 320,
      remaining: -120,
      utilization: 1.6,
      isPastWeek: true,
      overrunAmount: 120,
    }),
    createWeek({
      weekNumber: 2,
      label: "Week 2",
      startDate: "2026-03-10",
      endDateExclusive: "2026-03-17",
      baseBudget: 200,
      budget: 100,
      actual: 20,
      remaining: 80,
      utilization: 0.2,
      isCurrentWeek: true,
      wasRebalanced: true,
      rebalanceMode: "hard",
    }),
    createWeek({
      weekNumber: 3,
      label: "Week 3",
      startDate: "2026-03-17",
      endDateExclusive: "2026-03-24",
      baseBudget: 200,
      budget: 100,
      actual: 0,
      remaining: 100,
      utilization: 0,
      wasRebalanced: true,
      rebalanceMode: "hard",
    }),
  ];

  return {
    planKey: "default",
    referenceDate: "2026-03-18",
    monthStart: "2026-03-01",
    monthProgress: 0.58,
    completedMonthBaselineThrough: null,
    settings: {} as any,
    trend: {} as any,
    monthToDateIncome: {} as any,
    monthToDateExpenses: {} as any,
    recommendations: [
      { categoryKey: "groceries", monthlyBudget: 220 },
      { categoryKey: "fuel", monthlyBudget: 80 },
      { categoryKey: "smoking", monthlyBudget: 0 },
      { categoryKey: "other", monthlyBudget: 0 },
    ] as any,
    warnings: [
      {
        categoryKey: "variable_costs",
        severity: "warning",
        utilization: 1.2,
        message:
          "Week 1 zit 120 euro boven weekbudget. Resterende weken zijn herverdeeld.",
      },
    ],
    savingsPotential: 0,
    recommendedSavings: 0,
    automaticSavingsTargetPreview: {
      activeSavings: 0,
      balanced: 0,
    },
    savingsTargetSource: "manual_custom",
    usedOpenAISavingsTarget: false,
    monthlyBudgetTotal: 0,
    weeklyBudgetTotal: 0,
    projectedMonthNet: overrides?.projectedMonthNet ?? 240,
    flowSummary: {
      fixedCostsBudget: 0,
      subscriptionsBudget: 0,
      variableBudget: 300,
      appliedSavingsTarget: 200,
    } as any,
    weeklyVariablePlan,
    weeklyBudgetBreakdown: [
      createBreakdown(1, "2026-03-03", "2026-03-10", 140, 60),
      createBreakdown(2, "2026-03-10", "2026-03-17", 60, 40),
      createBreakdown(3, "2026-03-17", "2026-03-24", 60, 40),
    ],
    weeklySpendBreakdown: [] as any,
    outsideBudgetExpenses: {} as any,
    expenseDetails: {
      fixedCosts: [],
      subscriptions: [],
    },
    savingsProgress: {} as any,
    coachReport: {} as any,
    ...overrides,
  };
}

describe("applyBudgetWeekRebalanceGuardrails", () => {
  it("protects remaining weeks up to 70% when the month has ample headroom", () => {
    const result = applyBudgetWeekRebalanceGuardrails({
      plan: createPlan(),
      forecast: {
        monthStart: "2026-03-01",
        forecastReferenceDate: "2026-03-18",
        currentBalanceAnchor: 400,
        currentBalanceAnchorDate: "2026-03-18",
        cashRiskFlag: "none",
        riskFlag: "none",
        expectedEndBalance: 220,
        lowestExpectedBalance: 100,
        lowestExpectedBalanceDate: "2026-03-20",
        nextExpectedEventDate: null,
        nextExpectedEventLabel: null,
        expectedIncomeTotal: null,
        remainingExpectedIncomeTotal: null,
        remainingExpectedExpenseTotal: null,
        remainingExpectedSavingsOutflowTotal: null,
        upcomingCommittedIncomeTotal: null,
        upcomingCommittedExpenseTotal: null,
        expectedFixedCosts: null,
        expectedSubscriptions: null,
        expectedVariableCosts: null,
      },
      now: new Date("2026-03-18T12:00:00.000Z"),
    });

    expect(result.weeklyVariablePlan[1]?.budget).toBe(140);
    expect(result.weeklyVariablePlan[2]?.budget).toBe(140);
    expect(result.weeklyVariablePlan[1]?.guardrailBudgetFloor).toBe(140);
    expect(result.weeklyVariablePlan[2]?.rebalanceMode).toBe("guarded");
    expect(result.weeklyBudgetBreakdown[1]?.categories[0]?.amount).toBe(84);
    expect(result.warnings[0]?.message).toContain("deels herverdeeld");
  });

  it("keeps the floor near 50% when headroom is very limited", () => {
    const result = applyBudgetWeekRebalanceGuardrails({
      plan: createPlan({
        weeklyVariablePlan: [
          createWeek({
            weekNumber: 1,
            label: "Week 1",
            startDate: "2026-03-03",
            endDateExclusive: "2026-03-10",
            baseBudget: 100,
            budget: 100,
            actual: 160,
            remaining: -60,
            utilization: 1.6,
            isPastWeek: true,
            overrunAmount: 60,
          }),
          createWeek({
            weekNumber: 2,
            label: "Week 2",
            startDate: "2026-03-10",
            endDateExclusive: "2026-03-17",
            baseBudget: 100,
            budget: 0,
            actual: 0,
            remaining: 0,
            utilization: 0,
            isCurrentWeek: true,
            wasRebalanced: true,
            rebalanceMode: "hard",
          }),
        ],
        weeklyBudgetBreakdown: [
          createBreakdown(1, "2026-03-03", "2026-03-10", 70, 30),
          createBreakdown(2, "2026-03-10", "2026-03-17", 0, 0),
        ],
      }),
      forecast: {
        monthStart: "2026-03-01",
        forecastReferenceDate: "2026-03-18",
        currentBalanceAnchor: 400,
        currentBalanceAnchorDate: "2026-03-18",
        cashRiskFlag: "none",
        riskFlag: "none",
        expectedEndBalance: 1,
        lowestExpectedBalance: 50,
        lowestExpectedBalanceDate: "2026-03-28",
        nextExpectedEventDate: null,
        nextExpectedEventLabel: null,
        expectedIncomeTotal: null,
        remainingExpectedIncomeTotal: null,
        remainingExpectedExpenseTotal: null,
        remainingExpectedSavingsOutflowTotal: null,
        upcomingCommittedIncomeTotal: null,
        upcomingCommittedExpenseTotal: null,
        expectedFixedCosts: null,
        expectedSubscriptions: null,
        expectedVariableCosts: null,
      },
      now: new Date("2026-03-18T12:00:00.000Z"),
    });

    expect(result.weeklyVariablePlan[1]?.guardrailBudgetFloor).toBe(50);
    expect(result.weeklyVariablePlan[1]?.budget).toBe(1);
    expect(result.weeklyVariablePlan[1]?.rebalanceMode).toBe("guarded");
  });

  it("falls back to projected month net when forecast data is unavailable", () => {
    const result = applyBudgetWeekRebalanceGuardrails({
      plan: createPlan({
        projectedMonthNet: 220,
      }),
      forecast: null,
      now: new Date("2026-03-18T12:00:00.000Z"),
    });

    expect(result.weeklyVariablePlan[1]?.budget).toBe(140);
    expect(result.weeklyVariablePlan[2]?.budget).toBe(140);
  });

  it("keeps the original hard rebalance when the forecast ends below zero", () => {
    const plan = createPlan();
    const result = applyBudgetWeekRebalanceGuardrails({
      plan,
      forecast: {
        monthStart: "2026-03-01",
        forecastReferenceDate: "2026-03-18",
        currentBalanceAnchor: 400,
        currentBalanceAnchorDate: "2026-03-18",
        cashRiskFlag: "none",
        riskFlag: "deficit_warning",
        expectedEndBalance: -20,
        lowestExpectedBalance: -30,
        lowestExpectedBalanceDate: "2026-03-28",
        nextExpectedEventDate: null,
        nextExpectedEventLabel: null,
        expectedIncomeTotal: null,
        remainingExpectedIncomeTotal: null,
        remainingExpectedExpenseTotal: null,
        remainingExpectedSavingsOutflowTotal: null,
        upcomingCommittedIncomeTotal: null,
        upcomingCommittedExpenseTotal: null,
        expectedFixedCosts: null,
        expectedSubscriptions: null,
        expectedVariableCosts: null,
      },
      now: new Date("2026-03-18T12:00:00.000Z"),
    });

    expect(result).toBe(plan);
  });

  it("does nothing when there is no earlier week over budget", () => {
    const plan = createPlan({
      weeklyVariablePlan: [
        createWeek({
          weekNumber: 1,
          label: "Week 1",
          startDate: "2026-03-03",
          endDateExclusive: "2026-03-10",
          baseBudget: 200,
          budget: 200,
          actual: 180,
          remaining: 20,
          utilization: 0.9,
          isPastWeek: true,
          overrunAmount: 0,
        }),
        createWeek({
          weekNumber: 2,
          label: "Week 2",
          startDate: "2026-03-10",
          endDateExclusive: "2026-03-17",
          baseBudget: 200,
          budget: 180,
          actual: 0,
          remaining: 180,
          utilization: 0,
          isCurrentWeek: true,
          wasRebalanced: true,
          rebalanceMode: "hard",
        }),
      ],
    });

    const result = applyBudgetWeekRebalanceGuardrails({
      plan,
      forecast: null,
      now: new Date("2026-03-18T12:00:00.000Z"),
    });

    expect(result).toBe(plan);
  });

  it("leaves historical months unchanged", () => {
    const plan = createPlan({
      monthStart: "2026-02-01",
    });

    const result = applyBudgetWeekRebalanceGuardrails({
      plan,
      forecast: null,
      now: new Date("2026-03-18T12:00:00.000Z"),
    });

    expect(result).toBe(plan);
  });
});
