import { RiskProgressBar } from "@/components/risk-progress-bar";
import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { MonthPickerSheet } from "@/components/month-picker-sheet";
import { FinColors } from "@/constants/theme";
import { upsertBudgetPlanSettings } from "@/services/budget-plan-repository";
import {
  getMonthVariableBudgetSnapshot,
  getMonthVariableBudgetUsageText,
} from "@/services/budget-risk";
import { computeBudgetPlan } from "@/services/budget-plan";
import {
  getTransactionCategories,
  setTransactionManualCategory,
} from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  formatConfidenceLabel,
  getCategorizationCoverage,
  getCategoryPathLabel,
  getEffectiveCategoryId,
  getLeafCategories,
  needsCategorizationReview,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import {
  FORECAST_EXPENSE_SOURCE_OPTIONS,
  formatForecastExpenseSourceLabel,
  getForecastExpenseSourceDescription,
} from "@/services/forecast-expense-source-display";
import {
  ensureForecastFresh,
  type EnsureForecastFreshOptions,
} from "@/services/forecast-refresh";
import { resolveIncomeSemanticsForTransaction } from "@/services/income-semantics";
import {
  detectRareSubscriptionItems,
  type RareSubscriptionItem,
  type RareSubscriptionTransaction,
} from "@/services/rare-subscriptions";
import { supabase } from "@/services/supabase";
import {
  getCurrentMonthKey,
  getMonthOptionByKey,
  listTransactionMonthOptions,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import type {
  BudgetForecastExpenseSource,
  BudgetPlanComputation,
  CategoryRecord,
  ExpenseAnalysisCategory,
  ForecastRefreshReason,
  ForecastRefreshStatus,
} from "@/types/categorization";
import { AppIcon } from "@/components/ui/app-icon";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const SEGMENTS = [
  { key: "trends", label: "Trends" },
  { key: "forecast", label: "Voorspelling" },
  { key: "rare", label: "Verborgen" },
  { key: "review", label: "Controle" },
] as const;

const SUBJECT_DRIVEN_PROVIDERS = [
  "klarna",
  "paypal",
  "riverty",
  "afterpay",
  "billink",
  "in3",
  "sprinque",
];

const FIXED_FALLBACK_HINTS = [
  "hypotheek",
  "zorgverzekering",
  "energie",
  "water",
  "gemeentelijke",
  "gblt",
  "autoverzekering",
  "wegenbelasting",
  "cv installatie",
  "verzekering",
];

const SUBSCRIPTION_FALLBACK_HINTS = [
  "abonnement",
  "internet",
  "mobiel",
  "streaming",
  "netflix",
  "spotify",
  "google",
  "sony",
  "playstation",
  "ziggo",
  "youfone",
  "vodafone",
  "paypal",
];

const SAVINGS_FALLBACK_HINTS = [
  "spaar",
  "sparen",
  "spaarrekening",
  "belegging",
  "beleggen",
  "investering",
  "crypto",
  "naar sparen",
  "overboeking eigen rekening",
];

const VARIABLE_FALLBACK_HINTS = [
  "zakgeld",
  "kleedgeld",
  "kledinggeld",
  "pocket money",
  "allowance",
];

const CAT_COLORS = ["#7dd3a1", "#d7b64c", "#94a3b8", "#9b9186", "#6b6b6b"];
const RARE_SUBSCRIPTION_LOOKBACK_DAYS = 760;
const RARE_SUBSCRIPTION_PAGE_SIZE = 500;

type SegmentKey = (typeof SEGMENTS)[number]["key"];
type CategoryBarRow = { label: string; amount: number; color: string };
type InsightTx = {
  id: string;
  details: string;
  counterparty: string;
  date: string;
  amount: number;
  category_id_auto: string | null;
  category_id_user: string | null;
  category_confidence: number | null;
  category_source: string | null;
  analysis_main_group: "income" | "expense" | null;
  analysis_category:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
  recurring: boolean;
  recurring_type: "monthly" | "quarterly" | "yearly" | "irregular" | null;
  spending_pattern: "frequent_small_expense" | null;
};

type CashflowForecast = {
  month_start: string;
  forecast_reference_date: string | null;
  current_balance_anchor: number | null;
  current_balance_anchor_date: string | null;
  booked_income_total: number;
  booked_expense_total: number;
  booked_savings_outflow_total: number;
  remaining_expected_income_total: number;
  remaining_expected_expense_total: number;
  remaining_expected_savings_outflow_total: number;
  expected_income_total: number;
  expected_expense_total: number;
  expected_savings_outflow_total: number;
  expected_cash_out_total: number;
  expected_fixed_costs: number;
  expected_subscriptions: number;
  expected_variable_costs: number;
  upcoming_committed_income_total: number;
  upcoming_committed_expense_total: number;
  upcoming_committed_savings_outflow_total: number;
  lowest_expected_balance: number | null;
  lowest_expected_balance_date: string | null;
  next_expected_event_date: string | null;
  next_expected_event_label: string | null;
  cash_risk_flag: "none" | "cash_gap_warning";
  expected_end_of_month_balance: number | null;
  risk_flag: "none" | "deficit_warning";
  top_cost_bucket_1: string | null;
  top_cost_bucket_2: string | null;
  top_cost_bucket_3: string | null;
};

type GenericRowsResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

type ReviewableInsightTx = InsightTx & { categoryLabel: string };
type InsightIncomeTx = ReviewableInsightTx & {
  incomeGroupLabel: string | null;
  incomeShortLabel: string | null;
  countsAsIncome: boolean;
  expenseOffsetBucket:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | null;
};
type IncomeBreakdownRow = {
  label: string;
  total: number;
  count: number;
  tone: "income" | "refund";
};
type IncomeMetricCard = {
  label: string;
  value: string;
  meta: string;
  tone: "neutral" | "positive" | "refund";
};
type DrilldownExpenseGroup = Exclude<
  ExpenseAnalysisCategory,
  "savings_transfer"
>;
type CategoryGroup = {
  id: string;
  name: string;
  sortOrder: number;
  children: CategoryRecord[];
};

function isSubjectDrivenCounterparty(counterparty: string | null | undefined) {
  const normalized = String(counterparty || "").toLowerCase();
  if (!normalized) return false;
  return SUBJECT_DRIVEN_PROVIDERS.some((token) => normalized.includes(token));
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatShortDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return value;
  }

  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
  });
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getForecastRefreshHelper(status: ForecastRefreshStatus | null) {
  if (!status) return null;
  if (status.lastError) {
    return `Laatste verversing mislukte. Probeer de voorspelling opnieuw te vernieuwen.`;
  }
  if (status.isDirty) {
    return status.dirtyAt
      ? `Voorspelling moet nog worden bijgewerkt sinds ${formatDateTimeLabel(status.dirtyAt)}.`
      : "Voorspelling moet nog worden bijgewerkt.";
  }
  if (status.lastComputedAt) {
    return `Laatst ververst op ${formatDateTimeLabel(status.lastComputedAt)}.`;
  }
  return null;
}

function formatIncludedIncomeLabel(plan: BudgetPlanComputation | null) {
  if (!plan) return "Budget-instellingen";

  const labels: string[] = [];
  if (plan.settings.includeIncome.salary) labels.push("salaris");
  if (plan.settings.includeIncome.childBudget) {
    labels.push("kindgebonden budget");
  }
  if (plan.settings.includeIncome.structuralOther) {
    labels.push("overige structurele inkomsten");
  }
  if (plan.settings.includeIncome.variable) {
    labels.push("variabele inkomsten");
  }

  if (!labels.length) return "geen inkomstenbron";
  return labels.join(", ");
}

function getBudgetIncludedIncomeAmount(
  plan: BudgetPlanComputation | null,
  scope: "expected" | "booked",
) {
  if (!plan) return null;

  if (scope === "expected") {
    return Math.max(plan.flowSummary.expectedIncomeMonthly || 0, 0);
  }

  let total = 0;
  if (plan.settings.includeIncome.salary) total += plan.monthToDateIncome.salary;
  if (plan.settings.includeIncome.childBudget) {
    total += plan.monthToDateIncome.childBudget;
  }
  if (plan.settings.includeIncome.structuralOther) {
    total += plan.monthToDateIncome.structuralOther;
  }
  if (plan.settings.includeIncome.variable) {
    total += plan.monthToDateIncome.variable;
  }

  return Math.max(total, 0);
}

function parseUtcDate(dateIso: string) {
  const parsed = new Date(`${String(dateIso || "").slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDaysToIsoDate(dateIso: string, days: number) {
  const parsed = parseUtcDate(dateIso);
  if (!parsed) return dateIso;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function addMonthsToMonthKey(monthKey: string, months: number) {
  const option = getMonthOptionByKey(monthKey);
  if (!option) return monthKey;
  const date = new Date(option.year, option.month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getInsightsReferenceDateIso(selectedMonth: TransactionMonthOption) {
  if (selectedMonth.isCurrentMonth) {
    return toLocalIsoDate(new Date());
  }
  return addDaysToIsoDate(selectedMonth.endIso, -1);
}

function isFutureMonthOption(option: TransactionMonthOption) {
  return option.key > getCurrentMonthKey();
}

function getRareSubscriptionStatus(item: RareSubscriptionItem) {
  if (item.daysUntilNext == null || !item.nextExpectedDate) {
    return item.evidence === "possible"
      ? "Nog maar 1 keer gezien, dus makkelijk te missen."
      : `Laatst gezien op ${formatShortDate(item.lastChargeDate)}.`;
  }

  if (item.daysUntilNext < -45) {
    return `Had rond ${formatShortDate(item.nextExpectedDate)} opnieuw kunnen terugkomen.`;
  }
  if (item.daysUntilNext < 0) {
    return `Rond ${formatShortDate(item.nextExpectedDate)} verwacht.`;
  }
  if (item.daysUntilNext === 0) {
    return "Vandaag verwacht.";
  }
  if (item.daysUntilNext <= 30) {
    return `Binnen ${item.daysUntilNext} dagen verwacht.`;
  }

  return `Volgende moment rond ${formatShortDate(item.nextExpectedDate)}.`;
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMissingColumnError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42703" || code === "PGRST204") return true;

  return (
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("could not find")
  );
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function toLowerHaystack(tx: InsightTx) {
  return `${tx.counterparty || ""} ${tx.details || ""}`.toLowerCase();
}

function fallbackExpenseCategory(tx: InsightTx): ExpenseAnalysisCategory {
  const haystack = toLowerHaystack(tx);
  if (SAVINGS_FALLBACK_HINTS.some((hint) => haystack.includes(hint))) {
    return "savings_transfer";
  }
  if (SUBSCRIPTION_FALLBACK_HINTS.some((hint) => haystack.includes(hint))) {
    return "subscriptions";
  }
  if (FIXED_FALLBACK_HINTS.some((hint) => haystack.includes(hint))) {
    return "fixed_costs";
  }
  if (VARIABLE_FALLBACK_HINTS.some((hint) => haystack.includes(hint))) {
    return "variable_costs";
  }
  return "variable_costs";
}

function resolveExpenseBucket(
  tx: InsightTx,
  categoryMap: Map<string, CategoryRecord>,
): ExpenseAnalysisCategory {
  const categoryId = getEffectiveCategoryId(tx);
  const category = categoryId ? categoryMap.get(categoryId) || null : null;
  const categoryKey = String(category?.key || "").toLowerCase();

  if (category?.budget_group === "savings") return "savings_transfer";
  if (category?.budget_group === "subscriptions") return "subscriptions";
  if (category?.budget_group === "fixed") return "fixed_costs";
  if (category?.budget_group === "variable") return "variable_costs";

  if (categoryKey.startsWith("savings")) return "savings_transfer";
  if (categoryKey.startsWith("subscriptions")) return "subscriptions";
  if (
    (categoryKey.startsWith("care_") || categoryKey.startsWith("health_")) &&
    !categoryKey.startsWith("care_health_insurance") &&
    !categoryKey.startsWith("insurance_health") &&
    !categoryKey.startsWith("health_insurance")
  ) {
    return "variable_costs";
  }
  if (
    categoryKey.startsWith("housing") ||
    categoryKey.startsWith("care_health_insurance") ||
    categoryKey.startsWith("insurance_health") ||
    categoryKey.startsWith("health_insurance") ||
    categoryKey.startsWith("auto_transport_car_insurance") ||
    categoryKey.startsWith("auto_transport_road_tax")
  ) {
    return "fixed_costs";
  }
  if (
    categoryKey.startsWith("groceries") ||
    categoryKey.startsWith("fuel") ||
    categoryKey.startsWith("smoking") ||
    categoryKey.startsWith("shopping")
  ) {
      return "variable_costs";
  }

  if (
    tx.analysis_category === "fixed_costs" ||
    tx.analysis_category === "subscriptions" ||
    tx.analysis_category === "variable_costs" ||
    tx.analysis_category === "savings_transfer"
  ) {
    return tx.analysis_category;
  }

  return fallbackExpenseCategory(tx);
}

function applyExpenseBucketDelta(
  totals: {
    fixed: number;
    subscriptions: number;
    variable: number;
    savingsTransfers: number;
  },
  bucket: ExpenseAnalysisCategory,
  amount: number,
) {
  if (bucket === "fixed_costs") totals.fixed += amount;
  else if (bucket === "subscriptions") totals.subscriptions += amount;
  else if (bucket === "variable_costs") totals.variable += amount;
  else totals.savingsTransfers += amount;
}

function getTrendHeadline(
  monthReport: {
    fixed: number;
    subscriptions: number;
    variable: number;
    savingsTransfers: number;
    expenses: number;
    outflow: number;
    income: number;
    net: number;
  },
  budgetPlan: BudgetPlanComputation | null,
) {
  if (monthReport.income === 0 && monthReport.expenses === 0) {
    return "Nog geen maanddata om een trend te tonen.";
  }

  if (!budgetPlan) {
    return monthReport.net >= 0
      ? "Deze maand ligt je netto resultaat nog in de plus."
      : "Deze maand gaat er meer uit dan er binnenkomt.";
  }

  const monthBudgetSnapshot = getMonthVariableBudgetSnapshot(budgetPlan);
  if (monthBudgetSnapshot.state === "no_budget") {
    return "Stel een variabel budget in om je maandtempo goed te beoordelen.";
  }

  const delta = monthBudgetSnapshot.remaining ?? 0;

  if (delta > 50) {
    return `Je variabele uitgaven liggen ${fmt.format(delta)} onder je maandruimte.`;
  }
  if (delta >= 0) {
    return "Je variabele uitgaven zitten nog binnen je maandruimte.";
  }
  return `Je variabele uitgaven liggen ${fmt.format(Math.abs(delta))} boven je maandruimte.`;
}

function getForecastHeadline(
  forecast: CashflowForecast | null,
  budgetPlan: BudgetPlanComputation | null,
  options?: {
    isHistoricalMonth?: boolean;
    isFutureMonth?: boolean;
  },
) {
  if (!forecast) {
    return "Nog geen cashflowvoorspelling beschikbaar voor deze maand.";
  }

  if (options?.isHistoricalMonth) {
    return forecast.expected_end_of_month_balance != null
      ? `Afgesloten maand. Eindsaldo kwam uit op ${fmt.format(forecast.expected_end_of_month_balance)}.`
      : "Afgesloten maand zonder volledig eindsaldo.";
  }

  if (forecast.cash_risk_flag === "cash_gap_warning") {
    return forecast.lowest_expected_balance_date
      ? `Je saldo kan rond ${formatShortDate(forecast.lowest_expected_balance_date)} onder druk komen.`
      : "Je saldo kan deze maand tussentijds onder druk komen.";
  }

  if (
    forecast.risk_flag === "deficit_warning" ||
    (forecast.expected_end_of_month_balance != null &&
      forecast.expected_end_of_month_balance < 0)
  ) {
    return "De voorspelling laat zien dat je maandbuffer onder druk staat.";
  }

  if (options?.isFutureMonth) {
    return forecast.expected_end_of_month_balance != null
      ? `Verwacht saldo aan het einde van ${formatMonthLabel(forecast.month_start)}: ${fmt.format(forecast.expected_end_of_month_balance)}.`
      : "Toekomstmaand op basis van terugkerende lasten en recente patronen.";
  }

  if (
    forecast.expected_end_of_month_balance != null &&
    forecast.expected_end_of_month_balance > 0
  ) {
    return `Verwacht eindsaldo: ${fmt.format(forecast.expected_end_of_month_balance)}.`;
  }

  if (budgetPlan?.coachReport.sections.summary) {
    return budgetPlan.coachReport.sections.summary;
  }

  return "Je cashflow oogt stabiel op basis van het huidige maandtempo.";
}

function getForecastDataHelper(
  forecast: CashflowForecast | null,
  options: {
    isHistoricalMonth: boolean;
    isFutureMonth: boolean;
  },
) {
  if (!forecast) return null;
  if (options.isFutureMonth) {
    return "Gebaseerd op terugkerende lasten, abonnementen en recente maandpatronen.";
  }
  if (options.isHistoricalMonth) {
    return "Afgesloten maand. Alle resterende verwachtingen staan op nul.";
  }
  if (forecast.forecast_reference_date) {
    return `Data geboekt t/m ${formatShortDate(forecast.forecast_reference_date)}.`;
  }
  return null;
}

function getForecastStatusLabel(forecast: CashflowForecast | null) {
  if (!forecast) return "Nog leeg";
  if (forecast.cash_risk_flag === "cash_gap_warning") return "Let op";
  if (forecast.risk_flag === "deficit_warning") return "Tekort";
  if (
    forecast.expected_end_of_month_balance != null &&
    forecast.expected_end_of_month_balance < 0
  ) {
    return "Tekort";
  }
  return "Stabiel";
}

function getForecastStatusTone(forecast: CashflowForecast | null) {
  if (!forecast) return "muted" as const;
  if (forecast.cash_risk_flag === "cash_gap_warning") return "warning" as const;
  if (forecast.risk_flag === "deficit_warning") return "negative" as const;
  if (
    forecast.expected_end_of_month_balance != null &&
    forecast.expected_end_of_month_balance < 0
  ) {
    return "negative" as const;
  }
  return "positive" as const;
}

function formatMonthLabel(monthStartIso: string) {
  const parsed = parseUtcDate(monthStartIso);
  if (!parsed) return monthStartIso;
  return parsed.toLocaleDateString("nl-NL", {
    month: "long",
  });
}

function CategoryBar({ categories }: { categories: CategoryBarRow[] }) {
  const total = categories.reduce((sum, category) => sum + category.amount, 0) || 1;

  return (
    <View style={styles.categoryBarWrap}>
      <View style={styles.categoryBarTrack}>
        {categories.map((category) => (
          <View
            key={category.label}
            style={[
              styles.categoryBarSegment,
              {
                flex: category.amount / total,
                backgroundColor: category.color,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.categoryLegend}>
        {categories.map((category) => (
          <View key={category.label} style={styles.categoryLegendRow}>
            <View style={styles.categoryLegendMain}>
              <View
                style={[
                  styles.categoryLegendDot,
                  { backgroundColor: category.color },
                ]}
              />
              <Text style={styles.categoryLegendLabel}>{category.label}</Text>
            </View>
            <Text style={styles.categoryLegendValue}>
              {fmt.format(category.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReviewItem({
  tx,
  categoryMap,
  onPress,
  onConfirm,
  saving,
}: {
  tx: ReviewableInsightTx;
  categoryMap: Map<string, CategoryRecord>;
  onPress: (tx: ReviewableInsightTx) => void;
  onConfirm: (tx: ReviewableInsightTx) => void;
  saving: boolean;
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewIconWrap}>
        <TransactionCategoryIcon row={tx} categoryById={categoryMap} />
      </View>
      <View style={styles.reviewMain}>
        <Text style={styles.reviewName} numberOfLines={1}>
          {tx.counterparty || "Onbekende tegenpartij"}
        </Text>
        <Text style={styles.reviewSub} numberOfLines={1}>
          {tx.details || tx.date}
        </Text>
        <View style={styles.reviewMetaRow}>
          <Text style={styles.reviewCategory}>{tx.categoryLabel}</Text>
          <Text style={styles.reviewConfidence}>
            {formatConfidenceLabel(tx)}
          </Text>
        </View>
      </View>
      <View style={styles.reviewAside}>
        <Text style={styles.reviewAmount}>{fmt.format(tx.amount)}</Text>
        <View style={styles.reviewActions}>
          <Pressable
            style={styles.reviewButton}
            disabled={saving}
            onPress={() => onPress(tx)}
          >
            <Text style={styles.reviewButtonText}>Controleer</Text>
          </Pressable>
          {getEffectiveCategoryId(tx) ? (
            <Pressable
              style={styles.confirmButton}
              disabled={saving}
              onPress={() => onConfirm(tx)}
            >
              <Text style={styles.confirmButtonText}>Bevestig</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function RareSubscriptionRow({
  item,
  onPress,
}: {
  item: RareSubscriptionItem;
  onPress: (item: RareSubscriptionItem) => void;
}) {
  return (
    <Pressable style={styles.rareRow} onPress={() => onPress(item)}>
      <View style={styles.rareIconWrap}>
        <AppIcon
          name={item.evidence === "confirmed" ? "visibility" : "help-outline"}
          size={18}
          color={
            item.evidence === "confirmed"
              ? FinColors.warningText
              : FinColors.textSecondary
          }
        />
      </View>

      <View style={styles.rareMain}>
        <Text style={styles.rareName} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={styles.rareSub} numberOfLines={1}>
          {item.latestDetails || item.lastChargeDate}
        </Text>
        <View style={styles.rareMetaRow}>
          <View
            style={[
              styles.rareBadge,
              item.evidence === "confirmed"
                ? styles.rareBadgeConfirmed
                : styles.rareBadgePossible,
            ]}
          >
            <Text style={styles.rareBadgeText}>{item.frequencyLabel}</Text>
          </View>
          <Text style={styles.rareMetaText}>
            {item.evidence === "confirmed" ? "Bevestigd" : "Mogelijk verborgen"}
          </Text>
        </View>
        <Text style={styles.rareStatus}>{getRareSubscriptionStatus(item)}</Text>
      </View>

      <View style={styles.rareAside}>
        <Text style={styles.rareAmount}>{fmt.format(item.expectedAmount)}</Text>
        <Text style={styles.rareAsideSub}>
          Jaarimpact {fmt.format(item.annualSpendEstimate)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function InsightsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();
  const forecastLoadInFlight = React.useRef(false);
  const budgetLoadInFlight = React.useRef(false);
  const fallbackMonthOption = React.useMemo(
    () => getMonthOptionByKey(getCurrentMonthKey())!,
    [],
  );

  const [segment, setSegment] = React.useState<SegmentKey>("trends");
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [transactions, setTransactions] = React.useState<InsightTx[]>([]);
  const [rareSubscriptionItems, setRareSubscriptionItems] = React.useState<
    RareSubscriptionItem[]
  >([]);
  const [forecastByMonth, setForecastByMonth] = React.useState<
    Record<string, CashflowForecast>
  >({});
  const [forecast, setForecast] = React.useState<CashflowForecast | null>(null);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [analysisSchemaMissing, setAnalysisSchemaMissing] =
    React.useState(false);
  const [forecastSchemaMissing, setForecastSchemaMissing] =
    React.useState(false);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = React.useState(
    getCurrentMonthKey(),
  );
  const [monthOptions, setMonthOptions] = React.useState<TransactionMonthOption[]>(
    [fallbackMonthOption],
  );
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);
  const [txCount, setTxCount] = React.useState(0);
  const [selectedTx, setSelectedTx] =
    React.useState<ReviewableInsightTx | null>(null);
  const [incomeDetailsOpen, setIncomeDetailsOpen] = React.useState(false);
  const [savingReview, setSavingReview] = React.useState(false);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [expandedParents, setExpandedParents] = React.useState<
    Record<string, boolean>
  >({});
  const [forecastRefreshStatus, setForecastRefreshStatus] =
    React.useState<ForecastRefreshStatus | null>(null);
  const [refreshingForecast, setRefreshingForecast] = React.useState(false);
  const [updatingForecastExpenseSource, setUpdatingForecastExpenseSource] =
    React.useState(false);

  const selectedMonth = React.useMemo(
    () =>
      monthOptions.find((option) => option.key === selectedMonthKey) ||
      getMonthOptionByKey(selectedMonthKey) ||
      monthOptions[0] ||
      fallbackMonthOption,
    [fallbackMonthOption, monthOptions, selectedMonthKey],
  );
  const selectedMonthIndex = React.useMemo(
    () => monthOptions.findIndex((option) => option.key === selectedMonth.key),
    [monthOptions, selectedMonth.key],
  );
  const canGoToOlderMonth =
    selectedMonthIndex >= 0 && selectedMonthIndex < monthOptions.length - 1;
  const canGoToNewerMonth = selectedMonthIndex > 0;
  const insightsReferenceDateIso = React.useMemo(
    () => getInsightsReferenceDateIso(selectedMonth),
    [selectedMonth],
  );
  const isHistoricalMonth = selectedMonth.key < getCurrentMonthKey();
  const isFutureMonth = isFutureMonthOption(selectedMonth);
  const forecastStripOptions = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, offset) =>
        getMonthOptionByKey(addMonthsToMonthKey(getCurrentMonthKey(), offset)),
      ).filter((option): option is TransactionMonthOption => Boolean(option)),
    [],
  );
  const forecastStripItems = React.useMemo(
    () =>
      forecastStripOptions.map((option) => ({
        option,
        forecast: forecastByMonth[option.startIso] || null,
      })),
    [forecastByMonth, forecastStripOptions],
  );

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );
  const leafCategories = React.useMemo(() => {
    const curatedLeaves = getLeafCategories(categories, { curatedOnly: true });
    return curatedLeaves.length ? curatedLeaves : getLeafCategories(categories);
  }, [categories]);

  const groupedModalCategories = React.useMemo<CategoryGroup[]>(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const groups = new Map<string, CategoryGroup>();

    for (const leaf of leafCategories) {
      const parent = leaf.parent_id ? byId.get(leaf.parent_id) : null;
      const groupId = parent?.id || "__ungrouped__";
      const groupName = parent?.name || "Overig";
      const groupSort = parent?.sort_order ?? Number.MAX_SAFE_INTEGER;

      const existing = groups.get(groupId);
      if (existing) {
        existing.children.push(leaf);
      } else {
        groups.set(groupId, {
          id: groupId,
          name: groupName,
          sortOrder: groupSort,
          children: [leaf],
        });
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        children: [...group.children].sort((a, b) => {
          const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
          const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
          if (left !== right) return left - right;
          return a.name.localeCompare(b.name, "nl");
        }),
      }))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name, "nl");
      });
  }, [categories, leafCategories]);

  const categoryToGroupId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupedModalCategories) {
      map.set(group.id, group.id);
      for (const child of group.children) {
        map.set(child.id, group.id);
      }
    }
    return map;
  }, [groupedModalCategories]);

  const filteredModalGroups = React.useMemo(() => {
    const query = normalizeSearch(categorySearch);
    if (!query) return groupedModalCategories;

    return groupedModalCategories
      .map((group) => {
        const parentMatches = normalizeSearch(group.name).includes(query);
        if (parentMatches) return group;

        const filteredChildren = group.children.filter((child) => {
          const haystack = `${normalizeSearch(child.name)} ${normalizeSearch(
            child.key,
          )}`;
          return haystack.includes(query);
        });

        if (!filteredChildren.length) return null;
        return {
          ...group,
          children: filteredChildren,
        };
      })
      .filter((group): group is CategoryGroup => Boolean(group));
  }, [categorySearch, groupedModalCategories]);
  const searchActive = categorySearch.trim().length > 0;

  const displayTransactions = React.useMemo<ReviewableInsightTx[]>(
    () =>
      transactions.map((tx) => ({
        ...tx,
        categoryLabel: getCategoryPathLabel(tx, categoryMap),
      })),
    [transactions, categoryMap],
  );

  const coverage = React.useMemo(
    () => getCategorizationCoverage(transactions),
    [transactions],
  );

  const incomeTransactions = React.useMemo<InsightIncomeTx[]>(
    () =>
      displayTransactions
        .filter((tx) => tx.amount > 0)
        .map((tx) => {
          const semantics = resolveIncomeSemanticsForTransaction(tx, categoryMap);
          return {
            ...tx,
            incomeGroupLabel: semantics.groupLabel,
            incomeShortLabel: semantics.shortLabel,
            countsAsIncome: semantics.countsAsIncome,
            expenseOffsetBucket: semantics.expenseOffsetBucket,
          };
        })
        .sort((left, right) => {
          if (left.date !== right.date) return right.date.localeCompare(left.date);
          return right.amount - left.amount;
        }),
    [categoryMap, displayTransactions],
  );

  const incomeSummary = React.useMemo(() => {
    let structural = 0;
    let variableIncome = 0;
    let windfalls = 0;
    let costRefunds = 0;
    let structuralCount = 0;
    let variableIncomeCount = 0;
    let windfallsCount = 0;
    let costRefundsCount = 0;

    const totals = new Map<string, { total: number; count: number; tone: "income" | "refund" }>();

    for (const tx of incomeTransactions) {
      const semantics = resolveIncomeSemanticsForTransaction(tx, categoryMap);
      const label =
        semantics.groupLabel ||
        (semantics.countsAsIncome ? "Variabel inkomen" : "Kostencompensaties");
      const tone = semantics.kind === "expense_refund" ? "refund" : "income";
      const existing = totals.get(label);
      if (existing) {
        existing.total += tx.amount;
        existing.count += 1;
      } else {
        totals.set(label, { total: tx.amount, count: 1, tone });
      }

      if (
        semantics.kind === "salary" ||
        semantics.kind === "child_budget" ||
        semantics.kind === "structural_government" ||
        semantics.kind === "structural_other"
      ) {
        structural += tx.amount;
        structuralCount += 1;
      } else if (semantics.kind === "tax_refund") {
        windfalls += tx.amount;
        windfallsCount += 1;
      } else if (semantics.kind === "expense_refund") {
        costRefunds += tx.amount;
        costRefundsCount += 1;
      } else if (semantics.countsAsIncome) {
        variableIncome += tx.amount;
        variableIncomeCount += 1;
      }
    }

    const breakdown = Array.from(totals.entries())
      .map(([label, value]) => ({
        label,
        total: value.total,
        count: value.count,
        tone: value.tone,
      }))
      .sort((left, right) => right.total - left.total);

    return {
      structural,
      structuralCount,
      variableIncome,
      variableIncomeCount,
      windfalls,
      windfallsCount,
      costRefunds,
      costRefundsCount,
      totalIncome: structural + variableIncome + windfalls,
      breakdown,
    };
  }, [categoryMap, incomeTransactions]);

  const incomeMetricCards = React.useMemo<IncomeMetricCard[]>(() => {
    const cards: (IncomeMetricCard | null)[] = [
      {
        label: "Transacties",
        value: String(incomeTransactions.length),
        meta: `${incomeTransactions.length} inkomende transactie${incomeTransactions.length === 1 ? "" : "s"}`,
        tone: "neutral" as const,
      },
      incomeSummary.structural > 0
        ? {
            label: "Structureel",
            value: `+${fmt.format(incomeSummary.structural)}`,
            meta: `${incomeSummary.structuralCount} transactie${incomeSummary.structuralCount === 1 ? "" : "s"}`,
            tone: "positive" as const,
          }
        : null,
      incomeSummary.variableIncome > 0
        ? {
            label: "Variabel",
            value: `+${fmt.format(incomeSummary.variableIncome)}`,
            meta: `${incomeSummary.variableIncomeCount} transactie${incomeSummary.variableIncomeCount === 1 ? "" : "s"}`,
            tone: "positive" as const,
          }
        : null,
      incomeSummary.windfalls > 0
        ? {
            label: "Meevallers",
            value: `+${fmt.format(incomeSummary.windfalls)}`,
            meta: `${incomeSummary.windfallsCount} transactie${incomeSummary.windfallsCount === 1 ? "" : "s"}`,
            tone: "positive" as const,
          }
        : null,
      incomeSummary.costRefunds > 0
        ? {
            label: "Compensaties",
            value: `+${fmt.format(incomeSummary.costRefunds)}`,
            meta: `${incomeSummary.costRefundsCount} transactie${incomeSummary.costRefundsCount === 1 ? "" : "s"}`,
            tone: "refund" as const,
          }
        : null,
    ];

    return cards.filter((item): item is IncomeMetricCard => Boolean(item));
  }, [incomeSummary, incomeTransactions.length]);

  const monthReport = React.useMemo(() => {
    const totals = {
      fixed: 0,
      subscriptions: 0,
      variable: 0,
      savingsTransfers: 0,
    };

    for (const tx of transactions) {
      if (tx.amount > 0) {
        const semantics = resolveIncomeSemanticsForTransaction(tx, categoryMap);
        if (semantics.kind === "expense_refund" && semantics.expenseOffsetBucket) {
          applyExpenseBucketDelta(
            totals,
            semantics.expenseOffsetBucket,
            -tx.amount,
          );
        }
        continue;
      }

      if (tx.amount >= 0) continue;

      applyExpenseBucketDelta(
        totals,
        resolveExpenseBucket(tx, categoryMap),
        Math.abs(tx.amount),
      );
    }

    const expenses = totals.fixed + totals.subscriptions + totals.variable;
    const outflow = expenses + totals.savingsTransfers;

    return {
      fixed: totals.fixed,
      subscriptions: totals.subscriptions,
      variable: totals.variable,
      savingsTransfers: totals.savingsTransfers,
      expenses,
      outflow,
      income: incomeSummary.totalIncome,
      windfalls: incomeSummary.windfalls,
      costRefunds: incomeSummary.costRefunds,
      net: incomeSummary.totalIncome - expenses,
    };
  }, [categoryMap, incomeSummary.costRefunds, incomeSummary.totalIncome, incomeSummary.windfalls, transactions]);

  const spendingByCategory = React.useMemo<CategoryBarRow[]>(() => {
    const expenseRows = displayTransactions.filter((tx) => {
      if (tx.amount >= 0) return false;
      return resolveExpenseBucket(tx, categoryMap) !== "savings_transfer";
    });
    const totals = new Map<string, number>();

    for (const tx of expenseRows) {
      const key = tx.categoryLabel;
      totals.set(key, (totals.get(key) || 0) + Math.abs(tx.amount));
    }

    return Array.from(totals.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([label, amount], index) => ({
        label,
        amount,
        color: CAT_COLORS[index % CAT_COLORS.length],
      }));
  }, [categoryMap, displayTransactions]);

  const reviewQueue = React.useMemo(
    () =>
      displayTransactions
        .filter((tx) => needsCategorizationReview(tx))
        .slice(0, 8),
    [displayTransactions],
  );

  const incomeBreakdown = React.useMemo<IncomeBreakdownRow[]>(() => {
    return incomeSummary.breakdown;
  }, [incomeSummary.breakdown]);

  const trendHeadline = React.useMemo(
    () => getTrendHeadline(monthReport, budgetPlan),
    [budgetPlan, monthReport],
  );
  const forecastHeadline = React.useMemo(
    () =>
      getForecastHeadline(forecast, budgetPlan, {
        isHistoricalMonth,
        isFutureMonth,
      }),
    [budgetPlan, forecast, isFutureMonth, isHistoricalMonth],
  );
  const forecastDataHelper = React.useMemo(
    () =>
      getForecastDataHelper(forecast, {
        isHistoricalMonth,
        isFutureMonth,
      }),
    [forecast, isFutureMonth, isHistoricalMonth],
  );
  const forecastStatusLabel = React.useMemo(
    () => getForecastStatusLabel(forecast),
    [forecast],
  );
  const forecastStatusTone = React.useMemo(
    () => getForecastStatusTone(forecast),
    [forecast],
  );

  const topCostLabel = React.useCallback((bucket: string | null) => {
    if (bucket === "variable_costs") return "Variabele kosten";
    if (bucket === "subscriptions") return "Abonnementen";
    if (bucket === "fixed_costs") return "Vaste lasten";
    if (bucket === "savings_transfer") return "Overboeken naar sparen";
    return null;
  }, []);

  const forecastTopCostLabels = React.useMemo(
    () =>
      [
        forecast?.top_cost_bucket_1,
        forecast?.top_cost_bucket_2,
        forecast?.top_cost_bucket_3,
      ]
        .map((bucket) => topCostLabel(bucket || null))
        .filter(
          (label): label is NonNullable<ReturnType<typeof topCostLabel>> =>
            Boolean(label),
        ),
    [
      forecast?.top_cost_bucket_1,
      forecast?.top_cost_bucket_2,
      forecast?.top_cost_bucket_3,
      topCostLabel,
    ],
  );
  const forecastBuildupRows = React.useMemo(() => {
    if (!forecast) return [];
    const bookedFixed = isFutureMonth ? 0 : monthReport.fixed;
    const bookedSubscriptions = isFutureMonth ? 0 : monthReport.subscriptions;
    const bookedVariable = isFutureMonth ? 0 : monthReport.variable;
    const bookedSavings = isFutureMonth ? 0 : monthReport.savingsTransfers;

    return [
      {
        key: "fixed_costs",
        label: "Vaste lasten",
        total: forecast.expected_fixed_costs,
        booked: Math.min(bookedFixed, forecast.expected_fixed_costs),
        remaining: Math.max(forecast.expected_fixed_costs - bookedFixed, 0),
        pressable: true,
      },
      {
        key: "subscriptions",
        label: "Abonnementen",
        total: forecast.expected_subscriptions,
        booked: Math.min(bookedSubscriptions, forecast.expected_subscriptions),
        remaining: Math.max(
          forecast.expected_subscriptions - bookedSubscriptions,
          0,
        ),
        pressable: true,
      },
      {
        key: "variable_costs",
        label: "Variabele kosten",
        total: forecast.expected_variable_costs,
        booked: Math.min(bookedVariable, forecast.expected_variable_costs),
        remaining: Math.max(forecast.expected_variable_costs - bookedVariable, 0),
        pressable: true,
      },
      {
        key: "savings_transfer",
        label: "Naar sparen",
        total: forecast.expected_savings_outflow_total,
        booked: Math.min(
          bookedSavings,
          forecast.expected_savings_outflow_total,
        ),
        remaining: Math.max(
          forecast.expected_savings_outflow_total - bookedSavings,
          0,
        ),
        pressable: false,
      },
    ];
  }, [forecast, isFutureMonth, monthReport.fixed, monthReport.savingsTransfers, monthReport.subscriptions, monthReport.variable]);
  const budgetExpectedIncomeTotal = React.useMemo(
    () => getBudgetIncludedIncomeAmount(budgetPlan, "expected"),
    [budgetPlan],
  );
  const budgetBookedIncomeTotal = React.useMemo(
    () => getBudgetIncludedIncomeAmount(budgetPlan, "booked"),
    [budgetPlan],
  );
  const forecastCashInTotal = forecast?.expected_income_total ?? 0;
  const forecastBookedCashIn = forecast?.booked_income_total ?? 0;
  const forecastRemainingCashIn = forecast?.remaining_expected_income_total ?? 0;
  const forecastCashOutTotal = forecast?.expected_cash_out_total ?? 0;
  const forecastBookedCashOut =
    (forecast?.booked_expense_total ?? 0) +
    (forecast?.booked_savings_outflow_total ?? 0);
  const forecastRemainingCashOut =
    (forecast?.remaining_expected_expense_total ?? 0) +
    (forecast?.remaining_expected_savings_outflow_total ?? 0);
  const forecastExpectedMonthDelta = forecast
    ? Math.round((forecastCashInTotal - forecastCashOutTotal) * 100) / 100
    : null;
  const forecastBudgetBasisExpectedIncome = budgetExpectedIncomeTotal ?? 0;
  const forecastBudgetBasisBookedIncome = budgetBookedIncomeTotal ?? 0;
  const forecastBudgetBasisRemainingIncome = Math.max(
    forecastBudgetBasisExpectedIncome - forecastBudgetBasisBookedIncome,
    0,
  );
  const forecastOutsideBudgetBasisBookedIncome = Math.max(
    forecastBookedCashIn - forecastBudgetBasisBookedIncome,
    0,
  );
  const forecastOutsideBudgetBasisExpectedIncome = Math.max(
    forecastCashInTotal - forecastBudgetBasisExpectedIncome,
    0,
  );
  const forecastEndBalanceNeedsContext =
    forecastExpectedMonthDelta != null &&
    forecastExpectedMonthDelta >= 0 &&
    (forecast?.expected_end_of_month_balance ?? 0) < 0;
  const forecastRefreshHelper = React.useMemo(
    () => getForecastRefreshHelper(forecastRefreshStatus),
    [forecastRefreshStatus],
  );

  const rareSubscriptionSummary = React.useMemo(() => {
    const yearly = rareSubscriptionItems.filter(
      (item) => item.cadence === "yearly",
    ).length;
    const semiannual = rareSubscriptionItems.filter(
      (item) => item.cadence === "semiannual",
    ).length;
    const possible = rareSubscriptionItems.filter(
      (item) => item.evidence === "possible",
    ).length;
    const upcoming = rareSubscriptionItems.filter(
      (item) =>
        item.daysUntilNext != null &&
        item.daysUntilNext >= -45 &&
        item.daysUntilNext <= 120,
    );
    const annualImpact = rareSubscriptionItems.reduce(
      (sum, item) => sum + item.annualSpendEstimate,
      0,
    );

    return {
      yearly,
      semiannual,
      possible,
      upcoming,
      annualImpact,
    };
  }, [rareSubscriptionItems]);

  const rareSubscriptionHeadline = React.useMemo(() => {
    if (!rareSubscriptionItems.length) {
      return "Geen zeldzame abonnementen gevonden in de laatste 24 maanden.";
    }
    if (rareSubscriptionSummary.upcoming.length > 0) {
      return `${rareSubscriptionSummary.upcoming.length} zeldzame afschrijvingen verdienen binnenkort aandacht.`;
    }
    if (rareSubscriptionSummary.possible > 0) {
      return `${rareSubscriptionSummary.possible} betaling${rareSubscriptionSummary.possible === 1 ? "" : "en"} is maar 1 keer gezien en kan daardoor verborgen blijven.`;
    }
    return `${rareSubscriptionItems.length} zeldzame abonnementen gevonden die makkelijk uit beeld raken.`;
  }, [rareSubscriptionItems.length, rareSubscriptionSummary.possible, rareSubscriptionSummary.upcoming.length]);

  const loadMonthOptions = React.useCallback(async () => {
    try {
      const options = await listTransactionMonthOptions({
        includeFutureMonths: 6,
      });
      setMonthOptions(options);
    } catch (error) {
      console.error("[insights] month options load error", error);
      setMonthOptions([fallbackMonthOption]);
    }
  }, [fallbackMonthOption]);

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
      return rows;
    } catch (error) {
      console.error("[insights] categories load error", error);
      setCategories([]);
      return [] as CategoryRecord[];
    }
  }, []);

  const loadRareSubscriptions = React.useCallback(
    async (resolvedCategories: CategoryRecord[]) => {
      try {
        const userId = await requireCurrentUserId();
        const baseSelect =
          "id,amount,details,counterparty,date,category_id_auto,category_id_user";
        const analysisSelect = "analysis_category";
        const startIso = addDaysToIsoDate(
          insightsReferenceDateIso,
          -RARE_SUBSCRIPTION_LOOKBACK_DAYS,
        );
        const rows: RareSubscriptionTransaction[] = [];
        let offset = 0;
        let omitAnalysisColumns = analysisSchemaMissing;

        while (true) {
          const query = supabase
            .from("transactions")
            .select(
              omitAnalysisColumns
                ? baseSelect
                : `${baseSelect},${analysisSelect}`,
            )
            .eq("user_id", userId)
            .gte("date", startIso)
            .lt("date", selectedMonth.endIso)
            .lt("amount", 0)
            .order("date", { ascending: false })
            .range(offset, offset + RARE_SUBSCRIPTION_PAGE_SIZE - 1);

          let result = (await query) as GenericRowsResult;

          if (
            result.error &&
            !omitAnalysisColumns &&
            isMissingColumnError(result.error)
          ) {
            omitAnalysisColumns = true;
            setAnalysisSchemaMissing(true);
            result = (await supabase
              .from("transactions")
              .select(baseSelect)
              .eq("user_id", userId)
              .gte("date", startIso)
              .lt("date", selectedMonth.endIso)
              .lt("amount", 0)
              .order("date", { ascending: false })
              .range(offset, offset + RARE_SUBSCRIPTION_PAGE_SIZE - 1)) as GenericRowsResult;
          }

          if (result.error) throw result.error;

          const page = ((result.data || []) as Record<string, unknown>[]).map(
            (row) => ({
              id: String(row.id || ""),
              date: String(row.date || ""),
              details: String(row.details || ""),
              counterparty: row.counterparty
                ? String(row.counterparty).trim()
                : null,
              amount: Number(row.amount || 0),
              category_id_auto: row.category_id_auto
                ? String(row.category_id_auto)
                : null,
              category_id_user: row.category_id_user
                ? String(row.category_id_user)
                : null,
              analysis_category: row.analysis_category
                ? String(row.analysis_category)
                : null,
            }),
          );

          rows.push(...page);

          if (page.length < RARE_SUBSCRIPTION_PAGE_SIZE) break;
          offset += RARE_SUBSCRIPTION_PAGE_SIZE;
        }

        setRareSubscriptionItems(
          detectRareSubscriptionItems({
            transactions: rows,
            categories: resolvedCategories,
            referenceDate: insightsReferenceDateIso,
          }),
        );
      } catch (error) {
        console.error("[insights] rare subscriptions load error", error);
        setRareSubscriptionItems([]);
      }
    },
    [
      analysisSchemaMissing,
      insightsReferenceDateIso,
      selectedMonth.endIso,
    ],
  );

  const loadTransactions = React.useCallback(async () => {
    try {
      const userId = await requireCurrentUserId();
      const baseSelect =
        "id,amount,details,counterparty,date,category_id_auto,category_id_user,category_confidence,category_source";
      const analysisSelect =
        "analysis_main_group,analysis_category,recurring,recurring_type,spending_pattern";
      const transactionsQuery = supabase.from("transactions");

      let queryResult = (await transactionsQuery
        .select(
          analysisSchemaMissing
            ? baseSelect
            : `${baseSelect},${analysisSelect}`,
        )
        .eq("user_id", userId)
        .gte("date", selectedMonth.startIso)
        .lt("date", selectedMonth.endIso)
        .order("date", { ascending: false })
        .limit(300)) as GenericRowsResult;

      if (
        queryResult.error &&
        !analysisSchemaMissing &&
        isMissingColumnError(queryResult.error)
      ) {
        setAnalysisSchemaMissing(true);
        setForecastSchemaMissing(true);

        queryResult = (await transactionsQuery
          .select(baseSelect)
          .eq("user_id", userId)
          .gte("date", selectedMonth.startIso)
          .lt("date", selectedMonth.endIso)
          .order("date", { ascending: false })
          .limit(300)) as GenericRowsResult;
      }

      if (queryResult.error) throw queryResult.error;

      const data = ((queryResult.data || []) as Record<string, unknown>[]) || [];
      if (!data.length) {
        setTransactions([]);
        setTxCount(0);
        return;
      }

      const rows: InsightTx[] = data.map((row) => ({
        id: String(row.id),
        details: String(row.details || ""),
        counterparty: String(row.counterparty || "").trim(),
        date: String(row.date || ""),
        amount: Number(row.amount || 0),
        category_id_auto: row.category_id_auto
          ? String(row.category_id_auto)
          : null,
        category_id_user: row.category_id_user
          ? String(row.category_id_user)
          : null,
        category_confidence:
          row.category_confidence == null
            ? null
            : Number(row.category_confidence),
        category_source: row.category_source ? String(row.category_source) : null,
        analysis_main_group:
          row.analysis_main_group === "income" ||
          row.analysis_main_group === "expense"
            ? row.analysis_main_group
            : null,
        analysis_category:
          row.analysis_category === "fixed_costs" ||
          row.analysis_category === "subscriptions" ||
          row.analysis_category === "variable_costs" ||
          row.analysis_category === "savings_transfer" ||
          row.analysis_category === "income_structural" ||
          row.analysis_category === "income_variable"
            ? row.analysis_category
            : null,
        recurring: Boolean(row.recurring),
        recurring_type:
          row.recurring_type === "monthly" ||
          row.recurring_type === "quarterly" ||
          row.recurring_type === "yearly" ||
          row.recurring_type === "irregular"
            ? row.recurring_type
            : null,
        spending_pattern:
          row.spending_pattern === "frequent_small_expense"
            ? row.spending_pattern
            : null,
      }));

      setTransactions(rows);
      setTxCount(rows.length);
    } catch (error) {
      console.error("[insights] transactions load error", error);
    }
  }, [analysisSchemaMissing, selectedMonth.endIso, selectedMonth.startIso]);

  const loadForecast = React.useCallback(async (options?: {
    forceRecompute?: boolean;
    reason?: ForecastRefreshReason;
  }) => {
    if (forecastSchemaMissing) {
      setForecastByMonth({});
      setForecast(null);
      return;
    }
    if (forecastLoadInFlight.current) return;

    forecastLoadInFlight.current = true;

    try {
      const userId = await requireCurrentUserId();
      const enhancedForecastSelect =
        "month_start,forecast_reference_date,current_balance_anchor,current_balance_anchor_date,booked_income_total,booked_expense_total,booked_savings_outflow_total,remaining_expected_income_total,remaining_expected_expense_total,remaining_expected_savings_outflow_total,expected_income_total,expected_expense_total,expected_savings_outflow_total,expected_cash_out_total,expected_fixed_costs,expected_subscriptions,expected_variable_costs,upcoming_committed_income_total,upcoming_committed_expense_total,upcoming_committed_savings_outflow_total,lowest_expected_balance,lowest_expected_balance_date,next_expected_event_date,next_expected_event_label,cash_risk_flag,expected_end_of_month_balance,risk_flag,top_cost_bucket_1,top_cost_bucket_2,top_cost_bucket_3";
      const legacyForecastSelect =
        "month_start,expected_income_total,expected_expense_total,expected_fixed_costs,expected_subscriptions,expected_variable_costs,expected_end_of_month_balance,risk_flag,top_cost_bucket_1,top_cost_bucket_2,top_cost_bucket_3";
      const forecastQuery = supabase.from("monthly_cashflow_forecasts") as any;
      const requestedMonthStarts = Array.from(
        new Set([
          ...forecastStripOptions.map((option) => option.startIso),
          selectedMonth.startIso,
        ]),
      );
      const fetchForecastRows = async (
        useLegacy = false,
      ): Promise<GenericRowsResult> =>
        (await forecastQuery
          .select(useLegacy ? legacyForecastSelect : enhancedForecastSelect)
          .eq("user_id", userId)
          .in("month_start", requestedMonthStarts)) as GenericRowsResult;

      const referenceDate = selectedMonth.isCurrentMonth
        ? new Date()
        : new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      if (!selectedMonth.isCurrentMonth) {
        referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
      }
      const refreshOptions: EnsureForecastFreshOptions = {
        referenceDate,
        force: options?.forceRecompute,
        reason:
          options?.reason ||
          (selectedMonth.isCurrentMonth
            ? "insights_open"
            : isHistoricalMonth
              ? "historical_month_open"
              : "future_month_open"),
      };

      const refreshStatus = await ensureForecastFresh(refreshOptions).catch(
        (error) => {
          console.warn("[insights] forecast refresh check failed", error);
          return null;
        },
      );
      if (refreshStatus) {
        setForecastRefreshStatus(refreshStatus);
      }

      let usedLegacyForecastShape = false;
      let { data, error } = await fetchForecastRows();
      if (error && isMissingColumnError(error)) {
        usedLegacyForecastShape = true;
        const legacyResult = await fetchForecastRows(true);
        data = legacyResult.data;
        error = legacyResult.error;
      }
      if (!data || !data.length) {
        const backfillStatus = await ensureForecastFresh({
          referenceDate,
          reason: "forecast_backfill",
          force: true,
        }).catch((recomputeError) => {
          console.warn("[insights] forecast backfill trigger failed", recomputeError);
          return null;
        });
        if (backfillStatus) {
          setForecastRefreshStatus(backfillStatus);
        }
        let retry = await fetchForecastRows(usedLegacyForecastShape);
        if (retry.error && isMissingColumnError(retry.error)) {
          usedLegacyForecastShape = true;
          retry = await fetchForecastRows(true);
        }
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (isMissingRelationError(error)) {
          setForecastSchemaMissing(true);
          setForecast(null);
          return;
        }
        throw error;
      }

      if (!data || !data.length) {
        setForecastByMonth({});
        setForecast(null);
        return;
      }

      const rowsByMonth = ((data || []) as Record<string, unknown>[]).reduce<
        Record<string, CashflowForecast>
      >((acc, row) => {
        const mapped: CashflowForecast = {
          month_start: String(row.month_start || ""),
          forecast_reference_date:
            usedLegacyForecastShape || row.forecast_reference_date == null
              ? null
              : String(row.forecast_reference_date),
          current_balance_anchor:
            usedLegacyForecastShape || row.current_balance_anchor == null
              ? null
              : Number(row.current_balance_anchor),
          current_balance_anchor_date: row.current_balance_anchor_date
            ? String(row.current_balance_anchor_date)
            : null,
          booked_income_total: Number(
            usedLegacyForecastShape ? 0 : row.booked_income_total || 0,
          ),
          booked_expense_total: Number(
            usedLegacyForecastShape ? 0 : row.booked_expense_total || 0,
          ),
          booked_savings_outflow_total: Number(
            usedLegacyForecastShape ? 0 : row.booked_savings_outflow_total || 0,
          ),
          remaining_expected_income_total: Number(
            usedLegacyForecastShape
              ? row.expected_income_total || 0
              : row.remaining_expected_income_total || 0,
          ),
          remaining_expected_expense_total: Number(
            usedLegacyForecastShape
              ? row.expected_expense_total || 0
              : row.remaining_expected_expense_total || 0,
          ),
          remaining_expected_savings_outflow_total: Number(
            usedLegacyForecastShape
              ? 0
              : row.remaining_expected_savings_outflow_total || 0,
          ),
          expected_income_total: Number(row.expected_income_total || 0),
          expected_expense_total: Number(row.expected_expense_total || 0),
          expected_savings_outflow_total: Number(
            usedLegacyForecastShape ? 0 : row.expected_savings_outflow_total || 0,
          ),
          expected_cash_out_total: Number(
            usedLegacyForecastShape
              ? Number(row.expected_expense_total || 0)
              : row.expected_cash_out_total || 0,
          ),
          expected_fixed_costs: Number(row.expected_fixed_costs || 0),
          expected_subscriptions: Number(row.expected_subscriptions || 0),
          expected_variable_costs: Number(row.expected_variable_costs || 0),
          upcoming_committed_income_total: Number(
            usedLegacyForecastShape ? 0 : row.upcoming_committed_income_total || 0,
          ),
          upcoming_committed_expense_total: Number(
            usedLegacyForecastShape
              ? 0
              : row.upcoming_committed_expense_total || 0,
          ),
          upcoming_committed_savings_outflow_total: Number(
            usedLegacyForecastShape
              ? 0
              : row.upcoming_committed_savings_outflow_total || 0,
          ),
          lowest_expected_balance:
            usedLegacyForecastShape || row.lowest_expected_balance == null
              ? null
              : Number(row.lowest_expected_balance),
          lowest_expected_balance_date: row.lowest_expected_balance_date
            ? String(row.lowest_expected_balance_date)
            : null,
          next_expected_event_date: row.next_expected_event_date
            ? String(row.next_expected_event_date)
            : null,
          next_expected_event_label: row.next_expected_event_label
            ? String(row.next_expected_event_label)
            : null,
          cash_risk_flag:
            !usedLegacyForecastShape && row.cash_risk_flag === "cash_gap_warning"
              ? "cash_gap_warning"
              : "none",
          expected_end_of_month_balance:
            row.expected_end_of_month_balance == null
              ? null
              : Number(row.expected_end_of_month_balance),
          risk_flag:
            row.risk_flag === "deficit_warning" ? "deficit_warning" : "none",
          top_cost_bucket_1: row.top_cost_bucket_1
            ? String(row.top_cost_bucket_1)
            : null,
          top_cost_bucket_2: row.top_cost_bucket_2
            ? String(row.top_cost_bucket_2)
            : null,
          top_cost_bucket_3: row.top_cost_bucket_3
            ? String(row.top_cost_bucket_3)
            : null,
        };
        acc[mapped.month_start] = mapped;
        return acc;
      }, {});

      setForecastByMonth(rowsByMonth);
      setForecast(rowsByMonth[selectedMonth.startIso] || null);
    } catch (error) {
      console.error("[insights] forecast load error", error);
      setForecastByMonth({});
      setForecast(null);
    } finally {
      forecastLoadInFlight.current = false;
    }
  }, [
    forecastStripOptions,
    forecastSchemaMissing,
    isHistoricalMonth,
    selectedMonth.endIso,
    selectedMonth.isCurrentMonth,
    selectedMonth.startIso,
  ]);

  const loadBudgetPlan = React.useCallback(async () => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      return;
    }
    if (budgetLoadInFlight.current) return;

    budgetLoadInFlight.current = true;
    try {
      const referenceDate = selectedMonth.isCurrentMonth
        ? new Date()
        : new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      if (!selectedMonth.isCurrentMonth) {
        referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
      }
      const computed = await computeBudgetPlan(referenceDate, "default", new Date());
      setBudgetPlan(computed);
    } catch (error) {
      if (isMissingRelationError(error)) {
        setBudgetSchemaMissing(true);
        setBudgetPlan(null);
        return;
      }

      console.error("[insights] budget plan load error", error);
      setBudgetPlan(null);
    } finally {
      budgetLoadInFlight.current = false;
    }
  }, [budgetSchemaMissing, selectedMonth.endIso, selectedMonth.isCurrentMonth]);

  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const loadedCategories = categories.length
        ? categories
        : await loadCategories();
      await Promise.all([
        loadTransactions(),
        loadForecast(),
        loadBudgetPlan(),
        loadRareSubscriptions(loadedCategories),
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    categories,
    loadBudgetPlan,
    loadCategories,
    loadForecast,
    loadRareSubscriptions,
    loadTransactions,
  ]);

  React.useEffect(() => {
    if (!monthOptions.length) return;
    if (monthOptions.some((option) => option.key === selectedMonthKey)) return;

    const currentMonthOption = monthOptions.find((option) => option.isCurrentMonth);
    setSelectedMonthKey((currentMonthOption || monthOptions[0]).key);
  }, [monthOptions, selectedMonthKey]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadMonthOptions();
  }, [isFocused, loadMonthOptions]);

  React.useEffect(() => {
    if (!isFocused) return;
    void refreshAll();
  }, [isFocused, refreshAll]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void refreshAll();
  }, [backgroundStatus.lastCompletedAt, isFocused, refreshAll]);

  const openAnalysisDetail = React.useCallback(
    (group: DrilldownExpenseGroup) => {
      router.push({
        pathname: "/analysis-detail",
        params: {
          group,
          monthStart: selectedMonth.startIso,
          monthEnd: selectedMonth.endIso,
          monthLabel: selectedMonth.label,
        },
      });
    },
    [router, selectedMonth.endIso, selectedMonth.label, selectedMonth.startIso],
  );

  const openReviewModal = React.useCallback(
    (tx: ReviewableInsightTx) => {
      const suggestedCategoryId = getEffectiveCategoryId(tx);
      if (suggestedCategoryId) {
        const groupId = categoryToGroupId.get(suggestedCategoryId);
        if (groupId) {
          setExpandedParents((current) => ({
            ...current,
            [groupId]: true,
          }));
        }
      }
      setSelectedTx(tx);
      setCategorySearch("");
    },
    [categoryToGroupId],
  );

  const toggleParent = React.useCallback((parentId: string) => {
    setExpandedParents((current) => ({
      ...current,
      [parentId]: !current[parentId],
    }));
  }, []);

  const handleReviewSave = React.useCallback(
    async (categoryId: string) => {
      if (!selectedTx) return;

      setSavingReview(true);
      try {
        await setTransactionManualCategory(selectedTx.id, categoryId, {
          reason: "insights review",
          learnFromCounterparty: !isSubjectDrivenCounterparty(
            selectedTx.counterparty,
          ),
        });
        setSelectedTx(null);
        setCategorySearch("");
        await Promise.all([loadTransactions(), loadForecast(), loadBudgetPlan()]);
      } catch (error) {
        console.error("[insights] review save error", error);
      } finally {
        setSavingReview(false);
      }
    },
    [loadBudgetPlan, loadForecast, loadTransactions, selectedTx],
  );

  const handleQuickConfirm = React.useCallback(
    async (tx: ReviewableInsightTx) => {
      const categoryId = getEffectiveCategoryId(tx);
      if (!categoryId) return;

      setSavingReview(true);
      try {
        await setTransactionManualCategory(tx.id, categoryId, {
          reason: "insights quick confirm",
          learnFromCounterparty: !isSubjectDrivenCounterparty(tx.counterparty),
        });
        if (selectedTx?.id === tx.id) {
          setSelectedTx(null);
        }
        await Promise.all([loadTransactions(), loadForecast(), loadBudgetPlan()]);
      } catch (error) {
        console.error("[insights] quick confirm error", error);
      } finally {
        setSavingReview(false);
      }
    },
    [loadBudgetPlan, loadForecast, loadTransactions, selectedTx?.id],
  );

  const handleManualForecastRefresh = React.useCallback(async () => {
    setRefreshingForecast(true);
    try {
      await loadForecast({
        forceRecompute: true,
        reason: "manual_refresh",
      });
    } finally {
      setRefreshingForecast(false);
    }
  }, [loadForecast]);

  const handleForecastExpenseSourceChange = React.useCallback(
    async (nextSource: BudgetForecastExpenseSource) => {
      const currentSource =
        budgetPlan?.settings.forecastExpenseSource || "trend";
      if (updatingForecastExpenseSource || currentSource === nextSource) return;

      setUpdatingForecastExpenseSource(true);
      try {
        await upsertBudgetPlanSettings({
          planKey: "default",
          forecastExpenseSource: nextSource,
        });
        setBudgetPlan((current) =>
          current
            ? {
                ...current,
                settings: {
                  ...current.settings,
                  forecastExpenseSource: nextSource,
                },
              }
            : current,
        );
        await Promise.all([
          loadBudgetPlan(),
          loadForecast({
            forceRecompute: true,
            reason: "budget_toggle",
          }),
        ]);
      } catch (error) {
        console.error("[insights] forecast expense source update error", error);
      } finally {
        setUpdatingForecastExpenseSource(false);
      }
    },
    [budgetPlan?.settings.forecastExpenseSource, loadBudgetPlan, loadForecast, updatingForecastExpenseSource],
  );

  const openSelectedTransactionDetail = React.useCallback(() => {
    if (!selectedTx) return;
    const transactionId = selectedTx.id;
    setSelectedTx(null);
    setCategorySearch("");
    router.push(`/transaction-detail?id=${transactionId}`);
  }, [router, selectedTx]);

  const openRareTransactionDetail = React.useCallback(
    (item: RareSubscriptionItem) => {
      router.push(`/transaction-detail?id=${item.latestTransactionId}`);
    },
    [router],
  );

  const hasMonthData = txCount > 0;
  const netResult = monthReport.net;
  const monthBudgetSnapshot = React.useMemo(
    () => getMonthVariableBudgetSnapshot(budgetPlan),
    [budgetPlan],
  );
  const monthRiskTone = monthBudgetSnapshot.tone;
  const activeForecastExpenseSource =
    budgetPlan?.settings.forecastExpenseSource || "trend";
  const forecastBudgetActionLabel = isFutureMonth
    ? `Budget voor ${selectedMonth.label} instellen`
    : `Budget voor ${selectedMonth.label} openen`;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <HeaderDropdownMenu />
            <View>
              <Text style={styles.pageTitle}>Insights</Text>
              <Text style={styles.pageSubtitle}>Begrijpen, voorspellen, verbeteren.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerCta}
            onPress={() => router.push("/budget")}
          >
            <Text style={styles.headerCtaText}>Budget</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.monthRow}>
          <Pressable
            style={[
              styles.monthNavButton,
              !canGoToOlderMonth && styles.monthNavButtonDisabled,
            ]}
            onPress={() => {
              if (!canGoToOlderMonth) return;
              const nextOption = monthOptions[selectedMonthIndex + 1];
              if (nextOption) setSelectedMonthKey(nextOption.key);
            }}
            disabled={!canGoToOlderMonth}
          >
            <Text style={styles.monthNavButtonText}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.monthBadge}
            onPress={() => setMonthPickerOpen(true)}
          >
            <Text style={styles.monthBadgeText}>{selectedMonth.label}</Text>
            <AppIcon
              name="expand-more"
              size={18}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          </Pressable>
          <Pressable
            style={[
              styles.monthNavButton,
              !canGoToNewerMonth && styles.monthNavButtonDisabled,
            ]}
            onPress={() => {
              if (!canGoToNewerMonth) return;
              const nextOption = monthOptions[selectedMonthIndex - 1];
              if (nextOption) setSelectedMonthKey(nextOption.key);
            }}
            disabled={!canGoToNewerMonth}
          >
            <Text style={styles.monthNavButtonText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.segmentRow}>
          {SEGMENTS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.segmentChip,
                segment === item.key && styles.segmentChipActive,
              ]}
              onPress={() => setSegment(item.key)}
            >
              <Text
                style={[
                  styles.segmentChipText,
                  segment === item.key && styles.segmentChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={FinColors.textSecondary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {segment === "trends" ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>{selectedMonth.label}</Text>
                <Text style={styles.heroSummary}>{trendHeadline}</Text>
                <View style={styles.metricRow}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Inkomsten</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        hasMonthData ? styles.positiveText : styles.mutedText,
                      ]}
                    >
                      {hasMonthData
                        ? `+${fmt.format(monthReport.income)}`
                        : "Nog geen data"}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Netto resultaat</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        hasMonthData
                          ? netResult >= 0
                            ? styles.positiveText
                            : styles.negativeText
                          : styles.mutedText,
                      ]}
                    >
                      {hasMonthData
                        ? `${netResult >= 0 ? "+" : ""}${fmt.format(netResult)}`
                        : "Nog geen data"}
                    </Text>
                  </View>
                </View>
                {budgetPlan ? (
                  <RiskProgressBar
                    progress={monthBudgetSnapshot.progress}
                    tone={monthRiskTone}
                    style={styles.progressTrack}
                  />
                ) : null}
                {budgetPlan ? (
                  <Text style={styles.helperText}>
                    {monthBudgetSnapshot.label}.{" "}
                    {getMonthVariableBudgetUsageText(monthBudgetSnapshot, fmt)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Maandrapport</Text>
                  <Text style={styles.sectionHelper}>Waar je maand uit bestaat</Text>
                </View>
                <Pressable
                  style={styles.reportRowButton}
                  onPress={() => setIncomeDetailsOpen(true)}
                >
                  <Text style={styles.reportLabel}>Inkomsten totaal</Text>
                  <View style={styles.reportRight}>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(monthReport.income)}
                    </Text>
                    <Text style={styles.reportHint}>Details</Text>
                  </View>
                </Pressable>
                {incomeSummary.structural > 0 ? (
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Structureel inkomen</Text>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(incomeSummary.structural)}
                    </Text>
                  </View>
                ) : null}
                {incomeSummary.variableIncome > 0 ? (
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Variabel inkomen</Text>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(incomeSummary.variableIncome)}
                    </Text>
                  </View>
                ) : null}
                {monthReport.windfalls > 0 ? (
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Incidentele meevallers</Text>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(monthReport.windfalls)}
                    </Text>
                  </View>
                ) : null}
                {monthReport.costRefunds > 0 ? (
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Kostencompensaties</Text>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(monthReport.costRefunds)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Uitgaven totaal</Text>
                  <Text style={styles.reportValue}>
                    {fmt.format(monthReport.expenses)}
                  </Text>
                </View>
                <Pressable
                  style={styles.reportRowButton}
                  onPress={() => openAnalysisDetail("fixed_costs")}
                >
                  <Text style={styles.reportLabel}>Vaste lasten</Text>
                  <Text style={styles.reportValue}>{fmt.format(monthReport.fixed)}</Text>
                </Pressable>
                <Pressable
                  style={styles.reportRowButton}
                  onPress={() => openAnalysisDetail("subscriptions")}
                >
                  <Text style={styles.reportLabel}>Abonnementen</Text>
                  <Text style={styles.reportValue}>
                    {fmt.format(monthReport.subscriptions)}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.reportRowButton}
                  onPress={() => openAnalysisDetail("variable_costs")}
                >
                  <Text style={styles.reportLabel}>Variabele kosten</Text>
                  <Text style={styles.reportValue}>
                    {fmt.format(monthReport.variable)}
                  </Text>
                </Pressable>
                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Overboeken naar sparen</Text>
                  <Text style={styles.reportValue}>
                    {fmt.format(monthReport.savingsTransfers)}
                  </Text>
                </View>
                <View style={styles.reportDivider} />
                <View style={styles.reportRow}>
                  <Text style={styles.reportLabelStrong}>Netto resultaat</Text>
                  <Text
                    style={[
                      styles.reportValueStrong,
                      monthReport.net >= 0 ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {monthReport.net >= 0 ? "+" : ""}
                    {fmt.format(monthReport.net)}
                  </Text>
                </View>
                {monthReport.windfalls > 0 || monthReport.costRefunds > 0 ? (
                  <Text style={styles.helperText}>
                    Belastingmeevallers tellen mee in je cashflow, maar niet als
                    vast maandinkomen. Kostencompensaties verlagen je kosten.
                  </Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionTitle}>Uitgaven per categorie</Text>
                  <Text style={styles.sectionHelper}>Top 5 deze maand</Text>
                </View>
                {spendingByCategory.length ? (
                  <CategoryBar categories={spendingByCategory} />
                ) : (
                  <Text style={styles.supportText}>
                    Nog niet genoeg gecategoriseerde uitgaven om een verdeling te tonen.
                  </Text>
                )}
              </View>
            </>
          ) : null}

          {segment === "forecast" ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>{selectedMonth.label}</Text>
                <Text style={styles.heroSummary}>{forecastHeadline}</Text>
                {forecastDataHelper ? (
                  <Text style={styles.helperText}>{forecastDataHelper}</Text>
                ) : null}
                <View style={styles.forecastRefreshRow}>
                  <Text
                    style={[
                      styles.forecastRefreshMeta,
                      forecastRefreshStatus?.isDirty &&
                        styles.forecastRefreshMetaWarning,
                    ]}
                  >
                    {forecastRefreshHelper || "Refreshstatus wordt geladen."}
                  </Text>
                  <Pressable
                    style={[
                      styles.inlineRefreshButton,
                      refreshingForecast && styles.inlineRefreshButtonDisabled,
                    ]}
                    onPress={handleManualForecastRefresh}
                    disabled={refreshingForecast}
                  >
                    {refreshingForecast ? (
                      <ActivityIndicator
                        color={FinColors.textPrimary}
                        size="small"
                      />
                    ) : (
                      <Text style={styles.inlineRefreshButtonText}>
                        Voorspelling vernieuwen
                      </Text>
                    )}
                  </Pressable>
                </View>
                {forecast ? (
                  <View style={styles.metricRow}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Verwacht eindsaldo</Text>
                      <Text
                        style={[
                          styles.metricValue,
                          forecast.expected_end_of_month_balance != null &&
                          forecast.expected_end_of_month_balance >= 0
                            ? styles.positiveText
                            : styles.negativeText,
                        ]}
                      >
                        {forecast.expected_end_of_month_balance == null
                          ? "Onbekend"
                          : `${forecast.expected_end_of_month_balance >= 0 ? "+" : ""}${fmt.format(forecast.expected_end_of_month_balance)}`}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Laagste saldo</Text>
                      <Text
                        style={[
                          styles.metricValue,
                          forecast.lowest_expected_balance != null &&
                          forecast.lowest_expected_balance >= 0
                            ? styles.positiveText
                            : styles.negativeText,
                        ]}
                      >
                        {forecast.lowest_expected_balance == null
                          ? "Onbekend"
                          : fmt.format(forecast.lowest_expected_balance)}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Status</Text>
                      <Text
                        style={[
                          styles.metricValue,
                          forecastStatusTone === "positive" && styles.positiveText,
                          forecastStatusTone === "warning" && styles.warningText,
                          forecastStatusTone === "negative" && styles.negativeText,
                        ]}
                      >
                        {forecastStatusLabel}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Vooruitblik</Text>
                  <Text style={styles.sectionHelper}>Huidige maand + 6 maanden</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.forecastStrip}
                >
                  {forecastStripItems.map(({ option, forecast: stripForecast }) => (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.forecastStripCard,
                        selectedMonth.key === option.key &&
                          styles.forecastStripCardActive,
                      ]}
                      onPress={() => setSelectedMonthKey(option.key)}
                    >
                      <Text
                        style={[
                          styles.forecastStripLabel,
                          selectedMonth.key === option.key &&
                            styles.forecastStripLabelActive,
                        ]}
                      >
                        {option.monthLabel}
                      </Text>
                      <Text
                        style={[
                          styles.forecastStripValue,
                          stripForecast?.expected_end_of_month_balance != null &&
                          stripForecast.expected_end_of_month_balance >= 0
                            ? styles.positiveText
                            : styles.negativeText,
                        ]}
                      >
                        {stripForecast?.expected_end_of_month_balance == null
                          ? "..."
                          : `${stripForecast.expected_end_of_month_balance >= 0 ? "+" : ""}${fmt.format(stripForecast.expected_end_of_month_balance)}`}
                      </Text>
                      <Text style={styles.forecastStripMeta}>
                        {getForecastStatusLabel(stripForecast)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Toekomstige uitgaven</Text>
                  <Text style={styles.sectionHelper}>{selectedMonth.label}</Text>
                </View>
                <Text style={styles.supportText}>
                  Kies welke bron deze voorspelling gebruikt voor toekomstige
                  uitgaven.
                </Text>
                <View style={styles.choiceWrap}>
                  {FORECAST_EXPENSE_SOURCE_OPTIONS.map((option) => {
                    const selected =
                      activeForecastExpenseSource === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.choiceChip,
                          selected && styles.choiceChipActive,
                        ]}
                        onPress={() =>
                          void handleForecastExpenseSourceChange(option.value)
                        }
                        disabled={updatingForecastExpenseSource}
                      >
                        <View style={styles.choiceChipInner}>
                          <AppIcon
                            name={
                              selected
                                ? "check-circle"
                                : "radio-button-unchecked"
                            }
                            size={16}
                            color={
                              selected
                                ? FinColors.textPrimary
                                : FinColors.textMuted
                            }
                            variant="outlined"
                          />
                          <Text
                            style={[
                              styles.choiceChipText,
                              selected && styles.choiceChipTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>
                  Nu actief:{" "}
                  {formatForecastExpenseSourceLabel(activeForecastExpenseSource)}
                  .{" "}
                  {getForecastExpenseSourceDescription(activeForecastExpenseSource)}
                </Text>
                <Text style={styles.helperText}>
                  Trend volgt je recente maandritme. Budgetplan volgt vaste
                  lasten, abonnementen, variabele ruimte en sparen uit Budget.
                </Text>
                <Pressable
                  style={styles.forecastBudgetLinkButton}
                  onPress={() =>
                    router.push({
                      pathname: "/budget",
                      params: {
                        month: selectedMonth.key,
                        segment: "manage",
                        focusToken: String(Date.now()),
                      },
                    })
                  }
                >
                  <AppIcon
                    name="calendar-month"
                    size={16}
                    color={FinColors.textPrimary}
                    variant="outlined"
                  />
                  <Text style={styles.forecastBudgetLinkText}>
                    {forecastBudgetActionLabel}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Cashflow deze maand</Text>
                  <Text style={styles.sectionHelper}>
                    Saldo nu, maandmutatie en eindsaldo
                  </Text>
                </View>
                {forecast ? (
                  <>
                    <View style={styles.metricRow}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Laatste bekende saldo</Text>
                        <Text style={styles.metricValue}>
                          {forecast.current_balance_anchor == null
                            ? "Onbekend"
                            : fmt.format(forecast.current_balance_anchor)}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Maandmutatie verwacht</Text>
                        <Text
                          style={[
                            styles.metricValue,
                            forecastExpectedMonthDelta != null &&
                            forecastExpectedMonthDelta >= 0
                              ? styles.positiveText
                              : styles.negativeText,
                          ]}
                        >
                          {forecastExpectedMonthDelta == null
                            ? "Onbekend"
                            : `${forecastExpectedMonthDelta >= 0 ? "+" : ""}${fmt.format(forecastExpectedMonthDelta)}`}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Verwacht eindsaldo</Text>
                        <Text
                          style={[
                            styles.metricValue,
                            forecast.expected_end_of_month_balance != null &&
                            forecast.expected_end_of_month_balance >= 0
                              ? styles.positiveText
                              : styles.negativeText,
                          ]}
                        >
                          {forecast.expected_end_of_month_balance == null
                            ? "Onbekend"
                            : `${forecast.expected_end_of_month_balance >= 0 ? "+" : ""}${fmt.format(forecast.expected_end_of_month_balance)}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reportDivider} />

                    <View style={styles.forecastBreakdownGrid}>
                      <View style={styles.forecastBreakdownCard}>
                        <Text style={styles.forecastBreakdownTitle}>Cash-in</Text>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabelStrong}>Totaal cash-in</Text>
                          <Text style={[styles.reportValueStrong, styles.positiveText]}>
                            +{fmt.format(forecastCashInTotal)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Al binnen</Text>
                          <Text style={[styles.reportValue, styles.positiveText]}>
                            +{fmt.format(forecastBookedCashIn)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Nog verwacht</Text>
                          <Text style={[styles.reportValue, styles.positiveText]}>
                            +{fmt.format(forecastRemainingCashIn)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.forecastBreakdownCard}>
                        <Text style={styles.forecastBreakdownTitle}>Cash-out</Text>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabelStrong}>Totaal cash-out</Text>
                          <Text style={styles.reportValueStrong}>
                            {fmt.format(forecastCashOutTotal)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Al uitgegeven</Text>
                          <Text style={styles.reportValue}>
                            {fmt.format(forecastBookedCashOut)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Nog verwacht</Text>
                          <Text style={styles.reportValue}>
                            {fmt.format(forecastRemainingCashOut)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Waarvan sparen totaal</Text>
                          <Text style={styles.reportValue}>
                            {fmt.format(forecast.expected_savings_outflow_total)}
                          </Text>
                        </View>
                        <Text style={styles.helperText}>
                          Toekomstige uitgaven volgen nu:{" "}
                          {formatForecastExpenseSourceLabel(
                            activeForecastExpenseSource,
                          )}
                          .
                        </Text>
                      </View>
                    </View>

                    {budgetExpectedIncomeTotal != null ? (
                      <View style={styles.forecastPlannerCard}>
                        <Text style={styles.forecastPlannerTitle}>Budgetbasis</Text>
                        <Text style={styles.helperText}>
                          Van je totale cash-in van {fmt.format(forecastCashInTotal)}
                          {" "}telt {fmt.format(forecastBudgetBasisExpectedIncome)} mee
                          in je budgetplanner.
                        </Text>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Meegeteld totaal</Text>
                          <Text style={[styles.reportValue, styles.positiveText]}>
                            +{fmt.format(forecastBudgetBasisExpectedIncome)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Al meegeteld</Text>
                          <Text style={[styles.reportValue, styles.positiveText]}>
                            +{fmt.format(forecastBudgetBasisBookedIncome)}
                          </Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Nog volgens planner</Text>
                          <Text style={[styles.reportValue, styles.positiveText]}>
                            +{fmt.format(forecastBudgetBasisRemainingIncome)}
                          </Text>
                        </View>
                        {forecastOutsideBudgetBasisBookedIncome > 0 ? (
                          <View style={styles.reportRow}>
                            <Text style={styles.reportLabel}>
                              Buiten budgetbasis al ontvangen
                            </Text>
                            <Text style={[styles.reportValue, styles.positiveText]}>
                              +{fmt.format(forecastOutsideBudgetBasisBookedIncome)}
                            </Text>
                          </View>
                        ) : null}
                        {forecastOutsideBudgetBasisExpectedIncome > 0 ? (
                          <Text style={styles.helperText}>
                            Buiten de budgetbasis valt {fmt.format(
                              forecastOutsideBudgetBasisExpectedIncome,
                            )} aan cash-in, zoals meevallers of incidenteel inkomen.
                          </Text>
                        ) : null}
                        <Text style={styles.helperText}>
                          Inkomstenbasis budget: {formatIncludedIncomeLabel(budgetPlan)}.
                        </Text>
                      </View>
                    ) : null}

                    {forecast.cash_risk_flag === "cash_gap_warning" ? (
                      <Text style={styles.warningText}>
                        Let op: je saldo kan tussentijds onder nul zakken.
                      </Text>
                    ) : null}
                    {forecast.risk_flag === "deficit_warning" ? (
                      <Text style={styles.warningText}>
                        Verwacht tekort aan het eind van de maand.
                      </Text>
                    ) : null}
                    {forecastEndBalanceNeedsContext &&
                    forecast.current_balance_anchor != null ? (
                      <Text style={styles.helperText}>
                        Je maandmutatie is positief, maar je laatste bekende saldo
                        van {fmt.format(forecast.current_balance_anchor)} is nog te
                        laag om deze maand boven nul te eindigen.
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.supportText}>
                    Nog geen voorspelling beschikbaar voor {selectedMonth.label}.
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Komende bekende momenten</Text>
                  <Text style={styles.sectionHelper}>Nog in deze maand</Text>
                </View>
                {forecast ? (
                  <>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Komende inkomsten</Text>
                      <Text style={[styles.reportValue, styles.positiveText]}>
                        +{fmt.format(forecast.upcoming_committed_income_total)}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Komende uitgaven</Text>
                      <Text style={styles.reportValue}>
                        {fmt.format(forecast.upcoming_committed_expense_total)}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Komend naar sparen</Text>
                      <Text style={styles.reportValue}>
                        {fmt.format(
                          forecast.upcoming_committed_savings_outflow_total,
                        )}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabelStrong}>
                        Laagste verwachte saldo
                      </Text>
                      <View style={styles.reportRight}>
                        <Text
                          style={[
                            styles.reportValueStrong,
                            forecast.lowest_expected_balance != null &&
                            forecast.lowest_expected_balance >= 0
                              ? styles.positiveText
                              : styles.negativeText,
                          ]}
                        >
                          {forecast.lowest_expected_balance == null
                            ? "Onbekend"
                            : fmt.format(forecast.lowest_expected_balance)}
                        </Text>
                        {forecast.lowest_expected_balance_date ? (
                          <Text style={styles.reportHint}>
                            {formatShortDate(forecast.lowest_expected_balance_date)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {isHistoricalMonth ? (
                      <Text style={styles.helperText}>
                        Deze maand is afgesloten; er staan geen resterende momenten
                        meer open.
                      </Text>
                    ) : forecast.next_expected_event_date &&
                      forecast.next_expected_event_label ? (
                      <Text style={styles.helperText}>
                        Eerstvolgende verwachte beweging:{" "}
                        {forecast.next_expected_event_label} op{" "}
                        {formatShortDate(forecast.next_expected_event_date)}.
                      </Text>
                    ) : (
                      <Text style={styles.helperText}>
                        Er staan geen concrete toekomstige momenten meer klaar in
                        deze maand.
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.supportText}>
                    Nog geen voorspelling beschikbaar voor {selectedMonth.label}.
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Verwachte opbouw</Text>
                  <Text style={styles.sectionHelper}>Per kostenlaag</Text>
                </View>
                {forecast ? (
                  <>
                    {forecastBuildupRows.map((row) =>
                      row.pressable ? (
                        <Pressable
                          key={row.key}
                          style={styles.reportRowButton}
                          onPress={() =>
                            openAnalysisDetail(row.key as DrilldownExpenseGroup)
                          }
                        >
                          <View>
                            <Text style={styles.reportLabel}>{row.label}</Text>
                            <Text style={styles.reportHint}>
                              Geboekt {fmt.format(row.booked)} • nog verwacht{" "}
                              {fmt.format(row.remaining)}
                            </Text>
                          </View>
                          <View style={styles.reportRight}>
                            <Text style={styles.reportValue}>
                              {fmt.format(row.total)}
                            </Text>
                            <Text style={styles.reportHint}>Analyse</Text>
                          </View>
                        </Pressable>
                      ) : (
                        <View key={row.key} style={styles.reportRow}>
                          <View>
                            <Text style={styles.reportLabel}>{row.label}</Text>
                            <Text style={styles.reportHint}>
                              Geboekt {fmt.format(row.booked)} • nog verwacht{" "}
                              {fmt.format(row.remaining)}
                            </Text>
                          </View>
                          <Text style={styles.reportValue}>{fmt.format(row.total)}</Text>
                        </View>
                      ),
                    )}

                    <Text style={styles.helperText}>
                      Inkomstenbasis budget: {formatIncludedIncomeLabel(budgetPlan)}.
                    </Text>
                    {forecastTopCostLabels.length ? (
                      <Text style={styles.helperText}>
                        Grootste cash-out: {forecastTopCostLabels.join(", ")}.
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.supportText}>
                    Nog geen voorspelling beschikbaar voor {selectedMonth.label}.
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Budgetoverzicht</Text>
                  <Text style={styles.sectionHelper}>Koppeling met je budget</Text>
                </View>
                {budgetPlan ? (
                  <>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Nog vrij te besteden</Text>
                      <Text
                        style={[
                          styles.reportValue,
                          (monthBudgetSnapshot.remaining || 0) >= 0
                            ? styles.positiveText
                            : styles.negativeText,
                        ]}
                      >
                        {fmt.format(
                          monthBudgetSnapshot.remaining || 0,
                        )}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Variabel gebruikt</Text>
                      <Text style={styles.reportValue}>
                        {fmt.format(monthBudgetSnapshot.spent || 0)}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Status</Text>
                      <Text
                        style={[
                          styles.reportValue,
                          monthRiskTone === "good"
                            ? styles.positiveText
                            : monthRiskTone === "watch"
                              ? styles.warningText
                            : monthRiskTone === "critical"
                              ? styles.negativeText
                              : styles.reportValue,
                        ]}
                      >
                        {monthBudgetSnapshot.label}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Aanbevolen spaardoel</Text>
                      <Text style={[styles.reportValue, styles.positiveText]}>
                        +{fmt.format(budgetPlan.recommendedSavings)}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Waarschuwingen</Text>
                      <Text style={styles.reportValue}>
                        {budgetPlan.warnings.length}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Weekbudget totaal</Text>
                      <Text style={styles.reportValue}>
                        {fmt.format(budgetPlan.weeklyBudgetTotal)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => router.push("/budget")}
                    >
                      <Text style={styles.primaryButtonText}>Open budget</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.supportText}>
                    {budgetSchemaMissing
                      ? "Budgetdata is nog niet beschikbaar in deze omgeving."
                      : `Nog geen budgetplan beschikbaar voor ${selectedMonth.label}.`}
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Coach</Text>
                  <Text style={styles.sectionHelper}>Aanbevelingen en signalen</Text>
                </View>
                <Text style={styles.recommendationText}>
                  {budgetPlan?.coachReport.sections.summary ||
                    "Zodra er genoeg budget- en transactiedata is, verschijnen hier concrete aanbevelingen."}
                </Text>
                {budgetPlan?.coachReport.sections.actions.slice(0, 2).map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
                {budgetPlan?.warnings.slice(0, 2).map((warning) => (
                  <View key={warning.message} style={styles.bulletRow}>
                    <AppIcon
                      name="priority-high"
                      size={16}
                      color={FinColors.warningText}
                    />
                    <Text style={styles.bulletText}>{warning.message}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {segment === "rare" ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>Verborgen betalingen</Text>
                <Text style={styles.heroSummary}>{rareSubscriptionHeadline}</Text>
                <Text style={styles.helperText}>
                  Gebaseerd op maximaal 24 maanden historie en transacties die
                  als abonnement herkenbaar zijn.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Samenvatting</Text>
                  <Text style={styles.sectionHelper}>Zeldzame afschrijvingen</Text>
                </View>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>1x per jaar</Text>
                    <Text style={styles.summaryValue}>
                      {rareSubscriptionSummary.yearly}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>2x per jaar</Text>
                    <Text style={styles.summaryValue}>
                      {rareSubscriptionSummary.semiannual}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>1x gezien</Text>
                    <Text style={styles.summaryValue}>
                      {rareSubscriptionSummary.possible}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Geschatte jaarimpact</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(rareSubscriptionSummary.annualImpact)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Binnenkort relevant</Text>
                  <Text style={styles.sectionHelper}>
                    Terug verwacht of net gemist
                  </Text>
                </View>
                {rareSubscriptionSummary.upcoming.length ? (
                  <View style={styles.rareList}>
                    {rareSubscriptionSummary.upcoming.map((item) => (
                      <RareSubscriptionRow
                        key={item.id}
                        item={item}
                        onPress={openRareTransactionDetail}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.supportText}>
                    Er zijn nu geen zeldzame abonnementen die binnenkort opnieuw
                    verwacht worden.
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Alle signalen</Text>
                  <Text style={styles.sectionHelper}>Tik om de transactie te openen</Text>
                </View>
                {rareSubscriptionItems.length ? (
                  <View style={styles.rareList}>
                    {rareSubscriptionItems.map((item) => (
                      <RareSubscriptionRow
                        key={item.id}
                        item={item}
                        onPress={openRareTransactionDetail}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.supportText}>
                    Nog geen zeldzame abonnementen gevonden voor deze periode.
                  </Text>
                )}
              </View>
            </>
          ) : null}

          {segment === "review" ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>Controle</Text>
                <Text style={styles.heroSummary}>
                  {reviewQueue.length === 0
                    ? "Je categorisatie oogt rustig. Er staan geen open review-items klaar."
                    : `${reviewQueue.length} transacties wachten op bevestiging of correctie.`}
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Categorisatiekwaliteit</Text>
                  <Text style={styles.sectionHelper}>
                    {coverage.total ? `${coverage.categorized}/${coverage.total}` : "0/0"}
                  </Text>
                </View>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Automatisch</Text>
                    <Text style={styles.summaryValue}>{coverage.auto}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Handmatig</Text>
                    <Text style={styles.summaryValue}>{coverage.manual}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Open</Text>
                    <Text style={styles.summaryValue}>{coverage.uncategorized}</Text>
                  </View>
                </View>
                <Text style={styles.helperText}>
                  Handmatige bevestigingen helpen vergelijkbare transacties later sneller te herkennen.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Te controleren</Text>
                  <Text style={styles.sectionHelper}>Lage zekerheid of fallback</Text>
                </View>
                {reviewQueue.length ? (
                  <View style={styles.reviewList}>
                    {reviewQueue.map((tx) => (
                      <ReviewItem
                        key={tx.id}
                        tx={tx}
                        categoryMap={categoryMap}
                        onPress={openReviewModal}
                        onConfirm={handleQuickConfirm}
                        saving={savingReview}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.supportText}>
                    Alle transacties in deze periode hebben voldoende zekerheid of zijn al bevestigd.
                  </Text>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}

      <MonthPickerSheet
        visible={monthPickerOpen}
        title="Kies maand"
        helper="Historie plus 6 maanden vooruit"
        options={monthOptions}
        selectedKey={selectedMonth.key}
        onClose={() => setMonthPickerOpen(false)}
        onSelect={setSelectedMonthKey}
      />

      <Modal
        animationType="slide"
        transparent
        visible={incomeDetailsOpen}
        onRequestClose={() => setIncomeDetailsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Inkomsten</Text>
              <Pressable
                style={styles.modalIconCloseButton}
                onPress={() => setIncomeDetailsOpen(false)}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>{selectedMonth.label}</Text>

            <View style={styles.modalHeroCard}>
              <Text style={styles.modalHeroLabel}>Totaal inkomsten</Text>
              <Text style={[styles.modalHeroValue, styles.positiveText]}>
                +{fmt.format(monthReport.income)}
              </Text>
              <Text style={styles.modalHeroMeta}>
                {incomeTransactions.length} inkomende transactie
                {incomeTransactions.length === 1 ? "" : "s"} in {selectedMonth.label}
              </Text>
            </View>

            <View style={styles.modalMetricGrid}>
              {incomeMetricCards.map((item) => (
                <View key={item.label} style={styles.modalMetricCard}>
                  <Text style={styles.modalMetricLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.modalMetricValue,
                      item.tone === "positive" && styles.positiveText,
                      item.tone === "refund" && styles.refundText,
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text style={styles.modalMetricMeta}>{item.meta}</Text>
                </View>
              ))}
            </View>

            {incomeSummary.windfalls > 0 || incomeSummary.costRefunds > 0 ? (
              <View style={styles.modalNoteCard}>
                <Text style={styles.modalNoteText}>
                  Meevallers horen wel bij deze maand, maar niet bij je vaste
                  inkomensbasis. Kostencompensaties verlagen je kosten.
                </Text>
              </View>
            ) : null}

            {incomeBreakdown.length ? (
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionTitle}>Waar het vandaan komt</Text>
                  <Text style={styles.modalSectionHelper}>
                    {incomeBreakdown.length} groep{incomeBreakdown.length === 1 ? "" : "en"}
                  </Text>
                </View>
                {incomeBreakdown.map((item) => (
                  <View key={item.label} style={styles.modalBreakdownRow}>
                    <View style={styles.modalBreakdownMain}>
                      <Text style={styles.reportLabel}>{item.label}</Text>
                      <Text style={styles.modalBreakdownMeta}>
                        {item.count} transactie{item.count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.reportValue,
                        item.tone === "refund"
                          ? styles.refundText
                          : styles.positiveText,
                      ]}
                    >
                      +{fmt.format(item.total)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.modalSectionHeader}>
              <Text style={styles.modalSectionTitle}>Transacties</Text>
              <Text style={styles.modalSectionHelper}>Tik voor detail</Text>
            </View>
            <ScrollView style={styles.modalScroll}>
              {incomeTransactions.length ? (
                incomeTransactions.map((tx) => (
                  <Pressable
                    key={tx.id}
                    style={styles.incomeTxRow}
                    onPress={() => {
                      setIncomeDetailsOpen(false);
                      router.push(`/transaction-detail?id=${tx.id}`);
                    }}
                  >
                    <View style={styles.reviewIconWrap}>
                      <TransactionCategoryIcon row={tx} categoryById={categoryMap} />
                    </View>
                    <View style={styles.incomeTxMain}>
                      <Text style={styles.incomeTxCounterparty} numberOfLines={1}>
                        {tx.counterparty || "Onbekende bron"}
                      </Text>
                      <Text style={styles.incomeTxSub} numberOfLines={1}>
                        {tx.details || tx.date}
                      </Text>
                      <Text style={styles.incomeTxCategory} numberOfLines={1}>
                        {tx.incomeShortLabel
                          ? `${tx.categoryLabel} • ${tx.incomeShortLabel}`
                          : tx.categoryLabel}
                      </Text>
                    </View>
                    <View style={styles.incomeTxAside}>
                      <Text style={[styles.incomeTxAmount, styles.positiveText]}>
                        +{fmt.format(tx.amount)}
                      </Text>
                      <Text style={styles.incomeTxDate}>{formatShortDate(tx.date)}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.supportText}>
                  Geen inkomsten gevonden in deze maand.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={!!selectedTx}
        onRequestClose={() => {
          setSelectedTx(null);
          setCategorySearch("");
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Review transactie</Text>
              <Pressable
                style={styles.modalIconCloseButton}
                onPress={() => {
                  setSelectedTx(null);
                  setCategorySearch("");
                }}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.modalName} numberOfLines={1}>
              {selectedTx?.counterparty || "Onbekende tegenpartij"}
            </Text>
            <Text style={styles.modalSub} numberOfLines={2}>
              {selectedTx?.details || selectedTx?.date || ""}
            </Text>
            <Text style={styles.helperText}>
              Kies de juiste categorie. Deze keuze helpt vergelijkbare transacties later sneller herkennen.
            </Text>

            <View style={styles.modalActionRow}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={openSelectedTransactionDetail}
              >
                <Text style={styles.modalSecondaryButtonText}>
                  Open transactiedetail
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Zoek categorie..."
              placeholderTextColor={FinColors.textMuted}
              style={styles.modalSearchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <ScrollView style={styles.modalScroll}>
              {filteredModalGroups.length ? (
                filteredModalGroups.map((group) => {
                  const expanded = searchActive || Boolean(expandedParents[group.id]);

                  return (
                    <View key={group.id} style={styles.modalGroup}>
                      <Pressable
                        style={styles.modalGroupHeader}
                        onPress={() => toggleParent(group.id)}
                        disabled={searchActive}
                      >
                        <Text style={styles.modalGroupTitle}>{group.name}</Text>
                        {searchActive ? (
                          <Text style={styles.modalGroupCount}>
                            {group.children.length}
                          </Text>
                        ) : (
                          <AppIcon
                            name={expanded ? "remove" : "add"}
                            size={16}
                            color={FinColors.textSecondary}
                          />
                        )}
                      </Pressable>

                      {expanded
                        ? group.children.map((category) => (
                            <Pressable
                              key={category.id}
                              style={styles.modalCategoryButton}
                              disabled={savingReview}
                              onPress={() => {
                                void handleReviewSave(category.id);
                              }}
                            >
                              <Text style={styles.modalCategoryText}>
                                {category.name}
                              </Text>
                            </Pressable>
                          ))
                        : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.supportText}>
                  Geen categorieen gevonden voor deze zoekopdracht.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: FinColors.bgBase,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  headerCta: {
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerCtaText: {
    color: FinColors.warningText,
    fontWeight: "700",
    fontSize: 12,
  },
  monthRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthBadge: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
  },
  monthBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
    textTransform: "capitalize",
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavButtonDisabled: {
    opacity: 0.45,
  },
  monthNavButtonText: {
    fontSize: 22,
    lineHeight: 22,
    color: FinColors.textPrimary,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  segmentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  segmentChipActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  segmentChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  segmentChipTextActive: {
    color: FinColors.bgCard,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 20,
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  heroSummary: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  mutedText: {
    color: FinColors.textMuted,
  },
  positiveText: {
    color: FinColors.green,
  },
  refundText: {
    color: FinColors.warningText,
  },
  negativeText: {
    color: FinColors.red,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: FinColors.yellow,
    borderRadius: 999,
  },
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 18,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  sectionHelper: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  forecastStrip: {
    gap: 10,
    paddingRight: 4,
  },
  forecastStripCard: {
    width: 140,
    borderRadius: 16,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  forecastStripCardActive: {
    borderColor: FinColors.textPrimary,
    backgroundColor: FinColors.bgBase,
  },
  forecastStripLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textSecondary,
    textTransform: "capitalize",
  },
  forecastStripLabelActive: {
    color: FinColors.textPrimary,
  },
  forecastStripValue: {
    fontSize: 15,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  forecastStripMeta: {
    fontSize: 11,
    color: FinColors.textMuted,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reportRowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  reportLabel: {
    flex: 1,
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  reportLabelStrong: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  reportRight: {
    alignItems: "flex-end",
  },
  reportValue: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  reportValueStrong: {
    fontSize: 15,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  reportHint: {
    marginTop: 3,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  reportDivider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
  },
  forecastBreakdownGrid: {
    gap: 12,
  },
  forecastBreakdownCard: {
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 10,
  },
  forecastBreakdownTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  forecastPlannerCard: {
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 10,
  },
  forecastPlannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgInput,
  },
  choiceChipActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  choiceChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  choiceChipTextActive: {
    color: FinColors.textPrimary,
  },
  supportText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  forecastRefreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  forecastRefreshMeta: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textMuted,
  },
  forecastRefreshMetaWarning: {
    color: FinColors.warningText,
  },
  inlineRefreshButton: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineRefreshButtonDisabled: {
    opacity: 0.7,
  },
  inlineRefreshButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textMuted,
  },
  forecastBudgetLinkButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  forecastBudgetLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalActionRow: {
    marginTop: -2,
  },
  modalSecondaryButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  modalSecondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textPrimary,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: FinColors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: FinColors.bgCard,
    fontSize: 14,
    fontWeight: "700",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FinColors.yellow,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textPrimary,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: FinColors.red,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  categoryBarWrap: {
    gap: 14,
  },
  categoryBarTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: FinColors.bgElevated,
  },
  categoryBarSegment: {
    height: "100%",
  },
  categoryLegend: {
    gap: 10,
  },
  categoryLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryLegendMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  categoryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLegendLabel: {
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  categoryLegendValue: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  rareList: {
    gap: 12,
  },
  rareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
  },
  rareIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: FinColors.warningBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rareMain: {
    flex: 1,
    gap: 4,
  },
  rareName: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  rareSub: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  rareMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  rareBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rareBadgeConfirmed: {
    backgroundColor: FinColors.warningBg,
  },
  rareBadgePossible: {
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  rareBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  rareMetaText: {
    fontSize: 11,
    color: FinColors.textSecondary,
  },
  rareStatus: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  rareAside: {
    alignItems: "flex-end",
    gap: 4,
  },
  rareAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  rareAsideSub: {
    fontSize: 11,
    color: FinColors.textMuted,
    textAlign: "right",
  },
  reviewList: {
    gap: 12,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
  },
  reviewIconWrap: {
    width: 36,
    alignItems: "center",
  },
  reviewMain: {
    flex: 1,
  },
  reviewName: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  reviewSub: {
    fontSize: 12,
    color: FinColors.textMuted,
    marginTop: 4,
  },
  reviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  reviewCategory: {
    fontSize: 11,
    color: FinColors.textPrimary,
    fontWeight: "700",
    backgroundColor: FinColors.bgCard,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewConfidence: {
    fontSize: 11,
    color: FinColors.textMuted,
  },
  reviewAside: {
    alignItems: "flex-end",
    gap: 10,
  },
  reviewAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewButton: {
    minWidth: 68,
    height: 34,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  confirmButton: {
    minWidth: 72,
    height: 34,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    borderWidth: 1,
    borderColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  confirmButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.24)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "88%",
    backgroundColor: FinColors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalIconCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSub: {
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  modalHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 16,
    gap: 6,
  },
  modalHeroLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: FinColors.textMuted,
  },
  modalHeroValue: {
    fontSize: 30,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  modalHeroMeta: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  modalMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modalMetricCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 14,
    gap: 4,
  },
  modalMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  modalMetricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  modalMetricMeta: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  modalName: {
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalSection: {
    gap: 10,
  },
  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalSectionHelper: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  modalBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalBreakdownMain: {
    flex: 1,
  },
  modalBreakdownMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  modalNoteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 14,
  },
  modalNoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  modalSearchInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 14,
    color: FinColors.textPrimary,
    fontSize: 14,
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalGroup: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  modalGroupHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
    flex: 1,
  },
  modalGroupCount: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  modalCategoryButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingLeft: 10,
  },
  modalCategoryText: {
    fontSize: 14,
    color: FinColors.textPrimary,
  },
  incomeTxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  incomeTxMain: {
    flex: 1,
  },
  incomeTxCounterparty: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  incomeTxSub: {
    marginTop: 3,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  incomeTxCategory: {
    marginTop: 5,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  incomeTxAside: {
    alignItems: "flex-end",
  },
  incomeTxAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  incomeTxDate: {
    marginTop: 3,
    fontSize: 12,
    color: FinColors.textMuted,
  },
});
