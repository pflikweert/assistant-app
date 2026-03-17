import { resolveIncomeSemanticsForTransaction } from "./income-semantics";

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
  if (tx.analysis_main_group !== "income") return false;
  if (
    tx.analysis_category !== "income_structural" &&
    tx.analysis_category !== "income_variable"
  ) {
    return false;
  }

  return resolveIncomeSemanticsForTransaction(tx, categoryById).forecastEligible;
}
