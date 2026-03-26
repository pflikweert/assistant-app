import { allocateIntegerBudget } from "@/services/budget-lock-utils";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type {
  BudgetPlanComputation,
  BudgetWeekBudgetBreakdown,
  BudgetWeekPlanRow,
} from "@/types/categorization";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundEuro(value: number) {
  return Math.round(value);
}

function startOfMonthIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function resolveHeadroomReference(plan: BudgetPlanComputation) {
  const savingsTarget = roundEuro(
    Math.max(plan.flowSummary.appliedSavingsTarget || 0, 0),
  );
  if (savingsTarget > 0) return savingsTarget;
  return roundEuro(Math.max(plan.flowSummary.variableBudget || 0, 0));
}

function resolveAvailableHeadroom(
  plan: BudgetPlanComputation,
  forecast: InsightsForecastSummary | null,
) {
  if (forecast?.expectedEndBalance != null) {
    return Math.max(roundEuro(forecast.expectedEndBalance), 0);
  }
  return Math.max(roundEuro(plan.projectedMonthNet || 0), 0);
}

function resolveAdjustedBreakdown(params: {
  breakdown: BudgetWeekBudgetBreakdown;
  targetBudget: number;
  plan: BudgetPlanComputation;
}) {
  const { breakdown, targetBudget, plan } = params;
  const currentAmounts = breakdown.categories.map((category) =>
    Math.max(category.amount, 0),
  );
  const currentTotal = currentAmounts.reduce((sum, amount) => sum + amount, 0);
  const fallbackWeights = breakdown.categories.map((category) => {
    const matchingRecommendation = plan.recommendations.find(
      (row) => row.categoryKey === category.key,
    );
    return Math.max(matchingRecommendation?.monthlyBudget || 0, 0);
  });
  const weights = currentTotal > 0 ? currentAmounts : fallbackWeights;
  const allocations = allocateIntegerBudget(targetBudget, weights);

  return {
    ...breakdown,
    categories: breakdown.categories.map((category, index) => ({
      ...category,
      amount: allocations[index] || 0,
    })),
  };
}

function resolveRawRebalanceMode(row: BudgetWeekPlanRow) {
  if (row.rebalanceMode === "guarded") return "guarded" as const;
  if (row.wasRebalanced) return "hard" as const;
  return "none" as const;
}

export function applyBudgetWeekRebalanceGuardrails(params: {
  plan: BudgetPlanComputation;
  forecast: InsightsForecastSummary | null;
  now?: Date;
}): BudgetPlanComputation {
  const { plan, forecast, now = new Date() } = params;
  const currentMonthStartIso = startOfMonthIso(now);

  if (plan.monthStart < currentMonthStartIso) {
    return plan;
  }

  const hasPastOverrun = plan.weeklyVariablePlan.some(
    (row) => row.isPastWeek && row.overrunAmount > 0,
  );
  if (!hasPastOverrun) {
    return plan;
  }

  if (
    forecast?.expectedEndBalance != null &&
    forecast.expectedEndBalance < 0
  ) {
    return plan;
  }

  const headroomReference = resolveHeadroomReference(plan);
  const availableHeadroom = resolveAvailableHeadroom(plan, forecast);
  const headroomRatio =
    headroomReference > 0
      ? clamp(
          Math.min(availableHeadroom, headroomReference) / headroomReference,
          0,
          1,
        )
      : 0;
  const floorRatio = 0.5 + 0.2 * headroomRatio;
  const softBuffer =
    headroomReference > 0
      ? Math.min(Math.max(availableHeadroom, 0), headroomReference)
      : 0;

  const liftCandidates = plan.weeklyVariablePlan.map((row) => {
    if (row.isPastWeek) {
      return {
        weekFloor: null,
        neededLift: 0,
      };
    }

    const weekFloor = roundEuro(Math.max(row.baseBudget, 0) * floorRatio);
    const neededLift = Math.max(weekFloor - row.budget, 0);
    return {
      weekFloor,
      neededLift,
    };
  });

  const totalNeededLift = liftCandidates.reduce(
    (sum, item) => sum + item.neededLift,
    0,
  );
  if (totalNeededLift <= 0 || softBuffer <= 0) {
    return plan;
  }

  const liftBudget = Math.min(roundEuro(totalNeededLift), roundEuro(softBuffer));
  const liftAllocations = allocateIntegerBudget(
    liftBudget,
    liftCandidates.map((item) => item.neededLift),
  );

  let hasGuardedWeek = false;
  const nextWeeklyVariablePlan = plan.weeklyVariablePlan.map((row, index) => {
    const candidate = liftCandidates[index];
    const guardrailBudgetFloor = candidate.weekFloor;
    const lift = liftAllocations[index] || 0;
    const budget = row.budget + lift;
    const remaining = roundEuro(budget - row.actual);
    const utilization =
      budget > 0 ? row.actual / budget : row.actual > 0 ? Number.POSITIVE_INFINITY : 0;
    const wasRebalanced =
      row.wasRebalanced || Math.abs(budget - row.baseBudget) >= 1;
    const rebalanceMode =
      lift > 0
        ? "guarded"
        : resolveRawRebalanceMode({
            ...row,
            wasRebalanced,
          } as BudgetWeekPlanRow);

    if (lift > 0) {
      hasGuardedWeek = true;
    }

    return {
      ...row,
      budget,
      guardrailBudgetFloor,
      remaining,
      utilization,
      wasRebalanced,
      rebalanceMode,
    };
  });

  if (!hasGuardedWeek) {
    return plan;
  }

  const nextWeeklyBudgetBreakdown = plan.weeklyBudgetBreakdown.map(
    (breakdown, index) => {
      const nextWeek = nextWeeklyVariablePlan[index];
      if (!nextWeek) return breakdown;
      if (nextWeek.budget === plan.weeklyVariablePlan[index]?.budget) {
        return breakdown;
      }
      return resolveAdjustedBreakdown({
        breakdown,
        targetBudget: nextWeek.budget,
        plan,
      });
    },
  );

  const nextWarnings = plan.warnings.map((warning) => {
    if (
      warning.categoryKey !== "variable_costs" ||
      !warning.message.includes("Resterende weken zijn herverdeeld.")
    ) {
      return warning;
    }

    return {
      ...warning,
      message: warning.message.replace(
        "Resterende weken zijn herverdeeld.",
        "Resterende weken zijn deels herverdeeld, maar je maand heeft nog ruimte.",
      ),
    };
  });

  return {
    ...plan,
    warnings: nextWarnings,
    weeklyVariablePlan: nextWeeklyVariablePlan,
    weeklyBudgetBreakdown: nextWeeklyBudgetBreakdown,
  };
}
