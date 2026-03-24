import { getBudgetCategoryDisplayLabel } from "@/services/budget-week-attention";
import { getBudgetRiskTone } from "@/services/budget-risk";
import type { InsightsSignalTransaction } from "@/services/insights-highlights";
import type { TransactionMonthOption } from "@/services/transaction-month-options";
import type {
  BudgetCategoryKey,
  BudgetPlanComputation,
} from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const SUMMARY_CATEGORY_KEYS: BudgetCategoryKey[] = [
  "fixed_costs",
  "subscriptions",
  "groceries",
  "fuel",
  "smoking",
  "other",
];

export type InsightsCategorySummaryMode = "open" | "closed" | "fallback";
export type InsightsCategoryAmountKind = "actual" | "planned" | "expected";

export type InsightsCategorySummaryRow = {
  categoryKey: string;
  label: string;
  amountLabel: string;
  amountValue: number;
  amountKind: InsightsCategoryAmountKind;
  statusLabel: string;
  contextLabel: string;
  progress: number | null;
  progressTone: ReturnType<typeof getBudgetRiskTone> | null;
};

export type InsightsCategorySummaryModel = {
  mode: InsightsCategorySummaryMode;
  title: string;
  subtitle: string;
  rows: InsightsCategorySummaryRow[];
  emptyTitle: string;
  emptyDescription: string;
};

function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveMode(
  selectedMonth: TransactionMonthOption,
  budgetPlan: BudgetPlanComputation | null,
  currentMonthTransactions: InsightsSignalTransaction[],
): InsightsCategorySummaryMode {
  if (selectedMonth.key < getCurrentMonthKey()) return "closed";
  if (budgetPlan) return "open";
  if (currentMonthTransactions.length > 0) return "fallback";
  return "open";
}

function resolveTitleSubtitle(mode: InsightsCategorySummaryMode) {
  if (mode === "closed") {
    return {
      title: "Grootste uitgaven deze maand",
      subtitle: "Gebaseerd op werkelijke uitgaven",
    };
  }

  if (mode === "fallback") {
    return {
      title: "Grootste uitgaven tot nu toe",
      subtitle: "Gebaseerd op werkelijke uitgaven en beperkte budgetdata",
    };
  }

  return {
    title: "Verwachte grootste uitgaven",
    subtitle: "Gebaseerd op geplande lasten, abonnementen en je budgetten",
  };
}

function resolveSummaryLabel(categoryKey: BudgetCategoryKey) {
  return getBudgetCategoryDisplayLabel(categoryKey);
}

function toPercent(value: number) {
  return Math.max(0, Math.min(1, value));
}

function buildClosedRowsFromBudgetPlan(
  budgetPlan: BudgetPlanComputation,
): InsightsCategorySummaryRow[] {
  const rows = budgetPlan.recommendations
    .filter(
      (row) =>
        SUMMARY_CATEGORY_KEYS.includes(row.categoryKey as BudgetCategoryKey) &&
        row.monthlyActual > 0,
    )
    .map((row) => ({
      categoryKey: row.categoryKey,
      label: row.label || resolveSummaryLabel(row.categoryKey),
      amountValue: roundCurrency(Math.max(row.monthlyActual, 0)),
      amountLabel: fmt.format(Math.max(row.monthlyActual, 0)),
      amountKind: "actual" as const,
      statusLabel: "Werkelijk",
      contextLabel: "Werkelijke uitgaven in deze maand",
      progress: null,
      progressTone: null,
    }));

  return rows
    .sort((left, right) => right.amountValue - left.amountValue)
    ;
}

function buildOpenRowsFromBudgetPlan(
  budgetPlan: BudgetPlanComputation,
): InsightsCategorySummaryRow[] {
  const rows = budgetPlan.recommendations
    .filter((row) =>
      SUMMARY_CATEGORY_KEYS.includes(row.categoryKey as BudgetCategoryKey),
    )
    .map((row) => {
      const planned = roundCurrency(Math.max(row.monthlyBudget, 0));
      const actual = roundCurrency(Math.max(row.monthlyActual, 0));
      const isFixedOrSubscription =
        row.categoryKey === "fixed_costs" || row.categoryKey === "subscriptions";

      if (planned <= 0 && actual <= 0) {
        return null;
      }

      if (isFixedOrSubscription) {
        const expectedAmount = Math.max(planned, actual);
        const amountKind: InsightsCategoryAmountKind =
          actual > planned && actual > 0
            ? "actual"
            : actual > 0
              ? "expected"
              : "planned";

        const progress =
          planned > 0 && actual > 0 ? toPercent(actual / Math.max(planned, 1)) : null;

        return {
          categoryKey: row.categoryKey,
          label: row.label || resolveSummaryLabel(row.categoryKey),
          amountValue: roundCurrency(expectedAmount),
          amountLabel: fmt.format(expectedAmount),
          amountKind,
          statusLabel:
            amountKind === "actual"
              ? "Werkelijk"
              : amountKind === "expected"
                ? "Verwacht"
                : "Gepland",
          contextLabel:
            actual > 0
              ? `${fmt.format(actual)} uitgegeven tot nu toe`
              : "Nog niet afgeschreven",
          progress,
          progressTone:
            progress != null ? getBudgetRiskTone(progress) : null,
        } satisfies InsightsCategorySummaryRow;
      }

      if (planned > 0) {
        const progress =
          actual > 0 ? toPercent(actual / Math.max(planned, 1)) : null;
        const amountKind: InsightsCategoryAmountKind =
          actual > 0 ? "expected" : "planned";

        return {
          categoryKey: row.categoryKey,
          label: row.label || resolveSummaryLabel(row.categoryKey),
          amountValue: planned,
          amountLabel: fmt.format(planned),
          amountKind,
          statusLabel: amountKind === "expected" ? "Verwacht" : "Gepland",
          contextLabel:
            actual > 0
              ? `${fmt.format(actual)} uitgegeven tot nu toe`
              : "Volledig gepland",
          progress,
          progressTone:
            progress != null ? getBudgetRiskTone(progress) : null,
        } satisfies InsightsCategorySummaryRow;
      }

      if (actual <= 0) return null;

      return {
        categoryKey: row.categoryKey,
        label: row.label || resolveSummaryLabel(row.categoryKey),
        amountValue: actual,
        amountLabel: fmt.format(actual),
        amountKind: "actual" as const,
        statusLabel: "Werkelijk",
        contextLabel: "Geen budgetplan, op basis van besteding tot nu toe",
        progress: null,
        progressTone: null,
      } satisfies InsightsCategorySummaryRow;
    })
    .filter((row): row is InsightsCategorySummaryRow => Boolean(row));

  return rows
    .sort((left, right) => {
      const amountDiff = right.amountValue - left.amountValue;
      if (amountDiff !== 0) return amountDiff;
      if (left.amountKind === right.amountKind) return left.label.localeCompare(right.label);
      const kindWeight: Record<InsightsCategoryAmountKind, number> = {
        actual: 2,
        expected: 1,
        planned: 0,
      };
      return kindWeight[right.amountKind] - kindWeight[left.amountKind];
    })
    ;
}

function buildFallbackRows(
  currentMonthTransactions: InsightsSignalTransaction[],
): InsightsCategorySummaryRow[] {
  const grouped = new Map<
    string,
    {
      key: string;
      label: string;
      amount: number;
    }
  >();

  for (const tx of currentMonthTransactions) {
    if (tx.amount >= 0) continue;

    const rawLabel =
      tx.categoryLabel || tx.categoryKey || tx.counterparty || tx.details || "Onbekend";
    const key = tx.categoryKey || normalizeLabel(rawLabel) || "onbekend";
    const current = grouped.get(key);
    const amount = Math.abs(tx.amount);
    if (!current) {
      grouped.set(key, {
        key,
        label: tx.categoryLabel || resolveLabelFromKey(tx.categoryKey) || rawLabel,
        amount,
      });
      continue;
    }

    current.amount += amount;
  }

  return [...grouped.values()]
    .map((item) => ({
      categoryKey: item.key,
      label: item.label,
      amountValue: roundCurrency(item.amount),
      amountLabel: fmt.format(item.amount),
      amountKind: "actual" as const,
      statusLabel: "Werkelijk",
      contextLabel: "Werkelijke uitgaven in deze maand",
      progress: null,
      progressTone: null,
    }))
    .sort((left, right) => right.amountValue - left.amountValue);
}

function resolveLabelFromKey(key: string | null | undefined) {
  if (!key) return null;
  if (key === "fixed_costs") return "Vaste lasten";
  if (key === "subscriptions") return "Abonnementen";
  if (key === "variable_costs") return "Variabele uitgaven";
  if (key === "groceries") return "Boodschappen";
  if (key === "fuel") return "Brandstof";
  if (key === "smoking") return "Roken";
  if (key === "other") return "Overig";
  return key;
}

export function buildInsightsCategorySummary(input: {
  selectedMonth: TransactionMonthOption;
  budgetPlan: BudgetPlanComputation | null;
  currentMonthTransactions: InsightsSignalTransaction[];
  maxRows?: number | null;
}): InsightsCategorySummaryModel {
  const { selectedMonth, budgetPlan, currentMonthTransactions } = input;
  const maxRows = input.maxRows === undefined ? 5 : input.maxRows;
  const mode = resolveMode(selectedMonth, budgetPlan, currentMonthTransactions);
  const { title, subtitle } = resolveTitleSubtitle(mode);

  const rows =
    mode === "closed"
      ? budgetPlan
        ? buildClosedRowsFromBudgetPlan(budgetPlan)
        : buildFallbackRows(currentMonthTransactions)
      : mode === "open" && budgetPlan
        ? buildOpenRowsFromBudgetPlan(budgetPlan)
        : buildFallbackRows(currentMonthTransactions);

  return {
    mode,
    title,
    subtitle,
    rows: maxRows == null ? rows : rows.slice(0, Math.max(maxRows, 0)),
    emptyTitle: mode === "closed" ? "Nog geen uitgaven gevonden" : "Nog geen betrouwbare uitgaven",
    emptyDescription:
      mode === "closed"
        ? "Deze maand bevat nog geen uitgaven om op te rangschikken."
        : "Zodra er genoeg data is, tonen we hier je grootste uitgaven.",
  };
}
