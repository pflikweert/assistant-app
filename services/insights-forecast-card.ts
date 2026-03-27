import type { FinanceStatusTone } from "@/components/ui/finance-status-chip";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { getInsightsDisplayExpectedEndBalance } from "@/services/insights-remaining-month";
import type { BudgetPlanComputation } from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type ForecastStatusLabel = "Verwacht positief" | "Krap maar haalbaar" | "Let op" | "Neutraal";

export type InsightsForecastCardModel = {
  title: string;
  amountLabel: string;
  currentOperationalValue: string;
  freeToSpendNowValue: string | null;
  reservedValue: string | null;
  statusLabel: ForecastStatusLabel;
  statusTone: FinanceStatusTone;
  lowestOperationalPointValue: string;
  lowestOperationalPointDateLabel: string | null;
  explanation: string;
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
  const lowest =
    forecast.lowestOperationalPointInMonth ?? forecast.lowestExpectedBalance ?? null;
  const hasDeficit =
    forecast.riskFlag === "deficit_warning" ||
    (expectedEnd != null && expectedEnd < 0);

  if (hasDeficit) {
    return { label: "Let op", tone: "critical" };
  }

  const isTight =
    forecast.cashRiskFlag === "cash_gap_warning" ||
    (lowest != null && lowest < 150) ||
    (expectedEnd != null && expectedEnd < 200);

  if (isTight) {
    return { label: "Krap maar haalbaar", tone: "watch" };
  }

  return { label: "Verwacht positief", tone: "good" };
}

function buildExplanation(forecast: InsightsForecastSummary | null) {
  if (!forecast) {
    return "We kunnen nog geen betrouwbare maandverwachting maken.";
  }

  const currentOperational = forecast.currentOperationalBalance ?? null;
  const reserved = forecast.currentReservedBalance ?? null;
  const freeToSpendNow = forecast.freeToSpendNow ?? null;

  const parts = [
    currentOperational == null ? null : `Huidig saldo ${fmt.format(currentOperational)}`,
    reserved != null && reserved > 0 ? `Gereserveerd ${fmt.format(reserved)}` : null,
    freeToSpendNow == null ? null : `Vrij besteedbaar ${fmt.format(freeToSpendNow)}`,
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
}): InsightsForecastCardModel {
  const { forecast, budgetPlan, currentBalanceOverride } = input;
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
      lowestOperationalPointValue: "Nog niet beschikbaar",
      lowestOperationalPointDateLabel: null,
      explanation: "We kunnen nog geen betrouwbare maandverwachting maken.",
      isFallback: true,
    };
  }

  const currentOperational = forecast.currentOperationalBalance ?? null;
  const reserved = forecast.currentReservedBalance ?? null;
  const freeToSpendNow = forecast.freeToSpendNow ?? null;
  const status = resolveStatus(displayExpectedEndBalance, forecast);
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
    lowestOperationalPointValue:
      // Lowest point stays a separate monthly minimum; never swap it with the
      // headline end balance.
      (forecast.lowestOperationalPointInMonth ?? forecast.lowestExpectedBalance) == null
        ? "Niet beschikbaar"
        : fmt.format(
            forecast.lowestOperationalPointInMonth ?? forecast.lowestExpectedBalance ?? null,
          ),
    lowestOperationalPointDateLabel: formatShortDate(forecast.lowestExpectedBalanceDate),
    explanation: buildExplanation(forecast),
    isFallback: false,
  };
}
