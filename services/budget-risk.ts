import type { BudgetPlanComputation } from "@/types/categorization";

export type BudgetRiskTone = "neutral" | "good" | "watch" | "critical";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getBudgetRiskTone(utilization: number | null) {
  if (utilization == null || !Number.isFinite(utilization)) {
    return "neutral" as const;
  }
  if (utilization < 0.8) return "good" as const;
  if (utilization < 1) return "watch" as const;
  return "critical" as const;
}

export function getBudgetRiskLabel(
  utilization: number | null,
  emptyLabel = "Nog geen data",
) {
  const tone = getBudgetRiskTone(utilization);
  if (tone === "good") return "Op schema";
  if (tone === "watch") return "Let op";
  if (tone === "critical") return "Boven tempo";
  return emptyLabel;
}

export function getBudgetRiskProgress(utilization: number | null) {
  if (utilization == null || !Number.isFinite(utilization)) return 0;
  return clamp(utilization, 0, 1);
}

export function getMonthBudgetRiskTone(plan: BudgetPlanComputation | null) {
  if (!plan || plan.flowSummary.variableBudget <= 0) {
    return "neutral" as const;
  }

  const variableSpent = plan.monthToDateExpenses.variableCosts;
  const variableBudget = plan.flowSummary.variableBudget;
  if (variableSpent > variableBudget) return "critical" as const;

  const utilization = variableSpent / variableBudget;
  const paceDelta = utilization - plan.monthProgress;

  if (paceDelta <= 0.05) return "good" as const;
  if (paceDelta <= 0.15) return "watch" as const;
  return "critical" as const;
}

export function getMonthBudgetRiskLabel(
  plan: BudgetPlanComputation | null,
  emptyLabel = "Nog geen data",
) {
  const tone = getMonthBudgetRiskTone(plan);
  if (tone === "good") return "Op schema";
  if (tone === "watch") return "Let op";
  if (tone === "critical") return "Boven tempo";
  return emptyLabel;
}

export function getMonthBudgetRiskProgress(plan: BudgetPlanComputation | null) {
  if (!plan || plan.flowSummary.variableBudget <= 0) return 0;
  return clamp(
    plan.monthToDateExpenses.variableCosts /
      Math.max(plan.flowSummary.variableBudget, 1),
    0,
    1,
  );
}
