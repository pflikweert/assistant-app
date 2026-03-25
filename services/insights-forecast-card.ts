import type { FinanceStatusTone } from "@/components/ui/finance-status-chip";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { getInsightsDisplayExpectedEndBalance } from "@/services/insights-remaining-month";
import type { TransactionMonthOption } from "@/services/transaction-month-options";
import type { BudgetPlanComputation } from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type ForecastStatusLabel = "Verwacht positief" | "Krap maar haalbaar" | "Let op" | "Neutraal";

export type InsightsForecastCardModel = {
  title: string;
  amountLabel: string;
  statusLabel: ForecastStatusLabel;
  statusTone: FinanceStatusTone;
  lowestBalanceLabel: string;
  lowestBalanceDateLabel: string | null;
  explanation: string;
  isFallback: boolean;
};

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

function resolveStatus(forecast: InsightsForecastSummary): {
  label: ForecastStatusLabel;
  tone: FinanceStatusTone;
} {
  const expectedEnd = forecast.expectedEndBalance ?? null;
  const lowest = forecast.lowestExpectedBalance ?? null;
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

  const income = forecast.expectedIncomeTotal;
  const fixed = forecast.expectedFixedCosts;
  const subscriptions = forecast.expectedSubscriptions;
  const variable = forecast.expectedVariableCosts;

  if (
    income == null ||
    fixed == null ||
    subscriptions == null ||
    variable == null
  ) {
    return "Deze verwachting combineert bekende inkomsten, vaste lasten, abonnementen en verwachte variabele uitgaven.";
  }

  return `Op basis van bekende inkomsten (${fmt.format(income)}) en verwachte uitgaven: ${fmt.format(
    fixed,
  )} vaste lasten, ${fmt.format(subscriptions)} abonnementen en ${fmt.format(
    variable,
  )} variabele uitgaven.`;
}

export function buildInsightsForecastCard(input: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
  selectedMonth: TransactionMonthOption;
  currentBalanceOverride?: number | null;
}): InsightsForecastCardModel {
  const { forecast, budgetPlan, selectedMonth, currentBalanceOverride } = input;
  const isHistoricalMonth = selectedMonth.key < getCurrentMonthKey();
  const title = isHistoricalMonth ? "Eindsaldo deze maand" : "Verwacht eindsaldo";
  const displayExpectedEndBalance = isHistoricalMonth
    ? forecast?.expectedEndBalance ?? null
    : getInsightsDisplayExpectedEndBalance({
        forecast,
        budgetPlan,
        currentBalanceOverride,
      });

  if (!forecast || displayExpectedEndBalance == null) {
    return {
      title,
      amountLabel: "Nog niet beschikbaar",
      statusLabel: "Neutraal",
      statusTone: "neutral",
      lowestBalanceLabel: "Nog niet beschikbaar",
      lowestBalanceDateLabel: null,
      explanation: "We kunnen nog geen betrouwbare maandverwachting maken.",
      isFallback: true,
    };
  }

  const status = resolveStatus({
    ...forecast,
    expectedEndBalance: displayExpectedEndBalance,
  });
  return {
    title,
    amountLabel: fmt.format(displayExpectedEndBalance),
    statusLabel: status.label,
    statusTone: status.tone,
    lowestBalanceLabel:
      forecast.lowestExpectedBalance == null
        ? "Niet beschikbaar"
        : fmt.format(forecast.lowestExpectedBalance),
    lowestBalanceDateLabel: formatShortDate(forecast.lowestExpectedBalanceDate),
    explanation: buildExplanation(forecast),
    isFallback: false,
  };
}
