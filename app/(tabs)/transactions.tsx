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
import { requireCurrentUserId } from "@/services/current-user";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";
import { AppIcon } from "@/components/ui/app-icon";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

const PAGE_SIZE = 30;

const PRIMARY_FILTERS = [
  { key: "all", label: "Alles" },
  { key: "expenses", label: "Uitgaven" },
  { key: "income", label: "Inkomsten" },
  { key: "review", label: "Review" },
] as const;

type PrimaryFilterKey = (typeof PRIMARY_FILTERS)[number]["key"];

type MonthOption = {
  key: string;
  label: string;
  startIso: string | null;
  endIso: string | null;
};

type Tx = {
  id: string;
  counterparty: string;
  details: string;
  date: string;
  amount: number;
  seq: number;
  runningBalance: number | null;
  category_id_auto: string | null;
  category_id_user: string | null;
};

type TxListItem = Tx & {
  categoryLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "warning" | "manual";
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function buildMonthOptions(oldestDate: string | null): MonthOption[] {
  const options: MonthOption[] = [
    {
      key: "all",
      label: "Alle maanden",
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

function getMonthOptionByKey(monthKey: string) {
  if (monthKey === "all") {
    return {
      key: "all",
      label: "Alle maanden",
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
      label: "Alle maanden",
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

function getStatusMeta(tx: Tx) {
  if (tx.category_id_user) {
    return {
      statusLabel: "Handmatig",
      statusTone: "manual" as const,
    };
  }

  if (!getEffectiveCategoryId(tx)) {
    return {
      statusLabel: "Controle nodig",
      statusTone: "warning" as const,
    };
  }

  return {
    statusLabel: "Bevestigd",
    statusTone: "neutral" as const,
  };
}

function TxRow({
  item,
  onPress,
  categoryMap,
}: {
  item: TxListItem;
  onPress: () => void;
  categoryMap: Map<string, CategoryRecord>;
}) {
  const isPositive = item.amount >= 0;

  return (
    <TouchableOpacity
      style={styles.txRow}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={styles.iconWrap}>
        <TransactionCategoryIcon row={item} categoryById={categoryMap} />
      </View>

      <View style={styles.txBody}>
        <View style={styles.txTopLine}>
          <Text style={styles.txName} numberOfLines={1}>
            {item.counterparty || "Onbekend"}
          </Text>
          <View style={styles.amountWrap}>
            <Text style={[styles.txAmount, isPositive && styles.txAmountPositive]}>
              {isPositive ? "+" : ""}
              {fmt.format(item.amount)}
            </Text>
            {item.runningBalance != null ? (
              <Text style={styles.balanceMeta}>
                {fmt.format(item.runningBalance)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.txMetaLine}>
          <Text style={styles.txDate}>{item.date}</Text>
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.txDetail} numberOfLines={1}>
            {item.details || "Geen extra omschrijving"}
          </Text>
        </View>

        <View style={styles.txBottomLine}>
          <Text style={styles.categoryBadge}>{item.categoryLabel}</Text>
          <Text
            style={[
              styles.statusBadge,
              item.statusTone === "warning" && styles.statusBadgeWarning,
              item.statusTone === "manual" && styles.statusBadgeManual,
            ]}
          >
            {item.statusLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{formatSectionDateLabel(title)}</Text>
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
  const [primaryFilter, setPrimaryFilter] =
    React.useState<PrimaryFilterKey>("all");
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
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
    primaryFilter !== "all",
    selectedMonthKey !== "all",
    Boolean(searchQuery),
    Boolean(counterparty),
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.warn("[transactions] categories error", error);
    }
  }, []);

  const loadMonthOptions = React.useCallback(async () => {
    try {
      const userId = await requireCurrentUserId();
      const base = supabase
        .from("transactions")
        .select("date")
        .eq("user_id", userId)
        .order("date", { ascending: true })
        .limit(1);

      const query = counterparty ? base.eq("counterparty", counterparty) : base;
      const { data, error } = await query;
      if (error) throw error;

      const oldestDate = data?.[0]?.date ? String(data[0].date) : null;
      setMonthOptions(buildMonthOptions(oldestDate));
    } catch (error) {
      console.warn("[transactions] month options error", error);
      setMonthOptions(buildMonthOptions(null));
    }
  }, [counterparty]);

  const loadPage = React.useCallback(
    async (nextPage: number) => {
      setLoading(true);

      try {
        const userId = await requireCurrentUserId();
        const start = nextPage * PAGE_SIZE;
        let query = supabase
          .from("transactions")
          .select(
            "id,details,counterparty,date,amount,metadata,category_id_auto,category_id_user",
          )
          .eq("user_id", userId)
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

        const { data, error } = await query;
        if (error) throw error;

        const rows: Tx[] = (data || []).map((row: any) => {
          const metadata = row.metadata || {};
          const rawSeq = String(metadata["Volgnr"] || "").replace(/^0+/, "");
          const rawBalance = metadata["Saldo na trn"];

          let runningBalance: number | null = null;
          if (rawBalance != null) {
            const parsed = parseFloat(
              String(rawBalance).replace(/\./g, "").replace(",", "."),
            );
            runningBalance = Number.isNaN(parsed) ? null : parsed;
          }

          return {
            id: row.id,
            counterparty: String(row.counterparty || "").trim(),
            details: String(row.details || "").split("|")[0]?.trim() || "",
            date: row.date,
            amount: row.amount,
            seq: Number.parseInt(rawSeq || "0", 10) || 0,
            runningBalance,
            category_id_auto: row.category_id_auto || null,
            category_id_user: row.category_id_user || null,
          };
        });

        rows.sort((left, right) =>
          left.date === right.date
            ? right.seq - left.seq
            : left.date < right.date
              ? 1
              : -1,
        );

        setTransactions(rows);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (error) {
        console.error("[transactions] load error", error);
      } finally {
        setLoading(false);
      }
    },
    [counterparty, searchTokens, selectedMonth.endIso, selectedMonth.startIso],
  );

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 220);

    return () => clearTimeout(handle);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(0);
  }, [counterparty, primaryFilter, searchQuery, selectedMonthKey]);

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
      transactions.map((tx) => {
        const status = getStatusMeta(tx);
        return {
          ...tx,
          categoryLabel: getCategoryPathLabel(tx, categoryMap),
          statusLabel: status.statusLabel,
          statusTone: status.statusTone,
        };
      }),
    [transactions, categoryMap],
  );

  const filteredTransactions = React.useMemo(() => {
    let rows = displayTransactions;

    if (primaryFilter === "income") {
      rows = rows.filter((tx) => tx.amount > 0);
    }

    if (primaryFilter === "expenses") {
      rows = rows.filter((tx) => tx.amount < 0);
    }

    if (primaryFilter === "review") {
      rows = rows.filter((tx) => !getEffectiveCategoryId(tx));
    }

    if (searchTokens.length) {
      rows = rows.filter((tx) => {
        const haystack = normalizeSearch(
          [tx.counterparty, tx.details, tx.categoryLabel].join(" "),
        );
        return searchTokens.every((token) => haystack.includes(token));
      });
    }

    return rows;
  }, [displayTransactions, primaryFilter, searchTokens]);

  const sections = React.useMemo(() => {
    const map: Record<string, TxListItem[]> = {};

    filteredTransactions.forEach((tx) => {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    });

    return Object.entries(map).map(([date, data]) => ({
      title: date,
      data,
    }));
  }, [filteredTransactions]);

  const handleResetFilters = React.useCallback(() => {
    setPrimaryFilter("all");
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
          <View style={styles.headerLeft}>
            <HeaderDropdownMenu />
            <View style={styles.headerCopy}>
              <Text style={styles.pageTitle}>Transacties</Text>
              <Text style={styles.pageSubtitle}>
                Snel scannen, filteren en openen.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterSheetOpen && styles.filterButtonActive,
            ]}
            onPress={() => setFilterSheetOpen(true)}
          >
            <AppIcon
              name="tune"
              size={18}
              color={
                filterSheetOpen ? FinColors.bgCard : FinColors.textPrimary
              }
            />
            <Text
              style={[
                styles.filterButtonText,
                filterSheetOpen && styles.filterButtonTextActive,
              ]}
            >
              {activeFilterCount ? `${activeFilterCount}` : "Filter"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <AppIcon
            name="search"
            size={18}
            color={FinColors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Zoek op winkel, omschrijving of categorie"
            placeholderTextColor={FinColors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.primaryFilterRow}>
          {PRIMARY_FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.primaryFilterChip,
                primaryFilter === item.key && styles.primaryFilterChipActive,
              ]}
              onPress={() => setPrimaryFilter(item.key)}
            >
              <Text
                style={[
                  styles.primaryFilterText,
                  primaryFilter === item.key && styles.primaryFilterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(selectedMonthKey !== "all" || counterparty || hasActiveFilters) && (
          <View style={styles.activeChipsRow}>
            {selectedMonthKey !== "all" ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{selectedMonth.label}</Text>
              </View>
            ) : null}
            {counterparty ? (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{counterparty}</Text>
              </View>
            ) : null}
            {hasActiveFilters ? (
              <TouchableOpacity
                style={styles.resetChip}
                onPress={handleResetFilters}
              >
                <Text style={styles.resetChipText}>Wis filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          color={FinColors.textSecondary}
          style={styles.loadingIndicator}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {!loading && sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Geen transacties gevonden</Text>
            <Text style={styles.emptyCopy}>
              Probeer een andere zoekterm of haal een filter weg.
            </Text>
          </View>
        ) : null}

        {sections.map((section) => (
          <View key={section.title}>
            <SectionHeader title={section.title} />
            <View style={styles.sectionCard}>
              {section.data.map((item, index) => (
                <React.Fragment key={item.id}>
                  <TxRow
                    item={item}
                    categoryMap={categoryMap}
                    onPress={() =>
                      router.push({
                        pathname: "/transaction-detail",
                        params: { id: item.id },
                      })
                    }
                  />
                  {index < section.data.length - 1 ? (
                    <View style={styles.divider} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.pager}>
        <TouchableOpacity
          style={[styles.pageButton, page === 0 && styles.pageButtonDisabled]}
          onPress={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0 || loading}
        >
          <Text style={styles.pageButtonText}>Vorige</Text>
        </TouchableOpacity>
        <Text style={styles.pageLabel}>Pagina {page + 1}</Text>
        <TouchableOpacity
          style={[styles.pageButton, !hasMore && styles.pageButtonDisabled]}
          onPress={() => setPage((current) => current + 1)}
          disabled={!hasMore || loading}
        >
          <Text style={styles.pageButtonText}>Volgende</Text>
        </TouchableOpacity>
      </View>

      {filterSheetOpen ? (
        <Modal
          transparent
          visible={filterSheetOpen}
          animationType="slide"
          onRequestClose={() => setFilterSheetOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setFilterSheetOpen(false)}
            />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Filters</Text>
                <TouchableOpacity onPress={() => setFilterSheetOpen(false)}>
                  <Text style={styles.sheetClose}>Sluit</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sheetLabel}>Maand</Text>
              <View style={styles.monthGrid}>
                {monthOptions.slice(0, 8).map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.monthChip,
                      selectedMonthKey === option.key && styles.monthChipActive,
                    ]}
                    onPress={() => setSelectedMonthKey(option.key)}
                  >
                    <Text
                      style={[
                        styles.monthChipText,
                        selectedMonthKey === option.key &&
                          styles.monthChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetSecondaryButton}
                  onPress={handleResetFilters}
                >
                  <Text style={styles.sheetSecondaryButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetPrimaryButton}
                  onPress={() => setFilterSheetOpen(false)}
                >
                  <Text style={styles.sheetPrimaryButtonText}>Toepassen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  filterButton: {
    minWidth: 46,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  filterButtonTextActive: {
    color: FinColors.bgCard,
  },
  searchWrap: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 15,
  },
  searchInput: {
    paddingLeft: 42,
    paddingRight: 14,
    paddingVertical: 14,
    color: FinColors.textPrimary,
    fontSize: 14,
  },
  primaryFilterRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  primaryFilterChip: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
  },
  primaryFilterChipActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  primaryFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  primaryFilterTextActive: {
    color: FinColors.bgCard,
  },
  activeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
  },
  activeChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  resetChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  loadingIndicator: {
    marginVertical: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: FinColors.bgBase,
  },
  sectionHeader: {
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: FinColors.bgBase,
  },
  sectionCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
  },
  iconWrap: {
    marginTop: 2,
    marginRight: 12,
  },
  txBody: {
    flex: 1,
  },
  txTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  txName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  amountWrap: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  txAmountPositive: {
    color: FinColors.green,
  },
  txMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  txDate: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  dotSeparator: {
    marginHorizontal: 6,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  txDetail: {
    flex: 1,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  txBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
  },
  balanceMeta: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  categoryBadge: {
    marginRight: 8,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "600",
    color: FinColors.textPrimary,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  statusBadge: {
    marginRight: 8,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: FinColors.textMuted,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  statusBadgeWarning: {
    color: FinColors.warningText,
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  statusBadgeManual: {
    color: FinColors.green,
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 58,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 72,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  emptyCopy: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
  },
  pageButton: {
    minWidth: 88,
    marginHorizontal: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
  },
  pageButtonDisabled: {
    opacity: 0.45,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  pageLabel: {
    marginHorizontal: 6,
    minWidth: 72,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.16)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: FinColors.border,
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  sheetClose: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  sheetLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  monthChipActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  monthChipTextActive: {
    color: FinColors.bgCard,
  },
  sheetActions: {
    flexDirection: "row",
    marginTop: 6,
  },
  sheetSecondaryButton: {
    flex: 1,
    marginRight: 5,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSecondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  sheetPrimaryButton: {
    flex: 1,
    marginLeft: 5,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: FinColors.textPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetPrimaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.bgCard,
  },
});
