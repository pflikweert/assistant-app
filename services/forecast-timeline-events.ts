import { supabase } from "@/services/supabase";
import type { ForecastEvent } from "@/services/forecast-domain";
import {
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";

export type ForecastTimelineEventRecord = {
  eventKey: string;
  eventDate: string;
  eventType:
    | "income"
    | "fixed_cost"
    | "subscription"
    | "savings_transfer"
    | "milestone_lowest_balance";
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
};

export function mapForecastTimelineEventRecordToForecastEvent(
  record: ForecastTimelineEventRecord,
): ForecastEvent | null {
  if (record.eventType === "milestone_lowest_balance") return null;

  const amount = Math.abs(Number(record.amount || 0));
  const label = String(record.label || "").trim() || "Onbekend";

  if (record.eventType === "income") {
    return {
      id: record.eventKey,
      date: record.eventDate,
      type: "income",
      certainty: record.confidence === "high" ? "booked" : "committed",
      moneyLayer: "operational",
      amount,
      label,
      accountRole: "operational",
      ownerScope: "personal",
      timelineKind: "income",
      timelineSource: record.source,
      sourceLabel: label,
    };
  }

  if (record.eventType === "savings_transfer") {
    return {
      id: record.eventKey,
      date: record.eventDate,
      type: "reserve_allocation",
      certainty: record.confidence === "high" ? "booked" : "committed",
      moneyLayer: "reserved",
      amount,
      label,
      accountRole: "reserve",
      ownerScope: "personal",
      timelineKind: "savings_transfer",
      timelineSource: record.source,
      sourceLabel: label,
    };
  }

  return {
    id: record.eventKey,
    date: record.eventDate,
    type: record.eventType === "subscription" ? "expense" : "expense",
    certainty: record.confidence === "high" ? "booked" : "inferred",
    moneyLayer: "operational",
    amount,
    label,
    accountRole: "operational",
    ownerScope: "personal",
    timelineKind:
      record.eventType === "subscription" ? "subscription" : "fixed_cost",
    timelineSource: record.source,
    sourceLabel: label,
  };
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function isMissingColumnError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
  if (code === "42703" || code === "PGRST204") return true;
  return message.includes("column") && message.includes("does not exist");
}

export async function listForecastTimelineEvents(params: {
  userId: string;
  monthStart: string;
  moneyViewScope?: MoneyViewScope;
}): Promise<ForecastTimelineEventRecord[]> {
  const { userId, monthStart } = params;
  const moneyViewScope = normalizeMoneyViewScope(params.moneyViewScope);

  const legacySelect =
    "event_key,event_date,event_type,label,amount,source,confidence,fingerprint";

  const scopedSelect =
    "event_key,event_date,event_type,label,amount,source,confidence,fingerprint,scope_view";

  let result: any = await supabase
    .from("forecast_timeline_events")
    .select(scopedSelect)
    .eq("user_id", userId)
    .eq("scope_view", moneyViewScope)
    .eq("month_start", monthStart)
    .order("event_date", { ascending: true })
    .order("event_key", { ascending: true })
    .limit(200);

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from("forecast_timeline_events")
      .select(legacySelect)
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .order("event_date", { ascending: true })
      .order("event_key", { ascending: true })
      .limit(200);
  }

  if (result.error) {
    if (isMissingRelationError(result.error) || isMissingColumnError(result.error)) {
      return [];
    }
    throw result.error;
  }

  return ((result.data || []) as Record<string, unknown>[]).map((row) => ({
    eventKey: String(row.event_key || ""),
    eventDate: String(row.event_date || ""),
    eventType:
      row.event_type === "income" ||
      row.event_type === "fixed_cost" ||
      row.event_type === "subscription" ||
      row.event_type === "savings_transfer" ||
      row.event_type === "milestone_lowest_balance"
        ? row.event_type
        : "fixed_cost",
    label: String(row.label || ""),
    amount: Number(row.amount || 0),
    source:
      row.source === "income_source" ||
      row.source === "recurring_history" ||
      row.source === "subscription_profile" ||
      row.source === "rare_subscription" ||
      row.source === "derived"
        ? row.source
        : "derived",
    confidence: row.confidence === "high" ? "high" : "medium",
    fingerprint: String(row.fingerprint || ""),
  }));
}
