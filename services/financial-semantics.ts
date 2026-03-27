import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type {
  AnalysisCategory,
  AnalysisMainGroup,
  BudgetPlanComputation,
} from "@/types/categorization";

export type FinancialBalanceDimension =
  | "operationalBalance"
  | "reservedBalance"
  | "netWorth"
  | "freeToSpend";

export type FinancialBalanceValue = {
  amount: number | null;
  source:
    | "forecast_anchor"
    | "budget_remaining"
    | "not_modeled_yet"
    | "unavailable";
};

export type FinancialBalanceSnapshot = Record<
  FinancialBalanceDimension,
  FinancialBalanceValue
>;

export type FinancialScopeState = {
  budget: boolean;
  forecast: boolean;
  netWorth: boolean;
  freeToSpend: boolean;
  operationalBalance: boolean;
  reservedBalance: boolean;
};

type FinancialSemantics<T> = {
  explicit: T;
  legacy: T;
};

export type FinancialAccountScopeInput = {
  includeInBudget: boolean;
};

export type FinancialTransactionScopeInput = {
  budgetExcluded: boolean;
  analysisMainGroup?: AnalysisMainGroup | null;
  analysisCategory?: AnalysisCategory | null;
};

function isSavingsTransfer(
  analysisMainGroup?: AnalysisMainGroup | null,
  analysisCategory?: AnalysisCategory | null,
) {
  return (
    analysisMainGroup === "expense" && analysisCategory === "savings_transfer"
  );
}

export function resolveFinancialAccountScopeState(
  input: FinancialAccountScopeInput,
): FinancialSemantics<FinancialScopeState> {
  const includeInBudget = input.includeInBudget !== false;

  return {
    explicit: {
      budget: includeInBudget,
      forecast: true,
      netWorth: true,
      freeToSpend: includeInBudget,
      operationalBalance: true,
      reservedBalance: true,
    },
    legacy: {
      budget: includeInBudget,
      forecast: includeInBudget,
      netWorth: includeInBudget,
      freeToSpend: includeInBudget,
      operationalBalance: includeInBudget,
      reservedBalance: includeInBudget,
    },
  };
}

export function resolveFinancialTransactionScopeState(
  input: FinancialTransactionScopeInput,
): FinancialSemantics<FinancialScopeState> {
  const includeInBudget = input.budgetExcluded !== true;
  const savingsTransfer = isSavingsTransfer(
    input.analysisMainGroup,
    input.analysisCategory,
  );

  return {
    explicit: {
      budget: includeInBudget,
      forecast: true,
      netWorth: !savingsTransfer,
      freeToSpend: includeInBudget,
      operationalBalance: true,
      reservedBalance: savingsTransfer,
    },
    legacy: {
      budget: includeInBudget,
      forecast: includeInBudget,
      netWorth: includeInBudget,
      freeToSpend: includeInBudget,
      operationalBalance: includeInBudget,
      reservedBalance: includeInBudget && savingsTransfer,
    },
  };
}

export function isBankAccountIncludedInLegacyBudgetScope(
  includeInBudget: boolean,
) {
  return resolveFinancialAccountScopeState({ includeInBudget }).legacy.budget;
}

export function isBankAccountIncludedInLegacyForecastScope(
  includeInBudget: boolean,
) {
  return resolveFinancialAccountScopeState({ includeInBudget }).legacy.forecast;
}

export function isTransactionIncludedInLegacyBudgetScope(
  input: FinancialTransactionScopeInput,
) {
  return resolveFinancialTransactionScopeState(input).legacy.budget;
}

export function isTransactionExcludedFromLegacyBudgetScope(
  input: FinancialTransactionScopeInput,
) {
  return !isTransactionIncludedInLegacyBudgetScope(input);
}

export function isTransactionIncludedInLegacyForecastScope(
  input: FinancialTransactionScopeInput,
) {
  return resolveFinancialTransactionScopeState(input).legacy.forecast;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildFinancialBalanceSnapshot(params: {
  forecast: InsightsForecastSummary | null;
  plan: BudgetPlanComputation | null;
}): FinancialBalanceSnapshot {
  const { forecast, plan } = params;

  const operationalBalance =
    forecast?.currentBalanceAnchor == null
      ? null
      : round2(forecast.currentBalanceAnchor);

  const freeToSpend =
    plan == null
      ? null
      : round2(
          (plan.flowSummary?.variableBudget ?? 0) -
            (plan.monthToDateExpenses?.variableCosts ?? 0),
        );

  return {
    operationalBalance: {
      amount: operationalBalance,
      source:
        operationalBalance == null ? "unavailable" : "forecast_anchor",
    },
    reservedBalance: {
      amount: null,
      source: "not_modeled_yet",
    },
    netWorth: {
      amount: null,
      source: "not_modeled_yet",
    },
    freeToSpend: {
      amount: freeToSpend,
      source: freeToSpend == null ? "unavailable" : "budget_remaining",
    },
  };
}
