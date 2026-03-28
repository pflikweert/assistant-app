import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { resolveForecastDisplayExpectedEndBalance } from "@/services/insights-remaining-month";
import type { ReserveSurfaceBreakdown } from "@/services/reserve-surface";
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
    | "derived"
    | "zero"
    | "value"
    | "not_configured"
    | "not_modeled_yet"
    | "unavailable";
};

export type FinancialBalanceSnapshot = Record<
  FinancialBalanceDimension,
  FinancialBalanceValue
>;

export type FinancialSurfaceBalanceSnapshot = FinancialBalanceSnapshot & {
  currentOperationalBalance: FinancialBalanceValue;
  currentReservedBalance: FinancialBalanceValue;
  currentNetWorth: FinancialBalanceValue;
  freeToSpendNow: FinancialBalanceValue;
  expectedEndOperationalBalance: FinancialBalanceValue;
  expectedEndNetWorth: FinancialBalanceValue;
  carryoverIntoNextMonth: FinancialBalanceValue;
  lowestOperationalPointInMonth: FinancialBalanceValue;
};

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

function resolveReservedBalanceValue(forecast: InsightsForecastSummary | null) {
  if (!forecast) {
    return {
      amount: null as number | null,
      source: "unavailable" as const,
    };
  }

  if (forecast.currentReservedBalance == null) {
    return {
      amount: null as number | null,
      source: "not_configured" as const,
    };
  }

  if (forecast.currentReservedBalance === 0) {
    return {
      amount: 0 as number,
      source: "zero" as const,
    };
  }

  return {
    amount: round2(forecast.currentReservedBalance),
    source: "value" as const,
  };
}

export function buildFinancialBalanceSnapshot(params: {
  forecast: InsightsForecastSummary | null;
  plan: BudgetPlanComputation | null;
  currentBalanceOverride?: number | null;
  reserveSurface?: ReserveSurfaceBreakdown | null;
}): FinancialSurfaceBalanceSnapshot {
  const { forecast, plan, currentBalanceOverride, reserveSurface } = params;

  const operationalBalance =
    currentBalanceOverride ??
    forecast?.currentOperationalBalance ??
    forecast?.currentBalanceAnchor ??
    null;
  const reserveSurfaceTotal =
    reserveSurface?.reservedInAccountsNow == null &&
    reserveSurface?.reservedProtectedInOperationalNow == null
      ? null
      : round2(
          Math.max(reserveSurface?.reservedInAccountsNow ?? 0, 0) +
            Math.max(reserveSurface?.reservedProtectedInOperationalNow ?? 0, 0),
        );
  const reservedBalance =
    reserveSurface?.source === "modeled"
      ? reserveSurfaceTotal == null
        ? { amount: null as number | null, source: "not_configured" as const }
        : reserveSurfaceTotal === 0
          ? { amount: 0 as number, source: "zero" as const }
          : { amount: reserveSurfaceTotal, source: "derived" as const }
      : resolveReservedBalanceValue(forecast);
  const netWorth = forecast?.currentNetWorth ?? null;
  // freeToSpendNow is the operational room after reserved money.
  // It is intentionally separate from month budget and week budget:
  // those come from the budget surface, while this field is only about
  // what remains in the current operational layer right now.
  const protectedOperationalReserve =
    reserveSurface?.reservedProtectedInOperationalNow == null
      ? null
      : round2(Math.max(reserveSurface.reservedProtectedInOperationalNow, 0));
  const hasModeledReserveSurface = reserveSurface?.source === "modeled";
  const effectiveProtectedOperationalReserve =
    hasModeledReserveSurface && operationalBalance != null
      ? Math.max(protectedOperationalReserve ?? 0, 0)
      : protectedOperationalReserve;
  const freeToSpendNow =
    effectiveProtectedOperationalReserve == null && reservedBalance.amount == null
      ? null
      : currentBalanceOverride != null
        ? round2(
            currentBalanceOverride -
              (effectiveProtectedOperationalReserve ??
                Math.max(reservedBalance.amount || 0, 0)),
          )
        : effectiveProtectedOperationalReserve != null && operationalBalance != null
          ? round2(operationalBalance - effectiveProtectedOperationalReserve)
        : forecast?.freeToSpendNow != null
        ? forecast.freeToSpendNow
        : operationalBalance == null
          ? null
          : round2(operationalBalance - Math.max(reservedBalance.amount || 0, 0));
  const expectedEndOperationalBalance = resolveForecastDisplayExpectedEndBalance({
    forecast,
    budgetPlan: plan,
    currentBalanceOverride: operationalBalance,
  });
  const expectedEndNetWorth =
    forecast?.expectedEndNetWorth ?? expectedEndOperationalBalance;
  const carryoverIntoNextMonth =
    forecast?.carryoverIntoNextMonth ?? expectedEndOperationalBalance;
  // Lowest operational point is the month minimum, not the month-end balance.
  // Keep it on a separate surface field so dashboards cannot substitute it
  // for the headline operational forecast.
  const lowestOperationalPointInMonth =
    forecast?.lowestOperationalPointInMonth ?? forecast?.lowestExpectedBalance ?? null;

  const freeToSpend =
    plan == null
      ? null
      : round2(
          (plan.flowSummary?.variableBudget ?? 0) -
            (plan.monthToDateExpenses?.variableCosts ?? 0),
        );

  return {
    operationalBalance: {
      amount: operationalBalance == null ? null : round2(operationalBalance),
      source: operationalBalance == null ? "unavailable" : "forecast_anchor",
    },
    reservedBalance: {
      amount: reservedBalance.amount,
      source: reservedBalance.source,
    },
    netWorth: {
      amount: netWorth == null ? null : round2(netWorth),
      source: netWorth == null ? "not_modeled_yet" : "forecast_anchor",
    },
    freeToSpend: {
      amount: freeToSpend,
      source: freeToSpend == null ? "unavailable" : "budget_remaining",
    },
    currentOperationalBalance: {
      amount: operationalBalance == null ? null : round2(operationalBalance),
      source: operationalBalance == null ? "unavailable" : "forecast_anchor",
    },
    currentReservedBalance: {
      amount: reservedBalance.amount,
      source: reservedBalance.source,
    },
    currentNetWorth: {
      amount: netWorth == null ? null : round2(netWorth),
      source: netWorth == null ? "not_modeled_yet" : "forecast_anchor",
    },
    freeToSpendNow: {
      amount: freeToSpendNow == null ? null : round2(freeToSpendNow),
      source:
        freeToSpendNow == null
          ? "unavailable"
          : currentBalanceOverride != null
            ? "derived"
            : hasModeledReserveSurface
              ? "derived"
            : forecast?.freeToSpendNow != null
            ? "forecast_anchor"
            : "derived",
    },
    expectedEndOperationalBalance: {
      amount:
        expectedEndOperationalBalance == null
          ? null
          : round2(expectedEndOperationalBalance),
      source:
        expectedEndOperationalBalance == null
          ? "unavailable"
          : "forecast_anchor",
    },
    expectedEndNetWorth: {
      amount:
        expectedEndNetWorth == null ? null : round2(expectedEndNetWorth),
      source:
        expectedEndNetWorth == null ? "unavailable" : "forecast_anchor",
    },
    carryoverIntoNextMonth: {
      amount:
        carryoverIntoNextMonth == null ? null : round2(carryoverIntoNextMonth),
      source:
        carryoverIntoNextMonth == null ? "unavailable" : "forecast_anchor",
    },
    lowestOperationalPointInMonth: {
      amount:
        lowestOperationalPointInMonth == null
          ? null
          : round2(lowestOperationalPointInMonth),
      source:
        lowestOperationalPointInMonth == null
          ? "unavailable"
          : "forecast_anchor",
    },
  };
}
