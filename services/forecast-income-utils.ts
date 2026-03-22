import type {
  BudgetIncomeInclusionSettings,
  BudgetPlanSettings,
  ForecastIncomeBucket,
} from "@/types/categorization";
import { resolveIncomeSemanticsForTransaction } from "./income-semantics";

const DEFAULT_INCLUDE_INCOME: BudgetIncomeInclusionSettings = {
  salary: true,
  childBudget: true,
  structuralOther: false,
  variable: false,
};

type ForecastIncomeCategoryMeta = {
  key: string;
  budget_group?: string | null;
};

type ForecastIncomeCandidate = {
  amount: number;
  details: string;
  counterparty: string | null;
  analysis_main_group: "income" | "expense" | null;
  analysis_category:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
  category_id_auto: string | null;
  category_id_user: string | null;
};

export function isForecastEligibleIncomeTransaction<
  TCategoryMeta extends ForecastIncomeCategoryMeta,
>(
  tx: ForecastIncomeCandidate,
  categoryById: Map<string, TCategoryMeta>,
) {
  if (tx.amount <= 0) return false;
  const semantics = resolveIncomeSemanticsForTransaction(tx, categoryById);
  return semantics.countsAsIncome && semantics.forecastEligible;
}

export function resolveForecastIncomeBucketFromValue(
  value: string | null | undefined,
): ForecastIncomeBucket | null {
  if (
    value === "salary" ||
    value === "childBudget" ||
    value === "structuralOther" ||
    value === "variable"
  ) {
    return value;
  }
  return null;
}

export function resolveForecastIncomeBucketForTransaction<
  TCategoryMeta extends ForecastIncomeCategoryMeta,
>(
  tx: ForecastIncomeCandidate,
  categoryById: Map<string, TCategoryMeta>,
) {
  if (tx.amount <= 0) return null;
  const semantics = resolveIncomeSemanticsForTransaction(tx, categoryById);
  if (!semantics.countsAsIncome) return null;
  return resolveForecastIncomeBucketFromValue(semantics.budgetBucket);
}

export function isIncludedForecastIncomeBucket(
  bucket: ForecastIncomeBucket | null | undefined,
  settings: Pick<BudgetPlanSettings, "includeIncome"> | null | undefined,
) {
  if (!bucket) return true;
  const includeIncome = settings?.includeIncome ?? DEFAULT_INCLUDE_INCOME;
  if (bucket === "salary") return includeIncome.salary;
  if (bucket === "childBudget") return includeIncome.childBudget;
  if (bucket === "structuralOther") return includeIncome.structuralOther;
  return includeIncome.variable;
}
