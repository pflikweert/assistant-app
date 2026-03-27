import type {
  ForecastEvent,
  ForecastTimelineStorageEventType,
} from "@/services/forecast-domain";
import type { ForecastTimelineEvent } from "@/services/forecast-timeline";
import type { MoneyViewScope } from "@/services/finance-scope";

type StoredForecastSummaryLike = {
  scopeView: MoneyViewScope;
  monthStart: string;
  lowestExpectedBalance: number | null;
  lowestExpectedBalanceDate: string | null;
};

type ForecastTimelineEventLike =
  | ForecastTimelineEvent
  | (ForecastEvent & {
      kind?: "income" | "fixed_cost" | "subscription" | "savings_transfer" | null;
      source?: "income_source" | "recurring_history" | "subscription_profile" | "rare_subscription" | "derived";
      incomeBucket?: string | null;
    });

export type StoredForecastTimelineRow = {
  user_id: string;
  scope_view: MoneyViewScope;
  month_start: string;
  event_key: string;
  event_date: string;
  event_type: ForecastTimelineStorageEventType;
  label: string;
  amount: number;
  source:
    | "income_source"
    | "recurring_history"
    | "subscription_profile"
    | "rare_subscription"
    | "derived";
  confidence: "medium" | "high";
  fingerprint: string;
  computed_at: string;
  updated_at: string;
  reference_transaction_id?: string | null;
  reference_category_id?: string | null;
  reference_category_path?: string | null;
  reference_label?: string | null;
  reference_source_type?:
    | "transaction"
    | "income_source"
    | "subscription_profile"
    | "rare_subscription"
    | "derived"
    | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeEventKeyPart(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapEventTypeForStorage(
  event: ForecastTimelineEventLike,
): ForecastTimelineStorageEventType {
  if ("timelineKind" in event && event.timelineKind) {
    if (event.timelineKind === "income") return "income";
    if (event.timelineKind === "subscription") return "subscription";
    if (event.timelineKind === "fixed_cost") return "fixed_cost";
    if (event.timelineKind === "savings_transfer") return "savings_transfer";
  }

  if ("type" in event) {
    if (event.type === "income") return "income";
    if (event.type === "expense") return "fixed_cost";
    if (event.type === "reserve_allocation") return "savings_transfer";
    return "savings_transfer";
  }

  if (event.kind === "income") return "income";
  if (event.kind === "fixed_cost") return "fixed_cost";
  if (event.kind === "subscription") return "subscription";
  return "savings_transfer";
}

function mapCertaintyToTimelineConfidence(
  certainty: ForecastEvent["certainty"],
): "medium" | "high" {
  if (certainty === "booked" || certainty === "committed") return "high";
  return "medium";
}

export function buildForecastTimelineEventRows(params: {
  row: StoredForecastSummaryLike;
  userId: string;
  events: ForecastTimelineEventLike[];
  computedAtIso: string;
}): StoredForecastTimelineRow[] {
  const { row, userId, events, computedAtIso } = params;
  const mapped: StoredForecastTimelineRow[] = [];

  for (const event of events) {
    const eventType = mapEventTypeForStorage(event);
    if (
      "type" in event &&
      (event.type === "internal_transfer" || event.type === "correction")
    ) {
      continue;
    }
    const normalizedLabel = normalizeEventKeyPart(event.label) || "event";
    const eventKey = [
      "timelineSource" in event && event.timelineSource
        ? event.timelineSource
        : "source" in event
          ? event.source
          : "derived",
      eventType,
      event.date,
      normalizedLabel,
    ].join("|");

    const amount = event.amount;
    const confidence =
      "confidence" in event ? event.confidence : mapCertaintyToTimelineConfidence(event.certainty);
    mapped.push({
      user_id: userId,
      scope_view: row.scopeView,
      month_start: row.monthStart,
      event_key: eventKey,
      event_date: event.date,
      event_type: eventType,
      label: event.label,
      amount: round2(amount),
      source:
        "timelineSource" in event && event.timelineSource
          ? event.timelineSource
          : "source" in event
            ? event.source
            : "derived",
      confidence,
      fingerprint: [
        "timelineSource" in event && event.timelineSource
          ? event.timelineSource
          : "source" in event
            ? event.source
            : "derived",
        eventType,
        event.date,
        normalizedLabel,
        round2(amount),
        confidence,
        "incomeBucket" in event && event.incomeBucket ? event.incomeBucket : "none",
      ].join("|"),
      computed_at: computedAtIso,
      updated_at: computedAtIso,
    });
  }

  if (row.lowestExpectedBalanceDate && row.lowestExpectedBalance != null) {
    mapped.push({
      user_id: userId,
      scope_view: row.scopeView,
      month_start: row.monthStart,
      event_key: `derived|milestone_lowest_balance|${row.lowestExpectedBalanceDate}`,
      event_date: row.lowestExpectedBalanceDate,
      event_type: "milestone_lowest_balance",
      label: "Laagste punt verwacht",
      amount: round2(row.lowestExpectedBalance),
      source: "derived",
      confidence: "high",
      fingerprint: [
        "derived",
        "milestone_lowest_balance",
        row.lowestExpectedBalanceDate,
        round2(row.lowestExpectedBalance),
      ].join("|"),
      computed_at: computedAtIso,
      updated_at: computedAtIso,
    });
  }

  return mapped;
}
