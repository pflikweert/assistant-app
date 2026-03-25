import type { ForecastTimelineEventRecord } from "@/services/forecast-timeline-events";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { InsightsSignalTransaction } from "@/services/insights-highlights";
import type { TransactionMonthOption } from "@/services/transaction-month-options";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export type InsightsUpcomingMoment = {
  id: string;
  dateIso: string;
  dayLabel: string;
  monthLabel: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  amountTone: "income" | "expense" | "neutral";
};

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function isoFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function toDayMonthLabels(iso: string) {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return {
      dayLabel: iso.slice(-2) || "--",
      monthLabel: "DAT",
    };
  }

  return {
    dayLabel: String(parsed.getUTCDate()),
    monthLabel: parsed
      .toLocaleDateString("nl-NL", { month: "short", timeZone: "UTC" })
      .replace(".", "")
      .toUpperCase(),
  };
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedComparisonLabel(value: string | null | undefined) {
  return normalizeText(value);
}

function confidenceCopy(confidence: "high" | "medium") {
  return confidence === "high" ? "Verwacht" : "Verwacht rond";
}

type ReferenceSignal = Pick<
  InsightsSignalTransaction,
  "counterparty" | "details" | "categoryKey" | "categoryLabel" | "analysisCategory" | "amount"
> & {
  date: string;
};

function isGenericMomentLabel(label: string) {
  const normalized = normalizeText(label);
  return (
    !normalized ||
    normalized === "onbekend" ||
    normalized === "verwacht moment" ||
    normalized === "belangrijk verwacht moment" ||
    normalized === "grote vaste lasten" ||
    normalized === "salaris verwacht" ||
    normalized === "verwachte inkomende betaling" ||
    normalized === "verwachte inkomende betalingen" ||
    normalized === "verwachte uitgave" ||
    normalized === "verwachte betaling" ||
    normalized === "nog verwacht deze maand"
  );
}

function buildSignalLookup(signals: InsightsSignalTransaction[] | null | undefined) {
  const lookup = new Map<string, ReferenceSignal[]>();

  for (const signal of signals || []) {
    const record: ReferenceSignal = {
      counterparty: signal.counterparty,
      details: signal.details,
      categoryKey: signal.categoryKey,
      categoryLabel: signal.categoryLabel,
      analysisCategory: signal.analysisCategory,
      amount: signal.amount,
      date: signal.date,
    };

    const candidateKeys = [
      normalizedComparisonLabel(signal.counterparty),
      normalizedComparisonLabel(signal.details?.split("|")[0]),
      normalizedComparisonLabel(signal.details),
    ].filter(Boolean);

    for (const key of candidateKeys) {
      const existing = lookup.get(key) || [];
      existing.push(record);
      lookup.set(key, existing);
    }
  }

  for (const [key, values] of lookup.entries()) {
    lookup.set(
      key,
      [...values].sort((left, right) => right.date.localeCompare(left.date)),
    );
  }

  return lookup;
}

function resolveSignalForEvent(
  event: ForecastTimelineEventRecord,
  lookup: Map<string, ReferenceSignal[]>,
) {
  const keys = [
    normalizedComparisonLabel(event.label),
    normalizedComparisonLabel(event.label.split("|")[0]),
  ].filter(Boolean);

  const isIncomeEvent = event.eventType === "income";
  const isExpenseEvent = event.eventType === "fixed_cost" || event.eventType === "subscription";

  for (const key of keys) {
    const found = lookup.get(key);
    if (!found) continue;

    const compatible = found.find((signal) => {
      if (isIncomeEvent) {
        return signal.amount > 0 && signal.analysisCategory?.startsWith("income") === true;
      }
      if (isExpenseEvent) {
        return (
          signal.amount < 0 &&
          (signal.analysisCategory === "fixed_costs" ||
            signal.analysisCategory === "subscriptions")
        );
      }
      if (event.eventType === "savings_transfer") {
        return signal.amount < 0 && signal.analysisCategory === "savings_transfer";
      }
      return true;
    });

    if (compatible) return compatible;
  }

  return null;
}

function buildMomentSubtitle(
  event: ForecastTimelineEventRecord,
  signal: ReferenceSignal | null,
) {
  if (event.eventType === "milestone_lowest_balance") {
    return `${confidenceCopy(event.confidence)} moment van minste saldo`;
  }

  const categoryLabel = cleanDetails(signal?.categoryLabel);
  const categoryKey = normalizeText(signal?.categoryKey);
  const signalType = signal?.analysisCategory || null;
  const isFixedCostSignal = signalType === "fixed_costs";
  const isSubscriptionSignal = signalType === "subscriptions";
  const isSalaryCategory =
    categoryKey.includes("salary") ||
    normalizeText(categoryLabel).includes("salaris") ||
    normalizeText(categoryLabel).includes("loon");

  if (signalType === "income_structural" && isSalaryCategory) {
    return "Verwacht salaris";
  }

  if (signalType === "income_variable") {
    return "Verwachte inkomende betaling";
  }

  if (signalType === "savings_transfer") {
    return "Verwachte spaarboeking";
  }

  if (isSubscriptionSignal) {
    if (categoryLabel) return categoryLabel;
    return "Verwacht abonnement";
  }

  if (isFixedCostSignal) {
    if (categoryLabel) {
      const normalized = normalizeText(categoryLabel);
      if (normalized.includes("verzekering")) {
        return `Vaste lasten ${categoryLabel.toLowerCase()}`;
      }
      return categoryLabel;
    }
    return "Verwachte vaste last";
  }

  if (categoryLabel) return categoryLabel;

  if (event.eventType === "income") return "Verwachte inkomende betaling";
  if (event.eventType === "subscription") return "Verwacht abonnement";
  if (event.eventType === "savings_transfer") return "Verwachte spaarboeking";
  if (event.eventType === "fixed_cost") return "Verwachte vaste last";
  return "Verwachte betaling";
}

function buildAmountLabel(value: number | null, tone: "income" | "expense" | "neutral") {
  if (value == null || Number.isNaN(value)) return "n.b.";
  if (tone === "income") return `+ ${fmt.format(Math.abs(value))}`;
  if (tone === "expense") return `- ${fmt.format(Math.abs(value))}`;
  return fmt.format(value);
}

function dedupeByMeaning(items: InsightsUpcomingMoment[]) {
  const seen = new Set<string>();
  const next: InsightsUpcomingMoment[] = [];
  for (const item of items) {
    const key = `${item.dateIso}|${item.title.toLowerCase()}|${item.amountLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

function cleanDetails(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const first = raw.split("|")[0]?.trim() || raw;
  if (!first) return null;
  return first.length > 42 ? `${first.slice(0, 39)}...` : first;
}

function hasFutureDate(
  eventDate: string,
  referenceIso: string,
  selectedMonth: TransactionMonthOption,
) {
  return (
    eventDate > referenceIso &&
    eventDate >= selectedMonth.startIso &&
    eventDate < selectedMonth.endIso
  );
}

function hasRelevantTimelineAmount(amount: number) {
  return Number.isFinite(amount) && Math.abs(amount) >= 1;
}

function buildFromTimelineEvents(input: {
  timelineEvents: ForecastTimelineEventRecord[];
  referenceSignals: InsightsSignalTransaction[] | null | undefined;
  referenceIso: string;
  selectedMonth: TransactionMonthOption;
}) {
  const { timelineEvents, referenceSignals, referenceIso, selectedMonth } = input;
  const signalLookup = buildSignalLookup(referenceSignals);
  const futureEvents = timelineEvents
    .filter(
      (event) =>
        hasFutureDate(event.eventDate, referenceIso, selectedMonth) &&
        (event.eventType === "milestone_lowest_balance" ||
          hasRelevantTimelineAmount(event.amount)),
    )
    .sort((left, right) => {
      if (left.eventDate !== right.eventDate) return left.eventDate.localeCompare(right.eventDate);
      return left.eventKey.localeCompare(right.eventKey);
    });

  if (!futureEvents.length) return [];

  const picked: ForecastTimelineEventRecord[] = [];
  const pushUnique = (event: ForecastTimelineEventRecord | null | undefined) => {
    if (!event) return;
    if (picked.some((row) => row.eventKey === event.eventKey)) return;
    picked.push(event);
  };

  pushUnique(futureEvents.find((event) => event.eventType === "milestone_lowest_balance"));

  for (const event of futureEvents) {
    if (picked.length >= 4) break;
    if (event.eventType === "milestone_lowest_balance") continue;
    const title = cleanDetails(event.label);
    if (isGenericMomentLabel(title)) continue;
    pushUnique(event);
  }

  const mapped = picked
    .sort((left, right) => left.eventDate.localeCompare(right.eventDate))
    .slice(0, 4)
    .map((event) => {
      const labels = toDayMonthLabels(event.eventDate);
      const title = cleanDetails(event.label) || "Verwacht moment";
      const matchedSignal = resolveSignalForEvent(event, signalLookup);

      if (event.eventType === "milestone_lowest_balance") {
        return {
          id: event.eventKey,
          dateIso: event.eventDate,
          dayLabel: labels.dayLabel,
          monthLabel: labels.monthLabel,
          title: "Laagste saldo verwacht",
          subtitle: `${confidenceCopy(event.confidence)} moment van minste saldo`,
          amountLabel: buildAmountLabel(event.amount, "neutral"),
          amountTone: "neutral" as const,
        } satisfies InsightsUpcomingMoment;
      }

      if (isGenericMomentLabel(title)) return null;

      return {
        id: event.eventKey,
        dateIso: event.eventDate,
        dayLabel: labels.dayLabel,
        monthLabel: labels.monthLabel,
        title,
        subtitle: buildMomentSubtitle(event, matchedSignal),
        amountLabel: buildAmountLabel(
          event.amount,
          event.amount > 0 ? "income" : event.eventType === "income" ? "income" : "expense",
        ),
        amountTone: (event.amount > 0 ? "income" : "expense") as
          | "income"
          | "expense",
      } satisfies InsightsUpcomingMoment;
    })
    .filter((item): item is InsightsUpcomingMoment => item !== null);

  return dedupeByMeaning(mapped);
}

export function buildInsightsUpcomingMoments(input: {
  forecast: InsightsForecastSummary | null;
  timelineEvents?: ForecastTimelineEventRecord[] | null;
  referenceSignals?: InsightsSignalTransaction[] | null;
  selectedMonth: TransactionMonthOption;
  now?: Date;
}): InsightsUpcomingMoment[] {
  const {
    forecast,
    timelineEvents = null,
    referenceSignals = null,
    selectedMonth,
    now = new Date(),
  } = input;
  if (!forecast) return [];

  const isHistoricalMonth = selectedMonth.key < getCurrentMonthKey(now);
  if (isHistoricalMonth) return [];

  const referenceIso =
    forecast.forecastReferenceDate ||
    (selectedMonth.isCurrentMonth ? isoFromDate(now) : selectedMonth.startIso);

  if (timelineEvents && timelineEvents.length > 0) {
    const fromTimeline = buildFromTimelineEvents({
      timelineEvents,
      referenceSignals,
      referenceIso,
      selectedMonth,
    });
    if (fromTimeline.length > 0) return fromTimeline;
  }

  if (
    forecast.lowestExpectedBalanceDate &&
    forecast.lowestExpectedBalance != null &&
    forecast.lowestExpectedBalanceDate > referenceIso
  ) {
    const labels = toDayMonthLabels(forecast.lowestExpectedBalanceDate);
    return [
      {
        id: "lowest-balance",
        dateIso: forecast.lowestExpectedBalanceDate,
        dayLabel: labels.dayLabel,
        monthLabel: labels.monthLabel,
        title: "Laagste saldo verwacht",
        subtitle: "Moment van minste saldo",
        amountLabel: buildAmountLabel(forecast.lowestExpectedBalance, "neutral"),
        amountTone: "neutral",
      },
    ];
  }

  return [];
}
