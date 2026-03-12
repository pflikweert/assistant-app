import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
    buildCategoryRecordMap,
    getCategoryPathLabel,
    getEffectiveCategoryId,
} from "@/services/category-display";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    SectionList,
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
const PAGE_SIZE = 30;

const FILTER_PILLS = ["All", "Income", "Expenses", "Needs Review"];

type MonthOption = {
  key: string;
  label: string;
  startIso: string | null;
  endIso: string | null;
};

type Tx = {
  id: string;
  counterparty: string;
  omschrijving1: string;
  date: string;
  amount: number;
  seq: number;
  category_id_auto: string | null;
  category_id_user: string | null;
};

type TxListItem = Tx & { categoryLabel: string };

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildMonthOptions(oldestDate: string | null): MonthOption[] {
  const options: MonthOption[] = [
    {
      key: "all",
      label: "Alles",
      startIso: null,
      endIso: null,
    },
  ];

  if (!oldestDate) return options;

  const oldest = new Date(`${oldestDate}T00:00:00`);
  if (Number.isNaN(oldest.getTime())) return options;

  const oldestMonth = new Date(oldest.getFullYear(), oldest.getMonth(), 1);
  let cursor = new Date();
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  while (cursor >= oldestMonth) {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    options.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("nl-NL", {
        month: "long",
        year: "numeric",
      }),
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }

  return options;
}

function getMonthOptionByKey(monthKey: string): MonthOption {
  if (monthKey === "all") {
    return {
      key: "all",
      label: "Alles",
      startIso: null,
      endIso: null,
    };
  }

  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number.parseInt(yearValue || "", 10);
  const month = Number.parseInt(monthValue || "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return {
      key: "all",
      label: "Alles",
      startIso: null,
      endIso: null,
    };
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    key: monthKey,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
  };
}

function TxItem({
  item,
  onPress,
  categoryMap,
}: {
  item: TxListItem;
  onPress: () => void;
  categoryMap: Map<string, CategoryRecord>;
}) {
  const isPos = item.amount >= 0;
  return (
    <TouchableOpacity
      style={styles.txRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconBubble}>
        <TransactionCategoryIcon row={item} categoryById={categoryMap} />
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>
          {item.counterparty || "Unknown"}
        </Text>
        <Text style={styles.txSub} numberOfLines={1}>
          {item.omschrijving1}
        </Text>
        <View style={styles.categoryRow}>
          <Text style={styles.categoryBadge}>{item.categoryLabel}</Text>
          {item.category_id_user ? (
            <Text style={styles.categoryMeta}>Handmatig</Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.txAmount, isPos && styles.txAmountPos]}>
        {isPos ? "+" : ""}
        {fmt.format(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const label =
    title === today ? "Today" : title === yesterday ? "Yesterday" : title;
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function TransactionsTab() {
  const router = useRouter();
  const { counterparty: rawCounterparty } = useLocalSearchParams<{
    counterparty?: string | string[];
  }>();
  const counterparty = Array.isArray(rawCounterparty)
    ? rawCounterparty[0]
    : rawCounterparty;
  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [filter, setFilter] = React.useState("All");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMonthKey, setSelectedMonthKey] = React.useState("all");
  const [monthOptions, setMonthOptions] = React.useState<MonthOption[]>([
    getMonthOptionByKey("all"),
  ]);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );
  const selectedMonth = React.useMemo(
    () =>
      monthOptions.find((option) => option.key === selectedMonthKey) ||
      getMonthOptionByKey(selectedMonthKey),
    [monthOptions, selectedMonthKey],
  );
  const searchTokens = React.useMemo(
    () => normalizeSearch(searchQuery).split(" ").filter(Boolean),
    [searchQuery],
  );
  const activeFilterCount = [
    filter !== "All",
    selectedMonthKey !== "all",
    Boolean(searchInput.trim()),
    Boolean(counterparty),
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.warn("[v0] category load error", error);
    }
  }, []);

  const loadMonthOptions = React.useCallback(async () => {
    try {
      const base = supabase
        .from("transactions")
        .select("date")
        .order("date", { ascending: true })
        .limit(1);

      const query = counterparty ? base.eq("counterparty", counterparty) : base;
      const { data, error } = await query;

      if (error) throw error;

      const oldestDate = data?.[0]?.date ? String(data[0].date) : null;
      setMonthOptions(buildMonthOptions(oldestDate));
    } catch (error) {
      console.warn("[transactions] month option load error", error);
      setMonthOptions(buildMonthOptions(null));
    }
  }, [counterparty]);

  const loadPage = React.useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const start = p * PAGE_SIZE;
        let query = supabase
          .from("transactions")
          .select(
            "id,details,counterparty,date,amount,metadata,category_id_auto,category_id_user",
          )
          .order("date", { ascending: false })
          .order("metadata->>Volgnr", { ascending: false })
          .range(start, start + PAGE_SIZE - 1);

        if (counterparty) {
          query = query.eq("counterparty", counterparty);
        }

        if (selectedMonth.startIso && selectedMonth.endIso) {
          query = query
            .gte("date", selectedMonth.startIso)
            .lt("date", selectedMonth.endIso);
        }

        if (searchTokens.length) {
          const orFilters = searchTokens
            .slice(0, 5)
            .flatMap((token) => [
              `counterparty.ilike.%${token}%`,
              `details.ilike.%${token}%`,
            ])
            .join(",");
          query = query.or(orFilters);
        }

        const { data } = await query;

        const rows: Tx[] = (data || []).map((r: any) => {
          const md = r.metadata || {};
          const details = String(r.details || "");
          const rawSeq = String(md["Volgnr"] || "").replace(/^0+/, "");
          return {
            id: r.id,
            counterparty: String(r.counterparty || "").trim(),
            omschrijving1: details.split("|")[0]?.trim() || details,
            date: r.date,
            amount: r.amount,
            seq: parseInt(rawSeq || "0", 10) || 0,
            category_id_auto: r.category_id_auto || null,
            category_id_user: r.category_id_user || null,
          };
        });
        rows.sort((a, b) =>
          a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1,
        );
        setTransactions(rows);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (e) {
        console.error("[v0] transactions load error", e);
      } finally {
        setLoading(false);
      }
    },
    [counterparty, searchTokens, selectedMonth.endIso, selectedMonth.startIso],
  );

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => clearTimeout(handle);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(0);
  }, [counterparty, filter, searchQuery, selectedMonthKey]);

  React.useEffect(() => {
    if (monthOptions.some((option) => option.key === selectedMonthKey)) return;
    setSelectedMonthKey("all");
  }, [monthOptions, selectedMonthKey]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadCategories();
    void loadMonthOptions();
  }, [isFocused, loadCategories, loadMonthOptions]);

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

  const displayTransactions = React.useMemo<TxListItem[]>(
    () =>
      transactions.map((tx) => ({
        ...tx,
        categoryLabel: getCategoryPathLabel(tx, categoryMap),
      })),
    [transactions, categoryMap],
  );

  const filtered = React.useMemo(() => {
    let rows = displayTransactions;

    if (filter === "Income") {
      rows = rows.filter((t) => t.amount > 0);
    }
    if (filter === "Expenses") {
      rows = rows.filter((t) => t.amount < 0);
    }
    if (filter === "Needs Review") {
      rows = rows.filter((t) => !getEffectiveCategoryId(t));
    }
    if (searchTokens.length) {
      rows = rows.filter((tx) => {
        const haystack = normalizeSearch(
          [tx.counterparty, tx.omschrijving1, tx.categoryLabel].join(" "),
        );
        return searchTokens.every((token) => haystack.includes(token));
      });
    }

    return rows;
  }, [displayTransactions, filter, searchTokens]);

  const sections = React.useMemo(() => {
    const map: Record<string, TxListItem[]> = {};
    filtered.forEach((tx) => {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    });
    return Object.entries(map).map(([date, data]) => ({ title: date, data }));
  }, [filtered]);

  const handleResetFilters = React.useCallback(() => {
    setFilter("All");
    setSelectedMonthKey("all");
    setSearchInput("");
    setSearchQuery("");
    setPage(0);

    if (counterparty) {
      router.replace("/transactions");
    }
  }, [counterparty, router]);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.pageTitle}>Transactions</Text>
            {counterparty ? (
              <Text style={styles.counterpartyTag}>Filter: {counterparty}</Text>
            ) : selectedMonthKey !== "all" ? (
              <Text style={styles.counterpartyTag}>
                Maand: {selectedMonth.label}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerButton,
                filtersOpen && styles.headerButtonActive,
              ]}
              onPress={() => setFiltersOpen((current) => !current)}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  filtersOpen && styles.headerButtonTextActive,
                ]}
              >
                {activeFilterCount ? `Filter (${activeFilterCount})` : "Filter"}
              </Text>
            </TouchableOpacity>
            {hasActiveFilters ? (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetFilters}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            ) : null}
            <HeaderDropdownMenu />
          </View>
        </View>

        {filtersOpen ? (
          <View style={styles.filterPanel}>
            <Text style={styles.filterLabel}>Zoeken</Text>
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Zoek op tegenpartij of omschrijving"
              placeholderTextColor={FinColors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <Text style={styles.filterLabel}>Maand</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.monthRow}
            >
              {monthOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.monthPill,
                    selectedMonthKey === option.key && styles.monthPillActive,
                  ]}
                  onPress={() => setSelectedMonthKey(option.key)}
                >
                  <Text
                    style={[
                      styles.monthPillText,
                      selectedMonthKey === option.key &&
                        styles.monthPillTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Filter pills */}
      <View style={styles.pillRow}>
        {FILTER_PILLS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.pill, filter === p && styles.pillActive]}
            onPress={() => setFilter(p)}
          >
            <Text
              style={[styles.pillText, filter === p && styles.pillTextActive]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && (
        <ActivityIndicator
          color={FinColors.textSecondary}
          style={{ marginVertical: 12 }}
        />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} />
        )}
        renderItem={({ item, index, section }) => (
          <>
            <TxItem
              item={item}
              categoryMap={categoryMap}
              onPress={() => router.push(`/transaction-detail?id=${item.id}`)}
            />
            {index < section.data.length - 1 && <View style={styles.divider} />}
          </>
        )}
        ListEmptyComponent={() =>
          !loading ? (
            <Text style={styles.empty}>No transactions found.</Text>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Pager */}
      <View style={styles.pager}>
        <TouchableOpacity
          style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
          onPress={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          <Text style={[styles.pageBtnText, page === 0 && { opacity: 0.4 }]}>
            Previous
          </Text>
        </TouchableOpacity>
        <Text style={styles.pageNum}>{page + 1}</Text>
        <TouchableOpacity
          style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
          onPress={() => setPage((p) => p + 1)}
          disabled={!hasMore || loading}
        >
          <Text style={[styles.pageBtnText, !hasMore && { opacity: 0.4 }]}>
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerButtonActive: {
    backgroundColor: FinColors.textPrimary,
  },
  headerButtonText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  headerButtonTextActive: {
    color: FinColors.bgBase,
  },
  resetButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resetButtonText: {
    color: FinColors.green,
    fontSize: 13,
    fontWeight: "700",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  counterpartyTag: {
    marginTop: 6,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  filterPanel: {
    marginTop: 14,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 14,
  },
  filterLabel: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  searchInput: {
    backgroundColor: FinColors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.border,
    color: FinColors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  monthRow: {
    gap: 8,
    paddingRight: 12,
  },
  monthPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  monthPillActive: {
    backgroundColor: FinColors.textPrimary,
  },
  monthPillText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  monthPillTextActive: {
    color: FinColors.bgBase,
  },

  pillRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  pillActive: { backgroundColor: FinColors.textPrimary },
  pillText: { fontSize: 13, fontWeight: "600", color: FinColors.textSecondary },
  pillTextActive: { color: FinColors.bgBase },

  sectionHeader: {
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: FinColors.bgBase,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: FinColors.bgBase,
  },
  iconBubble: {
    marginRight: 14,
  },
  txMid: { flex: 1 },
  txName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 3 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  categoryBadge: {
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
  categoryMeta: { fontSize: 11, color: FinColors.textMuted },
  txAmount: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txAmountPos: { color: FinColors.green },

  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 58,
  },
  empty: {
    textAlign: "center",
    color: FinColors.textMuted,
    paddingVertical: 40,
    fontSize: 14,
  },

  pager: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
  },
  pageBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: FinColors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  pageNum: {
    fontSize: 14,
    color: FinColors.textMuted,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
});
