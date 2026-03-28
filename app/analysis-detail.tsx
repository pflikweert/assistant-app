import { TransactionCategoryIcon } from "@/components/category-icon";
import { FinColors } from "@/constants/theme";
import { FinanceDetailShell } from "@/components/ui/finance-detail-shell";
import { getTransactionCategories } from "@/services/categorization-repository";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import type {
    AnalysisCategory,
    CategoryRecord,
    ExpenseAnalysisCategory,
} from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type DetailTx = {
  id: string;
  date: string;
  amount: number;
  counterparty: string;
  subscriptionProfileName?: string | null;
  details: string;
  category_id_auto: string | null;
  category_id_user: string | null;
  analysis_category: AnalysisCategory | null;
};

type ComparisonDirection = "up" | "down" | "flat" | "new";

type AmountComparison = {
  direction: ComparisonDirection;
  percentage: number | null;
  previousAmount: number;
};

type DisplayTx = DetailTx & {
  amountAbs: number;
  subcategoryLabel: string;
  descriptorKey: string;
  descriptorLabel: string;
  isNew: boolean;
  comparison: AmountComparison | null;
};

type SubcategoryGroup = {
  label: string;
  amount: number;
  previousAmount: number;
  share: number;
  transactionCount: number;
  comparison: AmountComparison | null;
  transactions: DisplayTx[];
};

type MonthTrend = {
  monthLabel: string;
  monthStart: string;
  amount: number;
};

function labelForGroup(group: ExpenseAnalysisCategory) {
  if (group === "fixed_costs") return "Vaste lasten";
  if (group === "subscriptions") return "Abonnementen";
  return "Variabele kosten";
}

function toMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function normalizeMonthBoundary(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) return "";

  if (parsed.getDate() !== 1) {
    parsed.setDate(parsed.getDate() + 1);
  }

  return toLocalIsoDate(parsed);
}

function monthIso(date: Date) {
  return toLocalIsoDate(date);
}

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DESCRIPTOR_STOPWORDS = new Set([
  "betaling",
  "omschrijving",
  "factuur",
  "kenmerk",
  "referentie",
  "transactie",
  "incasso",
  "automatische",
  "afschrijving",
  "sepa",
  "pasnr",
  "pas",
  "bij",
  "van",
  "aan",
]);

function descriptorSignature(value: string) {
  const normalized = normalizeToken(value).replace(/\d+/g, " ");
  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !DESCRIPTOR_STOPWORDS.has(token));

  return tokens.slice(0, 4).join(" ");
}

function extractStableReference(value: string) {
  const source = String(value || "");

  const keywordMatch = source.match(
    /\b(?:kenmerk|contract|polis|lening|referentie|rekening)\s*[:#-]?\s*(\d{6,})\b/i,
  );
  if (keywordMatch?.[1]) {
    return keywordMatch[1];
  }

  const separatedMatch = source.match(/\b\d{3,}(?:[.\/-]\d{2,}){1,}\b/);
  if (separatedMatch?.[0]) {
    return separatedMatch[0].replace(/[\/-]/g, ".");
  }

  const leadingNumberMatch = source.match(/^\s*(\d{6,})\b/);
  if (leadingNumberMatch?.[1]) {
    return leadingNumberMatch[1];
  }

  return null;
}

function findClosestAmountIndex(amounts: number[], target: number) {
  if (!amounts.length) return -1;

  let bestIndex = 0;
  let bestDiff = Math.abs(amounts[0] - target);

  for (let i = 1; i < amounts.length; i += 1) {
    const diff = Math.abs(amounts[i] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function firstDetailSegment(details: string) {
  return details.split("|")[0]?.trim() || details.trim();
}

function descriptorKeyForTransaction(tx: DetailTx) {
  const reference = extractStableReference(firstDetailSegment(tx.details));
  const counterparty = descriptorSignature(tx.counterparty);
  if (reference && counterparty) return `cp:${counterparty}::ref:${reference}`;
  if (reference) return `ref:${reference}`;

  const detail = descriptorSignature(firstDetailSegment(tx.details));
  if (counterparty && detail) return `cp:${counterparty}::dt:${detail}`;
  if (counterparty) return `cp:${counterparty}`;

  if (detail) return `dt:${detail}`;

  return `tx:${tx.id}`;
}

function descriptorLooseKeyForTransaction(tx: DetailTx) {
  const counterparty = descriptorSignature(tx.counterparty);
  const detail = descriptorSignature(firstDetailSegment(tx.details));

  if (counterparty && detail) return `cp:${counterparty}::dt:${detail}`;
  if (counterparty) return `cp:${counterparty}`;
  if (detail) return `dt:${detail}`;
  return `tx:${tx.id}`;
}

function shouldUseStrictReferenceMatch(tx: DetailTx) {
  const haystack = normalizeToken(
    `${tx.counterparty} ${firstDetailSegment(tx.details)}`,
  );
  return (
    haystack.includes("hypotheek") ||
    haystack.includes("aflossing") ||
    haystack.includes("rente") ||
    haystack.includes("lening")
  );
}

function descriptorLabelForTransaction(tx: DetailTx) {
  return (
    tx.counterparty || firstDetailSegment(tx.details) || "Onbekende descriptor"
  );
}

function formatDisplayDate(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
  });
}

function resolveExpenseGroupForDetail(
  tx: DetailTx,
  categoryMap: Map<string, CategoryRecord>,
): ExpenseAnalysisCategory | null {
  const categoryId = tx.category_id_user || tx.category_id_auto;
  const category = categoryId ? categoryMap.get(categoryId) || null : null;
  const categoryKey = String(category?.key || "").toLowerCase();
  const budgetGroup = String(category?.budget_group || "").toLowerCase();

  if (budgetGroup === "subscriptions") return "subscriptions";
  if (budgetGroup === "fixed") return "fixed_costs";
  if (budgetGroup === "variable") return "variable_costs";
  if (budgetGroup === "savings") return null;

  if (categoryKey.startsWith("savings")) return null;
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
    tx.analysis_category === "variable_costs"
  ) {
    return tx.analysis_category;
  }

  return null;
}

function compareAmounts(
  current: number,
  previous: number,
): AmountComparison | null {
  if (current <= 0 && previous <= 0) return null;

  if (previous <= 0) {
    return current > 0
      ? { direction: "new", percentage: null, previousAmount: previous }
      : null;
  }

  const delta = current - previous;
  if (Math.abs(delta) < 0.01) {
    return { direction: "flat", percentage: 0, previousAmount: previous };
  }

  return {
    direction: delta > 0 ? "up" : "down",
    percentage: Math.round((Math.abs(delta) / previous) * 100),
    previousAmount: previous,
  };
}

function compareTransactionAmount(current: number, previous: number) {
  const comparison = compareAmounts(current, previous);
  if (!comparison || comparison.direction === "new") return null;
  return comparison;
}

function ComparisonBadge({
  comparison,
  compact = false,
  showFallback = true,
}: {
  comparison: AmountComparison | null;
  compact?: boolean;
  showFallback?: boolean;
}) {
  if (!comparison) {
    if (!showFallback) return null;
    return (
      <View
        style={[
          styles.comparisonBadge,
          styles.comparisonBadgeMuted,
          compact && styles.comparisonBadgeCompact,
        ]}
      >
        <Text
          style={[
            styles.comparisonBadgeText,
            styles.comparisonBadgeTextMuted,
            compact && styles.comparisonBadgeTextCompact,
          ]}
        >
          n.v.t.
        </Text>
      </View>
    );
  }

  const toneStyle =
    comparison.direction === "up"
      ? styles.comparisonBadgeUp
      : comparison.direction === "down"
        ? styles.comparisonBadgeDown
        : comparison.direction === "flat"
          ? styles.comparisonBadgeFlat
          : comparison.direction === "new"
            ? styles.comparisonBadgeNew
            : styles.comparisonBadgeMuted;
  const textToneStyle =
    comparison.direction === "up"
      ? styles.comparisonBadgeTextUp
      : comparison.direction === "down"
        ? styles.comparisonBadgeTextDown
        : comparison.direction === "flat"
          ? styles.comparisonBadgeTextFlat
          : comparison.direction === "new"
            ? styles.comparisonBadgeTextNew
            : styles.comparisonBadgeTextMuted;
  const label =
    comparison.direction === "new"
      ? "↑ nieuw"
      : comparison.direction === "flat"
        ? "0%"
        : `${comparison.direction === "up" ? "↑" : "↓"} ${comparison.percentage ?? 0}%`;

  return (
    <View
      style={[
        styles.comparisonBadge,
        toneStyle,
        compact && styles.comparisonBadgeCompact,
      ]}
    >
      <Text
        style={[
          styles.comparisonBadgeText,
          textToneStyle,
          compact && styles.comparisonBadgeTextCompact,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function buildRecentMonths(lastMonthStartIso: string, count = 6) {
  const base = parseLocalDate(lastMonthStartIso);
  if (!base) return [];

  const months: { startIso: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = addMonths(base, -i);
    months.push({
      startIso: monthIso(d),
      label: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }),
    });
  }
  return months;
}

export default function AnalysisDetailScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{
    group?: string;
    monthStart?: string;
    monthEnd?: string;
    monthLabel?: string;
  }>();

  const group = (params.group || "") as ExpenseAnalysisCategory;
  const monthStart = React.useMemo(
    () => normalizeMonthBoundary(String(params.monthStart || "")),
    [params.monthStart],
  );
  const monthEnd = React.useMemo(
    () => normalizeMonthBoundary(String(params.monthEnd || "")),
    [params.monthEnd],
  );
  const monthLabel = React.useMemo(() => {
    if (params.monthLabel) return String(params.monthLabel);

    const parsed = parseLocalDate(monthStart);
    return parsed
      ? parsed.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })
      : "Geselecteerde maand";
  }, [monthStart, params.monthLabel]);

  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [transactions, setTransactions] = React.useState<DetailTx[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = React.useState<
    Record<string, boolean>
  >({});

  const validGroup: ExpenseAnalysisCategory | null =
    group === "fixed_costs" ||
    group === "subscriptions" ||
    group === "variable_costs"
      ? group
      : null;

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );
  const previousMonthStart = React.useMemo(() => {
    const parsed = parseLocalDate(monthStart);
    return parsed ? toLocalIsoDate(addMonths(parsed, -1)) : "";
  }, [monthStart]);
  const lookbackStart = React.useMemo(() => {
    const parsed = parseLocalDate(monthStart);
    return parsed ? toLocalIsoDate(addMonths(parsed, -12)) : "";
  }, [monthStart]);

  const derivedData = React.useMemo(() => {
    const previousDescriptorAmounts = new Map<string, number[]>();
    const previousLooseDescriptorAmounts = new Map<string, number[]>();
    const previousSubcategoryTotals = new Map<string, number>();
    const descriptorHistoryCounts = new Map<string, number>();
    const looseDescriptorHistoryCounts = new Map<string, number>();
    const currentRows: DetailTx[] = [];
    const monthTotals = new Map<string, number>();
    const recentMonths = buildRecentMonths(monthStart, 6);

    for (const month of recentMonths) {
      monthTotals.set(month.startIso, 0);
    }

    let previousTotal = 0;

    for (const tx of transactions) {
      const amountAbs = Math.abs(tx.amount);
      const subcategoryLabel = getCategoryPathLabel(tx, categoryMap);
      const descriptorKey = descriptorKeyForTransaction(tx);
      const looseDescriptorKey = descriptorLooseKeyForTransaction(tx);

      if (tx.date >= monthStart && tx.date < monthEnd) {
        currentRows.push(tx);
      }

      if (tx.date >= previousMonthStart && tx.date < monthStart) {
        previousTotal += amountAbs;
        previousSubcategoryTotals.set(
          subcategoryLabel,
          (previousSubcategoryTotals.get(subcategoryLabel) || 0) + amountAbs,
        );

        const previousForDescriptor =
          previousDescriptorAmounts.get(descriptorKey) || [];
        previousForDescriptor.push(amountAbs);
        previousDescriptorAmounts.set(descriptorKey, previousForDescriptor);

        const previousForLooseDescriptor =
          previousLooseDescriptorAmounts.get(looseDescriptorKey) || [];
        previousForLooseDescriptor.push(amountAbs);
        previousLooseDescriptorAmounts.set(
          looseDescriptorKey,
          previousForLooseDescriptor,
        );
      }

      if (tx.date < monthStart) {
        descriptorHistoryCounts.set(
          descriptorKey,
          (descriptorHistoryCounts.get(descriptorKey) || 0) + 1,
        );
        looseDescriptorHistoryCounts.set(
          looseDescriptorKey,
          (looseDescriptorHistoryCounts.get(looseDescriptorKey) || 0) + 1,
        );
      }

      const txDate = parseLocalDate(tx.date);
      if (!txDate) continue;

      const trendKey = toLocalIsoDate(toMonthStart(txDate));
      if (monthTotals.has(trendKey)) {
        monthTotals.set(trendKey, (monthTotals.get(trendKey) || 0) + amountAbs);
      }
    }

    const availablePreviousByDescriptor = new Map<string, number[]>();
    for (const [
      descriptorKey,
      amounts,
    ] of previousDescriptorAmounts.entries()) {
      availablePreviousByDescriptor.set(descriptorKey, [...amounts]);
    }
    const availablePreviousByLooseDescriptor = new Map<string, number[]>();
    for (const [
      descriptorKey,
      amounts,
    ] of previousLooseDescriptorAmounts.entries()) {
      availablePreviousByLooseDescriptor.set(descriptorKey, [...amounts]);
    }

    const currentTransactions: DisplayTx[] = currentRows
      .map((tx) => {
        const descriptorKey = descriptorKeyForTransaction(tx);
        const looseDescriptorKey = descriptorLooseKeyForTransaction(tx);
        const strictReferenceMatch = shouldUseStrictReferenceMatch(tx);
        const amountAbs = Math.abs(tx.amount);
        const descriptorAmounts =
          availablePreviousByDescriptor.get(descriptorKey) || [];
        const exactClosestIndex = findClosestAmountIndex(
          descriptorAmounts,
          amountAbs,
        );
        let matchedPrevious =
          exactClosestIndex >= 0
            ? descriptorAmounts.splice(exactClosestIndex, 1)[0]
            : null;

        if (matchedPrevious == null && !strictReferenceMatch) {
          const looseDescriptorAmounts =
            availablePreviousByLooseDescriptor.get(looseDescriptorKey) || [];
          const looseClosestIndex = findClosestAmountIndex(
            looseDescriptorAmounts,
            amountAbs,
          );
          matchedPrevious =
            looseClosestIndex >= 0
              ? looseDescriptorAmounts.splice(looseClosestIndex, 1)[0]
              : null;
        }

        const historyOnExactKey =
          descriptorHistoryCounts.get(descriptorKey) || 0;
        const historyOnLooseKey =
          looseDescriptorHistoryCounts.get(looseDescriptorKey) || 0;
        const isNew = strictReferenceMatch
          ? historyOnExactKey === 0
          : historyOnExactKey === 0 && historyOnLooseKey === 0;

        return {
          ...tx,
          amountAbs,
          subcategoryLabel: getCategoryPathLabel(tx, categoryMap),
          descriptorKey,
          descriptorLabel: descriptorLabelForTransaction(tx),
          isNew,
          comparison:
            matchedPrevious == null
              ? null
              : compareTransactionAmount(amountAbs, matchedPrevious),
        };
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.amountAbs - a.amountAbs;
      });

    const totalAmount = currentTransactions.reduce(
      (sum, tx) => sum + tx.amountAbs,
      0,
    );
    const subcategoryMap = new Map<string, DisplayTx[]>();

    for (const tx of currentTransactions) {
      const existing = subcategoryMap.get(tx.subcategoryLabel);
      if (existing) {
        existing.push(tx);
      } else {
        subcategoryMap.set(tx.subcategoryLabel, [tx]);
      }
    }

    const subcategoryGroups: SubcategoryGroup[] = Array.from(
      subcategoryMap.entries(),
    )
      .map(([label, rows]) => {
        const amount = rows.reduce((sum, tx) => sum + tx.amountAbs, 0);
        const previousAmount = previousSubcategoryTotals.get(label) || 0;
        return {
          label,
          amount,
          previousAmount,
          share: totalAmount > 0 ? amount / totalAmount : 0,
          transactionCount: rows.length,
          comparison: compareAmounts(amount, previousAmount),
          transactions: rows,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const trend: MonthTrend[] = recentMonths
      .map((month) => ({
        monthLabel: month.label,
        monthStart: month.startIso,
        amount: monthTotals.get(month.startIso) || 0,
      }))
      .filter((month) => month.amount > 0);

    return {
      currentTransactions,
      totalAmount,
      previousTotal,
      groupComparison: compareAmounts(totalAmount, previousTotal),
      subcategoryGroups,
      trend,
    };
  }, [categoryMap, monthEnd, monthStart, previousMonthStart, transactions]);

  React.useEffect(() => {
    if (!isFocused || !validGroup || !monthStart || !monthEnd || !lookbackStart) {
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setExpandedSubcategories({});
      try {
        const userId = await requireCurrentUserId();
        const [cats, rows] = await Promise.all([
          getTransactionCategories(),
          supabase
            .from("transactions")
            .select(
              "id,date,amount,counterparty,details,category_id_auto,category_id_user,analysis_category",
            )
            .eq("user_id", userId)
            .lt("amount", 0)
            .gte("date", lookbackStart)
            .lt("date", monthEnd)
            .order("date", { ascending: false })
            .limit(6000),
        ]);

        if (rows.error) throw rows.error;

        setCategories(cats);
        const nextCategoryMap = buildCategoryRecordMap(cats);
        const nextTransactions = ((rows.data || []) as any[])
          .map((row) => ({
            id: String(row.id),
            date: String(row.date || ""),
            amount: Number(row.amount || 0),
            counterparty: String(row.counterparty || "").trim(),
            subscriptionProfileName: null as string | null,
            details: String(row.details || ""),
            category_id_auto: row.category_id_auto || null,
            category_id_user: row.category_id_user || null,
            analysis_category: (row.analysis_category || null) as AnalysisCategory | null,
          }))
          .filter(
            (row) => resolveExpenseGroupForDetail(row, nextCategoryMap) === validGroup,
          );

        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          nextTransactions.map((row) => row.id),
        );
        nextTransactions.forEach((row) => {
          row.subscriptionProfileName = subscriptionNames[row.id] || null;
        });

        setTransactions(nextTransactions);
      } catch (error) {
        console.error("[analysis-detail] load error", error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [isFocused, lookbackStart, monthEnd, monthStart, validGroup]);

  const toggleSubcategory = React.useCallback((label: string) => {
    setExpandedSubcategories((current) => ({
      ...current,
      [label]: !current[label],
    }));
  }, []);

  if (!validGroup || !monthStart || !monthEnd) {
    return (
      <FinanceDetailShell title="Analyse" onBack={() => router.back()}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ongeldige detailparameter.</Text>
        </View>
      </FinanceDetailShell>
    );
  }

  if (loading) {
    return (
      <FinanceDetailShell title="Analyse" onBack={() => router.back()}>
        <View style={styles.centered}>
          <ActivityIndicator color={FinColors.green} size="large" />
        </View>
      </FinanceDetailShell>
    );
  }

  const maxTrend = Math.max(1, ...derivedData.trend.map((item) => item.amount));

  return (
    <FinanceDetailShell
      title="Analyse"
      onBack={() => router.back()}
      contentContainerStyle={styles.content}
    >
        <View style={styles.card}>
        <Text style={styles.title}>{labelForGroup(validGroup)}</Text>
        <Text style={styles.subTitle}>{monthLabel}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totaalbedrag</Text>
          <Text style={styles.summaryValue}>
            {fmt.format(derivedData.totalAmount)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Vorige maand</Text>
          <Text style={styles.summaryValue}>
            {fmt.format(derivedData.previousTotal)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Verschil t.o.v. vorige maand</Text>
          <ComparisonBadge comparison={derivedData.groupComparison} />
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Aantal transacties</Text>
          <Text style={styles.summaryValue}>
            {derivedData.currentTransactions.length}
          </Text>
        </View>
        </View>

        <View style={styles.card}>
        <Text style={styles.cardTitle}>Verdeling per subcategorie</Text>
        {derivedData.subcategoryGroups.length ? (
          derivedData.subcategoryGroups.map((item) => {
            const expanded = Boolean(expandedSubcategories[item.label]);

            return (
              <View key={item.label} style={styles.subcategoryCard}>
                <Pressable
                  style={styles.subcategoryButton}
                  onPress={() => toggleSubcategory(item.label)}
                >
                  <View style={styles.subcategoryTitleWrap}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.subcategoryMeta}>
                      {Math.round(item.share * 100)}% van totaal •{" "}
                      {item.transactionCount} transacties
                    </Text>
                  </View>
                  <View style={styles.subcategoryRight}>
                    <Text style={styles.itemValue}>
                      {fmt.format(item.amount)}
                    </Text>
                    <View style={styles.subcategoryBadgeRow}>
                      <ComparisonBadge comparison={item.comparison} compact />
                      <Text style={styles.expandIndicator}>
                        {expanded ? "-" : "+"}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {expanded ? (
                  <View style={styles.subcategoryTransactions}>
                    {item.transactions.map((tx) => (
                      <Pressable
                        key={tx.id}
                        style={styles.txRow}
                        onPress={() => router.push(`/transactions/${tx.id}`)}
                      >
                        <View style={styles.txIconWrap}>
                          <TransactionCategoryIcon
                            row={tx}
                            categoryById={categoryMap}
                          />
                        </View>
                          <View style={styles.txLeft}>
                            <Text style={styles.txCounterparty} numberOfLines={1}>
                              {tx.subscriptionProfileName ||
                                tx.counterparty ||
                                "Onbekende tegenpartij"}
                            </Text>
                          <Text style={styles.txSub} numberOfLines={1}>
                            {firstDetailSegment(tx.details) ||
                              tx.descriptorLabel}
                          </Text>
                          <View style={styles.txMetaRow}>
                            <Text style={styles.txDate}>
                              {formatDisplayDate(tx.date)}
                            </Text>
                            {tx.isNew ? (
                              <View
                                style={[
                                  styles.comparisonBadge,
                                  styles.comparisonBadgeNew,
                                  styles.comparisonBadgeCompact,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.comparisonBadgeText,
                                    styles.comparisonBadgeTextNew,
                                    styles.comparisonBadgeTextCompact,
                                  ]}
                                >
                                  Nieuw
                                </Text>
                              </View>
                            ) : null}
                            <ComparisonBadge
                              comparison={tx.comparison}
                              compact
                              showFallback={!tx.isNew}
                            />
                          </View>
                        </View>
                        <Text style={styles.txAmount}>
                          {fmt.format(tx.amountAbs)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>Geen data voor deze selectie.</Text>
        )}
        </View>

        <View style={styles.card}>
        <Text style={styles.cardTitle}>Grafiek per maand</Text>
        {derivedData.trend.length ? (
          derivedData.trend.map((item) => (
            <View key={item.monthStart} style={styles.trendRow}>
              <Text style={styles.trendLabel}>{item.monthLabel}</Text>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    {
                      width: `${Math.max(8, Math.round((item.amount / maxTrend) * 100))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendValue}>{fmt.format(item.amount)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            Geen niet-lege maanden beschikbaar.
          </Text>
        )}
        </View>
    </FinanceDetailShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgBase,
  },
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: "700", color: FinColors.textPrimary },
  subTitle: {
    fontSize: 13,
    color: FinColors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  summaryLabel: { flex: 1, fontSize: 13, color: FinColors.textSecondary },
  summaryValue: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 15,
    color: FinColors.textPrimary,
    fontWeight: "700",
    marginBottom: 12,
  },
  subcategoryCard: {
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingVertical: 10,
  },
  subcategoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  subcategoryTitleWrap: { flex: 1, gap: 4 },
  itemLabel: { flex: 1, fontSize: 13, color: FinColors.textPrimary },
  itemValue: { fontSize: 13, color: FinColors.textPrimary, fontWeight: "700" },
  subcategoryMeta: { fontSize: 12, color: FinColors.textMuted },
  subcategoryRight: { alignItems: "flex-end", gap: 6 },
  subcategoryBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  expandIndicator: {
    width: 16,
    textAlign: "center",
    color: FinColors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  comparisonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  comparisonBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  comparisonBadgeUp: {
    backgroundColor: FinColors.redBg,
    borderColor: "rgba(229,115,115,0.24)",
  },
  comparisonBadgeDown: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  comparisonBadgeFlat: {
    backgroundColor: "rgba(103,184,255,0.12)",
    borderColor: "rgba(103,184,255,0.24)",
  },
  comparisonBadgeMuted: {
    backgroundColor: FinColors.bgElevated,
    borderColor: FinColors.borderSubtle,
  },
  comparisonBadgeNew: {
    backgroundColor: "rgba(103,184,255,0.12)",
    borderColor: "rgba(103,184,255,0.28)",
  },
  comparisonBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  comparisonBadgeTextCompact: {
    fontSize: 11,
  },
  comparisonBadgeTextUp: { color: FinColors.red },
  comparisonBadgeTextDown: { color: FinColors.green },
  comparisonBadgeTextFlat: { color: "#67b8ff" },
  comparisonBadgeTextMuted: { color: FinColors.textSecondary },
  comparisonBadgeTextNew: { color: "#67b8ff" },
  subcategoryTransactions: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 12,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  trendLabel: { width: 52, fontSize: 12, color: FinColors.textMuted },
  trendBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  trendBarFill: { height: "100%", backgroundColor: FinColors.green },
  trendValue: {
    width: 88,
    textAlign: "right",
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingVertical: 12,
    gap: 10,
  },
  txIconWrap: { marginRight: 2 },
  txLeft: { flex: 1 },
  txCounterparty: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  txSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 3 },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  txDate: { fontSize: 11, color: FinColors.textMuted },
  txAmount: { fontSize: 14, color: FinColors.textPrimary, fontWeight: "700" },
  emptyText: { color: FinColors.textMuted, fontSize: 13, lineHeight: 20 },
});
