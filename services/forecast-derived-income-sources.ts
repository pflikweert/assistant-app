import { resolveExpectedDayOfMonth } from "./forecast-timeline";
import { resolveIncomeSemanticsForTransaction } from "./income-semantics";
import type { CategoryRecord, RecurringType } from "../types/categorization";

type ForecastLikeTx = {
  date: string;
  amount: number;
  details: string;
  counterparty: string | null;
  recurring_type: RecurringType | null;
  category_id_auto: string | null;
  category_id_user: string | null;
  analysis_category:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
  budget_excluded?: boolean;
};

export type ForecastDerivedIncomeSource = {
  source_key: string;
  source_label: string;
  expected_income: number;
  income_frequency: RecurringType;
  income_day_of_month: number | null;
  last_detected_at: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePattern(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dateToMiddayIso(isoDate: string) {
  const date = toUtcDate(isoDate);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  ).toISOString();
}

function weightedRecentAverage(values: number[]) {
  if (!values.length) return 0;
  if (values.length === 1) return round2(values[0]);

  const weights = [0.72, 0.28];
  let weightedTotal = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    const weight = weights[index] ?? Math.max(0.14 / (index + 1), 0);
    weightedTotal += value * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return round2(values[0]);
  return round2(weightedTotal / totalWeight);
}

function classifyRecurringType(dayIntervals: number[]): RecurringType {
  if (!dayIntervals.length) return "irregular";
  const average =
    dayIntervals.reduce((sum, value) => sum + value, 0) / dayIntervals.length;

  if (average >= 26 && average <= 35) return "monthly";
  if (average >= 80 && average <= 100) return "quarterly";
  if (average >= 350 && average <= 380) return "yearly";
  return "irregular";
}

function descriptor(tx: Pick<ForecastLikeTx, "counterparty" | "details">) {
  return normalizePattern(
    tx.counterparty || tx.details.split("|")[0] || tx.details,
  );
}

function labelForTransaction(tx: Pick<ForecastLikeTx, "counterparty" | "details">) {
  const label = String(
    tx.counterparty || tx.details.split("|")[0] || tx.details || "",
  ).trim();
  return label || "Inkomst";
}

export function deriveIncomeSourcesFromTransactions(
  transactions: ForecastLikeTx[],
  categoryMap: Map<string, CategoryRecord>,
): ForecastDerivedIncomeSource[] {
  const grouped = new Map<string, ForecastLikeTx[]>();

  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    if (tx.budget_excluded) continue;

    const semantics = resolveIncomeSemanticsForTransaction(tx, categoryMap);
    if (!semantics.forecastEligible) continue;

    const key = descriptor(tx);
    if (!key) continue;

    const current = grouped.get(key) || [];
    current.push(tx);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, rows]) => {
      const sortedDesc = [...rows].sort((left, right) =>
        right.date.localeCompare(left.date),
      );
      const latest = sortedDesc[0];
      if (!latest) return null;

      const sortedAsc = [...sortedDesc].sort((left, right) =>
        left.date.localeCompare(right.date),
      );
      const intervals: number[] = [];
      for (let index = 1; index < sortedAsc.length; index += 1) {
        const previousDate = toUtcDate(sortedAsc[index - 1].date);
        const nextDate = toUtcDate(sortedAsc[index].date);
        const diffDays = Math.round(
          (nextDate.getTime() - previousDate.getTime()) / 86400000,
        );
        if (diffDays > 0) intervals.push(diffDays);
      }

      const recurringType =
        latest.recurring_type && latest.recurring_type !== "irregular"
          ? latest.recurring_type
          : classifyRecurringType(intervals);

      return {
        source_key: key,
        source_label: labelForTransaction(latest),
        expected_income: weightedRecentAverage(
          sortedDesc.slice(0, 3).map((row) => Math.abs(row.amount)),
        ),
        income_frequency: recurringType,
        income_day_of_month:
          resolveExpectedDayOfMonth(sortedDesc.slice(0, 6).map((row) => row.date)) ??
          toUtcDate(latest.date).getUTCDate(),
        last_detected_at: dateToMiddayIso(latest.date),
      } satisfies ForecastDerivedIncomeSource;
    })
    .filter((row): row is ForecastDerivedIncomeSource => Boolean(row))
    .sort((left, right) => left.source_label.localeCompare(right.source_label, "nl"));
}

export function mergeForecastIncomeSources(
  persisted: ForecastDerivedIncomeSource[],
  derived: ForecastDerivedIncomeSource[],
) {
  const merged = new Map<string, ForecastDerivedIncomeSource>();

  for (const source of persisted) {
    const key = normalizePattern(source.source_key);
    if (!key) continue;
    merged.set(key, { ...source, source_key: key });
  }

  for (const source of derived) {
    const key = normalizePattern(source.source_key);
    if (!key) continue;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...source, source_key: key });
      continue;
    }

    const derivedIsNewer = source.last_detected_at > existing.last_detected_at;
    merged.set(key, {
      source_key: key,
      source_label:
        derivedIsNewer && source.source_label ? source.source_label : existing.source_label,
      expected_income: round2(
        Math.max(existing.expected_income || 0, source.expected_income || 0),
      ),
      income_frequency:
        source.income_frequency !== "irregular"
          ? source.income_frequency
          : existing.income_frequency,
      income_day_of_month:
        source.income_day_of_month ?? existing.income_day_of_month,
      last_detected_at:
        derivedIsNewer ? source.last_detected_at : existing.last_detected_at,
    });
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.source_label.localeCompare(right.source_label, "nl"),
  );
}
