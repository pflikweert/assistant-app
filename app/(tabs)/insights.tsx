import { TransactionCategoryIcon } from "@/components/category-icon";
import { FinColors } from "@/constants/theme";
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
import { supabase } from "@/services/supabase";
import type {
    CategoryRecord,
    ExpenseAnalysisCategory,
} from "@/types/categorization";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

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
    start,
    end,
    startIso: toLocalIsoDate(start),
    endIso: toLocalIsoDate(end),
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
  };
}

// ─── Category bar ─────────────────────────────────────────────────────────────
type Category = { label: string; amount: number; color: string };
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

const CAT_COLORS = ["#7dd3a1", "#94a3b8", "#a3a3a3", "#6b6b6b", "#525252"];

function CategoryBar({ categories }: { categories: Category[] }) {
  const total = categories.reduce((s, c) => s + c.amount, 0) || 1;
  return (
    <View style={{ gap: 16 }}>
      {/* Segmented bar */}
      <View
        style={{
          flexDirection: "row",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          gap: 2,
        }}
      >
        {categories.map((cat, i) => (
          <View
            key={i}
            style={{ flex: cat.amount / total, backgroundColor: cat.color }}
          />
        ))}
      </View>
      {/* Legend */}
      <View style={{ gap: 12 }}>
        {categories.map((cat, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: cat.color,
                }}
              />
              <Text style={{ fontSize: 14, color: FinColors.textSecondary }}>
                {cat.label}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: FinColors.textPrimary,
              }}
            >
              {fmt.format(cat.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

function ReviewItem({
  tx,
  onPress,
  onConfirm,
  saving,
  categoryMap,
}: {
  tx: ReviewableInsightTx;
  onPress: (tx: ReviewableInsightTx) => void;
  onConfirm: (tx: ReviewableInsightTx) => void;
  saving: boolean;
  categoryMap: Map<string, CategoryRecord>;
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
            <Text style={styles.reviewButtonText}>Review</Text>
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
  return "variable_costs";
}

function resolveExpenseBucket(
  tx: InsightTx,
  categoryMap: Map<string, CategoryRecord>,
): ExpenseAnalysisCategory {
  if (
    tx.analysis_category === "fixed_costs" ||
    tx.analysis_category === "subscriptions" ||
    tx.analysis_category === "variable_costs" ||
    tx.analysis_category === "savings_transfer"
  ) {
    return tx.analysis_category;
  }

  const categoryId = getEffectiveCategoryId(tx);
  const category = categoryId ? categoryMap.get(categoryId) || null : null;
  const categoryKey = String(category?.key || "");

  if (categoryKey.startsWith("savings")) return "savings_transfer";
  if (categoryKey.startsWith("subscriptions")) return "subscriptions";
  if (
    categoryKey.startsWith("care_") &&
    !categoryKey.startsWith("care_health_insurance")
  ) {
    return "variable_costs";
  }

  if (category?.budget_group === "savings") return "savings_transfer";
  if (category?.budget_group === "fixed") return "fixed_costs";
  if (category?.budget_group === "variable") return "variable_costs";

  return fallbackExpenseCategory(tx);
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const router = useRouter();
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [transactions, setTransactions] = React.useState<InsightTx[]>([]);
  const [forecast, setForecast] = React.useState<CashflowForecast | null>(null);
  const [analysisSchemaMissing, setAnalysisSchemaMissing] =
    React.useState(false);
  const [forecastSchemaMissing, setForecastSchemaMissing] =
    React.useState(false);
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
  const forecastLoadInFlight = React.useRef(false);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

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
          const haystack = `${normalizeSearch(child.name)} ${normalizeSearch(child.key)}`;
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
  const selectedMonth = React.useMemo(
    () => getMonthBounds(monthOffset),
    [monthOffset],
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

  const spendingByCategory = React.useMemo<Category[]>(() => {
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
      .sort((a, b) => b[1] - a[1])
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
        .sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.amount - a.amount;
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
      .sort((a, b) => b.total - a.total);
  }, [incomeTransactions]);

  const insightCards = React.useMemo(() => {
    const cards: { title: string; text: string }[] = [];
    const topCategory = spendingByCategory[0];

    if (topCategory) {
      const share =
        monthReport.expenses > 0
          ? Math.round((topCategory.amount / monthReport.expenses) * 100)
          : 0;
      cards.push({
        title: `Grootste uitgave: ${topCategory.label}`,
        text: `${topCategory.label} is deze maand goed voor ${fmt.format(topCategory.amount)} en ${share}% van je uitgaven.`,
      });
    }

    cards.push({
      title: "Review-werkvoorraad",
      text:
        reviewQueue.length === 0
          ? "Er staan momenteel geen transacties klaar voor review."
          : `${reviewQueue.length} recente transacties hebben lage zekerheid of fallback-classificatie en wachten op bevestiging.`,
    });

    cards.push({
      title: "Lerend systeem",
      text:
        coverage.manual === 0
          ? "Na je eerste handmatige correcties worden vergelijkbare tegenpartijen automatisch hergebruikt als patroon."
          : `${coverage.manual} transacties zijn handmatig bevestigd en leveren nu patronen op voor volgende imports.`,
    });

    return cards;
  }, [
    coverage.manual,
    monthReport.expenses,
    reviewQueue.length,
    spendingByCategory,
  ]);

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (e) {
      console.error("[v0] insights categories load error", e);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const baseSelect =
        "id,amount,details,counterparty,date,category_id_auto,category_id_user,category_confidence,category_source";
      const analysisSelect =
        "analysis_main_group,analysis_category,recurring,recurring_type,spending_pattern";
      const transactionsQuery = supabase.from("transactions") as any;

      let queryResult = await transactionsQuery
        .select(
          analysisSchemaMissing
            ? baseSelect
            : `${baseSelect},${analysisSelect}`,
        )
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
          .gte("date", selectedMonth.startIso)
          .lt("date", selectedMonth.endIso)
          .order("date", { ascending: false })
          .limit(300);
      }

      if (queryResult.error) throw queryResult.error;

      const data = queryResult.data || [];

      if (!data?.length) {
        setTransactions([]);
        setTxCount(0);
        setTotalIncome(0);
        return;
      }
      const rows: InsightTx[] = data.map((r: any) => ({
        id: r.id,
        details: String(r.details || ""),
        counterparty: String(r.counterparty || "").trim(),
        date: String(r.date || ""),
        amount: Number(r.amount || 0),
        category_id_auto: r.category_id_auto || null,
        category_id_user: r.category_id_user || null,
        category_confidence:
          r.category_confidence == null ? null : Number(r.category_confidence),
        category_source: r.category_source || null,
        analysis_main_group: r.analysis_main_group || null,
        analysis_category: r.analysis_category || null,
        recurring: "recurring" in r ? Boolean(r.recurring) : false,
        recurring_type: r.recurring_type || null,
        spending_pattern: r.spending_pattern || null,
      }));

      setTransactions(rows);
      setTxCount(rows.length);

      const income = rows
        .filter((r) => r.amount > 0)
        .reduce((s, r) => s + r.amount, 0);
      setTotalIncome(income);
    } catch (e) {
      console.error("[v0] insights load error", e);
    }
  }, [analysisSchemaMissing, selectedMonth.endIso, selectedMonth.startIso]);

  const loadForecast = React.useCallback(async () => {
    if (forecastSchemaMissing) {
      setForecast(null);
      return;
    }
    if (forecastLoadInFlight.current) {
      return;
    }

    forecastLoadInFlight.current = true;

    try {
      const { data, error } = await supabase
        .from("monthly_cashflow_forecasts")
        .select(
          "month_start,expected_income_total,expected_expense_total,expected_fixed_costs,expected_subscriptions,expected_variable_costs,expected_end_of_month_balance,risk_flag,top_cost_bucket_1,top_cost_bucket_2,top_cost_bucket_3",
        )
        .eq("month_start", selectedMonth.startIso)
        .maybeSingle();

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
        risk_flag: (data.risk_flag || "none") as "none" | "deficit_warning",
        top_cost_bucket_1: data.top_cost_bucket_1 || null,
        top_cost_bucket_2: data.top_cost_bucket_2 || null,
        top_cost_bucket_3: data.top_cost_bucket_3 || null,
      });
    } catch (error) {
      console.error("[v0] insights forecast load error", error);
      setForecast(null);
    } finally {
      forecastLoadInFlight.current = false;
    }
  }, [forecastSchemaMissing, selectedMonth.startIso]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadCategories();
  }, [isFocused, loadCategories]);

  React.useEffect(() => {
    if (!isFocused) return;

    let cancelled = false;
    const run = async () => {
      await load();
      if (cancelled) return;
      await loadForecast();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isFocused, load, loadForecast]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;

    let cancelled = false;
    const run = async () => {
      await loadCategories();
      if (cancelled) return;
      await load();
      if (cancelled) return;
      await loadForecast();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    backgroundStatus.lastCompletedAt,
    isFocused,
    load,
    loadCategories,
    loadForecast,
  ]);

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
        await load();
      } catch (error) {
        console.error("[v0] insights review save error", error);
      } finally {
        setSavingReview(false);
      }
    },
    [load, selectedTx],
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

        await load();
      } catch (error) {
        console.error("[v0] insights quick confirm error", error);
      } finally {
        setSavingReview(false);
      }
    },
    [load, selectedTx?.id],
  );

  const hasMonthData = txCount > 0;
  const netResult = monthReport.net;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Insights</Text>
        <View style={styles.monthBadge}>
          <Pressable
            style={[
              styles.monthNavButton,
              monthOffset >= 24 && styles.monthNavButtonDisabled,
            ]}
            onPress={() =>
              setMonthOffset((current) => Math.min(current + 1, 24))
            }
            disabled={monthOffset >= 24}
          >
            <Text style={styles.monthNavButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.monthBadgeText}>{selectedMonth.label}</Text>
          <Pressable
            style={[
              styles.monthNavButton,
              monthOffset === 0 && styles.monthNavButtonDisabled,
            ]}
            onPress={() =>
              setMonthOffset((current) => Math.max(current - 1, 0))
            }
            disabled={monthOffset === 0}
          >
            <Text style={styles.monthNavButtonText}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text
              style={[
                styles.summaryValue,
                hasMonthData
                  ? { color: FinColors.green }
                  : styles.emptyAmountText,
              ]}
            >
              {hasMonthData ? `+${fmt.format(totalIncome)}` : "Nog geen data"}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text
              style={[
                styles.summaryValue,
                !hasMonthData && styles.emptyAmountText,
              ]}
            >
              {hasMonthData
                ? fmt.format(monthReport.expenses)
                : "Nog geen data"}
            </Text>
          </View>
        </View>

        {/* Net card */}
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Netto resultaat (excl. sparen)</Text>
          <Text
            style={[
              styles.netValue,
              hasMonthData
                ? netResult >= 0 && { color: FinColors.green }
                : styles.emptyAmountText,
            ]}
          >
            {hasMonthData
              ? `${netResult >= 0 ? "+" : ""}${fmt.format(netResult)}`
              : "Nog geen data"}
          </Text>
          {hasMonthData ? (
            <Text style={styles.txNote}>
              Overboekingen naar sparen:{" "}
              {fmt.format(monthReport.savingsTransfers)}
            </Text>
          ) : null}
          {txCount > 0 ? (
            <Text style={styles.txNote}>{txCount} transactions analysed</Text>
          ) : (
            <Text style={styles.txNote}>
              Er zijn nog geen transacties in deze maand.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Maandrapport</Text>
          <Pressable
            style={styles.monthReportRowButton}
            onPress={() => setIncomeDetailsOpen(true)}
          >
            <Text style={styles.monthReportLabel}>Inkomsten</Text>
            <View style={styles.monthReportButtonRight}>
              <Text style={[styles.monthReportValue, { color: FinColors.green }]}>
                +{fmt.format(monthReport.income)}
              </Text>
              <Text style={styles.monthReportButtonHint}>Details</Text>
            </View>
          </Pressable>
          <View style={styles.monthReportRow}>
            <Text style={styles.monthReportLabel}>
              Uitgaven totaal (excl. sparen)
            </Text>
            <Text style={styles.monthReportValue}>
              {fmt.format(monthReport.expenses)}
            </Text>
          </View>
          <Pressable
            style={styles.monthReportRowButton}
            onPress={() => openAnalysisDetail("fixed_costs")}
          >
            <Text style={styles.monthReportLabel}>Vaste lasten</Text>
            <Text style={styles.monthReportValue}>
              {fmt.format(monthReport.fixed)}
            </Text>
          </Pressable>
          <Pressable
            style={styles.monthReportRowButton}
            onPress={() => openAnalysisDetail("subscriptions")}
          >
            <Text style={styles.monthReportLabel}>Abonnementen</Text>
            <Text style={styles.monthReportValue}>
              {fmt.format(monthReport.subscriptions)}
            </Text>
          </Pressable>
          <Pressable
            style={styles.monthReportRowButton}
            onPress={() => openAnalysisDetail("variable_costs")}
          >
            <Text style={styles.monthReportLabel}>Variabele kosten</Text>
            <Text style={styles.monthReportValue}>
              {fmt.format(monthReport.variable)}
            </Text>
          </Pressable>
          <View style={styles.monthReportRow}>
            <Text style={styles.monthReportLabel}>Overboeken naar sparen</Text>
            <Text style={styles.monthReportValue}>
              {fmt.format(monthReport.savingsTransfers)}
            </Text>
          </View>
          <View style={styles.monthReportRow}>
            <Text style={styles.monthReportLabel}>Totale uitstroom</Text>
            <Text style={styles.monthReportValue}>
              {fmt.format(monthReport.outflow)}
            </Text>
          </View>
          <View style={[styles.monthReportRow, styles.monthReportNetRow]}>
            <Text style={styles.monthReportNetLabel}>
              Netto resultaat (excl. sparen)
            </Text>
            <Text
              style={[
                styles.monthReportNetValue,
                monthReport.net >= 0 && { color: FinColors.green },
              ]}
            >
              {monthReport.net >= 0 ? "+" : ""}
              {fmt.format(monthReport.net)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cashflow voorspelling</Text>
          {forecast ? (
            <>
              <View style={styles.monthReportRow}>
                <Text style={styles.monthReportLabel}>Verwachte inkomsten</Text>
                <Text
                  style={[styles.monthReportValue, { color: FinColors.green }]}
                >
                  +{fmt.format(forecast.expected_income_total)}
                </Text>
              </View>
              <View style={styles.monthReportRow}>
                <Text style={styles.monthReportLabel}>Verwachte uitgaven</Text>
                <Text style={styles.monthReportValue}>
                  {fmt.format(forecast.expected_expense_total)}
                </Text>
              </View>
              <View style={[styles.monthReportRow, styles.monthReportNetRow]}>
                <Text style={styles.monthReportNetLabel}>
                  Verwacht saldo eind maand
                </Text>
                <Text
                  style={[
                    styles.monthReportNetValue,
                    forecast.expected_end_of_month_balance != null &&
                      forecast.expected_end_of_month_balance >= 0 && {
                        color: FinColors.green,
                      },
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
              {forecastTopCostLabels.length ? (
                <Text style={styles.forecastMetaText}>
                  Grootste kostenposten: {forecastTopCostLabels.join(", ")}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyStateText}>
              Nog geen voorspelling beschikbaar voor {selectedMonth.label}.
            </Text>
          )}
        </View>

        <View style={styles.reviewSummaryCard}>
          <View style={styles.reviewSummaryHeader}>
            <Text style={styles.reviewSummaryTitle}>
              Categorisatiekwaliteit
            </Text>
            <Text style={styles.reviewSummaryValue}>
              {coverage.total
                ? `${coverage.categorized}/${coverage.total}`
                : "0/0"}
            </Text>
          </View>
          <Text style={styles.reviewSummaryText}>
            {reviewQueue.length === 0
              ? "Geen openstaande review-items deze maand."
              : `${reviewQueue.length} transacties moeten nog handmatig worden nagekeken.`}
          </Text>
          <View style={styles.reviewSummaryMeta}>
            <Text style={styles.reviewSummaryMetaText}>
              Auto: {coverage.auto}
            </Text>
            <Text style={styles.reviewSummaryMetaText}>
              Handmatig: {coverage.manual}
            </Text>
            <Text style={styles.reviewSummaryMetaText}>
              Open: {coverage.uncategorized}
            </Text>
          </View>
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          {spendingByCategory.length ? (
            <CategoryBar categories={spendingByCategory} />
          ) : (
            <Text style={styles.emptyStateText}>
              Nog niet genoeg gecategoriseerde uitgaven om een verdeling te
              tonen.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review Queue</Text>
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
            <Text style={styles.emptyStateText}>
              Alle transacties in deze periode hebben voldoende zekerheid of
              zijn al bevestigd.
            </Text>
          )}
        </View>

        {/* AI Insights */}
        <Text style={styles.sectionLabel}>Insights</Text>
        {insightCards.map((card) => (
          <InsightCard key={card.title} title={card.title} text={card.text} />
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={incomeDetailsOpen}
        onRequestClose={() => setIncomeDetailsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Inkomsten details</Text>
            <Text style={styles.modalSub}>{selectedMonth.label}</Text>

            <View style={styles.incomeSummaryRow}>
              <Text style={styles.monthReportLabel}>Totaal inkomsten</Text>
              <Text style={[styles.monthReportValue, { color: FinColors.green }]}>
                +{fmt.format(monthReport.income)}
              </Text>
            </View>
            <View style={styles.incomeSummaryRow}>
              <Text style={styles.monthReportLabel}>Aantal transacties</Text>
              <Text style={styles.monthReportValue}>{incomeTransactions.length}</Text>
            </View>

            {incomeBreakdown.length ? (
              <View style={styles.incomeBreakdownWrap}>
                <Text style={styles.incomeSectionTitle}>Verdeling inkomsten</Text>
                {incomeBreakdown.map((item) => (
                  <View key={item.label} style={styles.incomeBreakdownRow}>
                    <View style={styles.incomeBreakdownMain}>
                      <Text style={styles.incomeBreakdownLabel}>{item.label}</Text>
                      <Text style={styles.incomeBreakdownMeta}>
                        {item.count} transactie{item.count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text style={[styles.incomeBreakdownValue, { color: FinColors.green }]}>
                      +{fmt.format(item.total)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.incomeSectionTitle}>Transacties</Text>
            <ScrollView style={styles.incomeTxList}>
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
                      <Text style={styles.incomeTxAmount}>+{fmt.format(tx.amount)}</Text>
                      <Text style={styles.incomeTxDate}>{formatShortDate(tx.date)}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.modalEmptyText}>
                  Geen inkomsten gevonden in deze maand.
                </Text>
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setIncomeDetailsOpen(false)}
            >
              <Text style={styles.modalCloseText}>Sluiten</Text>
            </Pressable>
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
            <Text style={styles.modalTitle}>Review transactie</Text>
            <Text style={styles.modalName} numberOfLines={1}>
              {selectedTx?.counterparty || "Onbekende tegenpartij"}
            </Text>
            <Text style={styles.modalSub} numberOfLines={2}>
              {selectedTx?.details || selectedTx?.date || ""}
            </Text>
            <Text style={styles.modalHint}>
              Kies de juiste categorie. Deze keuze wordt gebruikt om
              vergelijkbare transacties later automatisch te herkennen.
            </Text>

            <TextInput
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Zoek categorie..."
              placeholderTextColor={FinColors.textMuted}
              style={styles.modalSearchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <ScrollView style={styles.modalList}>
              {filteredModalGroups.length ? (
                filteredModalGroups.map((group) => {
                  const expanded =
                    searchActive || Boolean(expandedParents[group.id]);

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
                          <View style={styles.modalGroupIconWrap}>
                            <MaterialIcons
                              name={expanded ? "remove" : "add"}
                              size={16}
                              color={FinColors.textSecondary}
                            />
                          </View>
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
                <Text style={styles.modalEmptyText}>
                  Geen categorieen gevonden voor deze zoekopdracht.
                </Text>
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => {
                setSelectedTx(null);
                setCategorySearch("");
              }}
            >
              <Text style={styles.modalCloseText}>Sluiten</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  monthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  monthNavButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  monthNavButtonDisabled: {
    opacity: 0.35,
  },
  monthNavButtonText: {
    color: FinColors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  // Summary row
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  summaryLabel: {
    fontSize: 13,
    color: FinColors.textMuted,
    fontWeight: "500",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  emptyAmountText: {
    fontSize: 18,
    color: FinColors.textMuted,
    fontWeight: "600",
  },

  // Net card
  netCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
  },
  netLabel: {
    fontSize: 13,
    color: FinColors.textMuted,
    fontWeight: "500",
    marginBottom: 8,
  },
  netValue: {
    fontSize: 36,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -1,
  },
  txNote: { fontSize: 12, color: FinColors.textMuted, marginTop: 12 },

  reviewSummaryCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  reviewSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewSummaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  reviewSummaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.green,
  },
  reviewSummaryText: {
    fontSize: 13,
    color: FinColors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  reviewSummaryMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  reviewSummaryMetaText: { fontSize: 12, color: FinColors.textMuted },

  monthReportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  monthReportRowButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  monthReportButtonRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  monthReportButtonHint: {
    fontSize: 11,
    fontWeight: "600",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  monthReportLabel: {
    fontSize: 13,
    color: FinColors.textSecondary,
    fontWeight: "500",
  },
  monthReportValue: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  monthReportNetRow: {
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 10,
    marginTop: 4,
  },
  monthReportNetLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  monthReportNetValue: {
    fontSize: 15,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  warningText: {
    fontSize: 13,
    color: FinColors.red,
    fontWeight: "700",
    marginTop: 6,
  },
  forecastMetaText: {
    fontSize: 12,
    color: FinColors.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: FinColors.textPrimary,
    marginBottom: 20,
  },
  emptyStateText: { fontSize: 14, color: FinColors.textMuted, lineHeight: 22 },
  reviewList: { gap: 12 },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  reviewIconWrap: {
    marginTop: 2,
  },
  reviewMain: { flex: 1 },
  reviewName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  reviewSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 4 },
  reviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  reviewCategory: {
    fontSize: 11,
    fontWeight: "600",
    color: FinColors.textPrimary,
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  reviewConfidence: { fontSize: 11, color: FinColors.textMuted },
  reviewAside: { alignItems: "flex-end", gap: 10 },
  reviewAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
  },
  confirmButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.green,
  },

  // Section
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
  },

  // Insight card
  insightCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
    marginBottom: 8,
  },
  insightText: { fontSize: 14, color: FinColors.textSecondary, lineHeight: 21 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "80%",
    backgroundColor: FinColors.bgCard,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: FinColors.textPrimary },
  modalName: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
    marginTop: 10,
  },
  modalSub: {
    fontSize: 13,
    color: FinColors.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  modalHint: {
    fontSize: 12,
    color: FinColors.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  modalSearchInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    borderRadius: 12,
    backgroundColor: FinColors.bgElevated,
    color: FinColors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalList: { marginTop: 14, marginBottom: 10 },
  modalGroup: {
    marginBottom: 10,
  },
  modalGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    borderRadius: 12,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalGroupTitle: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  modalGroupCount: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  modalGroupIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
  },
  modalCategoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    marginBottom: 8,
    backgroundColor: FinColors.bgElevated,
    marginLeft: 12,
  },
  modalCategoryText: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  modalEmptyText: {
    fontSize: 13,
    color: FinColors.textMuted,
    lineHeight: 20,
    paddingVertical: 8,
  },
  modalCloseButton: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  incomeSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  incomeBreakdownWrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 8,
  },
  incomeSectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  incomeBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  incomeBreakdownMain: {
    flex: 1,
  },
  incomeBreakdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  incomeBreakdownMeta: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  incomeBreakdownValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  incomeTxList: {
    maxHeight: 320,
  },
  incomeTxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
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
    marginTop: 2,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  incomeTxCategory: {
    marginTop: 4,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  incomeTxAside: {
    alignItems: "flex-end",
  },
  incomeTxAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.green,
  },
  incomeTxDate: {
    marginTop: 4,
    fontSize: 11,
    color: FinColors.textMuted,
  },
});
