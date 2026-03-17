import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryLogEntry = {
  table: string;
  selects: string[];
  upserts: { payload: Record<string, unknown>; options: unknown }[];
  inserts: Record<string, unknown>[];
  filters: { method: string; args: unknown[] }[];
};

const {
  fromMock,
  queryLog,
  responseQueue,
  requireCurrentUserIdMock,
} = vi.hoisted(() => {
  const responseQueue: { data: unknown; error: unknown }[] = [];
  const queryLog: QueryLogEntry[] = [];

  function nextResponse() {
    return responseQueue.shift() || { data: null, error: null };
  }

  function buildQuery(table: string) {
    const entry: QueryLogEntry = {
      table,
      selects: [],
      upserts: [],
      inserts: [],
      filters: [],
    };
    queryLog.push(entry);

    const query = {
      select: vi.fn((value: string) => {
        entry.selects.push(value);
        return query;
      }),
      eq: vi.fn((...args: unknown[]) => {
        entry.filters.push({ method: "eq", args });
        return query;
      }),
      order: vi.fn(() => query),
      maybeSingle: vi.fn(async () => nextResponse()),
      single: vi.fn(async () => nextResponse()),
      upsert: vi.fn((payload: Record<string, unknown>, options: unknown) => {
        entry.upserts.push({ payload, options });
        return query;
      }),
      insert: vi.fn(async (payload: Record<string, unknown>) => {
        entry.inserts.push(payload);
        return nextResponse();
      }),
    };

    return query;
  }

  return {
    fromMock: vi.fn((table: string) => buildQuery(table)),
    queryLog,
    responseQueue,
    requireCurrentUserIdMock: vi.fn(),
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

let upsertBudgetCategoryOverride: typeof import("./budget-plan-repository").upsertBudgetCategoryOverride;
let upsertBudgetPlanSettings: typeof import("./budget-plan-repository").upsertBudgetPlanSettings;
let upsertMonthlyBudgetValue: typeof import("./budget-plan-repository").upsertMonthlyBudgetValue;

describe("budget-plan-repository save flows", () => {
  beforeEach(async () => {
    ({
      upsertBudgetCategoryOverride,
      upsertBudgetPlanSettings,
      upsertMonthlyBudgetValue,
    } = await import("./budget-plan-repository"));
    fromMock.mockClear();
    queryLog.length = 0;
    responseQueue.length = 0;
    requireCurrentUserIdMock.mockReset();
    requireCurrentUserIdMock.mockResolvedValue("user-123");
  });

  it("merges partial plan settings with existing saved settings", async () => {
    responseQueue.push(
      {
        data: {
          plan_key: "default",
          mode: "balanced",
          adjustment_factor: 0.85,
          include_income_salary: true,
          include_income_child_budget: false,
          include_income_structural_other: false,
          include_income_variable: false,
          forecast_expense_source: "trend",
          apply_savings_target_to_variable_budget: true,
          savings_target_monthly: 125,
        },
        error: null,
      },
      {
        data: {
          plan_key: "default",
          mode: "custom",
          adjustment_factor: 0.85,
          include_income_salary: true,
          include_income_child_budget: true,
          include_income_structural_other: false,
          include_income_variable: false,
          forecast_expense_source: "budget_settings",
          apply_savings_target_to_variable_budget: true,
          savings_target_monthly: 200,
        },
        error: null,
      },
    );

    const result = await upsertBudgetPlanSettings({
      mode: "custom",
      includeIncome: { childBudget: true },
      forecastExpenseSource: "budget_settings",
      savingsTargetMonthly: 200,
    });

    expect(result.mode).toBe("custom");
    expect(result.adjustmentFactor).toBe(0.85);
    expect(result.includeIncome).toEqual({
      salary: true,
      childBudget: true,
      structuralOther: false,
      variable: false,
    });
    expect(result.forecastExpenseSource).toBe("budget_settings");
    expect(result.savingsTargetMonthly).toBe(200);

    expect(queryLog[1]?.table).toBe("budget_plan_settings");
    expect(queryLog[1]?.upserts[0]?.payload).toMatchObject({
      user_id: "user-123",
      plan_key: "default",
      mode: "custom",
      adjustment_factor: 0.85,
      include_income_salary: true,
      include_income_child_budget: true,
      include_income_structural_other: false,
      include_income_variable: false,
      forecast_expense_source: "budget_settings",
      savings_target_monthly: 200,
    });
  });

  it("preserves an existing factor override when only the monthly target changes", async () => {
    responseQueue.push(
      {
        data: { plan_key: "default" },
        error: null,
      },
      {
        data: {
          monthly_target_override: null,
          factor_override: 1.15,
        },
        error: null,
      },
      {
        data: {
          plan_key: "default",
          category_key: "subscriptions",
          monthly_target_override: 250,
          factor_override: 1.15,
        },
        error: null,
      },
    );

    const result = await upsertBudgetCategoryOverride({
      categoryKey: "subscriptions",
      monthlyTargetOverride: 250,
    });

    expect(result.monthlyTargetOverride).toBe(250);
    expect(result.factorOverride).toBe(1.15);
    expect(queryLog[2]?.upserts[0]?.payload).toMatchObject({
      user_id: "user-123",
      plan_key: "default",
      category_key: "subscriptions",
      monthly_target_override: 250,
      factor_override: 1.15,
    });
  });

  it("retries monthly budget saves without lock_trend and clamps negative values to zero", async () => {
    responseQueue.push(
      {
        data: { plan_key: "default" },
        error: null,
      },
      {
        data: null,
        error: { code: "42703", message: "column lock_trend does not exist" },
      },
      {
        data: {
          plan_key: "default",
          month_start: "2026-03-01",
          category_key: "groceries",
          monthly_budget: 0,
          source: "manual",
          created_at: null,
          updated_at: null,
        },
        error: null,
      },
    );

    const result = await upsertMonthlyBudgetValue({
      monthStartIso: "2026-03-01",
      categoryKey: "groceries",
      monthlyBudget: -40,
      source: "manual",
      lockTrend: true,
    });

    expect(result.monthlyBudget).toBe(0);
    expect(result.lockTrend).toBeNull();
    expect(queryLog[1]?.upserts[0]?.payload).toMatchObject({
      user_id: "user-123",
      month_start: "2026-03-01",
      category_key: "groceries",
      monthly_budget: 0,
      lock_trend: true,
    });
    expect(queryLog[2]?.upserts[0]?.payload).toMatchObject({
      user_id: "user-123",
      month_start: "2026-03-01",
      category_key: "groceries",
      monthly_budget: 0,
    });
    expect(queryLog[2]?.upserts[0]?.payload).not.toHaveProperty("lock_trend");
  });
});
