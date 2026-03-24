import { supabase } from "@/services/supabase";

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
}): Promise<ForecastTimelineEventRecord[]> {
  const { userId, monthStart } = params;

  const legacySelect =
    "event_key,event_date,event_type,label,amount,source,confidence,fingerprint";

  const result: any = await supabase
    .from("forecast_timeline_events")
    .select(legacySelect)
    .eq("user_id", userId)
    .eq("month_start", monthStart)
    .order("event_date", { ascending: true })
    .order("event_key", { ascending: true })
    .limit(200);

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
