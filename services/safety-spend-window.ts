import {
  listForecastTimelineEvents,
  type ForecastTimelineEventRecord,
} from "@/services/forecast-timeline-events";
import type { MoneyViewScope } from "@/services/finance-scope";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { SafeToSpendConfidenceLevel, SafeToSpendExplanationParts } from "@/services/safety-explanation";
import { buildSafeToSpendExplanation } from "@/services/safety-explanation";
import type { ConfidenceScore } from "@/services/explain-logic";
import { supabase } from "@/services/supabase";

export type SafetyAnchorType =
  | "configured"
  | "recurring_semantic"
  | "significant_fallback"
  | "fallback_end_next_month"
  | "none";

export type SafetySpendWindowSummary = {
  safeToSpendUntilNextIncome: number | null;
  projectedNetUntilNextIncome: number | null;
  nextIncomeDateAnchor: string | null;
  nextIncomeLabelAnchor: string | null;
  anchorType: SafetyAnchorType;
  isEstimatedAnchorDate: boolean;
  bridgeCrossMonthCostsUntilIncome: number | null;
  safeToSpendExplanation: string | null;
  safeToSpendExplanationParts: SafeToSpendExplanationParts | null;
  confidenceScore: ConfidenceScore;
  deltaReasonLabel: string | null;
  deltaReasonAmount: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const MIN_SIGNIFICANT_INCOME_ANCHOR_AMOUNT = 50;
const MIN_SIGNIFICANT_INCOME_FALLBACK_FLOOR = 250;
const MAIN_INCOME_LOOKAHEAD_DAYS = 31;
const MONTHS_LOOKAHEAD = 3;

const RECURRING_MAIN_INCOME_LABEL_HINTS = [
  "salaris",
  "loon",
  "uitkering",
  "pensioen",
  "toeslag",
  "kindgebonden budget",
  "kgb",
  "partnerbijdrage",
];

const WINDFALL_LABEL_HINTS = [
  "teruggave",
  "teruggaaf",
  "refund",
  "incidenteel",
  "bonus",
  "meevaller",
];

function monthStartIso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function toIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function resolveConfidence(params: {
  nextIncomeEvent: ForecastTimelineEventRecord | null;
  costsUntilIncome: number;
  eventsUntilNextIncome: ForecastTimelineEventRecord[];
}) : SafeToSpendConfidenceLevel {
  if (!params.nextIncomeEvent) return "low";
  const hasMedium = params.eventsUntilNextIncome.some(
    (event) => event.confidence !== "high",
  );
  if (!hasMedium && params.nextIncomeEvent.confidence === "high" && params.costsUntilIncome > 0) {
    return "high";
  }
  return "medium";
}

function mapSafeConfidenceToScore(level: SafeToSpendConfidenceLevel): ConfidenceScore {
  if (level === "high") return "HIGH";
  if (level === "medium") return "MEDIUM";
  return "INDICATIVE";
}

function startOfNextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function endOfNextMonth(date: Date) {
  return endOfMonth(startOfNextMonth(date));
}

function daysInMonth(date: Date) {
  return endOfMonth(date).getUTCDate();
}

function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeLabel(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function includesAnyHint(value: string, hints: string[]) {
  return hints.some((hint) => value.includes(hint));
}

function isWindfallLikeEvent(event: ForecastTimelineEventRecord) {
  return includesAnyHint(normalizeLabel(event.label), WINDFALL_LABEL_HINTS);
}

function isConfiguredIncomeAnchorEvent(
  event: ForecastTimelineEventRecord,
  includeIncomeSettings?: {
    salary?: boolean;
    childBudget?: boolean;
    structuralOther?: boolean;
    variable?: boolean;
  } | null,
) {
  if (event.eventType !== "income") return false;
  if (event.source === "income_source") return true;
  const label = normalizeLabel(event.label);
  if (includesAnyHint(label, ["salaris", "loon"])) {
    return includeIncomeSettings?.salary !== false;
  }
  if (includesAnyHint(label, ["kindgebonden budget", "kgb"])) {
    return includeIncomeSettings?.childBudget === true;
  }
  if (includesAnyHint(label, ["toeslag", "uitkering", "pensioen", "partnerbijdrage"])) {
    return includeIncomeSettings?.structuralOther === true;
  }
  return false;
}

function isRecurringSemanticIncomeAnchorEvent(event: ForecastTimelineEventRecord) {
  if (event.eventType !== "income") return false;
  if (event.source === "income_source") return true;
  return includesAnyHint(
    normalizeLabel(event.label),
    RECURRING_MAIN_INCOME_LABEL_HINTS,
  );
}

function resolveSignificantIncomeThreshold(avgMonthlyIncludedIncome: number | null) {
  const relative =
    avgMonthlyIncludedIncome == null || !Number.isFinite(avgMonthlyIncludedIncome)
      ? 0
      : 0.5 * Math.max(avgMonthlyIncludedIncome, 0);
  return Math.max(MIN_SIGNIFICANT_INCOME_FALLBACK_FLOOR, round2(relative));
}

type IncomeSourceAnchorRow = {
  source_label: string;
  expected_income: number;
  income_bucket: "salary" | "childBudget" | "structuralOther" | "variable" | null;
  income_frequency: "monthly" | "quarterly" | "yearly" | "irregular";
  income_day_of_month: number | null;
  last_detected_at: string | null;
};

function nextIncomeDateFromSource(
  row: IncomeSourceAnchorRow,
  referenceDate: Date,
): string | null {
  const dayOfMonth = Math.min(Math.max(row.income_day_of_month || 1, 1), 28);
  const refMs = referenceDate.getTime();

  if (row.income_frequency === "monthly") {
    const thisMonth = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), dayOfMonth, 12),
    );
    if (thisMonth.getTime() > refMs) return toIsoDate(thisMonth);
    const nextMonth = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, dayOfMonth, 12),
    );
    return toIsoDate(nextMonth);
  }

  const lastDetected = row.last_detected_at ? new Date(row.last_detected_at) : null;
  if (!lastDetected || Number.isNaN(lastDetected.getTime())) return null;

  const stepMonths =
    row.income_frequency === "quarterly"
      ? 3
      : row.income_frequency === "yearly"
        ? 12
        : 1;
  let candidate = new Date(
    Date.UTC(lastDetected.getUTCFullYear(), lastDetected.getUTCMonth(), dayOfMonth, 12),
  );
  while (candidate.getTime() <= refMs) {
    candidate = new Date(
      Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + stepMonths, dayOfMonth, 12),
    );
  }
  return toIsoDate(candidate);
}

async function resolveConfiguredIncomeSourceAnchor(input: {
  userId: string;
  referenceDate: Date;
  includeIncomeSettings?: {
    salary?: boolean;
    childBudget?: boolean;
    structuralOther?: boolean;
    variable?: boolean;
  } | null;
}): Promise<{ date: string; label: string } | null> {
  const { data, error } = await supabase
    .from("forecast_income_sources")
    .select(
      "source_label,expected_income,income_bucket,income_frequency,income_day_of_month,last_detected_at",
    )
    .eq("user_id", input.userId)
    .order("expected_income", { ascending: false })
    .limit(50);

  if (error || !data) return null;

  const rows = (data as Record<string, unknown>[]).map((row) => ({
    source_label: String(row.source_label || "inkomen"),
    expected_income: Math.max(Number(row.expected_income || 0), 0),
    income_bucket:
      row.income_bucket === "salary" ||
      row.income_bucket === "childBudget" ||
      row.income_bucket === "structuralOther" ||
      row.income_bucket === "variable"
        ? row.income_bucket
        : null,
    income_frequency:
      row.income_frequency === "monthly" ||
      row.income_frequency === "quarterly" ||
      row.income_frequency === "yearly"
        ? row.income_frequency
        : "irregular",
    income_day_of_month:
      row.income_day_of_month == null ? null : Math.round(Number(row.income_day_of_month)),
    last_detected_at:
      row.last_detected_at == null ? null : String(row.last_detected_at),
  })) as IncomeSourceAnchorRow[];

  const filtered = rows.filter((row) => {
    if (row.income_bucket === "salary") return input.includeIncomeSettings?.salary !== false;
    if (row.income_bucket === "childBudget") return input.includeIncomeSettings?.childBudget === true;
    if (row.income_bucket === "structuralOther") return input.includeIncomeSettings?.structuralOther === true;
    if (row.income_bucket === "variable") return input.includeIncomeSettings?.variable === true;
    return false;
  });

  const bucketScore = (bucket: IncomeSourceAnchorRow["income_bucket"]) => {
    if (bucket === "salary") return 4;
    if (bucket === "structuralOther") return 3;
    if (bucket === "childBudget") return 2;
    if (bucket === "variable") return 1;
    return 0;
  };

  const prioritized = filtered.sort((left, right) => {
    const scoreDiff = bucketScore(right.income_bucket) - bucketScore(left.income_bucket);
    if (scoreDiff !== 0) return scoreDiff;
    return right.expected_income - left.expected_income;
  });

  for (const row of prioritized) {
    const nextDate = nextIncomeDateFromSource(row, input.referenceDate);
    if (!nextDate) continue;
    if (nextDate <= toIsoDate(input.referenceDate)) continue;
    return {
      date: nextDate,
      label: row.source_label,
    };
  }

  return null;
}

function isSignificantIncomeAnchorEvent(
  event: ForecastTimelineEventRecord,
  significantThreshold: number,
) {
  if (event.eventType !== "income") return false;
  if (isWindfallLikeEvent(event)) return false;
  if (isConfiguredIncomeAnchorEvent(event)) return true;
  return Math.abs(event.amount) >= significantThreshold;
}

function isBridgeIncomeRelevantEvent(
  event: ForecastTimelineEventRecord,
  significantThreshold: number,
  includeIncomeSettings?: {
    salary?: boolean;
    childBudget?: boolean;
    structuralOther?: boolean;
    variable?: boolean;
  } | null,
) {
  if (event.eventType !== "income") return false;
  if (isConfiguredIncomeAnchorEvent(event, includeIncomeSettings)) return true;
  if (isRecurringSemanticIncomeAnchorEvent(event)) return true;
  return isSignificantIncomeAnchorEvent(event, significantThreshold);
}

function addDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function parseIsoDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function diffDaysInclusive(start: Date, end: Date) {
  const raw = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(0, raw);
}

function resolveProRataVariableUntilAnchor(params: {
  referenceDate: Date;
  anchorDate: Date;
  remainingVariableBudget: number | null;
  monthlyVariableBudgetBaseline: number | null;
}) {
  const remainingVariableBudget = Math.max(params.remainingVariableBudget || 0, 0);
  const monthlyVariableBudgetBaseline = Math.max(
    params.monthlyVariableBudgetBaseline || 0,
    0,
  );
  if (remainingVariableBudget <= 0 && monthlyVariableBudgetBaseline <= 0) return 0;
  const sameMonth =
    params.referenceDate.getUTCFullYear() === params.anchorDate.getUTCFullYear() &&
    params.referenceDate.getUTCMonth() === params.anchorDate.getUTCMonth();
  if (!sameMonth) {
    const daysBeforeAnchor = Math.max(params.anchorDate.getUTCDate() - 1, 0);
    const anchorMonthDays = daysInMonth(params.anchorDate);
    if (anchorMonthDays <= 0 || daysBeforeAnchor <= 0) return 0;
    const ratio = clamp01(daysBeforeAnchor / anchorMonthDays);
    return round2(ratio * monthlyVariableBudgetBaseline);
  }
  const start = addDays(params.referenceDate, 1);
  const end = params.anchorDate;
  const remainingDaysToAnchor = diffDaysInclusive(start, end);
  const monthEnd = endOfMonth(params.referenceDate);
  const remainingDaysInMonth = diffDaysInclusive(start, monthEnd);
  if (remainingDaysInMonth <= 0) return 0;
  const ratio = clamp01(remainingDaysToAnchor / remainingDaysInMonth);
  return round2(ratio * remainingVariableBudget);
}

function resolveProRataFixedUntilAnchor(params: {
  referenceDate: Date;
  anchorDate: Date;
  monthlyFixedBaseline: number | null;
}) {
  const fixed = Math.max(params.monthlyFixedBaseline || 0, 0);
  if (fixed <= 0) return 0;
  const anchorStartOfMonth = new Date(
    Date.UTC(params.anchorDate.getUTCFullYear(), params.anchorDate.getUTCMonth(), 1),
  );
  const nextMonthStart = startOfNextMonth(params.referenceDate);
  if (anchorStartOfMonth.getTime() < nextMonthStart.getTime()) return 0;
  const daysBeforeAnchor = Math.max(params.anchorDate.getUTCDate() - 1, 0);
  const anchorMonthDays = daysInMonth(params.anchorDate);
  if (anchorMonthDays <= 0 || daysBeforeAnchor <= 0) return 0;
  const ratio = clamp01(daysBeforeAnchor / anchorMonthDays);
  return round2(ratio * fixed);
}

export async function buildSafetySpendWindowSummary(input: {
  userId: string;
  moneyViewScope: MoneyViewScope;
  referenceDate: Date;
  freeToSpendNow: number | null;
  forecastSummary?: InsightsForecastSummary | null;
  avgMonthlyIncludedIncome?: number | null;
  includeIncomeSettings?: {
    salary?: boolean;
    childBudget?: boolean;
    structuralOther?: boolean;
    variable?: boolean;
  } | null;
  remainingVariableBudget?: number | null;
  monthlyVariableBudgetBaseline?: number | null;
  monthlyFixedBaseline?: number | null;
}): Promise<SafetySpendWindowSummary> {
  // Rule-based safety window:
  // this service uses forecast timeline events only and never depends on AI output.
  const referenceDate = input.referenceDate;
  const referenceIso = toIsoDate(referenceDate);
  const monthStarts = Array.from({ length: MONTHS_LOOKAHEAD }, (_, offset) =>
    monthStartIso(addMonths(referenceDate, offset)),
  );

  const monthEvents = await Promise.all(
    monthStarts.map((monthStart) =>
      listForecastTimelineEvents({
        userId: input.userId,
        monthStart,
        moneyViewScope: input.moneyViewScope,
      }).catch(() => [] as ForecastTimelineEventRecord[]),
    ),
  );

  const futureEvents = monthEvents
    .flat()
    .filter((event) => event.eventDate > referenceIso)
    .sort((left, right) => {
      if (left.eventDate !== right.eventDate) {
        return left.eventDate.localeCompare(right.eventDate);
      }
      return left.eventKey.localeCompare(right.eventKey);
    });

  const futureIncomeEvents = futureEvents.filter((event) => event.eventType === "income");
  const configuredIncomeSourceAnchor = await resolveConfiguredIncomeSourceAnchor({
    userId: input.userId,
    referenceDate,
    includeIncomeSettings: input.includeIncomeSettings,
  }).catch(() => null);
  const significantThreshold = resolveSignificantIncomeThreshold(
    input.avgMonthlyIncludedIncome ?? null,
  );
  const configuredIncomeEvent =
    futureIncomeEvents.find((event) =>
      isConfiguredIncomeAnchorEvent(event, input.includeIncomeSettings),
    ) || null;
  const recurringSemanticIncomeEvent =
    futureIncomeEvents.find(isRecurringSemanticIncomeAnchorEvent) || null;
  const significantFallbackIncomeEvent =
    futureIncomeEvents.find((event) =>
      isSignificantIncomeAnchorEvent(event, significantThreshold),
    ) || null;
  const timelineIncomeEvent =
    configuredIncomeEvent ||
    recurringSemanticIncomeEvent ||
    significantFallbackIncomeEvent ||
    futureIncomeEvents[0] ||
    null;
  const summaryIncomeDate = input.forecastSummary?.nextExpectedEventDate || null;
  const summaryIncomeLabel = input.forecastSummary?.nextExpectedEventLabel || null;
  const hasValidSummaryAnchor =
    summaryIncomeDate != null && summaryIncomeDate > referenceIso;
  const timelineAnchorIsWeak =
    timelineIncomeEvent == null ||
    (!isConfiguredIncomeAnchorEvent(timelineIncomeEvent, input.includeIncomeSettings) &&
      !isRecurringSemanticIncomeAnchorEvent(timelineIncomeEvent) &&
      Math.abs(timelineIncomeEvent.amount) < significantThreshold);
  const shouldPreferSummaryAnchor = hasValidSummaryAnchor && timelineAnchorIsWeak;
  const timelineAnchorType: SafetyAnchorType =
    timelineIncomeEvent == null
      ? "none"
      : isConfiguredIncomeAnchorEvent(timelineIncomeEvent, input.includeIncomeSettings)
        ? "configured"
        : isRecurringSemanticIncomeAnchorEvent(timelineIncomeEvent)
          ? "recurring_semantic"
          : isSignificantIncomeAnchorEvent(timelineIncomeEvent, significantThreshold)
            ? "significant_fallback"
            : "none";
  const timelineOrSummaryEvent =
    shouldPreferSummaryAnchor
      ? ({
          eventKey: "summary-anchor",
          eventDate: summaryIncomeDate!,
          eventType: "income",
          label: summaryIncomeLabel || "inkomen",
          amount: 0,
          source: "derived",
          confidence: "high",
          fingerprint: "summary-anchor",
        } satisfies ForecastTimelineEventRecord)
      : timelineIncomeEvent;
  let nextIncomeEvent =
    configuredIncomeSourceAnchor == null
      ? timelineOrSummaryEvent
      : ({
          eventKey: "configured-income-source-anchor",
          eventDate: configuredIncomeSourceAnchor.date,
          eventType: "income",
          label: configuredIncomeSourceAnchor.label,
          amount: 0,
          source: "income_source",
          confidence: "high",
          fingerprint: "configured-income-source-anchor",
        } satisfies ForecastTimelineEventRecord);
  let anchorType: SafetyAnchorType =
    configuredIncomeSourceAnchor != null
      ? "configured"
      : shouldPreferSummaryAnchor
        ? "configured"
        : timelineAnchorType;
  let isEstimatedAnchorDate =
    anchorType === "recurring_semantic" || anchorType === "significant_fallback";

  const lookaheadLimitIso = toIsoDate(addDays(referenceDate, MAIN_INCOME_LOOKAHEAD_DAYS));
  const anchorBeyondLookahead =
    nextIncomeEvent == null || nextIncomeEvent.eventDate > lookaheadLimitIso;
  if (anchorBeyondLookahead) {
    const fallbackAnchorDate = toIsoDate(endOfNextMonth(referenceDate));
    nextIncomeEvent = {
      eventKey: "fallback-end-next-month",
      eventDate: fallbackAnchorDate,
      eventType: "income",
      label: "volgende inkomstenperiode",
      amount: 0,
      source: "derived",
      confidence: "medium",
      fingerprint: "fallback-end-next-month",
    };
    anchorType = "fallback_end_next_month";
    isEstimatedAnchorDate = true;
  }

  if (!nextIncomeEvent) {
    return {
      safeToSpendUntilNextIncome: input.freeToSpendNow == null ? null : round2(Math.max(input.freeToSpendNow, 0)),
      projectedNetUntilNextIncome: null,
      nextIncomeDateAnchor: null,
      nextIncomeLabelAnchor: null,
      anchorType: "none",
      isEstimatedAnchorDate: true,
      bridgeCrossMonthCostsUntilIncome: null,
      safeToSpendExplanation: null,
      safeToSpendExplanationParts: null,
      confidenceScore: "INDICATIVE",
      deltaReasonLabel: null,
      deltaReasonAmount: null,
    };
  }

  const eventsUntilNextIncome = futureEvents.filter(
    (event) =>
      event.eventDate < nextIncomeEvent!.eventDate &&
      event.eventKey !== nextIncomeEvent!.eventKey,
  );

  let projectedIncome = round2(
    eventsUntilNextIncome
      .filter((event) => event.eventType === "income")
      .reduce((sum, event) => sum + Math.max(Math.abs(event.amount), 0), 0),
  );
  let projectedCosts = round2(
    eventsUntilNextIncome
      .filter(
        (event) =>
          event.eventType === "fixed_cost" ||
          event.eventType === "subscription" ||
          event.eventType === "savings_transfer",
      )
      .reduce((sum, event) => sum + Math.max(Math.abs(event.amount), 0), 0),
  );
  const shouldUseSummaryFallback =
    projectedIncome < MIN_SIGNIFICANT_INCOME_ANCHOR_AMOUNT &&
    projectedCosts === 0 &&
    shouldPreferSummaryAnchor &&
    input.forecastSummary != null;
  if (shouldUseSummaryFallback) {
    const fallbackIncome = Math.max(
      Number(input.forecastSummary?.remainingExpectedIncomeTotal || 0),
      0,
    );
    const fallbackExpense = Math.max(
      Number(input.forecastSummary?.remainingExpectedExpenseTotal || 0),
      0,
    );
    const fallbackReserve = Math.max(
      Number(input.forecastSummary?.remainingExpectedSavingsOutflowTotal || 0),
      0,
    );
    projectedIncome = round2(fallbackIncome);
    projectedCosts = round2(fallbackExpense + fallbackReserve);
  }

  const remainingIncome = Math.max(
    Number(input.forecastSummary?.remainingExpectedIncomeTotal || 0),
    0,
  );
  const remainingExpense = Math.max(
    Number(input.forecastSummary?.remainingExpectedExpenseTotal || 0),
    0,
  );
  const remainingReserve = Math.max(
    Number(input.forecastSummary?.remainingExpectedSavingsOutflowTotal || 0),
    0,
  );
  const remainingMonthNetCost = round2(Math.max(remainingExpense + remainingReserve - remainingIncome, 0));
  const nextIncomeDate = parseIsoDate(nextIncomeEvent.eventDate);
  const proRataFixedUntilAnchor = resolveProRataFixedUntilAnchor({
    referenceDate,
    anchorDate: nextIncomeDate,
    monthlyFixedBaseline: input.monthlyFixedBaseline ?? null,
  });
  const proRataVariableUntilAnchor = resolveProRataVariableUntilAnchor({
    referenceDate,
    anchorDate: nextIncomeDate,
    remainingVariableBudget: input.remainingVariableBudget ?? null,
    monthlyVariableBudgetBaseline: input.monthlyVariableBudgetBaseline ?? null,
  });
  const bridgeCosts = round2(
    Math.max(remainingMonthNetCost, projectedCosts - projectedIncome) +
      proRataFixedUntilAnchor +
      proRataVariableUntilAnchor,
  );
  const bridgeIncomeBeforeAnchor = round2(
    eventsUntilNextIncome
      .filter((event) =>
        isBridgeIncomeRelevantEvent(
          event,
          significantThreshold,
          input.includeIncomeSettings,
        ),
      )
      .reduce((sum, event) => sum + Math.max(Math.abs(event.amount), 0), 0),
  );
  const projectedNetUntilNextIncome = round2(bridgeIncomeBeforeAnchor - bridgeCosts);
  const safeToSpendUntilNextIncome =
    input.freeToSpendNow == null
      ? null
      : round2(Math.max(input.freeToSpendNow + projectedNetUntilNextIncome, 0));

  const currentMonthStart = monthStartIso(referenceDate);
  const bridgeCrossMonthCostsUntilIncome = round2(
    eventsUntilNextIncome
      .filter(
        (event) =>
          event.eventDate.slice(0, 7) !== currentMonthStart.slice(0, 7) &&
          (event.eventType === "fixed_cost" ||
            event.eventType === "subscription" ||
            event.eventType === "savings_transfer"),
      )
      .reduce((sum, event) => sum + Math.max(Math.abs(event.amount), 0), 0),
  );

  const confidence = anchorType === "fallback_end_next_month"
    ? "low"
    : resolveConfidence({
    nextIncomeEvent,
    costsUntilIncome: projectedCosts,
    eventsUntilNextIncome,
  });
  const deltaReasonCandidate = eventsUntilNextIncome
    .filter(
      (event) =>
        event.eventType === "fixed_cost" ||
        event.eventType === "subscription" ||
        event.eventType === "savings_transfer",
    )
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))[0];
  const parts: SafeToSpendExplanationParts = {
    incomeLabel: nextIncomeEvent.label || "inkomen",
    incomeDate: nextIncomeEvent.eventDate,
    isEstimatedAnchorDate,
    projectedCosts: bridgeCosts,
    projectedIncome: bridgeIncomeBeforeAnchor,
    windowStart: referenceIso,
    windowEnd: nextIncomeEvent.eventDate,
    confidence,
  };

  return {
    safeToSpendUntilNextIncome,
    projectedNetUntilNextIncome,
    nextIncomeDateAnchor: nextIncomeEvent.eventDate,
    nextIncomeLabelAnchor: nextIncomeEvent.label || null,
    anchorType,
    isEstimatedAnchorDate,
    bridgeCrossMonthCostsUntilIncome,
    safeToSpendExplanation: buildSafeToSpendExplanation(parts),
    safeToSpendExplanationParts: parts,
    confidenceScore: mapSafeConfidenceToScore(confidence),
    deltaReasonLabel: deltaReasonCandidate?.label || null,
    deltaReasonAmount:
      deltaReasonCandidate?.amount == null
        ? null
        : round2(Math.abs(deltaReasonCandidate.amount)),
  };
}
