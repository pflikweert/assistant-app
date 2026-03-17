import type {
  BudgetPlanComputation,
  BudgetWeekPlanRow,
} from "@/types/categorization";

export type BudgetRiskTone = "neutral" | "good" | "watch" | "critical";
export type MonthVariableBudgetState =
  | "no_data"
  | "no_budget"
  | "within_budget"
  | "over_budget";
export type WeekBudgetState = "no_data" | "within_budget" | "over_budget";

export type MonthVariableBudgetSnapshot = {
  state: MonthVariableBudgetState;
  budget: number | null;
  spent: number | null;
  remaining: number | null;
  tone: BudgetRiskTone;
  label: string;
  progress: number;
};

export type WeekBudgetSnapshot = {
  state: WeekBudgetState;
  budget: number | null;
  spent: number | null;
  remaining: number | null;
  tone: BudgetRiskTone;
  label: string;
  progress: number;
  elapsedRatio: number | null;
  expectedSpend: number | null;
  tempoDelta: number | null;
};

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

export function getMonthVariableBudgetSnapshot(
  plan: BudgetPlanComputation | null,
): MonthVariableBudgetSnapshot {
  if (!plan) {
    return {
      state: "no_data",
      budget: null,
      spent: null,
      remaining: null,
      tone: "neutral",
      label: "Nog geen data",
      progress: 0,
    };
  }

  const budget = plan.flowSummary.variableBudget;
  const spent = plan.monthToDateExpenses.variableCosts;
  if (budget <= 0) {
    return {
      state: "no_budget",
      budget,
      spent,
      remaining: 0,
      tone: "neutral",
      label: "Nog geen variabel budget",
      progress: 0,
    };
  }

  const remaining = budget - spent;
  const tone = getMonthBudgetRiskTone(plan);

  return {
    state: remaining < 0 ? "over_budget" : "within_budget",
    budget,
    spent,
    remaining,
    tone,
    label: getMonthBudgetRiskLabel(plan),
    progress: getMonthBudgetRiskProgress(plan),
  };
}

export function getMonthVariableBudgetUsageText(
  snapshot: MonthVariableBudgetSnapshot,
  formatCurrency: Intl.NumberFormat,
  noDataLabel = "Budgetgegevens laden...",
) {
  if (snapshot.state === "no_data") {
    return noDataLabel;
  }

  if (snapshot.state === "no_budget") {
    return "Stel eerst een variabel budget in om vrije ruimte te zien.";
  }

  if (snapshot.state === "over_budget") {
    return `${formatCurrency.format(
      Math.abs(snapshot.remaining || 0),
    )} boven je variabele maandbudget van ${formatCurrency.format(
      snapshot.budget || 0,
    )}`;
  }

  return `${formatCurrency.format(
    snapshot.spent || 0,
  )} van ${formatCurrency.format(
    snapshot.budget || 0,
  )} van je variabele budget gebruikt`;
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

export function getWeekElapsedRatio(
  week: BudgetWeekPlanRow | null,
  referenceDate = new Date(),
) {
  if (!week) return null;

  const start = new Date(`${week.startDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${week.endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return null;
  }

  const totalDays = Math.max(
    Math.round((endExclusive.getTime() - start.getTime()) / 86400000),
    1,
  );
  const reference = referenceDate.getTime();
  const elapsedDays = clamp(
    Math.round((Math.min(Math.max(reference, start.getTime()), endExclusive.getTime()) - start.getTime()) / 86400000),
    0,
    totalDays,
  );

  return clamp(elapsedDays / totalDays, 0, 1);
}

export function getWeekBudgetSnapshot(
  week: BudgetWeekPlanRow | null,
  referenceDate = new Date(),
): WeekBudgetSnapshot {
  if (!week) {
    return {
      state: "no_data",
      budget: null,
      spent: null,
      remaining: null,
      tone: "neutral",
      label: "Nog geen weekdata",
      progress: 0,
      elapsedRatio: null,
      expectedSpend: null,
      tempoDelta: null,
    };
  }

  const elapsedRatio = getWeekElapsedRatio(week, referenceDate);
  const expectedSpend =
    elapsedRatio == null || week.budget <= 0 ? null : week.budget * elapsedRatio;
  const tempoDelta =
    expectedSpend == null ? null : expectedSpend - week.actual;

  return {
    state: week.remaining < 0 ? "over_budget" : "within_budget",
    budget: week.budget,
    spent: week.actual,
    remaining: week.remaining,
    tone: getBudgetRiskTone(week.utilization),
    label: getBudgetRiskLabel(week.utilization, "Nog geen weekdata"),
    progress: getBudgetRiskProgress(week.utilization),
    elapsedRatio,
    expectedSpend,
    tempoDelta,
  };
}

export function getWeekTempoMessage(
  week: BudgetWeekPlanRow | null,
  referenceDate = new Date(),
  emptyLabel = "Weektrend verschijnt zodra je budget actief is.",
) {
  const snapshot = getWeekBudgetSnapshot(week, referenceDate);
  if (snapshot.state === "no_data" || snapshot.tempoDelta == null) {
    return emptyLabel;
  }

  const delta = snapshot.tempoDelta;
  const formatEuro = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  });

  if (delta >= 15) {
    return `${formatEuro.format(delta)} onder je weektempo. Mooie buffer.`;
  }
  if (delta > 0) {
    return `${formatEuro.format(delta)} onder je weektempo. Je ligt goed op koers.`;
  }
  if (delta > -15) {
    return `${formatEuro.format(Math.abs(delta))} boven je weektempo. Nog prima bij te sturen.`;
  }
  return `${formatEuro.format(Math.abs(delta))} boven je weektempo. Kijk even waar je kunt remmen.`;
}
