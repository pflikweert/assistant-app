import { TransactionListRow } from "@/components/transactions/transaction-list-row";
import {
  FinanceQuickMenu,
  type FinanceQuickMenuKey,
} from "@/components/navigation/finance-quick-menu";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceCircleIconButton } from "@/components/ui/finance-circle-icon-button";
import { FinanceMonthSelectorModal } from "@/components/ui/finance-month-selector-modal";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import { requireCurrentUserId } from "@/services/current-user";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
} from "@/services/category-display";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import {
  ALL_MONTHS_KEY,
  getCurrentMonthKey,
  getMonthOptionByKey,
  listTransactionMonthOptions,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import type { CategoryRecord } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

const PAGE_SIZE = 20;
const CONTENT_MAX_WIDTH = 1040;
const TRANSACTION_TYPE_FILTER_OPTIONS = [
  { key: "all", label: "Alles" },
  { key: "income", label: "Inkomsten" },
  { key: "fixed_costs", label: "Vaste lasten" },
  { key: "subscriptions", label: "Abonnementen" },
  { key: "variable_costs", label: "Overige uitgaven" },
] as const;

type TransactionTypeFilterKey = (typeof TRANSACTION_TYPE_FILTER_OPTIONS)[number]["key"];
type TransactionAnalysisMainGroupFilter = "income" | "expense";

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const normalized = String(value).replace(/\./g, "").replace(/,/g, ".").trim();
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

type TxRowItem = Tx & { categoryLabel: string };

type TxSection = {
  title: string;
  data: TxRowItem[];
};

export default function TransactionsScreen({
  counterpartyFilter,
  analysisCategoryFilter,
  analysisMainGroupFilter,
  monthStartFilter,
  monthEndExclusiveFilter,
  categoryKeyFilter,
  showQuickMenu = true,
}: {
  counterpartyFilter?: string;
  analysisCategoryFilter?: string;
  analysisMainGroupFilter?: TransactionAnalysisMainGroupFilter;
  monthStartFilter?: string;
  monthEndExclusiveFilter?: string;
  categoryKeyFilter?: string;
  showQuickMenu?: boolean;
} = {}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();
  const listRef = React.useRef<SectionList<TxRowItem>>(null);

  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [periodModalOpen, setPeriodModalOpen] = React.useState(false);
  const fallbackMonthOption = React.useMemo(
    () => getMonthOptionByKey(getCurrentMonthKey())!,
    [],
  );
  const [monthOptions, setMonthOptions] = React.useState<TransactionMonthOption[]>([
    fallbackMonthOption,
  ]);

  const categoryById = React.useMemo(() => buildCategoryRecordMap(categories), [categories]);
  const activeMonthKey = React.useMemo(() => {
    if (monthStartFilter && /^\d{4}-\d{2}/.test(monthStartFilter)) {
      return monthStartFilter.slice(0, 7);
    }
    return ALL_MONTHS_KEY;
  }, [monthStartFilter]);
  const resolvedMonthOptions = React.useMemo(
    () => (monthOptions.length ? monthOptions : [fallbackMonthOption]),
    [fallbackMonthOption, monthOptions],
  );
  const selectedMonthOption = React.useMemo(() => {
    if (activeMonthKey === ALL_MONTHS_KEY) return null;
    return (
      resolvedMonthOptions.find((option) => option.key === activeMonthKey) ||
      getMonthOptionByKey(activeMonthKey) ||
      fallbackMonthOption
    );
  }, [activeMonthKey, fallbackMonthOption, resolvedMonthOptions]);

  const categoryFilterIds = React.useMemo(() => {
    const normalizedFilter = String(categoryKeyFilter || "").trim().toLowerCase();
    if (!normalizedFilter) return [] as string[];

    const direct = categories
      .filter((category) => category.key.toLowerCase() === normalizedFilter)
      .map((category) => category.id);
    if (direct.length) return direct;

    return categories
      .filter((category) => category.key.toLowerCase().startsWith(`${normalizedFilter}_`))
      .map((category) => category.id);
  }, [categories, categoryKeyFilter]);

  const categoryFilterIdCsv = React.useMemo(() => categoryFilterIds.join(","), [categoryFilterIds]);

  const selectedTypeFilterKey = React.useMemo<TransactionTypeFilterKey>(() => {
    if (analysisMainGroupFilter === "income") return "income";
    if (analysisMainGroupFilter === "expense") {
      if (analysisCategoryFilter === "fixed_costs") return "fixed_costs";
      if (analysisCategoryFilter === "subscriptions") return "subscriptions";
      if (analysisCategoryFilter === "variable_costs") return "variable_costs";
      return "all";
    }

    if (analysisCategoryFilter === "income_structural" || analysisCategoryFilter === "income_variable") {
      return "income";
    }
    if (analysisCategoryFilter === "fixed_costs") return "fixed_costs";
    if (analysisCategoryFilter === "subscriptions") return "subscriptions";
    if (analysisCategoryFilter === "variable_costs") return "variable_costs";
    return "all";
  }, [analysisCategoryFilter, analysisMainGroupFilter]);

  const analysisTypeLabel = React.useMemo(() => {
    if (selectedTypeFilterKey === "all") return null;
    return TRANSACTION_TYPE_FILTER_OPTIONS.find((option) => option.key === selectedTypeFilterKey)?.label || null;
  }, [selectedTypeFilterKey]);

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.warn("loadCategories error", error);
    }
  }, []);

  const loadMonthOptions = React.useCallback(async () => {
    try {
      const options = await listTransactionMonthOptions({
        counterparty: counterpartyFilter || null,
      });
      setMonthOptions(options.length ? options : [fallbackMonthOption]);
    } catch (error) {
      console.warn("loadMonthOptions error", error);
      setMonthOptions([fallbackMonthOption]);
    }
  }, [counterpartyFilter, fallbackMonthOption]);

  const loadPage = React.useCallback(async (pageNumber: number) => {
    setLoading(true);
    try {
      const userId = await requireCurrentUserId();
      if (categoryKeyFilter && categoryFilterIds.length === 0) {
        setTransactions([]);
        setHasMore(false);
        setTotalCount(0);
        return;
      }

      const start = pageNumber * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;
      let query = supabase
        .from("transactions")
        .select("id,details,counterparty,date,amount,metadata,category_id_auto,category_id_user,category_confidence,category_source", { count: "exact" })
        .eq("user_id", userId);

      if (counterpartyFilter) query = query.eq("counterparty", counterpartyFilter);
      if (analysisMainGroupFilter) query = query.eq("analysis_main_group", analysisMainGroupFilter);
      if (analysisCategoryFilter) query = query.eq("analysis_category", analysisCategoryFilter);
      if (monthStartFilter) query = query.gte("date", monthStartFilter);
      if (monthEndExclusiveFilter) query = query.lt("date", monthEndExclusiveFilter);
      if (categoryFilterIdCsv) {
        query = query.or(`category_id_user.in.(${categoryFilterIdCsv}),category_id_auto.in.(${categoryFilterIdCsv})`);
      }
      const searchTokensForQuery = normalizeSearch(searchQuery).split(" ").filter(Boolean);
      if (searchTokensForQuery.length) {
        const tokenFilters = searchTokensForQuery.map(
          (token) => `or(details.ilike.%${token}%,counterparty.ilike.%${token}%)`,
        );
        const searchFilter =
          tokenFilters.length === 1
            ? tokenFilters[0]
            : `and(${tokenFilters.join(",")})`;
        query = query.or(searchFilter);
      }

      const response = await query
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .range(start, end);

      const { data, error, count } = response as { data: any[] | null; error: any; count: number | null };
      if (error) {
        console.warn("loadPage error", error);
      } else {
        const rows = (data || []).map((row) => {
          const metadata = row.metadata || {};
          const rawSeq = String(metadata["Volgnr"] || "").replace(/^0+/, "");
          const details = String(row.details || "");
          const omschrijving1 = details.split("|")[0]?.trim() || details;

          return {
            id: row.id,
            description: details,
            counterparty: String(row.counterparty || "").trim(),
            omschrijving1,
            date: row.date,
            amount: row.amount,
            seq: Number.parseInt(rawSeq || "0", 10) || 0,
            runningBalance: parseSaldo(metadata["Saldo na trn"]),
            categoryAutoId: row.category_id_auto || null,
            categoryUserId: row.category_id_user || null,
            categoryConfidence:
              row.category_confidence == null ? null : Number(row.category_confidence),
            categorySource: row.category_source || null,
          } as Tx;
        });

        rows.sort((a, b) => {
          if (a.date === b.date) return b.seq - a.seq;
          return a.date < b.date ? 1 : -1;
        });

        const subscriptionNames = await listTransactionSubscriptionProfileNames(rows.map((row) => row.id));
        rows.forEach((row) => {
          row.subscriptionProfileName = subscriptionNames[row.id] || null;
        });

        setTransactions(rows);
        const resolvedCount = Math.max(count ?? rows.length, 0);
        setTotalCount(resolvedCount);
        setHasMore(end + 1 < resolvedCount);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [analysisCategoryFilter, analysisMainGroupFilter, categoryFilterIdCsv, categoryFilterIds.length, categoryKeyFilter, counterpartyFilter, monthEndExclusiveFilter, monthStartFilter, searchQuery]);

  React.useEffect(() => {
    setPage(0);
  }, [analysisCategoryFilter, analysisMainGroupFilter, categoryKeyFilter, counterpartyFilter, monthEndExclusiveFilter, monthStartFilter, searchQuery]);

  React.useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput.trim()), 180);
    return () => clearTimeout(handle);
  }, [searchInput]);

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
    void loadMonthOptions();
    void loadPage(page);
  }, [backgroundStatus.lastCompletedAt, isFocused, loadCategories, loadMonthOptions, loadPage, page]);

  const displayTransactions = React.useMemo<TxRowItem[]>(() => {
    return transactions.map((tx) => ({
      ...tx,
      categoryLabel: getCategoryPathLabel(
        {
          category_id_auto: tx.categoryAutoId,
          category_id_user: tx.categoryUserId,
        },
        categoryById,
      ),
    }));
  }, [transactions, categoryById]);

  const searchTokens = React.useMemo(
    () => normalizeSearch(searchQuery).split(" ").filter(Boolean),
    [searchQuery],
  );
  const filteredTransactions = React.useMemo(() => {
    if (!searchTokens.length) return displayTransactions;

    return displayTransactions.filter((tx) => {
      const haystack = normalizeSearch(
        [tx.subscriptionProfileName, tx.counterparty, tx.description, tx.omschrijving1, tx.categoryLabel].filter(Boolean).join(" "),
      );
      return searchTokens.every((token) => haystack.includes(token));
    });
  }, [displayTransactions, searchTokens]);

  const sections = React.useMemo<TxSection[]>(() => {
    const grouped: Record<string, TxRowItem[]> = {};
    filteredTransactions.forEach((tx) => {
      if (!grouped[tx.date]) grouped[tx.date] = [];
      grouped[tx.date].push(tx);
    });

    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [filteredTransactions]);

  const activeFilterChips = React.useMemo(() => {
    const chips: string[] = [];
    if (counterpartyFilter) chips.push(counterpartyFilter);
    if (analysisTypeLabel) chips.push(analysisTypeLabel);
    if (categoryKeyFilter) chips.push(categoryKeyFilter.replace(/_/g, " "));
    return chips;
  }, [analysisTypeLabel, categoryKeyFilter, counterpartyFilter]);

  const activeFilterCount =
    activeFilterChips.length + (searchQuery ? 1 : 0) + (activeMonthKey !== ALL_MONTHS_KEY ? 1 : 0);

  const periodLabel = React.useMemo(() => {
    if (selectedMonthOption) return selectedMonthOption.label;
    return "Alle maanden";
  }, [selectedMonthOption]);
  const periodSummaryLabel = React.useMemo(() => {
    if (activeMonthKey === ALL_MONTHS_KEY) return "Alle maanden";
    return selectedMonthOption?.label || "Alle maanden";
  }, [activeMonthKey, selectedMonthOption]);
  const totalPages = React.useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );
  const currentRangeStart = React.useMemo(
    () => (totalCount === 0 ? 0 : page * PAGE_SIZE + 1),
    [page, totalCount],
  );
  const currentRangeEnd = React.useMemo(
    () => Math.min((page + 1) * PAGE_SIZE, totalCount),
    [page, totalCount],
  );

  const handleResetFilters = React.useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setPage(0);
    setPeriodModalOpen(false);
    setFilterModalOpen(false);
    router.replace({ pathname: "/transactions" });
  }, [router]);

  const buildTransactionRouteParams = React.useCallback(
    (input: {
      monthKey?: string | null;
      analysisMainGroup?: TransactionAnalysisMainGroupFilter | null;
      analysisCategory?: string | null;
    }) => {
      const nextParams: Record<string, string> = {};
      if (counterpartyFilter) nextParams.counterparty = counterpartyFilter;
      if (categoryKeyFilter) nextParams.categoryKey = categoryKeyFilter;

      const resolvedAnalysisMainGroup =
        input.analysisMainGroup === undefined ? analysisMainGroupFilter || null : input.analysisMainGroup;
      const resolvedAnalysisCategory =
        input.analysisCategory === undefined ? analysisCategoryFilter || null : input.analysisCategory;

      if (resolvedAnalysisMainGroup) {
        nextParams.analysisMainGroup = resolvedAnalysisMainGroup;
      }
      if (resolvedAnalysisCategory) {
        nextParams.analysisCategory = resolvedAnalysisCategory;
      }

      const resolvedMonthKey =
        input.monthKey === undefined ? activeMonthKey : input.monthKey;
      if (resolvedMonthKey && resolvedMonthKey !== ALL_MONTHS_KEY) {
        const option =
          resolvedMonthOptions.find((item) => item.key === resolvedMonthKey) ||
          getMonthOptionByKey(resolvedMonthKey);
        if (option) {
          nextParams.monthStart = option.startIso;
          nextParams.monthEndExclusive = option.endIso;
        }
      }

      return nextParams;
    },
    [
      analysisCategoryFilter,
      analysisMainGroupFilter,
      categoryKeyFilter,
      counterpartyFilter,
      activeMonthKey,
      resolvedMonthOptions,
    ],
  );

  const handlePageChange = React.useCallback((nextPage: number) => {
    const boundedPage = Math.max(0, Math.min(nextPage, Math.max(totalPages - 1, 0)));
    if (boundedPage === page) return;
    const listApi = listRef.current as
      | (SectionList<TxRowItem> & {
          scrollToLocation?: (params: {
            animated?: boolean;
            sectionIndex: number;
            itemIndex: number;
            viewOffset?: number;
          }) => void;
          scrollToOffset?: (params: { animated?: boolean; offset: number }) => void;
        })
      | null;

    if (typeof listApi?.scrollToLocation === "function") {
      listApi.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        viewOffset: 0,
        animated: false,
      });
    } else if (typeof listApi?.scrollToOffset === "function") {
      listApi.scrollToOffset({ offset: 0, animated: false });
    }
    setPage(boundedPage);
  }, [page, totalPages]);

  const handleApplyMonthFilter = React.useCallback((monthKey: string) => {
    setPage(0);
    setFilterModalOpen(false);
    router.replace({
      pathname: "/transactions",
      params: buildTransactionRouteParams({ monthKey }),
    });
  }, [buildTransactionRouteParams, router]);

  const handleApplyTypeFilter = React.useCallback(
    (typeKey: TransactionTypeFilterKey) => {
      setPage(0);
      setFilterModalOpen(false);

      const nextAnalysisParams =
        typeKey === "all"
          ? { analysisMainGroup: null, analysisCategory: null }
          : typeKey === "income"
            ? { analysisMainGroup: "income" as const, analysisCategory: null }
            : {
                analysisMainGroup: "expense" as const,
                analysisCategory: typeKey,
              };

      router.replace({
        pathname: "/transactions",
        params: buildTransactionRouteParams(nextAnalysisParams),
      });
    },
    [buildTransactionRouteParams, router],
  );

  const header = (
    <View style={styles.headerBlock}>
      <FinanceHeroShell
        shellStyle={styles.heroShell}
        innerStyle={styles.heroInner}
        eyebrow="Transactie overzicht"
        title="Transacties"
        subtitle="Transacties per periode en type."
        titleStyle={styles.heroTitle}
        subtitleStyle={styles.heroCopy}
      />

      <View style={styles.contentMax}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.periodLauncher}
            onPress={() => setPeriodModalOpen(true)}
            activeOpacity={0.9}
          >
            <AppIcon
              name="calendar-today"
              size={18}
              color={FinColors.textPrimary}
              variant="outlined"
            />
            <Text style={styles.periodLauncherText} numberOfLines={1}>
              {periodLabel}
            </Text>
            <AppIcon
              name="expand-more"
              size={18}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          </TouchableOpacity>

          <View style={styles.filterIconWrap}>
            <FinanceCircleIconButton
              icon="tune"
              onPress={() => setFilterModalOpen(true)}
              accessibilityLabel="Filters openen"
              size={48}
              iconSize={18}
              iconColor={FinColors.textPrimary}
              style={styles.filterIconButton}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterIconBadge}>
                <Text style={styles.filterIconBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.searchWrap}>
          <AppIcon name="search" size={18} color={FinColors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Zoek op winkel, categorie of bedrag..."
            placeholderTextColor={FinColors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {activeFilterCount > 0 ? (
          <View style={styles.activeFiltersRow}>
            {activeFilterChips.map((chip) => (
              <View key={chip} style={styles.activeChip}>
                <Text style={styles.activeChipText}>{chip}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.clearLink} onPress={handleResetFilters}>
              <Text style={styles.clearLinkText}>Wis alles</Text>
            </TouchableOpacity>
          </View>
        ) : null}

      </View>
    </View>
  );

  return (
    <View style={[styles.root, isWideLayout && styles.rootWide]}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceTopBar
        shellStyle={styles.topBar}
        innerStyle={styles.topBarInner}
        title="Mijn Financiën"
        rightSlot={<FinanceAvatarBadge />}
      />

      <SectionList
        ref={listRef}
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <View style={styles.contentMax}>
              <Text style={styles.sectionHeaderText}>{formatSectionDateLabel(title)}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          return (
            <TransactionListRow
              title={item.subscriptionProfileName || item.counterparty || "Onbekende tegenpartij"}
              subtitle={item.omschrijving1 || item.description}
              meta={item.categoryLabel}
              amount={item.amount}
              runningBalance={item.runningBalance}
              categoryAutoId={item.categoryAutoId}
              categoryUserId={item.categoryUserId}
              categoryById={categoryById}
              maxWidth={CONTENT_MAX_WIDTH}
              onPress={() =>
                router.push({
                  pathname: "/transaction-detail",
                  params: { id: item.id },
                })
              }
            />
          );
        }}
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <AppIcon name="history" size={28} color={FinColors.textMuted} variant="outlined" />
              </View>
              <Text style={styles.emptyTitle}>Geen transacties gevonden</Text>
              <Text style={styles.emptyText}>Pas je filters aan of kies een andere periode.</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity style={[styles.emptyActionButton, styles.emptyActionPrimary]} onPress={handleResetFilters}>
                  <Text style={styles.emptyActionPrimaryText}>Filters wissen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyActionButton} onPress={() => router.push("/csv-import")}>
                  <Text style={styles.emptyActionText}>Importeren</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {loading ? (
              <ActivityIndicator color={FinColors.textSecondary} style={styles.loadingIndicator} />
            ) : null}
            {totalCount > 0 ? (
              <View style={styles.pager}>
                <View style={styles.pageStatus}>
                  <Text style={styles.pageNumber}>
                    {currentRangeStart}-{currentRangeEnd} van {totalCount}
                  </Text>
                  <Text style={styles.pageMeta}>Pagina {page + 1} van {totalPages}</Text>
                </View>
                <View style={styles.pagerNavGroup}>
                  <TouchableOpacity
                    style={[styles.pagerIconButton, page === 0 && styles.pagerButtonDisabled]}
                    onPress={() => handlePageChange(0)}
                    disabled={page === 0 || loading}
                    accessibilityLabel="Ga naar eerste pagina"
                  >
                    <AppIcon name="first-page" size={20} color={FinColors.textPrimary} variant="outlined" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pagerIconButton, page === 0 && styles.pagerButtonDisabled]}
                    onPress={() => handlePageChange(page - 1)}
                    disabled={page === 0 || loading}
                    accessibilityLabel="Vorige pagina"
                  >
                    <AppIcon name="chevron-left" size={20} color={FinColors.textPrimary} variant="outlined" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pagerIconButton, styles.pagerIconButtonPrimary, (!hasMore || loading) && styles.pagerButtonDisabled]}
                    onPress={() => handlePageChange(page + 1)}
                    disabled={!hasMore || loading}
                    accessibilityLabel="Volgende pagina"
                  >
                    <AppIcon name="chevron-right" size={20} color={FinColors.textPrimary} variant="outlined" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        }
      />

      {showQuickMenu ? (
        <FinanceQuickMenu
          activeKey="transactions"
          onSelect={(key: FinanceQuickMenuKey) => {
            if (key === "index") {
              router.push("/");
            } else if (key === "budget") {
              router.push("/budget");
            } else if (key === "transactions") {
              router.push("/transactions");
            } else if (key === "insights") {
              router.push("/insights");
            }
          }}
        />
      ) : null}

      <FinanceBottomSheetShell
        visible={filterModalOpen}
        title="Filters"
        subtitle="Filter alleen transacties, de periode kies je apart."
        onClose={() => setFilterModalOpen(false)}
        bodyStyle={styles.filterModalBody}
        footerStyle={styles.filterModalFooter}
        footer={
          <View style={styles.filterModalActions}>
            <TouchableOpacity
              style={styles.filterModalSecondaryButton}
              onPress={() => {
                setFilterModalOpen(false);
                handleResetFilters();
              }}
            >
              <Text style={styles.filterModalSecondaryText}>Wis filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterModalPrimaryButton}
              onPress={() => setFilterModalOpen(false)}
            >
              <Text style={styles.filterModalPrimaryText}>Sluiten</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <ScrollView
          style={styles.filterModalScroll}
          contentContainerStyle={styles.filterModalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filterModalSection}>
            <Text style={styles.filterModalLabel}>Snel kiezen</Text>
            <View style={styles.filterModalChipWrap}>
              {TRANSACTION_TYPE_FILTER_OPTIONS.map((option) => {
                const isActive = selectedTypeFilterKey === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterModalChip, isActive && styles.filterModalChipActive]}
                    onPress={() => handleApplyTypeFilter(option.key)}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        styles.filterModalChipText,
                        isActive && styles.filterModalChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filterModalSection}>
            <Text style={styles.filterModalLabel}>Periode</Text>
            <View style={styles.filterModalField}>
              <View>
                <Text style={styles.filterModalFieldLabel}>Geselecteerd</Text>
                <Text style={styles.filterModalFieldValue}>{periodSummaryLabel}</Text>
              </View>
              <AppIcon
                name="calendar-today"
                size={18}
                color={FinColors.textMuted}
                variant="outlined"
              />
            </View>
          </View>

          {(activeFilterChips.length || searchQuery) ? (
            <View style={styles.filterModalSection}>
              <Text style={styles.filterModalLabel}>Actieve filters</Text>
              <View style={styles.filterModalActiveWrap}>
                {activeFilterChips.map((chip) => (
                  <View key={chip} style={styles.filterModalActiveChip}>
                    <Text style={styles.filterModalActiveChipText}>{chip}</Text>
                  </View>
                ))}
                {searchQuery ? (
                  <View style={styles.filterModalActiveChip}>
                    <Text style={styles.filterModalActiveChipText}>Zoek: {searchQuery}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.filterModalSection}>
              <Text style={styles.filterModalLabel}>Actieve filters</Text>
              <View style={styles.filterModalField}>
                <View>
                  <Text style={styles.filterModalFieldLabel}>Status</Text>
                  <Text style={styles.filterModalFieldValue}>Geen actieve filters</Text>
                </View>
                <AppIcon
                  name="check-circle-outline"
                  size={18}
                  color={FinColors.textMuted}
                  variant="outlined"
                />
              </View>
            </View>
          )}

          <View style={styles.filterModalSection}>
            <Text style={styles.filterModalLabel}>Meer</Text>
            <TouchableOpacity
              style={styles.filterModalLinkCard}
              onPress={() => {
                setFilterModalOpen(false);
                router.push("/category-budget-groups");
              }}
            >
              <View>
                <Text style={styles.filterModalLinkTitle}>Categorie-indeling</Text>
                <Text style={styles.filterModalLinkText}>
                  Beheer hoe categorieen zijn opgebouwd en gegroepeerd.
                </Text>
              </View>
              <AppIcon name="chevron-right" size={20} color={FinColors.textSecondary} variant="outlined" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </FinanceBottomSheetShell>

      <FinanceMonthSelectorModal
        visible={periodModalOpen}
        monthOptions={resolvedMonthOptions}
        selectedKey={activeMonthKey}
        allowAllMonths
        allMonthsLabel="Alle maanden"
        onClose={() => setPeriodModalOpen(false)}
        onConfirm={handleApplyMonthFilter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  rootWide: {
    alignItems: "center",
  },
  list: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
  },
  headerBlock: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 14,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(246,245,242,0.84)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.05)",
  },
  topBarInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  heroShell: {
    marginHorizontal: -16,
  },
  heroInner: {
    paddingTop: 102,
    paddingBottom: 32,
    gap: 18,
  },
  contentMax: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  heroTitle: {
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -1.8,
    fontWeight: "900",
    color: FinColors.textPrimary,
  },
  heroCopy: {
    fontSize: 18,
    lineHeight: 26,
    color: FinColors.textSecondary,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 18,
  },
  periodLauncher: {
    flex: 1,
    minHeight: 54,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.10)",
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  periodLauncherText: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
    flex: 1,
  },
  filterIconWrap: {
    width: 48,
    height: 48,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  filterIconButton: {
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.10)",
  },
  filterIconBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  filterIconBadgeText: {
    fontSize: 11,
    fontWeight: "800",
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
  activeFiltersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  activeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#f8efc6",
    borderWidth: 1,
    borderColor: "#e2cc7e",
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6f5c00",
  },
  clearLink: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  clearLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
    textDecorationLine: "underline",
  },
  sectionLead: {
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionLeadLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 188,
    backgroundColor: "transparent",
  },
  sectionHeader: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  emptyCard: {
    marginTop: 20,
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  emptyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
    justifyContent: "center",
  },
  emptyActionButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionPrimary: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  emptyActionPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.bgCard,
  },
  loadingIndicator: {
    marginVertical: 10,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    gap: 12,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  pagerNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  pagerIconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pagerIconButtonPrimary: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  pagerButtonDisabled: {
    opacity: 0.45,
  },
  pageStatus: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 120,
  },
  pageNumber: {
    textAlign: "left",
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  pageMeta: {
    marginTop: 2,
    textAlign: "left",
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textMuted,
  },
  bottomNavShell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  bottomNav: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
  },
  bottomNavItemActive: {
    backgroundColor: FinColors.yellow,
  },
  bottomNavLabel: {
    marginTop: 4,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  filterModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.22)",
  },
  filterModalCard: {
    maxHeight: "86%",
    backgroundColor: FinColors.bgBase,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: "rgba(17,17,17,0.05)",
  },
  filterModalHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: FinColors.border,
    marginBottom: 16,
  },
  filterModalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  filterModalHeaderMain: {
    flex: 1,
  },
  filterModalTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  filterModalSub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  filterModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  filterModalScroll: {
    marginTop: 18,
  },
  filterModalBody: {
    minHeight: 0,
  },
  filterModalFooter: {
    marginTop: 18,
  },
  filterModalScrollContent: {
    paddingBottom: 20,
    gap: 18,
  },
  filterModalSection: {
    gap: 12,
  },
  filterModalLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "800",
    color: FinColors.textMuted,
  },
  filterModalField: {
    minHeight: 64,
    borderRadius: 22,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterModalFieldLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  filterModalFieldValue: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  filterModalChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterModalChip: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalChipActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  filterModalChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  filterModalChipTextActive: {
    color: FinColors.textPrimary,
  },
  filterModalActiveWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterModalActiveChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  filterModalActiveChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  filterModalLinkCard: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterModalLinkTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  filterModalLinkText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textSecondary,
  },
  filterModalActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 6,
  },
  filterModalSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    borderWidth: 1,
    borderColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  filterModalPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  bottomNavLabelActive: {
    color: FinColors.textPrimary,
  },
});
