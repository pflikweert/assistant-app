import { beforeAll, describe, expect, it, vi } from "vitest";

import type { BudgetPlanSettings } from "@/types/categorization";
import { buildCalendarWeekRangesForMonth } from "@/services/budget-week-utils";

vi.mock("@/services/budget-coach", () => ({
  suggestAutomaticSavingsTarget: vi.fn(),
}));

vi.mock("@/services/category-budget-groups", () => ({
  applyEffectiveBudgetGroupsToCategories: vi.fn(async () => undefined),
  listCategoryBudgetGroupOverrides: vi.fn(async () => []),
}));

vi.mock("@/services/budget-lock-utils", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/budget-lock-utils")
  >("@/services/budget-lock-utils");

  return {
    ...actual,
    resolveLockedVariableMainCategories: vi.fn(() => []),
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: vi.fn(async () => "test-user"),
}));

vi.mock("@/services/budget-plan-repository", () => ({
  getBudgetCategoryOverrides: vi.fn(async () => []),
  getBudgetPlanSettings: vi.fn(async () => ({
    planKey: "default",
    mode: "balanced",
    adjustmentFactor: 1,
    includeIncome: {
      salary: true,
      childBudget: true,
      structuralOther: false,
      variable: false,
    },
    forecastExpenseSource: "trend",
    applySavingsTargetToVariableBudget: false,
    savingsTargetMonthly: 0,
    createdAt: null,
    updatedAt: null,
  })),
  getMonthlyBudgetValues: vi.fn(async () => []),
}));

vi.mock("@/services/categorization-repository", () => ({
  normalizePattern: (value: string) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {},
}));

let resolveBudgetPlanningTimeline: typeof import("./budget-plan").resolveBudgetPlanningTimeline;
let resolveExpenseBaselinesFromCompletedMonths: typeof import("./budget-plan").resolveExpenseBaselinesFromCompletedMonths;
let resolveExpectedIncomeMonthlyFromCompletedMonths: typeof import("./budget-plan").resolveExpectedIncomeMonthlyFromCompletedMonths;
let resolveFutureMonthOverlapCarryover: typeof import("./budget-plan").resolveFutureMonthOverlapCarryover;
let resolveIncludedIncomePreview: typeof import("./budget-plan").resolveIncludedIncomePreview;

const DEFAULT_SETTINGS: BudgetPlanSettings = {
  planKey: "default",
  mode: "balanced",
  adjustmentFactor: 1,
  includeIncome: {
    salary: true,
    childBudget: true,
    structuralOther: false,
    variable: false,
  },
  forecastExpenseSource: "trend",
  applySavingsTargetToVariableBudget: false,
  savingsTargetMonthly: 0,
  createdAt: null,
  updatedAt: null,
};

beforeAll(async () => {
  const budgetPlan = await import("./budget-plan");
  resolveBudgetPlanningTimeline = budgetPlan.resolveBudgetPlanningTimeline;
  resolveExpenseBaselinesFromCompletedMonths =
    budgetPlan.resolveExpenseBaselinesFromCompletedMonths;
  resolveExpectedIncomeMonthlyFromCompletedMonths =
    budgetPlan.resolveExpectedIncomeMonthlyFromCompletedMonths;
  resolveFutureMonthOverlapCarryover =
    budgetPlan.resolveFutureMonthOverlapCarryover;
  resolveIncludedIncomePreview = budgetPlan.resolveIncludedIncomePreview;
});

function expenseTx(params: {
  date: string;
  amount: number;
  analysisCategory: "fixed_costs" | "subscriptions" | "variable_costs";
  details: string;
}) {
  return {
    id: `${params.analysisCategory}-${params.date}-${params.details}`,
    date: params.date,
    amount: -Math.abs(params.amount),
    details: params.details,
    counterparty: params.details,
    category_id_auto: null,
    category_id_user: null,
    analysis_main_group: "expense",
    analysis_category: params.analysisCategory,
    budget_excluded: false,
    metadata: {},
  } as any;
}

function incomeTx(params: { date: string; amount: number; details: string }) {
  return {
    id: `income-${params.date}-${params.details}`,
    date: params.date,
    amount: params.amount,
    details: params.details,
    counterparty: params.details,
    category_id_auto: null,
    category_id_user: null,
    analysis_main_group: "income",
    analysis_category: "income_structural",
    budget_excluded: false,
    metadata: {},
  } as any;
}

describe("resolveBudgetPlanningTimeline", () => {
  it("cuts future-month planning off at the start of the real current month", () => {
    const timeline = resolveBudgetPlanningTimeline(
      new Date("2026-04-30T12:00:00.000Z"),
      new Date("2026-03-17T12:00:00.000Z"),
    );

    expect(timeline.isFuturePlanningMonth).toBe(true);
    expect(timeline.observationEndExclusive.toISOString().slice(0, 10)).toBe(
      "2026-03-01",
    );
    expect(timeline.observedDataEndExclusive.toISOString().slice(0, 10)).toBe(
      "2026-03-18",
    );
    expect(timeline.completedMonthCutoffStart.toISOString().slice(0, 10)).toBe(
      "2026-03-01",
    );
    expect(timeline.completedMonthBaselineThrough).toBe("2026-02-01");
  });

  it("keeps historical planning as-of the selected month", () => {
    const timeline = resolveBudgetPlanningTimeline(
      new Date("2026-01-31T12:00:00.000Z"),
      new Date("2026-03-17T12:00:00.000Z"),
    );

    expect(timeline.isFuturePlanningMonth).toBe(false);
    expect(timeline.observationEndExclusive.toISOString().slice(0, 10)).toBe(
      "2026-02-01",
    );
    expect(timeline.observedDataEndExclusive.toISOString().slice(0, 10)).toBe(
      "2026-02-01",
    );
    expect(timeline.completedMonthCutoffStart.toISOString().slice(0, 10)).toBe(
      "2026-01-01",
    );
  });
});

describe("future budget baselines", () => {
  it("uses the included-income budget settings for the forecast income preview", () => {
    const preview = resolveIncludedIncomePreview(
      {
        salary: 2400,
        childBudget: 429,
        structuralOther: 0,
        variable: 650,
        windfalls: 50,
        costRefunds: 25,
        total: 3554,
      },
      {
        ...DEFAULT_SETTINGS,
        includeIncome: {
          salary: true,
          childBudget: true,
          structuralOther: false,
          variable: false,
        },
      },
    );

    expect(preview.total).toBe(2829);
    expect(preview.structural).toBe(2829);
    expect(preview.variable).toBe(0);
  });

  it("falls back to the default include-income settings when they are missing", () => {
    const preview = resolveIncludedIncomePreview(
      {
        salary: 2400,
        childBudget: 429,
        structuralOther: 0,
        variable: 650,
        windfalls: 50,
        costRefunds: 25,
        total: 3554,
      },
      {
        ...DEFAULT_SETTINGS,
        includeIncome: undefined as any,
      } as any,
    );

    expect(preview.total).toBe(2829);
    expect(preview.structural).toBe(2829);
    expect(preview.variable).toBe(0);
  });

  it("uses only completed months for fixed, subscriptions and variable baselines", () => {
    const rows = [
      expenseTx({
        date: "2026-01-05",
        amount: 800,
        analysisCategory: "fixed_costs",
        details: "zorgverzekering",
      }),
      expenseTx({
        date: "2026-02-05",
        amount: 1000,
        analysisCategory: "fixed_costs",
        details: "zorgverzekering",
      }),
      expenseTx({
        date: "2026-03-05",
        amount: 120,
        analysisCategory: "fixed_costs",
        details: "zorgverzekering",
      }),
      expenseTx({
        date: "2026-01-09",
        amount: 30,
        analysisCategory: "subscriptions",
        details: "spotify",
      }),
      expenseTx({
        date: "2026-02-09",
        amount: 50,
        analysisCategory: "subscriptions",
        details: "spotify",
      }),
      expenseTx({
        date: "2026-03-09",
        amount: 10,
        analysisCategory: "subscriptions",
        details: "spotify",
      }),
      expenseTx({
        date: "2026-01-12",
        amount: 250,
        analysisCategory: "variable_costs",
        details: "Albert Heijn",
      }),
      expenseTx({
        date: "2026-02-12",
        amount: 350,
        analysisCategory: "variable_costs",
        details: "Albert Heijn",
      }),
      expenseTx({
        date: "2026-03-12",
        amount: 40,
        analysisCategory: "variable_costs",
        details: "Albert Heijn",
      }),
      expenseTx({
        date: "2026-01-20",
        amount: 60,
        analysisCategory: "variable_costs",
        details: "Shell",
      }),
      expenseTx({
        date: "2026-02-20",
        amount: 90,
        analysisCategory: "variable_costs",
        details: "Shell",
      }),
      expenseTx({
        date: "2026-03-20",
        amount: 15,
        analysisCategory: "variable_costs",
        details: "Shell",
      }),
    ];

    const baselines = resolveExpenseBaselinesFromCompletedMonths(
      rows,
      new Map(),
      new Date("2025-12-01T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z"),
    );

    expect(baselines.get("fixed_costs")).toBe(944);
    expect(baselines.get("subscriptions")).toBe(44.4);
    expect(baselines.get("variable_costs")).toBe(403.6);
    expect(baselines.get("groceries")).toBe(322);
    expect(baselines.get("fuel")).toBe(81.6);
  });

  it("uses only completed months for the expected income baseline", () => {
    const rows = [
      incomeTx({
        date: "2026-01-25",
        amount: 2400,
        details: "Salaris",
      }),
      incomeTx({
        date: "2026-02-25",
        amount: 2600,
        details: "Salaris",
      }),
      incomeTx({
        date: "2026-03-25",
        amount: 400,
        details: "Salaris",
      }),
      incomeTx({
        date: "2026-01-20",
        amount: 400,
        details: "Kindgebonden budget",
      }),
      incomeTx({
        date: "2026-02-20",
        amount: 400,
        details: "Kindgebonden budget",
      }),
    ];

    const expectedIncomeMonthly = resolveExpectedIncomeMonthlyFromCompletedMonths(
      rows,
      new Map(),
      DEFAULT_SETTINGS,
      new Date("2025-12-01T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z"),
    );

    expect(expectedIncomeMonthly).toBe(2944);
  });
});

describe("future month overlap carryover", () => {
  it("reuses the rebalanced last overlap week from the open previous month", () => {
    const planningTimeline = resolveBudgetPlanningTimeline(
      new Date("2026-04-30T12:00:00.000Z"),
      new Date("2026-03-17T12:00:00.000Z"),
    );
    const selectedMonthStart = new Date("2026-04-01T00:00:00.000Z");
    const selectedWeekRanges = buildCalendarWeekRangesForMonth(
      selectedMonthStart,
      new Date("2026-05-01T00:00:00.000Z"),
    );

    const carryover = resolveFutureMonthOverlapCarryover({
      planningTimeline,
      timelineReferenceDay: new Date("2026-03-17T00:00:00.000Z"),
      transactions: [
        expenseTx({
          date: "2026-03-01",
          amount: 100,
          analysisCategory: "variable_costs",
          details: "Albert Heijn",
        }),
        expenseTx({
          date: "2026-03-03",
          amount: 120,
          analysisCategory: "variable_costs",
          details: "Albert Heijn",
        }),
        expenseTx({
          date: "2026-03-10",
          amount: 70,
          analysisCategory: "variable_costs",
          details: "Albert Heijn",
        }),
      ],
      categoryMap: new Map(),
      selectedWeekRanges,
      previousMonthStart: new Date("2026-03-01T00:00:00.000Z"),
      selectedMonthStart,
      prePreviousMonthVariableMainCategoryBudgets: new Map([
        ["groceries", 310],
        ["fuel", 0],
        ["smoking", 0],
        ["other", 0],
      ]),
      previousMonthVariableMainCategoryBudgets: new Map([
        ["groceries", 310],
        ["fuel", 0],
        ["smoking", 0],
        ["other", 0],
      ]),
      selectedMonthVariableMainCategoryBudgets: new Map([
        ["groceries", 300],
        ["fuel", 0],
        ["smoking", 0],
        ["other", 0],
      ]),
      previousMonthLockedCategoryKeys: new Set(),
    });

    expect(carryover).not.toBeNull();
    expect(carryover?.weekPlan.startDate).toBe("2026-03-30");
    expect(carryover?.weekPlan.budget).toBe(45);
    expect(carryover?.weekPlan.actual).toBe(0);
    expect(carryover?.weekBudgetBreakdown.categories).toEqual([
      { key: "groceries", label: "Boodschappen", amount: 45 },
      { key: "fuel", label: "Brandstof", amount: 0 },
      { key: "smoking", label: "Roken", amount: 0 },
      { key: "other", label: "Overig", amount: 0 },
    ]);
  });
});
