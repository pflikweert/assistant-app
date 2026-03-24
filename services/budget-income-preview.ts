import type { BudgetIncomeInclusionSettings } from "@/types/categorization";

type BudgetIncomePreviewSource = {
  salary: number;
  childBudget: number;
  structuralOther: number;
  variable: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function resolveBudgetIncomePreview(
  income: BudgetIncomePreviewSource,
  includeIncome: BudgetIncomeInclusionSettings | undefined | null,
) {
  const resolvedIncludeIncome = includeIncome ?? {
    salary: true,
    childBudget: true,
    structuralOther: false,
    variable: false,
  };

  const structural = round2(
    (resolvedIncludeIncome.salary ? income.salary : 0) +
      (resolvedIncludeIncome.childBudget ? income.childBudget : 0) +
      (resolvedIncludeIncome.structuralOther ? income.structuralOther : 0),
  );
  const variable = resolvedIncludeIncome.variable ? round2(income.variable) : 0;

  return {
    total: round2(structural + variable),
    structural,
    variable,
  };
}
