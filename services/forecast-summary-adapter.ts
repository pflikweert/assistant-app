import {
  type ForecastCarryover,
  type ForecastCertainty,
  type ForecastMonthState,
  type ForecastMonthStatus,
  normalizeForecastCertainty,
} from "@/services/forecast-domain";
import {
  buildForecastCarryoverFromLatestKnownBalance,
  type LatestKnownBalanceSnapshot,
} from "@/services/latest-known-balance";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";

function resolveMonthStatus(
  summary: InsightsForecastSummary | null,
): ForecastMonthStatus {
  if (!summary) return "unknown";
  if (summary.riskFlag === "deficit_warning") return "stressed";
  if (summary.cashRiskFlag === "cash_gap_warning") return "projected";
  if (
    summary.expectedEndBalance == null &&
    summary.currentBalanceAnchor == null
  ) {
    return "unknown";
  }
  if (summary.nextExpectedEventDate == null && summary.lowestExpectedBalance == null) {
    return "observed";
  }
  return "projected";
}

function resolveCertainty(summary: InsightsForecastSummary | null): ForecastCertainty {
  if (!summary) return "low";
  if (summary.expectedEndBalance == null) return "medium";
  return "high";
}

function buildCarryoverFromSummary(
  summary: InsightsForecastSummary | null,
): ForecastCarryover | null {
  if (!summary || summary.currentBalanceAnchor == null) return null;

  return {
    sourceMonthStart: summary.monthStart,
    targetMonthStart: summary.monthStart,
    sourceMoneyLayer: "operational",
    targetMoneyLayer: "operational",
    amount: summary.currentBalanceAnchor,
    certainty: normalizeForecastCertainty("high"),
    sourceEventType: "correction",
    sourceLabel: summary.currentBalanceAnchorDate || null,
    reason: "Laatste bekende saldo",
  };
}

export function buildForecastMonthStateFromLegacySummary(
  summary: InsightsForecastSummary | null,
  budgetPlan?: BudgetPlanComputation | null,
  latestKnownBalance?: LatestKnownBalanceSnapshot | null,
): ForecastMonthState | null {
  if (!summary) return null;

  const carryover =
    buildCarryoverFromSummary(summary) ||
    (latestKnownBalance
      ? buildForecastCarryoverFromLatestKnownBalance(latestKnownBalance)
      : null);

  return {
    monthStart: summary.monthStart,
    referenceDate: summary.forecastReferenceDate,
    currentBalanceDate: summary.currentBalanceAnchorDate,
    status: resolveMonthStatus(summary),
    currentBalance: summary.currentBalanceAnchor,
    reservedBalance: null,
    netWorth: null,
    freeToSpend: budgetPlan
      ? Math.max(
          (budgetPlan.flowSummary?.variableBudget ?? 0) -
            (budgetPlan.monthToDateExpenses?.variableCosts ?? 0),
          0,
        )
      : null,
    expectedEndBalance: summary.expectedEndBalance,
    lowestExpectedBalance: summary.lowestExpectedBalance,
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
    certainty: resolveCertainty(summary),
    carryover,
    events: [],
  };
}

export function adaptForecastMonthStateToLegacySummary(
  state: ForecastMonthState | null,
): InsightsForecastSummary | null {
  if (!state) return null;

  return {
    monthStart: state.monthStart,
    forecastReferenceDate: state.referenceDate,
    currentBalanceAnchor: state.currentBalance,
    currentBalanceAnchorDate: state.currentBalanceDate,
    cashRiskFlag: state.cashRiskFlag,
    riskFlag: state.riskFlag,
    expectedEndBalance: state.expectedEndBalance,
    lowestExpectedBalance: state.lowestExpectedBalance,
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
