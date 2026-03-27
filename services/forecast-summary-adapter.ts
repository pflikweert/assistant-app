import {
  type ForecastCarryover,
  type ForecastCertainty,
  type ForecastMonthState,
  type ForecastMonthStatus,
  normalizeForecastCertainty,
} from "@/services/forecast-domain";
import { resolveForecastDisplayExpectedEndBalance } from "@/services/insights-remaining-month";
import {
  buildForecastCarryoverFromLatestKnownBalance,
  type LatestKnownBalanceSnapshot,
} from "@/services/latest-known-balance";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";

function resolveMonthStatus(
  summary: InsightsForecastSummary | null,
  resolvedExpectedEndOperationalBalance: number | null,
): ForecastMonthStatus {
  if (!summary) return "unknown";
  if (summary.riskFlag === "deficit_warning") return "stressed";
  if (summary.cashRiskFlag === "cash_gap_warning") return "projected";
  if (
    resolvedExpectedEndOperationalBalance == null &&
    (summary.currentOperationalBalance ?? summary.currentBalanceAnchor) == null
  ) {
    return "unknown";
  }
  if (
    summary.nextExpectedEventDate == null &&
    (summary.lowestOperationalPointInMonth ?? summary.lowestExpectedBalance) == null
  ) {
    return "observed";
  }
  return "projected";
}

function resolveCertainty(
  summary: InsightsForecastSummary | null,
  resolvedExpectedEndOperationalBalance: number | null,
): ForecastCertainty {
  if (!summary) return "estimated";
  if (resolvedExpectedEndOperationalBalance == null) {
    return "inferred";
  }
  return "committed";
}

function buildCarryoverFromSummary(
  summary: InsightsForecastSummary | null,
): ForecastCarryover | null {
  // Legacy compatibility only: this carryover is reconstructed from the
  // stored summary row until the new domain state is the only source of truth.
  const currentOperationalBalance =
    summary?.currentOperationalBalance ?? summary?.currentBalanceAnchor ?? null;
  if (!summary || currentOperationalBalance == null) return null;

  return {
    sourceMonthStart: summary.monthStart,
    targetMonthStart: summary.monthStart,
    sourceMoneyLayer: "operational",
    targetMoneyLayer: "operational",
    amount: currentOperationalBalance,
    certainty: normalizeForecastCertainty("booked"),
    sourceEventType: "correction",
    sourceLabel: summary.currentBalanceAnchorDate || null,
    reason: "Laatste bekende operationele stand",
  };
}

export function buildForecastMonthStateFromLegacySummary(
  summary: InsightsForecastSummary | null,
  budgetPlan?: BudgetPlanComputation | null,
  latestKnownBalance?: LatestKnownBalanceSnapshot | null,
): ForecastMonthState | null {
  if (!summary) return null;

  // Fallback-only bridge: derive the canonical month state from legacy rows,
  // but never let old aliases replace the operational end balance.
  const carryover =
    buildCarryoverFromSummary(summary) ||
    (latestKnownBalance
      ? buildForecastCarryoverFromLatestKnownBalance(latestKnownBalance)
      : null);
  const currentOperationalBalance =
    summary.currentOperationalBalance ?? summary.currentBalanceAnchor ?? null;
  const resolvedExpectedEndOperationalBalance =
    resolveForecastDisplayExpectedEndBalance({
      forecast: summary,
      budgetPlan: budgetPlan ?? null,
      currentBalanceOverride: currentOperationalBalance,
    });

  return {
    monthStart: summary.monthStart,
    referenceDate: summary.forecastReferenceDate,
    currentBalanceDate: summary.currentBalanceAnchorDate,
    status: resolveMonthStatus(summary, resolvedExpectedEndOperationalBalance),
    openingOperationalBalance: currentOperationalBalance,
    openingReservedBalance: summary.currentReservedBalance ?? null,
    openingNetWorth:
      summary.currentNetWorth ??
      summary.currentOperationalBalance ??
      summary.currentBalanceAnchor,
    currentBalance: currentOperationalBalance,
    reservedBalance: summary.currentReservedBalance ?? null,
    netWorth:
      summary.currentNetWorth ??
      summary.currentOperationalBalance ??
      summary.currentBalanceAnchor,
    freeToSpend: budgetPlan
      ? Math.max(
          (budgetPlan.flowSummary?.variableBudget ?? 0) -
            (budgetPlan.monthToDateExpenses?.variableCosts ?? 0),
          0,
        )
      : null,
    expectedIncome: summary.expectedIncomeTotal,
    expectedExpenses: [
      summary.expectedFixedCosts,
      summary.expectedSubscriptions,
      summary.expectedVariableCosts,
    ].reduce((total, value) => total + (value || 0), 0),
    expectedInternalTransfers: 0,
    expectedReserveAllocations: summary.remainingExpectedSavingsOutflowTotal,
    expectedEndOperationalBalance: resolvedExpectedEndOperationalBalance,
    expectedEndReservedBalance: summary.currentReservedBalance ?? null,
    expectedEndNetWorth:
      summary.expectedEndNetWorth ?? resolvedExpectedEndOperationalBalance,
    freeToSpendCarryover: budgetPlan
      ? Math.max(
          (budgetPlan.flowSummary?.variableBudget ?? 0) -
            (budgetPlan.monthToDateExpenses?.variableCosts ?? 0),
          0,
        )
      : null,
    expectedEndBalance: resolvedExpectedEndOperationalBalance,
    lowestExpectedBalance:
      summary.lowestOperationalPointInMonth ?? summary.lowestExpectedBalance,
    lowestExpectedBalanceDate: summary.lowestExpectedBalanceDate,
    nextExpectedEventDate: summary.nextExpectedEventDate,
    nextExpectedEventLabel: summary.nextExpectedEventLabel,
    expectedIncomeTotal: summary.expectedIncomeTotal,
    remainingExpectedIncomeTotal: summary.remainingExpectedIncomeTotal,
    remainingExpectedExpenseTotal: summary.remainingExpectedExpenseTotal,
    remainingExpectedSavingsOutflowTotal:
      summary.remainingExpectedSavingsOutflowTotal,
    upcomingCommittedIncomeTotal: summary.upcomingCommittedIncomeTotal,
    upcomingCommittedExpenseTotal: summary.upcomingCommittedExpenseTotal,
    expectedFixedCosts: summary.expectedFixedCosts,
    expectedSubscriptions: summary.expectedSubscriptions,
    expectedVariableCosts: summary.expectedVariableCosts,
    riskFlag: summary.riskFlag,
    cashRiskFlag: summary.cashRiskFlag,
    certainty: resolveCertainty(summary, resolvedExpectedEndOperationalBalance),
    carryover,
    events: [],
  };
}

export function adaptForecastMonthStateToLegacySummary(
  state: ForecastMonthState | null,
): InsightsForecastSummary | null {
  if (!state) return null;

  // Legacy compatibility adapter only.
  return {
    monthStart: state.monthStart,
    forecastReferenceDate: state.referenceDate,
    currentBalanceAnchor: state.currentBalance,
    currentBalanceAnchorDate: state.currentBalanceDate,
    cashRiskFlag: state.cashRiskFlag,
    riskFlag: state.riskFlag,
    expectedEndBalance: state.expectedEndBalance,
    currentOperationalBalance: state.currentBalance,
    currentReservedBalance: state.reservedBalance,
    currentNetWorth: state.netWorth,
    freeToSpendNow:
      state.currentBalance == null || state.reservedBalance == null
        ? null
        : state.currentBalance - state.reservedBalance,
    expectedEndOperationalBalance: state.expectedEndOperationalBalance,
    expectedEndNetWorth: state.expectedEndNetWorth,
    carryoverIntoNextMonth: state.expectedEndOperationalBalance,
    lowestExpectedBalance: state.lowestExpectedBalance,
    lowestOperationalPointInMonth: state.lowestExpectedBalance,
    lowestExpectedBalanceDate: state.lowestExpectedBalanceDate,
    nextExpectedEventDate: state.nextExpectedEventDate,
    nextExpectedEventLabel: state.nextExpectedEventLabel,
    expectedIncomeTotal: state.expectedIncomeTotal,
    remainingExpectedIncomeTotal: state.remainingExpectedIncomeTotal,
    remainingExpectedExpenseTotal: state.remainingExpectedExpenseTotal,
    remainingExpectedSavingsOutflowTotal:
      state.remainingExpectedSavingsOutflowTotal,
    upcomingCommittedIncomeTotal: state.upcomingCommittedIncomeTotal,
    upcomingCommittedExpenseTotal: state.upcomingCommittedExpenseTotal,
    expectedFixedCosts: state.expectedFixedCosts,
    expectedSubscriptions: state.expectedSubscriptions,
    expectedVariableCosts: state.expectedVariableCosts,
  };
}
