import type { ForecastIncomeBucket, RecurringType } from "@/types/categorization";

export type ForecastTimelineEvent = {
  date: string;
  label: string;
  amount: number;
  kind: "income" | "fixed_cost" | "subscription" | "savings_transfer";
  incomeBucket?: ForecastIncomeBucket | null;
  source:
    | "income_source"
    | "recurring_history"
    | "subscription_profile"
    | "rare_subscription";
  confidence: "medium" | "high";
  referenceTransactionId?: string | null;
  referenceCategoryId?: string | null;
  referenceCategoryPath?: string | null;
  referenceLabel?: string | null;
  referenceSourceType?:
    | "transaction"
    | "income_source"
    | "subscription_profile"
    | "rare_subscription"
    | "derived"
    | null;
};

export type ForecastTimelineProjection = {
  events: ForecastTimelineEvent[];
  upcomingCommittedIncomeTotal: number;
  upcomingCommittedExpenseTotal: number;
  upcomingCommittedSavingsOutflowTotal: number;
  nextExpectedEventDate: string | null;
  nextExpectedEventLabel: string | null;
  lowestExpectedBalance: number | null;
  lowestExpectedBalanceDate: string | null;
  cashRiskFlag: "none" | "cash_gap_warning";
};

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthExclusive(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function daysInMonth(date: Date) {
  return Math.round(
    (endOfMonthExclusive(date).getTime() - startOfMonth(date).getTime()) /
      86400000,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function monthsDiff(from: Date, to: Date) {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

export function frequencyAppliesInMonth(
  frequency: RecurringType,
  anchorDate: Date,
  monthStart: Date,
) {
  const diff = monthsDiff(startOfMonth(anchorDate), monthStart);
  if (diff < 0) return false;

  if (frequency === "monthly") return true;
  if (frequency === "quarterly") return diff % 3 === 0;
  if (frequency === "yearly") return diff % 12 === 0;
  return diff === 0;
}

export function resolveExpectedDayOfMonth(occurrenceDates: string[]) {
  const days = occurrenceDates
    .map((value) => toUtcDate(String(value || "").slice(0, 10)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getUTCDate())
    .sort((left, right) => left - right);

  if (!days.length) return null;

  const mid = Math.floor(days.length / 2);
  if (days.length % 2 === 1) return days[mid];
  return Math.round((days[mid - 1] + days[mid]) / 2);
}

export function buildScheduledDateForMonth(
  monthStart: Date,
  preferredDayOfMonth: number | null,
) {
  const resolvedDay = clamp(
    Math.round(preferredDayOfMonth || 1),
    1,
    daysInMonth(monthStart),
  );
  return dateToIso(
    new Date(
      Date.UTC(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
        resolvedDay,
      ),
    ),
  );
}

export function buildForecastTimelineProjection(params: {
  currentBalanceAnchor: number | null;
  referenceDate: Date;
  monthEndExclusive: Date;
  events: ForecastTimelineEvent[];
}) {
  const { currentBalanceAnchor, referenceDate, monthEndExclusive, events } = params;
  const referenceIso = dateToIso(referenceDate);
  const monthEndIso = dateToIso(monthEndExclusive);

  const futureEvents = [...events]
    .filter((event) => event.date > referenceIso && event.date < monthEndIso)
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date);
      if (left.amount !== right.amount) return left.amount - right.amount;
      return left.label.localeCompare(right.label, "nl");
    });

  const upcomingCommittedIncomeTotal = round2(
    futureEvents
      .filter((event) => event.amount > 0)
      .reduce((sum, event) => sum + event.amount, 0),
  );
  const upcomingCommittedExpenseTotal = round2(
    futureEvents
      .filter(
        (event) =>
          event.amount < 0 && event.kind !== "savings_transfer",
      )
      .reduce((sum, event) => sum + Math.abs(event.amount), 0),
  );
  const upcomingCommittedSavingsOutflowTotal = round2(
    futureEvents
      .filter(
        (event) =>
          event.amount < 0 && event.kind === "savings_transfer",
      )
      .reduce((sum, event) => sum + Math.abs(event.amount), 0),
  );

  let runningBalance =
    currentBalanceAnchor == null ? null : round2(currentBalanceAnchor);
  let lowestExpectedBalance = runningBalance;
  let lowestExpectedBalanceDate = runningBalance == null ? null : referenceIso;

  for (const event of futureEvents) {
    if (runningBalance == null) break;
    runningBalance = round2(runningBalance + event.amount);
    if (
      lowestExpectedBalance == null ||
      runningBalance < lowestExpectedBalance
    ) {
      lowestExpectedBalance = runningBalance;
      lowestExpectedBalanceDate = event.date;
    }
  }

  return {
    events: futureEvents,
    upcomingCommittedIncomeTotal,
    upcomingCommittedExpenseTotal,
    upcomingCommittedSavingsOutflowTotal,
    nextExpectedEventDate: futureEvents[0]?.date || null,
    nextExpectedEventLabel: futureEvents[0]?.label || null,
    lowestExpectedBalance,
    lowestExpectedBalanceDate,
    cashRiskFlag:
      lowestExpectedBalance != null && lowestExpectedBalance < 0
        ? ("cash_gap_warning" as const)
        : ("none" as const),
  } satisfies ForecastTimelineProjection;
}
