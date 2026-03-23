import { getMonthVariableBudgetSnapshot } from "@/services/budget-risk";
import {
  shouldSuppressRepeatedInsight,
  type InsightsHighlightHistoryState,
  type InsightsHighlightSignalSource,
} from "@/services/insights-highlight-history";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { BudgetPlanComputation } from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const CONFIDENCE_THRESHOLD = {
  attention: 70,
  trend: 70,
  reassurance: 60,
  neutral: 0,
} as const;

const REPEAT_SUPPRESSION_WINDOW_MS = 72 * 60 * 60 * 1000;

export type InsightsSignalTransaction = {
  id?: string;
  amount: number;
  counterparty: string | null;
  date: string;
  analysisCategory:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | null;
};

export type InsightsHighlight = {
  id: string;
  type: "trend" | "reassurance" | "attention" | "neutral";
  title: string;
  description: string;
  ctaLabel?: string;
  ctaPath?: string;
  signalSource: InsightsHighlightSignalSource;
  confidence: number;
  meaningKey: string;
  fingerprint: string;
};

type Candidate = InsightsHighlight & {
  family: string;
};

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundToBucket(value: number, bucket: number) {
  if (!Number.isFinite(value)) return 0;
  if (bucket <= 0) return Math.round(value);
  return Math.round(value / bucket) * bucket;
}

function normalizeCounterparty(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sumVariableExpense(rows: InsightsSignalTransaction[]) {
  return rows.reduce((sum, row) => {
    if (row.amount >= 0) return sum;

    const isVariable =
      row.analysisCategory === "variable_costs" || row.analysisCategory == null;
    if (!isVariable) return sum;

    return sum + Math.abs(row.amount);
  }, 0);
}

function confidenceThresholdFor(type: Candidate["type"]) {
  return CONFIDENCE_THRESHOLD[type];
}

function buildTempoCandidate(input: {
  selectedMonthKey: string;
  monthSnapshot: ReturnType<typeof getMonthVariableBudgetSnapshot>;
  forecast: InsightsForecastSummary | null;
}): Candidate | null {
  const { selectedMonthKey, monthSnapshot, forecast } = input;

  if (monthSnapshot.tone !== "critical" && monthSnapshot.tone !== "watch") {
    return null;
  }

  const overrun = Math.max(0, Math.abs(monthSnapshot.remaining || 0));
  const confidence =
    monthSnapshot.tone === "critical"
      ? clampConfidence(
          92 +
            Math.min(4, roundToBucket(overrun, 25) / 25) +
            (forecast?.riskFlag === "deficit_warning" ? 3 : 0) +
            (forecast?.cashRiskFlag === "cash_gap_warning" ? 2 : 0),
        )
      : clampConfidence(
          78 +
            Math.min(6, roundToBucket(overrun, 25) / 25) +
            (forecast?.cashRiskFlag === "cash_gap_warning" ? 2 : 0),
        );

  return {
    id: monthSnapshot.tone === "critical" ? "tempo-critical" : "tempo-watch",
    type: monthSnapshot.tone === "critical" ? "attention" : "trend",
    title:
      monthSnapshot.tone === "critical"
        ? "Uitgaven lopen te snel op"
        : "Uitgaven vragen aandacht",
    description:
      monthSnapshot.tone === "critical"
        ? overrun > 0
          ? `Je zit ${fmt.format(overrun)} boven je variabele maandruimte.`
          : "Je variabele uitgaven lopen sneller op dan je maandtempo."
        : "Je variabele uitgaven gaan sneller dan je maandtempo.",
    ctaLabel: "Bekijk",
    ctaPath: "/budget",
    signalSource: "ai-influenced",
    confidence,
    meaningKey: "budget-tempo",
    fingerprint: [
      "tempo",
      selectedMonthKey,
      monthSnapshot.tone,
      monthSnapshot.state,
      roundToBucket(monthSnapshot.remaining || 0, 25),
      forecast?.riskFlag || "none",
      forecast?.cashRiskFlag || "none",
      roundToBucket(forecast?.expectedEndBalance ?? 0, 50),
    ].join("|"),
    family: "tempo",
  };
}

function buildVariableTrendCandidate(input: {
  selectedMonthKey: string;
  currentMonthTransactions: InsightsSignalTransaction[];
  previousMonthTransactions: InsightsSignalTransaction[];
}): Candidate | null {
  const { selectedMonthKey, currentMonthTransactions, previousMonthTransactions } = input;

  const currentVariable = sumVariableExpense(currentMonthTransactions);
  const previousVariable = sumVariableExpense(previousMonthTransactions);
  const variableDelta = currentVariable - previousVariable;

  if (previousVariable <= 0) return null;
  if (variableDelta <= 75) return null;
  if (currentVariable <= previousVariable * 1.15) return null;

  const ratio = currentVariable / previousVariable;
  const confidence = clampConfidence(
    70 +
      Math.min(14, Math.round(variableDelta / 20) * 2) +
      (ratio >= 1.5 ? 8 : ratio >= 1.25 ? 4 : 0),
  );

  return {
    id: "variable-trend-up",
    type: "trend",
    title: "Variabele uitgaven hoger",
    description: `Je variabele uitgaven liggen ${fmt.format(variableDelta)} hoger dan vorige maand.`,
    ctaLabel: "Bekijk",
    ctaPath: "/transactions",
    signalSource: "hard",
    confidence,
    meaningKey: "variable-spend-higher",
    fingerprint: [
      "variable-trend",
      selectedMonthKey,
      roundToBucket(currentVariable, 25),
      roundToBucket(previousVariable, 25),
      roundToBucket(variableDelta, 25),
    ].join("|"),
    family: "variable-trend",
  };
}

function buildNewCostCandidate(input: {
  selectedMonthKey: string;
  currentMonthTransactions: InsightsSignalTransaction[];
  lookbackTransactions: InsightsSignalTransaction[];
}): Candidate | null {
  const { selectedMonthKey, currentMonthTransactions, lookbackTransactions } = input;

  const knownCounterparties = new Set(
    lookbackTransactions
      .filter((row) => row.amount < 0)
      .map((row) => normalizeCounterparty(row.counterparty))
      .filter((value) => value.length > 0),
  );

  const currentByCounterparty = new Map<
    string,
    { label: string; total: number; count: number; sampleTransactionId: string | null }
  >();

  for (const row of currentMonthTransactions) {
    if (row.amount >= 0) continue;
    const key = normalizeCounterparty(row.counterparty);
    if (!key) continue;

    const existing = currentByCounterparty.get(key);
    if (existing) {
      existing.total += Math.abs(row.amount);
      existing.count += 1;
    } else {
      currentByCounterparty.set(key, {
        label: row.counterparty || "Onbekende betaling",
        total: Math.abs(row.amount),
        count: 1,
        sampleTransactionId: row.id ? String(row.id) : null,
      });
    }
  }

  const newestCost = Array.from(currentByCounterparty.entries())
    .filter(([key, value]) => !knownCounterparties.has(key) && value.total >= 20)
    .sort((left, right) => right[1].total - left[1].total)[0];

  if (!newestCost) return null;

  const [, value] = newestCost;
  const confidence = clampConfidence(
    64 +
      Math.min(14, Math.round(value.total / 10)) +
      Math.min(6, Math.max(0, value.count - 1) * 3),
  );

  return {
    id: "new-cost",
    type: "attention",
    title: "Nieuwe kostenpost",
    description: `${value.label} verscheen deze maand met ${fmt.format(value.total)} aan uitgaven.`,
    ctaLabel: "Bekijk",
    ctaPath: value.sampleTransactionId
      ? `/transaction-detail?id=${value.sampleTransactionId}`
      : "/transactions",
    signalSource: "hard",
    confidence,
    meaningKey: "new-counterparty-cost",
    fingerprint: [
      "new-cost",
      selectedMonthKey,
      normalizeCounterparty(value.label),
      roundToBucket(value.total, 5),
      value.count,
    ].join("|"),
    family: "new-cost",
  };
}

function buildStableMonthCandidate(input: {
  selectedMonthKey: string;
  selectedMonthLabel: string;
  monthSnapshot: ReturnType<typeof getMonthVariableBudgetSnapshot>;
  forecast: InsightsForecastSummary | null;
}): Candidate | null {
  const { selectedMonthKey, selectedMonthLabel, monthSnapshot, forecast } = input;

  const hasStrongRisk =
    forecast?.riskFlag === "deficit_warning" ||
    forecast?.cashRiskFlag === "cash_gap_warning" ||
    (forecast?.expectedEndBalance != null && forecast.expectedEndBalance < 0);

  if (hasStrongRisk || monthSnapshot.tone !== "good") return null;

  const confidence = clampConfidence(
    64 +
      (forecast?.expectedEndBalance != null
        ? Math.min(8, Math.round(Math.max(forecast.expectedEndBalance, 0) / 200))
        : 0),
  );

  return {
    id: "stable-month",
    type: "reassurance",
    title: "Vaste lasten gedekt",
    description:
      forecast?.expectedEndBalance != null
        ? `Je maand lijkt stabiel. Verwacht eindsaldo: ${fmt.format(forecast.expectedEndBalance)}.`
        : `Je maand ${selectedMonthLabel.toLowerCase()} loopt voorlopig stabiel.`,
    signalSource: "ai-influenced",
    confidence,
    meaningKey: "month-stability",
    fingerprint: [
      "stable-month",
      selectedMonthKey,
      monthSnapshot.tone,
      monthSnapshot.state,
      roundToBucket(monthSnapshot.remaining || 0, 25),
      roundToBucket(forecast?.expectedEndBalance ?? 0, 50),
    ].join("|"),
    family: "stability",
  };
}

function buildNoDataHighlight(): InsightsHighlight {
  return {
    id: "neutral-no-data",
    type: "neutral",
    title: "Nog weinig data",
    description: "We zien nog te weinig om duidelijke patronen te tonen.",
    signalSource: "hard",
    confidence: 100,
    meaningKey: "no-data",
    fingerprint: "no-data",
  };
}

function buildStableFallback(): InsightsHighlight {
  return {
    id: "neutral-stable",
    type: "reassurance",
    title: "Rustig maandbeeld",
    description: "Je uitgaven lopen deze maand grotendeels zoals verwacht.",
    signalSource: "ai-influenced",
    confidence: 62,
    meaningKey: "stable-fallback",
    fingerprint: "stable-fallback",
  };
}

function dedupeCandidates(candidates: Candidate[]) {
  const byFamily = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = byFamily.get(candidate.family);
    if (!existing || candidate.confidence > existing.confidence) {
      byFamily.set(candidate.family, candidate);
    }
  }

  const byMeaning = new Map<string, Candidate>();
  for (const candidate of byFamily.values()) {
    const existing = byMeaning.get(candidate.meaningKey);
    if (!existing || candidate.confidence > existing.confidence) {
      byMeaning.set(candidate.meaningKey, candidate);
    }
  }

  return Array.from(byMeaning.values()).sort((left, right) => {
    if (left.confidence !== right.confidence) return right.confidence - left.confidence;
    return left.title.localeCompare(right.title, "nl");
  });
}

function stripInternalFields(candidate: Candidate): InsightsHighlight {
  const { family: _family, ...rest } = candidate;
  return rest;
}

function isConfidentEnough(candidate: Candidate) {
  return candidate.confidence >= confidenceThresholdFor(candidate.type);
}

function isStaleByLatestTransaction(
  latestTransactionDateIso: string | null | undefined,
  now = Date.now(),
  staleWindowMs = REPEAT_SUPPRESSION_WINDOW_MS,
) {
  if (!latestTransactionDateIso) return false;
  const parsed = Date.parse(`${latestTransactionDateIso}T23:59:59.999Z`);
  if (!Number.isFinite(parsed)) return false;
  return now - parsed > staleWindowMs;
}

export function selectInsightsHighlights(input: {
  selectedMonthKey: string;
  selectedMonthLabel: string;
  forecast: InsightsForecastSummary | null;
  budgetPlan: BudgetPlanComputation | null;
  currentMonthTransactions: InsightsSignalTransaction[];
  previousMonthTransactions: InsightsSignalTransaction[];
  lookbackTransactions: InsightsSignalTransaction[];
  latestTransactionDateIso?: string | null;
  history?: InsightsHighlightHistoryState | null;
}): InsightsHighlight[] {
  const {
    selectedMonthKey,
    selectedMonthLabel,
    forecast,
    budgetPlan,
    currentMonthTransactions,
    previousMonthTransactions,
    lookbackTransactions,
    latestTransactionDateIso = null,
    history = null,
  } = input;

  const monthSnapshot = getMonthVariableBudgetSnapshot(budgetPlan);
  const hasData =
    Boolean(forecast) ||
    monthSnapshot.state !== "no_data" ||
    currentMonthTransactions.length > 0;

  if (!hasData) {
    return [buildNoDataHighlight()];
  }

  const candidates: Candidate[] = [
    buildTempoCandidate({
      selectedMonthKey,
      monthSnapshot,
      forecast,
    }),
    buildVariableTrendCandidate({
      selectedMonthKey,
      currentMonthTransactions,
      previousMonthTransactions,
    }),
    buildNewCostCandidate({
      selectedMonthKey,
      currentMonthTransactions,
      lookbackTransactions,
    }),
    buildStableMonthCandidate({
      selectedMonthKey,
      selectedMonthLabel,
      monthSnapshot,
      forecast,
    }),
  ].filter((candidate): candidate is Candidate => Boolean(candidate));

  const deduped = dedupeCandidates(candidates);
  const confident = deduped.filter(isConfidentEnough);
  const dataIsStale = isStaleByLatestTransaction(latestTransactionDateIso);
  const visible = dataIsStale
    ? confident
    : confident.filter(
        (candidate) =>
          !shouldSuppressRepeatedInsight(
            history,
            {
              meaningKey: candidate.meaningKey,
              fingerprint: candidate.fingerprint,
              signalSource: candidate.signalSource,
            },
            Date.now(),
            REPEAT_SUPPRESSION_WINDOW_MS,
          ),
      );

  if (visible.length > 0) {
    const relevant = visible.filter(
      (item) => item.type === "attention" || item.type === "trend",
    );
    const reassurance = visible.filter((item) => item.type === "reassurance");

    const result: Candidate[] = [];
    for (const item of relevant) {
      if (result.length >= 3) break;
      result.push(item);
    }

    if (result.length < 3 && reassurance.length > 0) {
      result.push(reassurance[0]);
    }

    return result.slice(0, 3).map(stripInternalFields);
  }

  if (confident.length === 0) {
    return [buildStableFallback()];
  }

  return [buildStableFallback()];
}
