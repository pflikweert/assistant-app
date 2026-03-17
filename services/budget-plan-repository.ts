import { supabase } from "@/services/supabase";
import { requireCurrentUserId } from "@/services/current-user";
import type {
    BudgetCategoryKey,
    BudgetForecastExpenseSource,
    BudgetCategoryOverride,
    BudgetIncomeInclusionSettings,
    BudgetPlanMode,
    BudgetPlanSettings,
    MonthlyBudgetValue,
} from "@/types/categorization";

const DEFAULT_PLAN_KEY = "default";
const DEFAULT_MODE: BudgetPlanMode = "active_savings";
const DEFAULT_ADJUSTMENT_FACTOR = 0.9;
const DEFAULT_INCLUDE_INCOME: BudgetIncomeInclusionSettings = {
  salary: true,
  childBudget: true,
  structuralOther: false,
  variable: false,
};
const DEFAULT_FORECAST_EXPENSE_SOURCE: BudgetForecastExpenseSource = "trend";
const DEFAULT_APPLY_SAVINGS_TARGET_TO_VARIABLE_BUDGET = false;
const DEFAULT_SAVINGS_TARGET_MONTHLY = 0;

type RowRecord = Record<string, unknown>;

export type UpsertBudgetPlanSettingsInput = {
  planKey?: string;
  mode?: BudgetPlanMode;
  adjustmentFactor?: number;
  includeIncome?: Partial<BudgetIncomeInclusionSettings>;
  forecastExpenseSource?: BudgetForecastExpenseSource;
  applySavingsTargetToVariableBudget?: boolean;
  savingsTargetMonthly?: number;
};

export type UpsertBudgetCategoryOverrideInput = {
  planKey?: string;
  categoryKey: BudgetCategoryKey;
  monthlyTargetOverride?: number | null;
  factorOverride?: number | null;
};

export type UpsertMonthlyBudgetValueInput = {
  planKey?: string;
  monthStartIso: string;
  categoryKey: BudgetCategoryKey;
  monthlyBudget: number;
  source?: "manual" | "system";
  lockTrend?: boolean | null;
};

export type ResetMonthlyBudgetValuesInput = {
  planKey?: string;
  monthStartIso: string;
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = asNumber(value, fallback);
  return parsed < 0 ? fallback : parsed;
}

function asNullablePositiveFactor(value: unknown): number | null {
  const parsed = asNullableNumber(value);
  if (parsed == null) return null;
  if (parsed <= 0) return null;
  return parsed;
}

function asAdjustmentFactor(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0 || parsed > 1.5) return fallback;
  return parsed;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function asNullableBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function isMissingColumnError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();
  if (code === "42703") return true;
  return message.includes("column") && message.includes("does not exist");
}

function normalizePlanKey(planKey?: string): string {
  const trimmed = String(planKey || DEFAULT_PLAN_KEY).trim();
  return trimmed || DEFAULT_PLAN_KEY;
}

function normalizeMonthStartIso(value: string): string {
  const direct = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

  const parsed = new Date(direct);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid monthStartIso: ${value}`);
  }
  return parsed.toISOString().slice(0, 10);
}

function mapSettingsRow(
  row: RowRecord | null,
  planKeyFallback: string,
): BudgetPlanSettings {
  if (!row) {
    return {
      planKey: planKeyFallback,
      mode: DEFAULT_MODE,
      adjustmentFactor: DEFAULT_ADJUSTMENT_FACTOR,
      includeIncome: {
        ...DEFAULT_INCLUDE_INCOME,
      },
      forecastExpenseSource: DEFAULT_FORECAST_EXPENSE_SOURCE,
      applySavingsTargetToVariableBudget:
        DEFAULT_APPLY_SAVINGS_TARGET_TO_VARIABLE_BUDGET,
      savingsTargetMonthly: DEFAULT_SAVINGS_TARGET_MONTHLY,
      createdAt: null,
      updatedAt: null,
    };
  }

  const modeRaw = String(row.mode || DEFAULT_MODE);
  const mode: BudgetPlanMode =
    modeRaw === "balanced" ||
    modeRaw === "custom" ||
    modeRaw === "active_savings"
      ? modeRaw
      : DEFAULT_MODE;
  const forecastExpenseSourceRaw = String(
    row.forecast_expense_source || DEFAULT_FORECAST_EXPENSE_SOURCE,
  );
  const forecastExpenseSource: BudgetForecastExpenseSource =
    forecastExpenseSourceRaw === "budget_settings"
      ? "budget_settings"
      : DEFAULT_FORECAST_EXPENSE_SOURCE;

  return {
    planKey: String(row.plan_key || planKeyFallback),
    mode,
    adjustmentFactor: asAdjustmentFactor(
      row.adjustment_factor,
      DEFAULT_ADJUSTMENT_FACTOR,
    ),
    includeIncome: {
      salary: asBoolean(
        row.include_income_salary,
        DEFAULT_INCLUDE_INCOME.salary,
      ),
      childBudget: asBoolean(
        row.include_income_child_budget,
        DEFAULT_INCLUDE_INCOME.childBudget,
      ),
      structuralOther: asBoolean(
        row.include_income_structural_other,
        DEFAULT_INCLUDE_INCOME.structuralOther,
      ),
      variable: asBoolean(
        row.include_income_variable,
        DEFAULT_INCLUDE_INCOME.variable,
      ),
    },
    forecastExpenseSource,
    applySavingsTargetToVariableBudget: asBoolean(
      row.apply_savings_target_to_variable_budget,
      DEFAULT_APPLY_SAVINGS_TARGET_TO_VARIABLE_BUDGET,
    ),
    savingsTargetMonthly: asNonNegativeNumber(
      row.savings_target_monthly,
      DEFAULT_SAVINGS_TARGET_MONTHLY,
    ),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function mapCategoryOverrideRow(row: RowRecord): BudgetCategoryOverride {
  return {
    planKey: String(row.plan_key || DEFAULT_PLAN_KEY),
    categoryKey: String(row.category_key || "other") as BudgetCategoryKey,
    monthlyTargetOverride: asNullableNumber(row.monthly_target_override),
    factorOverride: asNullablePositiveFactor(row.factor_override),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function mapMonthlyValueRow(row: RowRecord): MonthlyBudgetValue {
  const sourceRaw = String(row.source || "manual");
  return {
    planKey: String(row.plan_key || DEFAULT_PLAN_KEY),
    monthStart: String(row.month_start || ""),
    categoryKey: String(row.category_key || "other") as BudgetCategoryKey,
    monthlyBudget: asNonNegativeNumber(row.monthly_budget, 0),
    source: sourceRaw === "system" ? "system" : "manual",
    lockTrend: asNullableBoolean(row.lock_trend),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

async function ensurePlanRow(planKey: string, userId: string) {
  const { data, error } = await supabase
    .from("budget_plan_settings")
    .select("plan_key")
    .eq("user_id", userId)
    .eq("plan_key", planKey)
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase
    .from("budget_plan_settings")
    .insert({
      user_id: userId,
      plan_key: planKey,
      mode: DEFAULT_MODE,
      adjustment_factor: DEFAULT_ADJUSTMENT_FACTOR,
    });

  if (insertError) throw insertError;
}

export async function getBudgetPlanSettings(
  planKey = DEFAULT_PLAN_KEY,
): Promise<BudgetPlanSettings> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(planKey);
  const { data, error } = await supabase
    .from("budget_plan_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_key", normalizedPlanKey)
    .maybeSingle();

  if (error) throw error;
  return mapSettingsRow((data || null) as RowRecord | null, normalizedPlanKey);
}

export async function upsertBudgetPlanSettings(
  input: UpsertBudgetPlanSettingsInput,
): Promise<BudgetPlanSettings> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(input.planKey);
  const existing = await getBudgetPlanSettings(normalizedPlanKey);

  const nextMode = input.mode || existing.mode;
  const nextAdjustmentFactor =
    input.adjustmentFactor == null
      ? existing.adjustmentFactor
      : asAdjustmentFactor(input.adjustmentFactor, existing.adjustmentFactor);
  const nextIncludeIncome: BudgetIncomeInclusionSettings = {
    salary:
      input.includeIncome?.salary == null
        ? existing.includeIncome.salary
        : Boolean(input.includeIncome.salary),
    childBudget:
      input.includeIncome?.childBudget == null
        ? existing.includeIncome.childBudget
        : Boolean(input.includeIncome.childBudget),
    structuralOther:
      input.includeIncome?.structuralOther == null
        ? existing.includeIncome.structuralOther
        : Boolean(input.includeIncome.structuralOther),
    variable:
      input.includeIncome?.variable == null
        ? existing.includeIncome.variable
        : Boolean(input.includeIncome.variable),
  };
  const nextForecastExpenseSource =
    input.forecastExpenseSource || existing.forecastExpenseSource;
  const nextApplySavingsTargetToVariableBudget =
    input.applySavingsTargetToVariableBudget == null
      ? existing.applySavingsTargetToVariableBudget
      : Boolean(input.applySavingsTargetToVariableBudget);
  const nextSavingsTargetMonthly =
    input.savingsTargetMonthly == null
      ? existing.savingsTargetMonthly
      : asNonNegativeNumber(
          input.savingsTargetMonthly,
          existing.savingsTargetMonthly,
        );

  const basePayload = {
    user_id: userId,
    plan_key: normalizedPlanKey,
    mode: nextMode,
    adjustment_factor: nextAdjustmentFactor,
    updated_at: new Date().toISOString(),
  };

  const settingsPayload = {
    ...basePayload,
    include_income_salary: nextIncludeIncome.salary,
    include_income_child_budget: nextIncludeIncome.childBudget,
    include_income_structural_other: nextIncludeIncome.structuralOther,
    include_income_variable: nextIncludeIncome.variable,
    forecast_expense_source: nextForecastExpenseSource,
    apply_savings_target_to_variable_budget:
      nextApplySavingsTargetToVariableBudget,
    savings_target_monthly: nextSavingsTargetMonthly,
  };

  const legacyPayload = {
    ...basePayload,
    apply_savings_target_to_variable_budget:
      nextApplySavingsTargetToVariableBudget,
    savings_target_monthly: nextSavingsTargetMonthly,
  };

  let { data, error } = await supabase
    .from("budget_plan_settings")
    .upsert(settingsPayload, { onConflict: "user_id,plan_key" })
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && isMissingColumnError(error)) {
    const retry = await supabase
      .from("budget_plan_settings")
      .upsert(legacyPayload, { onConflict: "user_id,plan_key" })
      .select("*")
      .eq("user_id", userId)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return mapSettingsRow(data as RowRecord, normalizedPlanKey);
}

export async function getBudgetCategoryOverrides(
  planKey = DEFAULT_PLAN_KEY,
): Promise<BudgetCategoryOverride[]> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(planKey);
  const { data, error } = await supabase
    .from("budget_category_overrides")
    .select(
      "plan_key,category_key,monthly_target_override,factor_override,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("plan_key", normalizedPlanKey)
    .order("category_key", { ascending: true });

  if (error) throw error;
  return ((data || []) as RowRecord[]).map(mapCategoryOverrideRow);
}

export async function upsertBudgetCategoryOverride(
  input: UpsertBudgetCategoryOverrideInput,
): Promise<BudgetCategoryOverride> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(input.planKey);
  await ensurePlanRow(normalizedPlanKey, userId);

  const { data: existingRow, error: existingError } = await supabase
    .from("budget_category_overrides")
    .select("monthly_target_override,factor_override")
    .eq("user_id", userId)
    .eq("plan_key", normalizedPlanKey)
    .eq("category_key", input.categoryKey)
    .maybeSingle();

  if (existingError) throw existingError;

  const existingMonthlyTarget = asNullableNumber(
    (existingRow as RowRecord | null)?.monthly_target_override,
  );
  const existingFactor = asNullablePositiveFactor(
    (existingRow as RowRecord | null)?.factor_override,
  );

  const nextMonthlyTarget =
    input.monthlyTargetOverride === undefined
      ? existingMonthlyTarget
      : input.monthlyTargetOverride == null
        ? null
        : asNonNegativeNumber(input.monthlyTargetOverride, 0);

  const nextFactor =
    input.factorOverride === undefined
      ? existingFactor
      : input.factorOverride == null
        ? null
        : asNullablePositiveFactor(input.factorOverride);

  const { data, error } = await supabase
    .from("budget_category_overrides")
    .upsert(
      {
        user_id: userId,
        plan_key: normalizedPlanKey,
        category_key: input.categoryKey,
        monthly_target_override: nextMonthlyTarget,
        factor_override: nextFactor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_key,category_key" },
    )
    .select(
      "plan_key,category_key,monthly_target_override,factor_override,created_at,updated_at",
    )
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return mapCategoryOverrideRow(data as RowRecord);
}

export async function getMonthlyBudgetValues(
  monthStartIso: string,
  planKey = DEFAULT_PLAN_KEY,
): Promise<MonthlyBudgetValue[]> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(planKey);
  const normalizedMonthStart = normalizeMonthStartIso(monthStartIso);

  const withLockTrend = await supabase
    .from("monthly_budget_values")
    .select(
      "plan_key,month_start,category_key,monthly_budget,source,lock_trend,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("plan_key", normalizedPlanKey)
    .eq("month_start", normalizedMonthStart)
    .order("category_key", { ascending: true });

  let dataRows = (withLockTrend.data || null) as RowRecord[] | null;
  let error = withLockTrend.error;

  if (error && isMissingColumnError(error)) {
    const retry = await supabase
      .from("monthly_budget_values")
      .select(
        "plan_key,month_start,category_key,monthly_budget,source,created_at,updated_at",
      )
      .eq("user_id", userId)
      .eq("plan_key", normalizedPlanKey)
      .eq("month_start", normalizedMonthStart)
      .order("category_key", { ascending: true });
    dataRows = (retry.data || null) as RowRecord[] | null;
    error = retry.error;
  }

  if (error) throw error;
  return (dataRows || []).map(mapMonthlyValueRow);
}

export async function upsertMonthlyBudgetValue(
  input: UpsertMonthlyBudgetValueInput,
): Promise<MonthlyBudgetValue> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(input.planKey);
  const normalizedMonthStart = normalizeMonthStartIso(input.monthStartIso);
  await ensurePlanRow(normalizedPlanKey, userId);

  const nextSource = input.source === "system" ? "system" : "manual";
  const nextMonthlyBudget = asNonNegativeNumber(input.monthlyBudget, 0);
  const nextLockTrend =
    input.lockTrend == null ? null : Boolean(input.lockTrend);

  const payloadWithLockTrend = {
    user_id: userId,
    plan_key: normalizedPlanKey,
    month_start: normalizedMonthStart,
    category_key: input.categoryKey,
    monthly_budget: nextMonthlyBudget,
    source: nextSource,
    lock_trend: nextLockTrend,
    updated_at: new Date().toISOString(),
  };

  const payloadWithoutLockTrend = {
    user_id: userId,
    plan_key: normalizedPlanKey,
    month_start: normalizedMonthStart,
    category_key: input.categoryKey,
    monthly_budget: nextMonthlyBudget,
    source: nextSource,
    updated_at: new Date().toISOString(),
  };

  const withLockTrend = await supabase
    .from("monthly_budget_values")
    .upsert(payloadWithLockTrend, {
      onConflict: "user_id,plan_key,month_start,category_key",
    })
    .select(
      "plan_key,month_start,category_key,monthly_budget,source,lock_trend,created_at,updated_at",
    )
    .eq("user_id", userId)
    .single();

  let dataRow = (withLockTrend.data || null) as RowRecord | null;
  let error = withLockTrend.error;

  if (error && isMissingColumnError(error)) {
    const retry = await supabase
      .from("monthly_budget_values")
      .upsert(payloadWithoutLockTrend, {
        onConflict: "user_id,plan_key,month_start,category_key",
      })
      .select(
        "plan_key,month_start,category_key,monthly_budget,source,created_at,updated_at",
      )
      .eq("user_id", userId)
      .single();
    dataRow = (retry.data || null) as RowRecord | null;
    error = retry.error;
  }

  if (error) throw error;
  return mapMonthlyValueRow(dataRow as RowRecord);
}

export async function resetMonthlyBudgetValues(
  input: ResetMonthlyBudgetValuesInput,
): Promise<void> {
  const userId = await requireCurrentUserId();
  const normalizedPlanKey = normalizePlanKey(input.planKey);
  const normalizedMonthStart = normalizeMonthStartIso(input.monthStartIso);

  const { error } = await supabase
    .from("monthly_budget_values")
    .delete()
    .eq("user_id", userId)
    .eq("plan_key", normalizedPlanKey)
    .eq("month_start", normalizedMonthStart);

  if (error) throw error;
}
