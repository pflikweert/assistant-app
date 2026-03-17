import type { BudgetForecastExpenseSource } from "@/types/categorization";

export const FORECAST_EXPENSE_SOURCE_OPTIONS: {
  value: BudgetForecastExpenseSource;
  label: string;
  description: string;
}[] = [
  {
    value: "trend",
    label: "Trend",
    description: "Volgt je recente maandritme voor toekomstige uitgaven.",
  },
  {
    value: "budget_settings",
    label: "Budgetplan",
    description:
      "Volgt je ingestelde budgetten voor vaste lasten, variabel en sparen.",
  },
];

export function formatForecastExpenseSourceLabel(
  source: BudgetForecastExpenseSource,
) {
  return source === "budget_settings" ? "Budgetplan" : "Trend";
}

export function getForecastExpenseSourceDescription(
  source: BudgetForecastExpenseSource,
) {
  return source === "budget_settings"
    ? "Toekomstige uitgaven volgen je budgetinstellingen."
    : "Toekomstige uitgaven volgen je recente uitgaventrend.";
}
