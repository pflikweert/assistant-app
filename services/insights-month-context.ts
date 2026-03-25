import { getMonthVariableBudgetSnapshot } from "@/services/budget-risk";
import type { TransactionMonthOption } from "@/services/transaction-month-options";
import type { BudgetPlanComputation } from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export type InsightsMonthStatusTone = "good" | "watch" | "critical" | "neutral";

export type InsightsForecastSummary = {
  monthStart: string;
  forecastReferenceDate: string | null;
  currentBalanceAnchor: number | null;
  currentBalanceAnchorDate: string | null;
  cashRiskFlag: "none" | "cash_gap_warning";
  riskFlag: "none" | "deficit_warning";
  expectedEndBalance: number | null;
  lowestExpectedBalance: number | null;
  lowestExpectedBalanceDate: string | null;
  nextExpectedEventDate: string | null;
  nextExpectedEventLabel: string | null;
  expectedIncomeTotal: number | null;
  remainingExpectedIncomeTotal: number | null;
  remainingExpectedExpenseTotal: number | null;
  remainingExpectedSavingsOutflowTotal: number | null;
  upcomingCommittedIncomeTotal: number | null;
  upcomingCommittedExpenseTotal: number | null;
  expectedFixedCosts: number | null;
  expectedSubscriptions: number | null;
  expectedVariableCosts: number | null;
};

export type InsightsMonthContextSummary = {
  statusTone: InsightsMonthStatusTone;
  statusLabel: "Op schema" | "Let op" | "Krap" | "Neutraal";
  contextLine: string;
  summaryLine: string;
  attentionCount: number;
};

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatShortDate(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;

  return parsed.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

export function formatAttentionCountLabel(count: number) {
  return `${count} aandachtspunt${count === 1 ? "" : "en"}`;
}

export function buildInsightsMonthContextSummary(input: {
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
  selectedMonth: TransactionMonthOption;
}): InsightsMonthContextSummary {
  const { forecast, budgetPlan, selectedMonth } = input;
  const monthSnapshot = getMonthVariableBudgetSnapshot(budgetPlan);
  const currentMonthKey = getCurrentMonthKey();
  const isHistoricalMonth = selectedMonth.key < currentMonthKey;

  const hasDeficitRisk =
    forecast?.riskFlag === "deficit_warning" ||
    (forecast?.expectedEndBalance != null && forecast.expectedEndBalance < 0);
  const hasCashGapRisk = forecast?.cashRiskFlag === "cash_gap_warning";
  const budgetIsCritical = monthSnapshot.tone === "critical";
  const budgetNeedsAttention = monthSnapshot.tone === "watch";
  const budgetNotConfigured = monthSnapshot.state === "no_budget";

  const attentionCount =
    (hasDeficitRisk ? 1 : 0) +
    (hasCashGapRisk ? 1 : 0) +
    (budgetIsCritical || budgetNeedsAttention || budgetNotConfigured ? 1 : 0);

  const hasEnoughData = Boolean(forecast) || monthSnapshot.state !== "no_data";

  if (!hasEnoughData) {
    return {
      statusTone: "neutral",
      statusLabel: "Neutraal",
      attentionCount: 0,
      contextLine: "We bouwen nog aan je maandbeeld voor deze periode.",
      summaryLine: "Zodra er meer transacties binnen zijn, zie je hier direct wat opvalt.",
    };
  }

  let statusTone: InsightsMonthStatusTone = "good";
  let statusLabel: InsightsMonthContextSummary["statusLabel"] = "Op schema";

  if (hasDeficitRisk || budgetIsCritical) {
    statusTone = "critical";
    statusLabel = "Krap";
  } else if (hasCashGapRisk || budgetNeedsAttention || budgetNotConfigured) {
    statusTone = "watch";
    statusLabel = "Let op";
  }

  let contextLine = "Je maand loopt rustig.";
  if (statusTone === "critical") {
    contextLine =
      attentionCount > 0
        ? `Je maand staat onder druk. Er zijn ${formatAttentionCountLabel(attentionCount)}.`
        : "Je maand staat onder druk.";
  } else if (statusTone === "watch") {
    contextLine =
      attentionCount > 0
        ? `Je maand vraagt aandacht. Er zijn ${formatAttentionCountLabel(attentionCount)}.`
        : "Je maand vraagt aandacht.";
  } else if (attentionCount > 0) {
    contextLine = `Je maand loopt rustig. Er zijn ${formatAttentionCountLabel(attentionCount)}.`;
  }

  if (isHistoricalMonth) {
    contextLine =
      attentionCount > 0
        ? `Deze maand is afgerond met ${formatAttentionCountLabel(attentionCount)}.`
        : "Deze maand is rustig afgerond.";
  }

  let summaryLine = "Je maandbeeld ziet er stabiel uit op basis van wat nu bekend is.";
  if (hasDeficitRisk && forecast?.expectedEndBalance != null) {
    summaryLine = `Als dit tempo zo bleef, kwam je uit op ${fmt.format(forecast.expectedEndBalance)} eindsaldo.`;
  } else if (hasCashGapRisk && forecast?.lowestExpectedBalanceDate) {
    summaryLine = `Rond ${formatShortDate(forecast.lowestExpectedBalanceDate)} kon je saldo tijdelijk krap worden.`;
  } else if (
    monthSnapshot.state !== "no_data" &&
    monthSnapshot.state !== "no_budget" &&
    monthSnapshot.remaining != null
  ) {
    if (monthSnapshot.remaining < 0) {
      summaryLine = `Je zat ${fmt.format(Math.abs(monthSnapshot.remaining))} boven je variabele maandruimte.`;
    } else {
      summaryLine = `Je had nog ongeveer ${fmt.format(monthSnapshot.remaining)} variabele ruimte in deze maand.`;
    }
  } else if (monthSnapshot.state === "no_budget") {
    summaryLine =
      "Stel je variabele maandbudget in, dan krijg je hier direct gerichte bijsturing.";
  }

  return {
    statusTone,
    statusLabel,
    attentionCount,
    contextLine,
    summaryLine,
  };
}
