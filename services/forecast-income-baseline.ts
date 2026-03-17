import type { BudgetPlanComputation, RecurringType } from "../types/categorization";
import { frequencyAppliesInMonth } from "./forecast-timeline";

type IncomeSourceRow = {
  expected_income: number;
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

export function resolveExpectedCashflowIncomeBaseline(params: {
  monthStart: Date;
  budgetPlan: BudgetPlanComputation | null;
  incomeSources: IncomeSourceRow[];
}) {
  const { monthStart, budgetPlan, incomeSources } = params;

  let total = 0;
  for (const source of incomeSources) {
    const anchorDate = new Date(source.last_detected_at);
    if (
      Number.isNaN(anchorDate.getTime()) ||
      !frequencyAppliesInMonth(source.income_frequency, anchorDate, monthStart)
    ) {
      continue;
    }

    total += source.expected_income;
  }

  if (total > 0) {
    return round2(total);
  }

  if (budgetPlan) {
    return Math.max(0, asNumber(budgetPlan.flowSummary.expectedIncomeMonthly, 0));
  }

  return 0;
}
