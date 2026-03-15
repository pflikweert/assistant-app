import { RiskProgressBar } from "@/components/risk-progress-bar";
import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { getMonthVariableBudgetSnapshot } from "@/services/budget-risk";
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
import { recomputeCurrentMonthCashflowForecast } from "@/services/forecasting";
import { supabase } from "@/services/supabase";
import type {
  BudgetPlanComputation,
  CategoryRecord,
  ExpenseAnalysisCategory,
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
  expected_income_total: number;
  expected_expense_total: number;
  expected_fixed_costs: number;
  expected_subscriptions: number;
  expected_variable_costs: number;
  expected_end_of_month_balance: number | null;
  risk_flag: "none" | "deficit_warning";
  top_cost_bucket_1: string | null;
  top_cost_bucket_2: string | null;
  top_cost_bucket_3: string | null;
};

type ReviewableInsightTx = InsightTx & { categoryLabel: string };
type IncomeBreakdownRow = {
  label: string;
  total: number;
  count: number;
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

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthBounds(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);

  return {
    startIso: toLocalIsoDate(start),
    endIso: toLocalIsoDate(end),
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
  };
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

  if (category?.budget_group === "savings") return "savings_transfer";
  if (category?.budget_group === "fixed") return "fixed_costs";
  if (category?.budget_group === "variable") return "variable_costs";

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
) {
  if (!forecast) {
    return "Nog geen cashflowvoorspelling beschikbaar voor deze maand.";
  }

  if (
    forecast.risk_flag === "deficit_warning" ||
    (forecast.expected_end_of_month_balance != null &&
      forecast.expected_end_of_month_balance < 0)
  ) {
    return "De voorspelling laat zien dat je maandbuffer onder druk staat.";
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

export default function InsightsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();
  const forecastLoadInFlight = React.useRef(false);
  const budgetLoadInFlight = React.useRef(false);

  const [segment, setSegment] = React.useState<SegmentKey>("trends");
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [transactions, setTransactions] = React.useState<InsightTx[]>([]);
  const [forecast, setForecast] = React.useState<CashflowForecast | null>(null);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [analysisSchemaMissing, setAnalysisSchemaMissing] =
    React.useState(false);
  const [forecastSchemaMissing, setForecastSchemaMissing] =
    React.useState(false);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [totalIncome, setTotalIncome] = React.useState(0);
  const [txCount, setTxCount] = React.useState(0);
  const [selectedTx, setSelectedTx] =
    React.useState<ReviewableInsightTx | null>(null);
  const [incomeDetailsOpen, setIncomeDetailsOpen] = React.useState(false);
  const [savingReview, setSavingReview] = React.useState(false);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [expandedParents, setExpandedParents] = React.useState<
    Record<string, boolean>
  >({});

  const selectedMonth = React.useMemo(
    () => getMonthBounds(monthOffset),
    [monthOffset],
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

  const monthReport = React.useMemo(() => {
    let fixed = 0;
    let subscriptions = 0;
    let variable = 0;
    let savingsTransfers = 0;

    for (const tx of transactions) {
      if (tx.amount >= 0) continue;

      const bucket = resolveExpenseBucket(tx, categoryMap);
      const value = Math.abs(tx.amount);
      if (bucket === "fixed_costs") fixed += value;
      else if (bucket === "subscriptions") subscriptions += value;
      else if (bucket === "variable_costs") variable += value;
      else savingsTransfers += value;
    }

    const expenses = fixed + subscriptions + variable;
    const outflow = expenses + savingsTransfers;

    return {
      fixed,
      subscriptions,
      variable,
      savingsTransfers,
      expenses,
      outflow,
      income: totalIncome,
      net: totalIncome - expenses,
    };
  }, [categoryMap, totalIncome, transactions]);

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

  const incomeTransactions = React.useMemo(
    () =>
      displayTransactions
        .filter((tx) => tx.amount > 0)
        .sort((left, right) => {
          if (left.date !== right.date) return right.date.localeCompare(left.date);
          return right.amount - left.amount;
        }),
    [displayTransactions],
  );

  const incomeBreakdown = React.useMemo<IncomeBreakdownRow[]>(() => {
    const totals = new Map<string, { total: number; count: number }>();

    for (const tx of incomeTransactions) {
      const key = tx.categoryLabel || "Overig";
      const existing = totals.get(key);
      if (existing) {
        existing.total += tx.amount;
        existing.count += 1;
      } else {
        totals.set(key, { total: tx.amount, count: 1 });
      }
    }

    return Array.from(totals.entries())
      .map(([label, value]) => ({
        label,
        total: value.total,
        count: value.count,
      }))
      .sort((left, right) => right.total - left.total);
  }, [incomeTransactions]);

  const trendHeadline = React.useMemo(
    () => getTrendHeadline(monthReport, budgetPlan),
    [budgetPlan, monthReport],
  );
  const forecastHeadline = React.useMemo(
    () => getForecastHeadline(forecast, budgetPlan),
    [budgetPlan, forecast],
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

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.error("[insights] categories load error", error);
    }
  }, []);

  const loadTransactions = React.useCallback(async () => {
    try {
      const userId = await requireCurrentUserId();
      const baseSelect =
        "id,amount,details,counterparty,date,category_id_auto,category_id_user,category_confidence,category_source";
      const analysisSelect =
        "analysis_main_group,analysis_category,recurring,recurring_type,spending_pattern";
      const transactionsQuery = supabase.from("transactions");

      let queryResult = await transactionsQuery
        .select(
          analysisSchemaMissing
            ? baseSelect
            : `${baseSelect},${analysisSelect}`,
        )
        .eq("user_id", userId)
        .gte("date", selectedMonth.startIso)
        .lt("date", selectedMonth.endIso)
        .order("date", { ascending: false })
        .limit(300);

      if (
        queryResult.error &&
        !analysisSchemaMissing &&
        isMissingColumnError(queryResult.error)
      ) {
        setAnalysisSchemaMissing(true);
        setForecastSchemaMissing(true);

        queryResult = await transactionsQuery
          .select(baseSelect)
          .eq("user_id", userId)
          .gte("date", selectedMonth.startIso)
          .lt("date", selectedMonth.endIso)
          .order("date", { ascending: false })
          .limit(300);
      }

      if (queryResult.error) throw queryResult.error;

      const data = ((queryResult.data || []) as Record<string, unknown>[]) || [];
      if (!data.length) {
        setTransactions([]);
        setTxCount(0);
        setTotalIncome(0);
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
      setTotalIncome(
        rows.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0),
      );
    } catch (error) {
      console.error("[insights] transactions load error", error);
    }
  }, [analysisSchemaMissing, selectedMonth.endIso, selectedMonth.startIso]);

  const loadForecast = React.useCallback(async () => {
    if (forecastSchemaMissing) {
      setForecast(null);
      return;
    }
    if (forecastLoadInFlight.current) return;

    forecastLoadInFlight.current = true;

    try {
      const userId = await requireCurrentUserId();
      const fetchForecastRow = async () =>
        supabase
          .from("monthly_cashflow_forecasts")
          .select(
            "month_start,expected_income_total,expected_expense_total,expected_fixed_costs,expected_subscriptions,expected_variable_costs,expected_end_of_month_balance,risk_flag,top_cost_bucket_1,top_cost_bucket_2,top_cost_bucket_3",
          )
          .eq("user_id", userId)
          .eq("month_start", selectedMonth.startIso)
          .maybeSingle();

      const referenceDate = new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
      const isCurrentMonth = selectedMonth.startIso === getMonthBounds(0).startIso;

      if (isCurrentMonth) {
        await recomputeCurrentMonthCashflowForecast(referenceDate).catch(
          (error) => {
            console.warn("[insights] forecast recompute trigger failed", error);
          },
        );
      }

      let { data, error } = await fetchForecastRow();
      if (!data) {
        await recomputeCurrentMonthCashflowForecast(referenceDate).catch(
          (recomputeError) => {
            console.warn("[insights] forecast backfill trigger failed", recomputeError);
          },
        );
        const retry = await fetchForecastRow();
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

      if (!data) {
        setForecast(null);
        return;
      }

      setForecast({
        month_start: String(data.month_start),
        expected_income_total: Number(data.expected_income_total || 0),
        expected_expense_total: Number(data.expected_expense_total || 0),
        expected_fixed_costs: Number(data.expected_fixed_costs || 0),
        expected_subscriptions: Number(data.expected_subscriptions || 0),
        expected_variable_costs: Number(data.expected_variable_costs || 0),
        expected_end_of_month_balance:
          data.expected_end_of_month_balance == null
            ? null
            : Number(data.expected_end_of_month_balance),
        risk_flag:
          data.risk_flag === "deficit_warning" ? "deficit_warning" : "none",
        top_cost_bucket_1: data.top_cost_bucket_1
          ? String(data.top_cost_bucket_1)
          : null,
        top_cost_bucket_2: data.top_cost_bucket_2
          ? String(data.top_cost_bucket_2)
          : null,
        top_cost_bucket_3: data.top_cost_bucket_3
          ? String(data.top_cost_bucket_3)
          : null,
      });
    } catch (error) {
      console.error("[insights] forecast load error", error);
      setForecast(null);
    } finally {
      forecastLoadInFlight.current = false;
    }
  }, [forecastSchemaMissing, selectedMonth.endIso, selectedMonth.startIso]);

  const loadBudgetPlan = React.useCallback(async () => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      return;
    }
    if (budgetLoadInFlight.current) return;

    budgetLoadInFlight.current = true;
    try {
      const referenceDate = new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
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
  }, [budgetSchemaMissing, selectedMonth.endIso]);

  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    try {
      await loadCategories();
      await Promise.all([loadTransactions(), loadForecast(), loadBudgetPlan()]);
    } finally {
      setLoading(false);
    }
  }, [loadBudgetPlan, loadCategories, loadForecast, loadTransactions]);

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

  const openSelectedTransactionDetail = React.useCallback(() => {
    if (!selectedTx) return;
    const transactionId = selectedTx.id;
    setSelectedTx(null);
    setCategorySearch("");
    router.push(`/transaction-detail?id=${transactionId}`);
  }, [router, selectedTx]);

  const hasMonthData = txCount > 0;
  const netResult = monthReport.net;
  const monthBudgetSnapshot = React.useMemo(
    () => getMonthVariableBudgetSnapshot(budgetPlan),
    [budgetPlan],
  );
  const monthRiskTone = monthBudgetSnapshot.tone;

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
              monthOffset >= 24 && styles.monthNavButtonDisabled,
            ]}
            onPress={() => setMonthOffset((current) => Math.min(current + 1, 24))}
            disabled={monthOffset >= 24}
          >
            <Text style={styles.monthNavButtonText}>‹</Text>
          </Pressable>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>{selectedMonth.label}</Text>
          </View>
          <Pressable
            style={[
              styles.monthNavButton,
              monthOffset === 0 && styles.monthNavButtonDisabled,
            ]}
            onPress={() => setMonthOffset((current) => Math.max(current - 1, 0))}
            disabled={monthOffset === 0}
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
                      {hasMonthData ? `+${fmt.format(totalIncome)}` : "Nog geen data"}
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
                    Status: {monthBudgetSnapshot.label}.{" "}
                    {monthBudgetSnapshot.state === "no_budget"
                      ? "Stel eerst een variabel budget in om maandsturing te zien."
                      : monthBudgetSnapshot.state === "over_budget"
                        ? `${fmt.format(Math.abs(monthBudgetSnapshot.remaining || 0))} boven je variabele maandbudget van ${fmt.format(monthBudgetSnapshot.budget || 0)}`
                        : `${fmt.format(monthBudgetSnapshot.spent || 0)} van ${fmt.format(monthBudgetSnapshot.budget || 0)} variabel gebruikt`}
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
                  <Text style={styles.reportLabel}>Inkomsten</Text>
                  <View style={styles.reportRight}>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(monthReport.income)}
                    </Text>
                    <Text style={styles.reportHint}>Details</Text>
                  </View>
                </Pressable>
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
                <Text style={styles.eyebrow}>Voorspelling</Text>
                <Text style={styles.heroSummary}>{forecastHeadline}</Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Cashflow voorspelling</Text>
                  <Text style={styles.sectionHelper}>Einde van de maand</Text>
                </View>
                {forecast ? (
                  <>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Verwachte inkomsten</Text>
                      <Text style={[styles.reportValue, styles.positiveText]}>
                        +{fmt.format(forecast.expected_income_total)}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Verwachte uitgaven</Text>
                      <Text style={styles.reportValue}>
                        {fmt.format(forecast.expected_expense_total)}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabelStrong}>Verwacht eindsaldo</Text>
                      <Text
                        style={[
                          styles.reportValueStrong,
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

                    {forecast.risk_flag === "deficit_warning" ||
                    (forecast.expected_end_of_month_balance != null &&
                      forecast.expected_end_of_month_balance < 0) ? (
                      <Text style={styles.warningText}>
                        Verwacht tekort deze maand
                      </Text>
                    ) : null}

                    <View style={styles.reportDivider} />
                    <Text style={styles.sectionHelper}>
                      Verwachte kostenlagen
                    </Text>
                    <Pressable
                      style={styles.reportRowButton}
                      onPress={() => openAnalysisDetail("fixed_costs")}
                    >
                      <Text style={styles.reportLabel}>Vaste lasten</Text>
                      <View style={styles.reportRight}>
                        <Text style={styles.reportValue}>
                          {fmt.format(forecast.expected_fixed_costs)}
                        </Text>
                        <Text style={styles.reportHint}>Analyse</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={styles.reportRowButton}
                      onPress={() => openAnalysisDetail("subscriptions")}
                    >
                      <Text style={styles.reportLabel}>Abonnementen</Text>
                      <View style={styles.reportRight}>
                        <Text style={styles.reportValue}>
                          {fmt.format(forecast.expected_subscriptions)}
                        </Text>
                        <Text style={styles.reportHint}>Analyse</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={styles.reportRowButton}
                      onPress={() => openAnalysisDetail("variable_costs")}
                    >
                      <Text style={styles.reportLabel}>Variabele kosten</Text>
                      <View style={styles.reportRight}>
                        <Text style={styles.reportValue}>
                          {fmt.format(forecast.expected_variable_costs)}
                        </Text>
                        <Text style={styles.reportHint}>Analyse</Text>
                      </View>
                    </Pressable>

                    <Text style={styles.helperText}>
                      Inkomstenbasis: {formatIncludedIncomeLabel(budgetPlan)}.
                    </Text>
                    {forecastTopCostLabels.length ? (
                      <Text style={styles.helperText}>
                        Grootste kostenposten: {forecastTopCostLabels.join(", ")}.
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

      <Modal
        animationType="slide"
        transparent
        visible={incomeDetailsOpen}
        onRequestClose={() => setIncomeDetailsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Inkomsten details</Text>
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

            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Totaal inkomsten</Text>
              <Text style={[styles.reportValue, styles.positiveText]}>
                +{fmt.format(monthReport.income)}
              </Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.reportLabel}>Aantal transacties</Text>
              <Text style={styles.reportValue}>{incomeTransactions.length}</Text>
            </View>

            {incomeBreakdown.length ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Verdeling inkomsten</Text>
                {incomeBreakdown.map((item) => (
                  <View key={item.label} style={styles.reportRow}>
                    <View style={styles.modalBreakdownMain}>
                      <Text style={styles.reportLabel}>{item.label}</Text>
                      <Text style={styles.modalBreakdownMeta}>
                        {item.count} transactie{item.count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text style={[styles.reportValue, styles.positiveText]}>
                      +{fmt.format(item.total)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.modalSectionTitle}>Transacties</Text>
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
                        {tx.categoryLabel}
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
    alignItems: "center",
    justifyContent: "center",
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
  supportText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textMuted,
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
  modalName: {
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalSection: {
    gap: 10,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalBreakdownMain: {
    flex: 1,
  },
  modalBreakdownMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textMuted,
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
