import { resolveBudgetIncomePreview } from "@/services/budget-income-preview";
import { isIncludedForecastIncomeBucket } from "@/services/forecast-income-utils";
import type {
  BudgetPlanComputation,
  ForecastIncomeBucket,
  RecurringType,
} from "../types/categorization";
import { frequencyAppliesInMonth } from "./forecast-timeline";

type IncomeSourceRow = {
  expected_income: number;
  income_bucket?: ForecastIncomeBucket | null;
  income_frequency: RecurringType;
  last_detected_at: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type IncomeBaselineBreakdown = {
  total: number;
  structural: number;
  variable: number;
};

function emptyIncomeBaselineBreakdown(): IncomeBaselineBreakdown {
  return {
    total: 0,
    structural: 0,
    variable: 0,
  };
}

function resolveBudgetPlanIncomeBaseline(
  budgetPlan: BudgetPlanComputation | null,
): IncomeBaselineBreakdown {
  if (!budgetPlan) return emptyIncomeBaselineBreakdown();
  if (!(budgetPlan as { trend?: { income?: unknown } }).trend?.income) {
    return {
      total: Math.max(0, asNumber(budgetPlan.flowSummary?.expectedIncomeMonthly, 0)),
      structural: 0,
      variable: 0,
    };
  }
  const preview = resolveBudgetIncomePreview(
    budgetPlan.trend.income,
    budgetPlan.settings.includeIncome,
  );

  return {
    total: Math.max(0, round2(preview.total)),
    structural: Math.max(0, round2(preview.structural)),
    variable: Math.max(0, round2(preview.variable)),
  };
}

export function resolveExpectedCashflowIncomeBaselineBreakdown(params: {
  monthStart: Date;
  budgetPlan: BudgetPlanComputation | null;
  incomeSources: IncomeSourceRow[];
}): IncomeBaselineBreakdown {
  const { monthStart, budgetPlan, incomeSources } = params;
  const preferredSource = budgetPlan?.settings?.forecastExpenseSource || "trend";
  const budgetPlanBaseline = resolveBudgetPlanIncomeBaseline(budgetPlan);

  if (budgetPlanBaseline.total > 0) {
    return budgetPlanBaseline;
  }

  if (preferredSource === "budget_settings" && budgetPlan) {
    return budgetPlanBaseline;
  }

  let total = 0;
  let structural = 0;
  let variable = 0;
  for (const source of incomeSources) {
    const anchorDate = new Date(source.last_detected_at);
    if (
      Number.isNaN(anchorDate.getTime()) ||
      !frequencyAppliesInMonth(source.income_frequency, anchorDate, monthStart)
    ) {
      continue;
    }

    if (
      !isIncludedForecastIncomeBucket(
        source.income_bucket,
        budgetPlan?.settings || null,
      )
    ) {
      continue;
    }

    total += source.expected_income;
    if (source.income_bucket === "variable") {
      variable += source.expected_income;
      continue;
    }
    if (source.income_bucket) {
      structural += source.expected_income;
    }
  }

  if (total > 0) {
    return {
      total: round2(total),
      structural: round2(structural),
      variable: round2(variable),
    };
  }

  if (budgetPlan) {
    return {
      total: Math.max(
        0,
        asNumber(budgetPlan.flowSummary.expectedIncomeMonthly, 0),
      ),
      structural: budgetPlanBaseline.structural,
      variable: budgetPlanBaseline.variable,
    };
  }

  return emptyIncomeBaselineBreakdown();
}

export function resolveExpectedCashflowIncomeBaseline(params: {
  monthStart: Date;
  budgetPlan: BudgetPlanComputation | null;
  incomeSources: IncomeSourceRow[];
}) {
  return resolveExpectedCashflowIncomeBaselineBreakdown(params).total;
}
