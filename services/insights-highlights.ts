import { getMonthVariableBudgetSnapshot } from "@/services/budget-risk";
import { resolveForecastDisplayExpectedEndBalance } from "@/services/insights-remaining-month";
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
  details?: string | null;
  categoryKey?: string | null;
  categoryLabel?: string | null;
  analysisCategory:
    | "income_structural"
    | "income_variable"
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

function buildMonthlyMagnitudeTotals(
  rows: InsightsSignalTransaction[],
  matcher: (row: InsightsSignalTransaction) => boolean,
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!matcher(row)) continue;
    const key = getMonthKey(row.date);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    totals.set(key, (totals.get(key) || 0) + Math.abs(row.amount));
  }
  return totals;
}

function getMonthKey(dateIso: string) {
  return String(dateIso || "").slice(0, 7);
}

function hasCorrectionHint(rows: InsightsSignalTransaction[]) {
  const haystack = rows
    .map((row) => `${row.counterparty || ""} ${row.details || ""}`)
    .join(" ")
    .toLowerCase();
  return [
    "correctie",
    "nabetaling",
    "achterstall",
    "terugwerkende kracht",
    "aanvulling",
    "compensatie",
  ].some((hint) => haystack.includes(hint));
}

function getRecentHistoricalMonthValues(
  totalsByMonth: Map<string, number>,
  selectedMonthKey: string,
  limit = 3,
) {
  return Array.from(totalsByMonth.entries())
    .filter(([monthKey]) => monthKey < selectedMonthKey)
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, limit)
    .map(([, value]) => value);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] || 0;
  return ((sorted[mid - 1] || 0) + (sorted[mid] || 0)) / 2;
}

type RecurringBucketKey = "income_structural" | "fixed_costs" | "subscriptions";

function getRecurringBucketLabel(bucket: RecurringBucketKey) {
  if (bucket === "income_structural") return "Vaste inkomsten";
  if (bucket === "fixed_costs") return "Vaste lasten";
  return "Abonnementen";
}

function getRecurringBucketKey(bucket: RecurringBucketKey) {
  if (bucket === "income_structural") return "recurring-income";
  if (bucket === "fixed_costs") return "fixed-costs";
  return "subscriptions";
}

function getRecurringBucketCtaPath(bucket: RecurringBucketKey) {
  return `/transactions?analysisCategory=${bucket}`;
}

function getRecurringBucketMatcher(bucket: RecurringBucketKey) {
  return (row: InsightsSignalTransaction) => {
    if (bucket === "income_structural") {
      return row.amount > 0 && row.analysisCategory === "income_structural";
    }
    return row.amount < 0 && row.analysisCategory === bucket;
  };
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

function buildVariableTrendDownCandidate(input: {
  selectedMonthKey: string;
  currentMonthTransactions: InsightsSignalTransaction[];
  previousMonthTransactions: InsightsSignalTransaction[];
}): Candidate | null {
  const { selectedMonthKey, currentMonthTransactions, previousMonthTransactions } =
    input;

  const currentVariable = sumVariableExpense(currentMonthTransactions);
  const previousVariable = sumVariableExpense(previousMonthTransactions);
  const variableDelta = previousVariable - currentVariable;

  if (previousVariable <= 0) return null;
  if (variableDelta <= 75) return null;
  if (currentVariable >= previousVariable * 0.9) return null;

  const ratio = currentVariable / previousVariable;
  const confidence = clampConfidence(
    72 +
      Math.min(12, Math.round(variableDelta / 20) * 2) +
      (ratio <= 0.75 ? 8 : ratio <= 0.85 ? 4 : 0),
  );

  return {
    id: "variable-trend-down",
    type: "trend",
    title: "Variabele uitgaven lager",
    description: `Je gaf ${fmt.format(variableDelta)} minder uit aan variabele posten dan vorige maand.`,
    ctaLabel: "Bekijk",
    ctaPath: "/transactions",
    signalSource: "hard",
    confidence,
    meaningKey: "variable-spend-lower",
    fingerprint: [
      "variable-trend-down",
      selectedMonthKey,
      roundToBucket(currentVariable, 25),
      roundToBucket(previousVariable, 25),
      roundToBucket(variableDelta, 25),
    ].join("|"),
    family: "variable-trend-down",
  };
}

function buildRecurringBucketCandidate(input: {
  bucket: RecurringBucketKey;
  selectedMonthKey: string;
  currentMonthTransactions: InsightsSignalTransaction[];
  previousMonthTransactions: InsightsSignalTransaction[];
  lookbackTransactions: InsightsSignalTransaction[];
}): Candidate | null {
  const {
    bucket,
    selectedMonthKey,
    currentMonthTransactions,
    previousMonthTransactions,
    lookbackTransactions,
  } = input;

  const matcher = getRecurringBucketMatcher(bucket);
  const bucketLabel = getRecurringBucketLabel(bucket);
  const isIncome = bucket === "income_structural";
  const favorableDirection = isIncome ? "higher" : "lower";
  const bucketKey = getRecurringBucketKey(bucket);

  const allHistoricalTransactions = [...previousMonthTransactions, ...lookbackTransactions];
  const historicalMonthTotals = buildMonthlyMagnitudeTotals(allHistoricalTransactions, matcher);
  const currentTotal = buildMonthlyMagnitudeTotals(currentMonthTransactions, matcher).get(
    selectedMonthKey,
  ) || 0;
  const recentHistoricalValues = getRecentHistoricalMonthValues(
    historicalMonthTotals,
    selectedMonthKey,
    3,
  );

  const baseline = recentHistoricalValues.length ? median(recentHistoricalValues) : 0;
  const delta = currentTotal - baseline;
  const absDelta = Math.abs(delta);
  const ratio = baseline > 0 ? currentTotal / baseline : currentTotal > 0 ? Infinity : 0;

  if (currentTotal <= 0) return null;
  if (baseline <= 0 && currentTotal < 100) return null;
  if (baseline > 0 && absDelta < Math.max(75, baseline * 0.25)) return null;
  if (baseline > 0 && ratio > 0.85 && ratio < 1.15) return null;

  const isPositive = isIncome ? delta > 0 : delta < 0;
  const hasHint = isIncome && hasCorrectionHint(currentMonthTransactions);
  const confidence = clampConfidence(
    (isPositive ? 82 : 74) +
      Math.min(10, Math.round(Math.max(absDelta, currentTotal) / 50)) +
      (hasHint ? 4 : 0) +
      (recentHistoricalValues.length >= 2 ? 2 : 0),
  );

  const directionLabel = isPositive ? favorableDirection : isIncome ? "lower" : "higher";
  const description = isIncome
    ? isPositive
      ? hasHint
        ? `Je ${bucketLabel.toLowerCase()} liggen ${fmt.format(absDelta)} hoger dan normaal. Dat lijkt op een correctie of nabetaling.`
        : `Je ${bucketLabel.toLowerCase()} liggen ${fmt.format(absDelta)} hoger dan normaal.`
      : `Je ${bucketLabel.toLowerCase()} liggen ${fmt.format(absDelta)} lager dan normaal.`
    : isPositive
      ? `Je ${bucketLabel.toLowerCase()} liggen ${fmt.format(absDelta)} lager dan normaal.`
      : `Je ${bucketLabel.toLowerCase()} liggen ${fmt.format(absDelta)} hoger dan normaal.`;

  return {
    id: `${bucketKey}-trend-${directionLabel}`,
    type: isPositive ? "reassurance" : "attention",
    title: `${bucketLabel} ${isPositive ? favorableDirection : isIncome ? "lager" : "hoger"} dan normaal`,
    description,
    ctaLabel: "Bekijk",
    ctaPath: getRecurringBucketCtaPath(bucket),
    signalSource: "hard",
    confidence,
    meaningKey: `${bucketKey}-trend`,
    fingerprint: [
      `${bucketKey}-trend`,
      selectedMonthKey,
      roundToBucket(currentTotal, 25),
      roundToBucket(baseline, 25),
      recentHistoricalValues.length,
      hasHint ? "hint" : "plain",
    ].join("|"),
    family: `${bucketKey}-trend`,
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
  const expectedEndOperationalBalance = resolveForecastDisplayExpectedEndBalance({
    forecast,
    budgetPlan: null,
  });

  const hasStrongRisk =
    forecast?.riskFlag === "deficit_warning" ||
    forecast?.cashRiskFlag === "cash_gap_warning" ||
    (expectedEndOperationalBalance != null && expectedEndOperationalBalance < 0);

  if (hasStrongRisk || monthSnapshot.tone !== "good") return null;

  const confidence = clampConfidence(
    64 +
      (expectedEndOperationalBalance != null
        ? Math.min(
            8,
            Math.round(Math.max(expectedEndOperationalBalance, 0) / 200),
          )
        : 0),
  );

  return {
    id: "stable-month",
    type: "reassurance",
    title: "Vaste lasten gedekt",
    description:
      expectedEndOperationalBalance != null
        ? `Je maand lijkt stabiel. Verwacht eindsaldo: ${fmt.format(expectedEndOperationalBalance)}.`
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
      roundToBucket(expectedEndOperationalBalance ?? 0, 50),
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
    buildVariableTrendDownCandidate({
      selectedMonthKey,
      currentMonthTransactions,
      previousMonthTransactions,
    }),
    buildRecurringBucketCandidate({
      bucket: "income_structural",
      selectedMonthKey,
      currentMonthTransactions,
      previousMonthTransactions,
      lookbackTransactions,
    }),
    buildRecurringBucketCandidate({
      bucket: "fixed_costs",
      selectedMonthKey,
      currentMonthTransactions,
      previousMonthTransactions,
      lookbackTransactions,
    }),
    buildRecurringBucketCandidate({
      bucket: "subscriptions",
      selectedMonthKey,
      currentMonthTransactions,
      previousMonthTransactions,
      lookbackTransactions,
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
    const reassurance = visible.filter((item) => item.type === "reassurance");
    const relevant = visible.filter(
      (item) => item.type === "attention" || item.type === "trend",
    );

    const result: Candidate[] = [];
    for (const item of reassurance) {
      if (result.length >= 3) break;
      result.push(item);
    }

    for (const item of relevant) {
      if (result.length >= 3) break;
      result.push(item);
    }

    if (result.length < 3) {
      for (const item of reassurance) {
        if (result.length >= 3) break;
        if (result.some((existing) => existing.id === item.id)) continue;
        result.push(item);
      }
    }

    if (result.length < 3) {
      result.push({
        ...buildStableFallback(),
        family: "stable-fallback",
      });
    }

    return result.slice(0, 3).map(stripInternalFields);
  }

  if (confident.length === 0) {
    return [buildStableFallback()];
  }

  return [buildStableFallback()];
}
