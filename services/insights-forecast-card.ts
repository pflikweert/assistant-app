import type {
  ForecastSurfaceConfidence,
  ConfidenceLabel,
} from "@/services/confidence-model";
import type { ForecastSurfaceExplainability } from "@/services/explainability";
import type { FinanceStatusTone } from "@/components/ui/finance-status-chip";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { getInsightsDisplayExpectedEndBalance } from "@/services/insights-remaining-month";
import { resolveFinancialSurfaceStatus } from "@/services/financial-surface-semantics";
import type { BudgetPlanComputation } from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type ForecastStatusLabel = "Op schema" | "Let op" | "Neutraal";

export type InsightsForecastCardModel = {
  title: string;
  amountLabel: string;
  currentOperationalValue: string;
  freeToSpendNowValue: string | null;
  reservedValue: string | null;
  statusLabel: ForecastStatusLabel;
  statusTone: FinanceStatusTone;
  confidenceLabel: ConfidenceLabel | null;
  lowestOperationalPointValue: string;
  lowestOperationalPointDateLabel: string | null;
  explanation: string;
  explanationItems: string[];
  isFallback: boolean;
};

function formatShortDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

function resolveStatus(expectedEnd: number | null, forecast: InsightsForecastSummary): {
  label: ForecastStatusLabel;
  tone: FinanceStatusTone;
} {
  const status = resolveFinancialSurfaceStatus({
    activeMonthLabel: "deze maand",
    expectedEndOperationalBalance: expectedEnd,
    remainingMonthlyBudget: null,
    monthBudgetTone:
      forecast.cashRiskFlag === "cash_gap_warning" ? "watch" : "neutral",
  });

  if (status.tone === "critical" || forecast.riskFlag === "deficit_warning") {
    return { label: "Let op", tone: "critical" };
  }

  return { label: "Op schema", tone: "good" };
}

function buildExplanation(input: {
  hasForecast: boolean;
  currentOperational: number | null;
  reserved: number | null;
  freeToSpendNow: number | null;
}) {
  if (!input.hasForecast) {
    return "We kunnen nog geen betrouwbare maandverwachting maken.";
  }

  const parts = [
    input.currentOperational == null
      ? null
      : `Huidig saldo ${fmt.format(input.currentOperational)}`,
    input.reserved != null && input.reserved > 0
      ? `Gereserveerd ${fmt.format(input.reserved)}`
      : null,
    input.freeToSpendNow == null
      ? null
      : `Vrij besteedbaar ${fmt.format(input.freeToSpendNow)}`,
  ].filter(Boolean);

  if (!parts.length) {
    return "Deze verwachting combineert bekende inkomsten, vaste lasten, abonnementen en verwachte variabele uitgaven.";
  }

  return parts.join(" · ");
}

export function buildInsightsForecastCard(input: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
  currentBalanceOverride?: number | null;
  surfaceBalances?: FinancialSurfaceBalanceSnapshot | null;
  surfaceConfidence?: ForecastSurfaceConfidence | null;
  surfaceExplainability?: ForecastSurfaceExplainability | null;
}): InsightsForecastCardModel {
  const {
    forecast,
    budgetPlan,
    currentBalanceOverride,
    surfaceBalances,
    surfaceConfidence,
    surfaceExplainability,
  } = input;
  const title = "Verwacht eindsaldo";
  const displayExpectedEndBalance = getInsightsDisplayExpectedEndBalance({
    forecast,
    budgetPlan,
    currentBalanceOverride,
  });

  if (!forecast || displayExpectedEndBalance == null) {
    return {
      title,
      amountLabel: "Nog niet beschikbaar",
      currentOperationalValue: "Nog niet beschikbaar",
      freeToSpendNowValue: null,
      reservedValue: null,
      statusLabel: "Neutraal",
      statusTone: "neutral",
      confidenceLabel: null,
      lowestOperationalPointValue: "Nog niet beschikbaar",
      lowestOperationalPointDateLabel: null,
      explanation: "We kunnen nog geen betrouwbare maandverwachting maken.",
      explanationItems: [],
      isFallback: true,
    };
  }

  // Keep Insights aligned with the canonical surface summary when available.
  const currentOperational =
    surfaceBalances?.currentOperationalBalance.amount ??
    forecast.currentOperationalBalance ??
    null;
  const reserved =
    surfaceBalances?.currentReservedBalance.amount ??
    forecast.currentReservedBalance ??
    null;
  const freeToSpendNow =
    surfaceBalances?.freeToSpendNow.amount ?? forecast.freeToSpendNow ?? null;
  const status = resolveStatus(displayExpectedEndBalance, forecast);
  const fallbackExplanation = buildExplanation({
    hasForecast: Boolean(forecast),
    currentOperational,
    reserved,
    freeToSpendNow,
  });
  const primaryExplanation =
    surfaceExplainability?.items.find((item) => item.key === "expected_end")
      ?.message || fallbackExplanation;
  const explanationItems =
    (surfaceExplainability?.insightsBullets || [])
      .filter((item) => Boolean(item) && item !== primaryExplanation)
      .slice(0, 2);

  return {
    title,
    amountLabel: fmt.format(displayExpectedEndBalance),
    currentOperationalValue:
      currentOperational == null ? "Niet bekend" : fmt.format(currentOperational),
    freeToSpendNowValue:
      freeToSpendNow == null ? null : fmt.format(freeToSpendNow),
    reservedValue: reserved == null ? null : fmt.format(reserved),
    statusLabel: status.label,
    statusTone: status.tone,
    confidenceLabel: surfaceConfidence?.expectedEndOperationalBalance.label ?? null,
    lowestOperationalPointValue:
      // Lowest point stays a separate monthly minimum; never swap it with the
      // headline end balance.
      (forecast.lowestOperationalPointInMonth ?? forecast.lowestExpectedBalance) == null
        ? "Niet beschikbaar"
        : fmt.format(
            forecast.lowestOperationalPointInMonth ?? forecast.lowestExpectedBalance ?? null,
          ),
    lowestOperationalPointDateLabel: formatShortDate(forecast.lowestExpectedBalanceDate),
    explanation: primaryExplanation,
    explanationItems,
    isFallback: false,
  };
}
