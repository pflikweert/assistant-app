import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { MonthPickerSheet } from "@/components/month-picker-sheet";
import { FinColors } from "@/constants/theme";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
  getEffectiveCategoryId,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import {
  getCurrentMonthKey,
  getMonthOptionByKey,
  listTransactionMonthOptions,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import type { CategoryRecord } from "@/types/categorization";
import { AppIcon } from "@/components/ui/app-icon";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const PAGE_SIZE = 30;
const ALL_MONTHS_KEY = "all-months";
const ALL_MONTHS_PICKER_OPTION = {
  key: ALL_MONTHS_KEY,
  label: "Alle maanden",
  meta: "Zoek en bekijk over je hele historie",
} as const;

const PRIMARY_FILTERS = [
  { key: "all", label: "Alle transacties", icon: "filter-list" },
  { key: "expenses", label: "Uitgaven", icon: "category" },
  { key: "income", label: "Inkomsten", icon: "payments" },
  { key: "review", label: "Review", icon: "task-alt" },
] as const;

type PrimaryFilterKey = (typeof PRIMARY_FILTERS)[number]["key"];

type Tx = {
  id: string;
  counterparty: string;
  subscriptionProfileName?: string | null;
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
          <View style={styles.txCopyBlock}>
            <Text style={styles.txName} numberOfLines={2}>
              {item.subscriptionProfileName || item.counterparty || "Onbekend"}
            </Text>
            <Text style={styles.txSubline} numberOfLines={1}>
              {item.details || "Geen extra omschrijving"}
            </Text>
            <Text style={styles.txMetaLineText} numberOfLines={1}>
              {item.categoryLabel} • {item.date}
            </Text>
          </View>
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
      </View>
    </TouchableOpacity>
  );
}

function AvatarBadge() {
  return (
    <View style={styles.avatarBadge}>
      <Text style={styles.avatarBadgeText}>PF</Text>
    </View>
  );
}

export default function TransactionsTab() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { counterparty: rawCounterparty } = useLocalSearchParams<{
    counterparty?: string | string[];
  }>();
  const counterparty = Array.isArray(rawCounterparty)
    ? rawCounterparty[0]
    : rawCounterparty;
  const fallbackMonthOption = React.useMemo(
    () => getMonthOptionByKey(getCurrentMonthKey())!,
    [],
  );

  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [primaryFilter, setPrimaryFilter] =
    React.useState<PrimaryFilterKey>("all");
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMonthKey, setSelectedMonthKey] = React.useState(
    getCurrentMonthKey(),
  );
  const [monthOptions, setMonthOptions] = React.useState<TransactionMonthOption[]>(
    [fallbackMonthOption],
  );
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );

  const isAllMonthsSelected = selectedMonthKey === ALL_MONTHS_KEY;

  const selectedMonth = React.useMemo(
    () => {
      return (
        monthOptions.find((option) => option.key === selectedMonthKey) ||
        getMonthOptionByKey(selectedMonthKey) ||
        monthOptions[0] ||
        fallbackMonthOption
      );
    },
    [fallbackMonthOption, monthOptions, selectedMonthKey],
  );
  const selectedMonthLabel = isAllMonthsSelected
    ? "Alle maanden"
    : selectedMonth.label;
  const searchTokens = React.useMemo(
    () => normalizeSearch(searchQuery).split(" ").filter(Boolean),
    [searchQuery],
  );

  const activeFilterCount = [
    primaryFilter !== "all",
    Boolean(searchQuery),
    Boolean(counterparty),
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;
  const isWideLayout = width >= 980;

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
      const options = await listTransactionMonthOptions({ counterparty });
      setMonthOptions(options);
    } catch (error) {
      console.warn("[transactions] month options error", error);
      setMonthOptions([fallbackMonthOption]);
    }
  }, [counterparty, fallbackMonthOption]);

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

        if (!isAllMonthsSelected) {
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

        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          rows.map((row) => row.id),
        );
        rows.forEach((row) => {
          row.subscriptionProfileName = subscriptionNames[row.id] || null;
        });

        setTransactions(rows);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (error) {
        console.error("[transactions] load error", error);
      } finally {
        setLoading(false);
      }
    },
    [
      counterparty,
      isAllMonthsSelected,
      searchTokens,
      selectedMonth.endIso,
      selectedMonth.startIso,
    ],
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
    if (selectedMonthKey === ALL_MONTHS_KEY) return;
    if (monthOptions.some((option) => option.key === selectedMonthKey)) return;
    const currentMonthOption = monthOptions.find((option) => option.isCurrentMonth);
    setSelectedMonthKey(
      (currentMonthOption || monthOptions[0] || fallbackMonthOption).key,
    );
  }, [fallbackMonthOption, monthOptions, selectedMonthKey]);

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
            <Text style={styles.pageTitle}>Mijn Financiën</Text>
          </View>
          <AvatarBadge />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listScroller}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.contentShell,
            isWideLayout && styles.contentShellWide,
          ]}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroLabelDot} />
              <Text style={styles.heroEyebrowText}>Transactie overzicht</Text>
            </View>
            <Text style={styles.heroTitle}>Transacties</Text>
            <View style={styles.heroCopyWrap}>
              <Text style={styles.heroSupport}>
                Recent overzicht van al je uitgaven en inkomsten, georganiseerd
                op tijd en categorie.
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.primaryFilterRow}
          >
            {PRIMARY_FILTERS.map((item) => {
              const active = primaryFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.primaryFilterChip,
                    active && styles.primaryFilterChipActive,
                  ]}
                  onPress={() => setPrimaryFilter(item.key)}
                >
                  <AppIcon
                    name={item.icon as never}
                    size={16}
                    color={active ? FinColors.warningText : FinColors.textSecondary}
                    variant="outlined"
                    style={styles.primaryFilterChipIcon}
                  />
                  <Text
                    style={[
                      styles.primaryFilterText,
                      active && styles.primaryFilterTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

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

          {(counterparty || hasActiveFilters) && (
            <View style={styles.activeChipsRow}>
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

          {loading ? (
            <ActivityIndicator
              color={FinColors.textSecondary}
              style={styles.loadingIndicator}
            />
          ) : null}

          <View style={styles.monthSectionHeader}>
            <Text style={styles.monthSectionLabel}>Deze maand</Text>
            <Text style={styles.monthSectionTitle}>
              {selectedMonthLabel.toUpperCase()}
            </Text>
          </View>

          {!loading && sections.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <AppIcon
                  name="history"
                  size={28}
                  color={FinColors.textMuted}
                  variant="outlined"
                />
              </View>
              <Text style={styles.emptyTitle}>Geen transacties gevonden</Text>
              <Text style={styles.emptyCopy}>
                Probeer een andere zoekterm of haal een filter weg.
              </Text>
            </View>
          ) : null}

          {sections.map((section) => (
            <View key={section.title} style={styles.sectionList}>
              {section.data.map((item) => (
                <TxRow
                  key={item.id}
                  item={item}
                  categoryMap={categoryMap}
                  onPress={() =>
                    router.push({
                      pathname: "/transaction-detail",
                      params: { id: item.id },
                    })
                  }
                />
              ))}
            </View>
          ))}

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
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => router.push("/csv-import")}
        activeOpacity={0.85}
      >
        <AppIcon name="add" size={26} color={FinColors.bgCard} variant="outlined" />
      </TouchableOpacity>

      <MonthPickerSheet
        visible={monthPickerOpen}
        title="Kies maand"
        helper="Kies alle maanden of 1 maand met transacties"
        pinnedOptions={[ALL_MONTHS_PICKER_OPTION]}
        options={monthOptions}
        selectedKey={selectedMonthKey}
        onClose={() => setMonthPickerOpen(false)}
        onSelect={setSelectedMonthKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  topBar: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: FinColors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
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
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.45,
    marginLeft: 12,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.warningText,
  },
  heroLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroLabelDot: {
    width: 9,
    height: 9,
    backgroundColor: FinColors.warningText,
  },
  heroCopyWrap: {
    borderLeftWidth: 2,
    borderLeftColor: FinColors.border,
    paddingLeft: 14,
  },
  heroEyebrowText: {
    fontSize: 10,
    fontWeight: "800",
    color: FinColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  heroCard: {
    backgroundColor: FinColors.bgBase,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingHorizontal: 0,
    paddingTop: 34,
    paddingBottom: 28,
    gap: 16,
    overflow: "hidden",
  },
  heroTitle: {
    color: FinColors.textPrimary,
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -1.8,
  },
  heroSupport: {
    color: FinColors.textSecondary,
    fontSize: 18,
    lineHeight: 26,
  },
  primaryFilterRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 18,
    paddingBottom: 10,
    paddingRight: 4,
  },
  primaryFilterChip: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryFilterChipActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  primaryFilterChipIcon: {
    marginTop: -1,
  },
  primaryFilterText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  primaryFilterTextActive: {
    color: FinColors.textPrimary,
  },
  searchWrap: {
    marginTop: 16,
    minHeight: 60,
    borderRadius: 999,
    backgroundColor: "#d6dadd",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.04)",
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 18,
    top: 20,
  },
  searchInput: {
    paddingLeft: 52,
    paddingRight: 18,
    paddingVertical: 18,
    color: FinColors.textPrimary,
    fontSize: 14,
  },
  activeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    alignItems: "center",
  },
  activeChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#f8efc6",
    borderWidth: 1,
    borderColor: "#e2cc7e",
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6f5c00",
  },
  resetChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
    textDecorationLine: "underline",
    textDecorationColor: FinColors.textSecondary,
  },
  loadingIndicator: {
    marginVertical: 10,
  },
  listScroller: {
    paddingBottom: 96,
    backgroundColor: FinColors.bgBase,
  },
  contentShell: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 0,
  },
  contentShellWide: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  monthSectionHeader: {
    paddingTop: 18,
    paddingBottom: 16,
  },
  monthSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  monthSectionTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionList: {
    gap: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 0,
  },
  iconWrap: {
    marginRight: 16,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  txBody: {
    flex: 1,
  },
  txTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  txCopyBlock: {
    flex: 1,
    paddingRight: 10,
  },
  txName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  txSubline: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  txMetaLineText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: FinColors.textMuted,
  },
  txAmount: {
    fontSize: 17,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  amountWrap: {
    alignItems: "flex-end",
    minWidth: 100,
  },
  txAmountPositive: {
    color: FinColors.green,
  },
  balanceMeta: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 44,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    marginBottom: 12,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
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
    paddingVertical: 18,
    marginTop: 10,
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
  fabButton: {
    position: "absolute",
    right: 22,
    bottom: 96,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: FinColors.warningText,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});
