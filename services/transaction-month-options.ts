import { supabase } from "./supabase";

export const ALL_MONTHS_KEY = "all-months";

export type TransactionMonthOption = {
  key: string;
  label: string;
  monthLabel: string;
  startIso: string;
  endIso: string;
  year: number;
  month: number;
  isCurrentMonth: boolean;
};

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthOptionByKey(
  monthKey: string | null | undefined,
): TransactionMonthOption | null {
  const [yearValue, monthValue] = String(monthKey || "").split("-");
  const year = Number.parseInt(yearValue || "", 10);
  const month = Number.parseInt(monthValue || "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const key = `${year}-${String(month).padStart(2, "0")}`;

  return {
    key,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    monthLabel: start.toLocaleDateString("nl-NL", {
      month: "long",
    }),
    startIso: toLocalIsoDate(start),
    endIso: toLocalIsoDate(end),
    year,
    month,
    isCurrentMonth: key === getCurrentMonthKey(),
  };
}

export function groupMonthOptionsByYear(options: TransactionMonthOption[]) {
  const groups = new Map<number, TransactionMonthOption[]>();

  for (const option of options) {
    const existing = groups.get(option.year);
    if (existing) {
      existing.push(option);
    } else {
      groups.set(option.year, [option]);
    }
  }

  return Array.from(groups.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([year, months]) => ({
      year,
      months: months.sort((left, right) => right.month - left.month),
    }));
}

export async function listTransactionMonthOptions(params?: {
  counterparty?: string | null;
  includeFutureMonths?: number;
}) {
  const { data, error } = await supabase.rpc("list_transaction_months", {
    p_counterparty: params?.counterparty || null,
  });

  if (error) throw error;

  const optionKeys = new Set(
    ((data || []) as { month_start?: string | null }[])
      .map((row) => String(row.month_start || "").slice(0, 7))
      .filter((key) => /^\d{4}-\d{2}$/.test(key)),
  );

  const futureMonths = Math.max(0, Math.round(params?.includeFutureMonths || 0));
  if (futureMonths > 0) {
    const currentMonth = new Date();
    for (let offset = 0; offset <= futureMonths; offset += 1) {
      const futureDate = addMonths(currentMonth, offset);
      optionKeys.add(
        `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`,
      );
    }
  }

  const options = [...optionKeys]
    .sort((left, right) => right.localeCompare(left))
    .map((key) => getMonthOptionByKey(key))
    .filter((option): option is TransactionMonthOption => Boolean(option));

  if (options.length) return options;

  const fallback = getMonthOptionByKey(getCurrentMonthKey());
  return fallback ? [fallback] : [];
}
