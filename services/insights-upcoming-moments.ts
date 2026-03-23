import type { InsightsForecastSummary } from "@/services/insights-month-context";
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
    const fallbackDay = iso.slice(-2);
    return {
      dayLabel: fallbackDay || "--",
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

function normalizeEventLabel(label: string | null | undefined) {
  return String(label || "").trim();
}

function isIncomeLabel(label: string) {
  const normalized = label.toLowerCase();
  return (
    normalized.includes("salaris") ||
    normalized.includes("inkomen") ||
    normalized.includes("loon") ||
    normalized.includes("storting")
  );
}

function isExpenseLabel(label: string) {
  const normalized = label.toLowerCase();
  return (
    normalized.includes("incasso") ||
    normalized.includes("vaste last") ||
    normalized.includes("huur") ||
    normalized.includes("hypotheek") ||
    normalized.includes("abonnement")
  );
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

export function buildInsightsUpcomingMoments(input: {
  forecast: InsightsForecastSummary | null;
  selectedMonth: TransactionMonthOption;
  now?: Date;
}): InsightsUpcomingMoment[] {
  const { forecast, selectedMonth, now = new Date() } = input;
  if (!forecast) return [];

  const isHistoricalMonth = selectedMonth.key < getCurrentMonthKey(now);
  if (isHistoricalMonth) return [];

  const monthEndInclusive = (() => {
    const endExclusive = parseIsoDate(selectedMonth.endIso);
    if (!endExclusive) return null;
    return new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
  })();

  const referenceIso =
    forecast.forecastReferenceDate ||
    (selectedMonth.isCurrentMonth ? isoFromDate(now) : selectedMonth.startIso);

  const candidates: InsightsUpcomingMoment[] = [];

  if (
    forecast.lowestExpectedBalanceDate &&
    forecast.lowestExpectedBalance != null &&
    forecast.lowestExpectedBalanceDate > referenceIso
  ) {
    const labels = toDayMonthLabels(forecast.lowestExpectedBalanceDate);
    candidates.push({
      id: "lowest-balance",
      dateIso: forecast.lowestExpectedBalanceDate,
      dayLabel: labels.dayLabel,
      monthLabel: labels.monthLabel,
      title: "Laagste saldo verwacht",
      subtitle: "Moment van minste saldo",
      amountLabel: buildAmountLabel(forecast.lowestExpectedBalance, "neutral"),
      amountTone: "neutral",
    });
  }

  const nextLabel = normalizeEventLabel(forecast.nextExpectedEventLabel);
  if (forecast.nextExpectedEventDate && forecast.nextExpectedEventDate > referenceIso) {
    const labels = toDayMonthLabels(forecast.nextExpectedEventDate);
    const tone = isIncomeLabel(nextLabel)
      ? "income"
      : isExpenseLabel(nextLabel)
        ? "expense"
        : "neutral";
    const amountValue =
      tone === "income"
        ? forecast.upcomingCommittedIncomeTotal
        : tone === "expense"
          ? forecast.upcomingCommittedExpenseTotal
          : null;
    candidates.push({
      id: "next-event",
      dateIso: forecast.nextExpectedEventDate,
      dayLabel: labels.dayLabel,
      monthLabel: labels.monthLabel,
      title: nextLabel || "Volgend verwacht moment",
      subtitle:
        tone === "income"
          ? "Verwachte inkomende betaling"
          : tone === "expense"
            ? "Verwachte uitgaande betaling"
            : "Belangrijk verwacht moment",
      amountLabel: buildAmountLabel(amountValue, tone),
      amountTone: tone,
    });
  }

  if (
    monthEndInclusive &&
    forecast.upcomingCommittedExpenseTotal > 0 &&
    isoFromDate(monthEndInclusive) > referenceIso
  ) {
    const labels = toDayMonthLabels(isoFromDate(monthEndInclusive));
    candidates.push({
      id: "expense-cluster",
      dateIso: isoFromDate(monthEndInclusive),
      dayLabel: labels.dayLabel,
      monthLabel: labels.monthLabel,
      title: "Grote vaste lasten",
      subtitle: "Nog verwacht deze maand",
      amountLabel: buildAmountLabel(forecast.upcomingCommittedExpenseTotal, "expense"),
      amountTone: "expense",
    });
  }

  if (
    monthEndInclusive &&
    forecast.upcomingCommittedIncomeTotal > 0 &&
    isoFromDate(monthEndInclusive) > referenceIso
  ) {
    const labels = toDayMonthLabels(isoFromDate(monthEndInclusive));
    candidates.push({
      id: "income-cluster",
      dateIso: isoFromDate(monthEndInclusive),
      dayLabel: labels.dayLabel,
      monthLabel: labels.monthLabel,
      title: "Salaris verwacht",
      subtitle: "Verwachte inkomende betalingen",
      amountLabel: buildAmountLabel(forecast.upcomingCommittedIncomeTotal, "income"),
      amountTone: "income",
    });
  }

  return dedupeByMeaning(candidates)
    .sort((left, right) => {
      if (left.dateIso !== right.dateIso) return left.dateIso.localeCompare(right.dateIso);
      return left.title.localeCompare(right.title, "nl");
    })
    .slice(0, 4);
}

