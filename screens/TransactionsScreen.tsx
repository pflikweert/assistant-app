import { TransactionCategoryIcon } from "@/components/category-icon";
import { ThemedText } from "@/components/themed-text";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import { requireCurrentUserId } from "@/services/current-user";
import {
  buildCategoryNameMap,
  getCategoryLabel,
} from "@/services/category-display";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const PAGE_SIZE = 20;
const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type Tx = {
  id: string;
  description: string;
  counterparty: string;
  subscriptionProfileName?: string | null;
  omschrijving1: string;
  date: string;
  amount: number;
  seq: number;
  runningBalance: number | null;
  categoryAutoId: string | null;
  categoryUserId: string | null;
  categoryConfidence: number | null;
  categorySource: string | null;
};

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatSectionDateLabel(value: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (value === today) return "Vandaag";
  if (value === yesterday) return "Gisteren";

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function TransactionsScreen({
  counterpartyFilter,
  analysisCategoryFilter,
  monthStartFilter,
  monthEndExclusiveFilter,
  categoryKeyFilter,
}: {
  counterpartyFilter?: string;
  analysisCategoryFilter?: string;
  monthStartFilter?: string;
  monthEndExclusiveFilter?: string;
  categoryKeyFilter?: string;
} = {}) {
  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryById = React.useMemo(
    () => buildCategoryNameMap(categories),
    [categories],
  );

  const categoryFilterIds = React.useMemo(() => {
    const normalizedFilter = String(categoryKeyFilter || "")
      .trim()
      .toLowerCase();
    if (!normalizedFilter) return [] as string[];

    const direct = categories
      .filter((category) => category.key.toLowerCase() === normalizedFilter)
      .map((category) => category.id);
    if (direct.length) return direct;

    return categories
      .filter((category) =>
        category.key.toLowerCase().startsWith(`${normalizedFilter}_`),
      )
      .map((category) => category.id);
  }, [categories, categoryKeyFilter]);

  const categoryFilterIdCsv = React.useMemo(
    () => categoryFilterIds.join(","),
    [categoryFilterIds],
  );

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.warn("loadCategories error", error);
    }
  }, []);

  const loadPage = React.useCallback(
    async (pageNumber: number) => {
      setLoading(true);
      try {
        const userId = await requireCurrentUserId();
        if (categoryKeyFilter && categoryFilterIds.length === 0) {
          setTransactions([]);
          setHasMore(false);
          return;
        }

        const start = pageNumber * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;
        let query = supabase
          .from("transactions")
          .select(
            "id,details,counterparty,date,amount,metadata,category_id_auto,category_id_user,category_confidence,category_source",
          )
          .eq("user_id", userId);

        if (counterpartyFilter) {
          query = query.eq("counterparty", counterpartyFilter);
        }
        if (analysisCategoryFilter) {
          query = query.eq("analysis_category", analysisCategoryFilter);
        }
        if (monthStartFilter) {
          query = query.gte("date", monthStartFilter);
        }
        if (monthEndExclusiveFilter) {
          query = query.lt("date", monthEndExclusiveFilter);
        }
        if (categoryFilterIdCsv) {
          query = query.or(
            `category_id_user.in.(${categoryFilterIdCsv}),category_id_auto.in.(${categoryFilterIdCsv})`,
          );
        }

        const response = await query
          .order("date", { ascending: false })
          .order("metadata->>Volgnr", { ascending: false })
          .range(start, end);

        const { data, error } = response as { data: any[] | null; error: any };
        if (error) {
          console.warn("loadPage error", error);
        } else {
          const rows = (data || []).map((r) => {
            const md = r.metadata || {};
            const rawSeq = String(md["Volgnr"] || "").replace(/^0+/, "");
            const details = String(r.details || "");
            const omschrijving1 = details.split("|")[0]?.trim() || details;
            return {
              id: r.id,
              description: details,
              counterparty: String(r.counterparty || "").trim(),
              omschrijving1,
              date: r.date,
              amount: r.amount,
              seq: Number.parseInt(rawSeq || "0", 10) || 0,
              runningBalance: parseSaldo(md["Saldo na trn"]),
              categoryAutoId: r.category_id_auto || null,
              categoryUserId: r.category_id_user || null,
              categoryConfidence:
                r.category_confidence == null
                  ? null
                  : Number(r.category_confidence),
              categorySource: r.category_source || null,
            } as Tx;
          });

          rows.sort((a, b) => {
            if (a.date === b.date) return b.seq - a.seq;
            return a.date < b.date ? 1 : -1;
          });

          const subscriptionNames = await listTransactionSubscriptionProfileNames(
            rows.map((row) => row.id),
          );
          rows.forEach((row) => {
            row.subscriptionProfileName = subscriptionNames[row.id] || null;
          });

          setTransactions(rows);
          setHasMore(rows.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [
      analysisCategoryFilter,
      categoryFilterIdCsv,
      categoryFilterIds.length,
      categoryKeyFilter,
      counterpartyFilter,
      monthEndExclusiveFilter,
      monthStartFilter,
    ],
  );

  React.useEffect(() => {
    setPage(0);
  }, [
    analysisCategoryFilter,
    categoryKeyFilter,
    counterpartyFilter,
    monthEndExclusiveFilter,
    monthStartFilter,
  ]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadCategories();
  }, [isFocused, loadCategories]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadPage(page);
  }, [isFocused, loadPage, page]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadCategories();
    void loadPage(page);
  }, [
    backgroundStatus.lastCompletedAt,
    isFocused,
    loadCategories,
    loadPage,
    page,
  ]);

  const sections = React.useMemo(() => {
    const grouped: Record<string, Tx[]> = {};
    transactions.forEach((tx) => {
      if (!grouped[tx.date]) grouped[tx.date] = [];
      grouped[tx.date].push(tx);
    });
    return Object.entries(grouped).map(([date, data]) => ({
      title: date,
      data,
    }));
  }, [transactions]);

  const getEffectiveCategory = React.useCallback(
    (tx: Tx) =>
      getCategoryLabel(
        {
          category_id_auto: tx.categoryAutoId,
          category_id_user: tx.categoryUserId,
        },
        categoryById,
      ),
    [categoryById],
  );

  const activeFilterCount = [
    Boolean(counterpartyFilter),
    Boolean(analysisCategoryFilter),
    Boolean(categoryKeyFilter),
    Boolean(monthStartFilter),
  ].filter(Boolean).length;

  return (
    <View style={styles.root}>
      <View style={styles.headerCard}>
        <ThemedText type="subtitle" style={styles.eyebrow}>
          Transacties
        </ThemedText>
        <ThemedText type="title" style={styles.heading}>
          Alle transacties
        </ThemedText>
        <ThemedText style={styles.helperText}>
          Snel scannen, openen en waar nodig direct corrigeren.
        </ThemedText>
        {activeFilterCount > 0 ? (
          <View style={styles.filterChip}>
            <ThemedText style={styles.filterChipText}>
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} actief
            </ThemedText>
          </View>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionHeaderText}>
              {formatSectionDateLabel(title)}
            </ThemedText>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const isFirst = index === 0;
          const isLast = index === section.data.length - 1;
          const isPositive = item.amount >= 0;

          return (
            <TouchableOpacity
              style={StyleSheet.flatten([
                styles.row,
                isFirst && styles.rowFirst,
                isLast && styles.rowLast,
                !isLast && styles.rowDivider,
              ])}
              activeOpacity={0.78}
              onPress={() =>
                router.push({
                  pathname: "/transaction-detail",
                  params: { id: item.id },
                })
              }
            >
              <View style={styles.iconWrap}>
                <TransactionCategoryIcon
                  row={{
                    category_id_auto: item.categoryAutoId,
                    category_id_user: item.categoryUserId,
                  }}
                  categoryById={categoryById}
                  size={20}
                  bubbleSize={42}
                />
              </View>

              <View style={styles.rowText}>
                <ThemedText style={styles.desc}>
                  {item.subscriptionProfileName ||
                    item.counterparty ||
                    "Onbekende tegenpartij"}
                </ThemedText>
                <ThemedText style={styles.subDesc}>
                  {item.omschrijving1 || item.description}
                </ThemedText>

                <View style={styles.categoryRow}>
                  <ThemedText style={styles.categoryBadge}>
                    {getEffectiveCategory(item)}
                  </ThemedText>
                {item.categoryUserId ? (
                  <ThemedText style={styles.categoryMeta}>Handmatig</ThemedText>
                ) : item.categoryConfidence != null ? (
                  <ThemedText style={styles.categoryMeta}>
                    {`${Math.round(item.categoryConfidence * 100)}% ${item.categorySource || "automatisch"}`}
                  </ThemedText>
                ) : null}
              </View>
              </View>

              <View style={styles.amountColumn}>
                <ThemedText
                  style={[
                    styles.amount,
                    isPositive ? styles.amountPositive : styles.amountNegative,
                  ]}
                >
                  {`${isPositive ? "+" : "-"}${euroFormatter.format(Math.abs(item.amount))}`}
                </ThemedText>
                <ThemedText style={styles.running}>
                  {item.runningBalance == null
                    ? "Saldo onbekend"
                    : `Saldo ${euroFormatter.format(item.runningBalance)}`}
                </ThemedText>
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          loading ? (
            <ActivityIndicator
              color={FinColors.textSecondary}
              style={styles.loadingIndicator}
            />
          ) : null
        }
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.emptyTitle}>
                Geen transacties gevonden
              </ThemedText>
              <ThemedText style={styles.emptyText}>
                Pas je filters aan of kies een andere periode.
              </ThemedText>
            </View>
          ) : null
        }
      />

      <View style={styles.pager}>
        <Pressable
          style={[styles.pagerButton, page === 0 && styles.pagerButtonDisabled]}
          onPress={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0 || loading}
        >
          <AppIcon
            name="chevron-left"
            size={18}
            color={page === 0 ? FinColors.textMuted : FinColors.textPrimary}
            variant="outlined"
          />
          <ThemedText
            style={[
              styles.pagerButtonText,
              page === 0 && styles.pagerButtonTextDisabled,
            ]}
          >
            Vorige
          </ThemedText>
        </Pressable>

        <ThemedText style={styles.pageNumber}>Pagina {page + 1}</ThemedText>

        <Pressable
          style={[
            styles.pagerButton,
            (!hasMore || loading) && styles.pagerButtonDisabled,
          ]}
          onPress={() => setPage((current) => current + 1)}
          disabled={!hasMore || loading}
        >
          <ThemedText
            style={[
              styles.pagerButtonText,
              (!hasMore || loading) && styles.pagerButtonTextDisabled,
            ]}
          >
            Volgende
          </ThemedText>
          <AppIcon
            name="chevron-right"
            size={18}
            color={
              !hasMore || loading ? FinColors.textMuted : FinColors.textPrimary
            }
            variant="outlined"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    padding: 16,
  },
  headerCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 15,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  heading: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: FinColors.textPrimary,
    marginTop: 4,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
    marginTop: 8,
  },
  filterChip: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  filterChipText: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingIndicator: {
    marginVertical: 18,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingTop: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: FinColors.textPrimary,
    textTransform: "capitalize",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowFirst: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  rowLast: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 8,
  },
  rowDivider: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  iconWrap: {
    marginRight: 12,
    paddingTop: 2,
  },
  rowText: {
    flex: 1,
    paddingRight: 10,
  },
  desc: {
    fontSize: 15,
    lineHeight: 21,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  subDesc: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 7,
  },
  categoryBadge: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: FinColors.green,
    backgroundColor: FinColors.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  categoryMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: FinColors.textMuted,
    marginLeft: 8,
  },
  amountColumn: {
    minWidth: 116,
    alignItems: "flex-end",
    marginLeft: 8,
  },
  amount: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "right",
  },
  amountPositive: {
    color: FinColors.green,
  },
  amountNegative: {
    color: FinColors.red,
  },
  running: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
    marginTop: 4,
    textAlign: "right",
  },
  emptyCard: {
    marginTop: 32,
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pagerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  pagerButtonDisabled: {
    backgroundColor: FinColors.bgElevated,
  },
  pagerButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "600",
    marginHorizontal: 4,
  },
  pagerButtonTextDisabled: {
    color: FinColors.textMuted,
  },
  pageNumber: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
});
