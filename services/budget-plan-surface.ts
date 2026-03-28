import { computeBudgetPlan } from "@/services/budget-plan";
import { applyBudgetWeekRebalanceGuardrails } from "@/services/budget-week-guardrails";
import { getMonthVariableBudgetSnapshot } from "@/services/budget-risk";
import {
  buildForecastSurfaceConfidence,
  type ForecastSurfaceConfidence,
} from "@/services/confidence-model";
import {
  buildForecastSurfaceExplainability,
  type ForecastSurfaceExplainability,
} from "@/services/explainability";
import {
  buildConfidenceLayerMetadata,
  type ConfidenceLayerMetadata,
} from "@/services/explain-logic";
import {
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";
import { loadMoneyViewScopePreference } from "@/services/finance-scope-preference";
import {
  buildFinancialBalanceSnapshot,
  type FinancialSurfaceBalanceSnapshot,
} from "@/services/financial-semantics";
import { loadReserveSurfaceBreakdown, type ReserveSurfaceBreakdown } from "@/services/reserve-surface";
import {
  buildSafetySpendWindowSummary,
  type SafetySpendWindowSummary,
} from "@/services/safety-spend-window";
import { resolveSafetyContextCopy } from "@/services/financial-surface-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import {
  loadLatestKnownBalanceSnapshot,
  loadLatestKnownNetWorthSnapshot,
} from "@/services/latest-known-balance";
import { loadMonthForecastSummary } from "@/services/month-forecast-summary";
import type { BudgetPlanComputation } from "@/types/categorization";

// Canonical surface contract shared by Dashboard, Insights and Budget.
export type ForecastSurfaceSummary = {
  scopeView: MoneyViewScope;
  plan: BudgetPlanComputation;
  forecast: InsightsForecastSummary | null;
  balances: FinancialSurfaceBalanceSnapshot;
  // Canonical reserve contract for surface consumers.
  reserveBreakdown: ReserveSurfaceBreakdown | null;
  confidence: ForecastSurfaceConfidence;
  explainability: ForecastSurfaceExplainability;
  safeToSpendUntilNextIncome: number | null;
  projectedNetUntilNextIncome: number | null;
  nextIncomeDateAnchor: string | null;
  nextIncomeLabelAnchor: string | null;
  nextIncomeAmountAnchor: number | null;
  nextIncomeAmountAnchorMeta: SafetySpendWindowSummary["nextIncomeAmountAnchorMeta"];
  safeToSpendAnchorType:
    | "configured"
    | "recurring_semantic"
    | "significant_fallback"
    | "summary_fallback"
    | "fallback_end_next_month"
    | "none";
  safeToSpendIsEstimatedAnchorDate: boolean;
  knownUpcomingFixedCostsUntilAnchor: number | null;
  knownUpcomingSubscriptionsUntilAnchor: number | null;
  safeToSpendLabel: string;
  safeToSpendSubtitle: string;
  bridgeCrossMonthCostsUntilIncome: number | null;
  safeToSpendExplanation: string | null;
  safeToSpendExplanationParts: SafetySpendWindowSummary["safeToSpendExplanationParts"];
  safeToSpendConfidenceScore: SafetySpendWindowSummary["safeToSpendConfidenceScore"];
  confidenceLayer: ConfidenceLayerMetadata;
  // Deprecated alias for temporary backward compatibility in older callers.
  reserve: ReserveSurfaceBreakdown | null;
};

function startOfMonthIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export async function loadBudgetPlanForSurface(params: {
  referenceDate: Date;
  planKey?: string;
  timelineReference?: Date;
  forecastReason?: string;
  forecastSummary?: InsightsForecastSummary | null;
  currentBalanceOverride?: number | null;
  moneyViewScope?: MoneyViewScope;
  userId?: string;
}): Promise<ForecastSurfaceSummary> {
  const {
    referenceDate,
    planKey = "default",
    timelineReference = new Date(),
    forecastReason,
    forecastSummary,
    currentBalanceOverride,
    moneyViewScope,
    userId,
  } = params;

  const monthStartIso = startOfMonthIso(referenceDate);
  const resolvedUserId = userId || undefined;
  const scopePreference =
    moneyViewScope != null
      ? { scopeView: moneyViewScope }
      : await loadMoneyViewScopePreference(resolvedUserId).catch(() => ({
          scopeView: "personal" as MoneyViewScope,
        }));
  const resolvedMoneyViewScope = normalizeMoneyViewScope(
    scopePreference.scopeView,
  );
  const [latestKnownBalance, latestKnownNetWorth] = await Promise.all([
    currentBalanceOverride != null
      ? Promise.resolve({ balance: currentBalanceOverride, date: null })
      : loadLatestKnownBalanceSnapshot(
          resolvedUserId,
          resolvedMoneyViewScope,
        ).catch(() => ({ balance: null, date: null })),
    loadLatestKnownNetWorthSnapshot(
      resolvedUserId,
      resolvedMoneyViewScope,
    ).catch(() => ({ balance: null, date: null })),
  ]);

  const [rawPlan, loadedForecast] = await Promise.all([
    computeBudgetPlan(
      referenceDate,
      planKey,
      timelineReference,
      resolvedMoneyViewScope,
    ),
    forecastSummary === undefined
      ? loadMonthForecastSummary({
          monthStartIso,
          referenceDate,
          reason: forecastReason,
          moneyViewScope: resolvedMoneyViewScope,
          userId,
        })
      : Promise.resolve(forecastSummary),
  ]);

  const plan = applyBudgetWeekRebalanceGuardrails({
      plan: rawPlan,
      forecast: loadedForecast,
      now: timelineReference,
    });
  const reserveBreakdown = await loadReserveSurfaceBreakdown({
    userId: resolvedUserId,
    moneyViewScope: resolvedMoneyViewScope,
    budgetPlan: plan,
  }).catch(() => null);
  const balances = buildFinancialBalanceSnapshot({
    forecast: loadedForecast,
    plan,
    currentBalanceOverride: latestKnownBalance.balance,
    currentNetWorthOverride: latestKnownNetWorth.balance,
    reserveSurface: reserveBreakdown,
  });
  const confidence = buildForecastSurfaceConfidence({
    forecast: loadedForecast,
    plan,
    balances,
    reserveBreakdown,
  });
  const explainability = buildForecastSurfaceExplainability({
    balances,
    reserveBreakdown,
    confidence,
  });
  const monthSnapshot = getMonthVariableBudgetSnapshot(plan);
  const safetyWindow =
    resolvedUserId == null
      ? {
          safeToSpendUntilNextIncome: null,
          projectedNetUntilNextIncome: null,
          nextIncomeDateAnchor: null,
          nextIncomeLabelAnchor: null,
          nextIncomeAmountAnchor: null,
          nextIncomeAmountAnchorMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "surface_fallback",
            dataGapReason: "surface_not_loaded",
          },
          anchorType: "none" as const,
          isEstimatedAnchorDate: true,
          bridgeCrossMonthCostsUntilIncome: null,
          knownUpcomingFixedCostsUntilAnchor: null,
          knownUpcomingSubscriptionsUntilAnchor: null,
          safeToSpendExplanation: null,
          safeToSpendExplanationParts: null,
          confidenceScore: "INDICATIVE" as const,
          safeToSpendConfidenceScore: "INDICATIVE" as const,
          deltaReasonLabel: null,
          deltaReasonAmount: null,
        }
      : await buildSafetySpendWindowSummary({
          userId: resolvedUserId,
          moneyViewScope: resolvedMoneyViewScope,
          referenceDate,
          freeToSpendNow: balances.freeToSpendNow.amount,
          forecastSummary: loadedForecast,
          avgMonthlyIncludedIncome:
            plan.flowSummary.expectedIncomeMonthly == null
              ? null
              : Number(plan.flowSummary.expectedIncomeMonthly),
          includeIncomeSettings: plan.settings.includeIncome,
          remainingVariableBudget: monthSnapshot.remaining,
          monthlyVariableBudgetBaseline:
            plan.flowSummary.variableBudget == null
              ? null
              : Number(plan.flowSummary.variableBudget),
          monthlyFixedBaseline:
            Number(plan.flowSummary.fixedCostsBudget || 0) +
            Number(plan.flowSummary.subscriptionsBudget || 0),
        }).catch(() => ({
          safeToSpendUntilNextIncome: null,
          projectedNetUntilNextIncome: null,
          nextIncomeDateAnchor: null,
          nextIncomeLabelAnchor: null,
          nextIncomeAmountAnchor: null,
          nextIncomeAmountAnchorMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "surface_fallback",
            dataGapReason: "safety_window_unavailable",
          },
          anchorType: "none" as const,
          isEstimatedAnchorDate: true,
          bridgeCrossMonthCostsUntilIncome: null,
          knownUpcomingFixedCostsUntilAnchor: null,
          knownUpcomingSubscriptionsUntilAnchor: null,
          safeToSpendExplanation: null,
          safeToSpendExplanationParts: null,
          confidenceScore: "INDICATIVE" as const,
          safeToSpendConfidenceScore: "INDICATIVE" as const,
          deltaReasonLabel: null,
          deltaReasonAmount: null,
        }));
  const confidenceLayer = buildConfidenceLayerMetadata({
    freeToSpendNowSignal: confidence.freeToSpendNow,
    safeToSpendSignal: confidence.safeToSpendUntilNextIncome,
    freeToSpendExplanationString:
      explainability.items.find((item) => item.key === "free_to_spend")?.message ||
      null,
    safeToSpendExplanationString: safetyWindow.safeToSpendExplanation,
    safeToSpendDeltaReasonLabel: safetyWindow.deltaReasonLabel,
    safeToSpendDeltaReasonAmount: safetyWindow.deltaReasonAmount,
  });
  const safeToSpendCopy = resolveSafetyContextCopy({
    anchorLabel: safetyWindow.nextIncomeLabelAnchor,
    anchorDate: safetyWindow.nextIncomeDateAnchor,
    isEstimatedAnchorDate: safetyWindow.isEstimatedAnchorDate,
  });

  return {
    scopeView: resolvedMoneyViewScope,
    forecast: loadedForecast,
    plan,
    reserveBreakdown,
    confidence,
    explainability,
    safeToSpendUntilNextIncome: safetyWindow.safeToSpendUntilNextIncome,
    projectedNetUntilNextIncome: safetyWindow.projectedNetUntilNextIncome,
    nextIncomeDateAnchor: safetyWindow.nextIncomeDateAnchor,
    nextIncomeLabelAnchor: safetyWindow.nextIncomeLabelAnchor,
    nextIncomeAmountAnchor: safetyWindow.nextIncomeAmountAnchor,
    nextIncomeAmountAnchorMeta: safetyWindow.nextIncomeAmountAnchorMeta,
    safeToSpendAnchorType: safetyWindow.anchorType,
    safeToSpendIsEstimatedAnchorDate: safetyWindow.isEstimatedAnchorDate,
    safeToSpendLabel: safeToSpendCopy.fullLabel,
    safeToSpendSubtitle: safeToSpendCopy.sheetSubtitle,
    bridgeCrossMonthCostsUntilIncome: safetyWindow.bridgeCrossMonthCostsUntilIncome,
    knownUpcomingFixedCostsUntilAnchor:
      safetyWindow.knownUpcomingFixedCostsUntilAnchor,
    knownUpcomingSubscriptionsUntilAnchor:
      safetyWindow.knownUpcomingSubscriptionsUntilAnchor,
    safeToSpendExplanation: safetyWindow.safeToSpendExplanation,
    safeToSpendExplanationParts: safetyWindow.safeToSpendExplanationParts,
    safeToSpendConfidenceScore: safetyWindow.safeToSpendConfidenceScore,
    confidenceLayer,
    reserve: reserveBreakdown,
    balances,
  };
}
