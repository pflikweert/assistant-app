import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { MonthPickerSheet } from "@/components/month-picker-sheet";
import { FinColors } from "@/constants/theme";
import { getBudgetGroupLabel } from "@/services/category-budget-groups";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
  getEffectiveCategoryId,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import { resolveIncomeSemanticsForTransaction } from "@/services/income-semantics";
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
  const effectiveCategoryId = getEffectiveCategoryId(item);
  const budgetGroupLabel = getBudgetGroupLabel(
    effectiveCategoryId ? categoryMap.get(effectiveCategoryId)?.budget_group : null,
  );
  const incomeSemantics = isPositive
    ? resolveIncomeSemanticsForTransaction(item, categoryMap)
    : null;
  const incomeSemanticLabel =
    incomeSemantics?.shortLabel &&
    incomeSemantics.shortLabel !== "Variabel inkomen"
      ? incomeSemantics.shortLabel
      : null;

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
          {budgetGroupLabel ? (
            <Text style={styles.budgetGroupBadge}>{budgetGroupLabel}</Text>
          ) : null}
          {incomeSemanticLabel ? (
            <Text
              style={[
                styles.incomeSemanticBadge,
                incomeSemantics?.kind === "expense_refund" &&
                  styles.incomeSemanticBadgeRefund,
              ]}
            >
              {incomeSemanticLabel}
            </Text>
          ) : null}
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
  const selectedMonthIndex = React.useMemo(
    () => monthOptions.findIndex((option) => option.key === selectedMonth?.key),
    [monthOptions, selectedMonth?.key],
  );
  const canGoToOlderMonth =
    selectedMonthIndex >= 0 && selectedMonthIndex < monthOptions.length - 1;
  const canGoToNewerMonth = selectedMonthIndex > 0;

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

        query = query
          .gte("date", selectedMonth.startIso)
          .lt("date", selectedMonth.endIso);

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
            <View style={styles.headerCopy}>
              <Text style={styles.pageTitle}>Transacties</Text>
              <Text style={styles.pageSubtitle}>
                Snel scannen, filteren en openen.
              </Text>
            </View>
          </View>
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
              style={styles.monthBadgeIcon}
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

      <MonthPickerSheet
        visible={monthPickerOpen}
        title="Kies maand"
        helper="Alleen maanden met transacties"
        options={monthOptions}
        selectedKey={selectedMonth.key}
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
  monthRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthBadge: {
    flex: 1,
    minHeight: 40,
    marginHorizontal: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    flexDirection: "row",
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
  monthBadgeIcon: {
    marginLeft: 4,
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
  budgetGroupBadge: {
    marginRight: 8,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: FinColors.warningText,
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  incomeSemanticBadge: {
    marginRight: 8,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: FinColors.green,
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  incomeSemanticBadgeRefund: {
    color: FinColors.warningText,
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
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
});
