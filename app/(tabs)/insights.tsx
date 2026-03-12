import React from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FinColors } from "@/constants/theme";
import { useIsFocused } from "@react-navigation/native";
import { getTransactionCategories, setTransactionManualCategory } from "@/services/categorization-repository";
import {
  buildCategoryNameMap,
  formatConfidenceLabel,
  getCategorizationCoverage,
  getCategoryLabel,
  getEffectiveCategoryId,
  getLeafCategories,
  needsCategorizationReview,
} from "@/services/category-display";
import { useCategorizationStatus } from "@/services/categorization-status";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";

const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getMonthBounds(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);

  return {
    start,
    end,
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
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
};

type ReviewableInsightTx = InsightTx & { categoryLabel: string };
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
      <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", gap: 2 }}>
        {categories.map((cat, i) => (
          <View key={i} style={{ flex: cat.amount / total, backgroundColor: cat.color }} />
        ))}
      </View>
      {/* Legend */}
      <View style={{ gap: 12 }}>
        {categories.map((cat, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color }} />
              <Text style={{ fontSize: 14, color: FinColors.textSecondary }}>{cat.label}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: FinColors.textPrimary }}>
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
}: {
  tx: ReviewableInsightTx;
  onPress: (tx: ReviewableInsightTx) => void;
  onConfirm: (tx: ReviewableInsightTx) => void;
  saving: boolean;
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewMain}>
        <Text style={styles.reviewName} numberOfLines={1}>
          {tx.counterparty || "Onbekende tegenpartij"}
        </Text>
        <Text style={styles.reviewSub} numberOfLines={1}>
          {tx.details || tx.date}
        </Text>
        <View style={styles.reviewMetaRow}>
          <Text style={styles.reviewCategory}>{tx.categoryLabel}</Text>
          <Text style={styles.reviewConfidence}>{formatConfidenceLabel(tx)}</Text>
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [transactions, setTransactions] = React.useState<InsightTx[]>([]);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [totalSpent, setTotalSpent] = React.useState(0);
  const [totalIncome, setTotalIncome] = React.useState(0);
  const [txCount, setTxCount] = React.useState(0);
  const [selectedTx, setSelectedTx] = React.useState<ReviewableInsightTx | null>(null);
  const [savingReview, setSavingReview] = React.useState(false);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>({});
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryMap = React.useMemo(() => buildCategoryNameMap(categories), [categories]);
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
        categoryLabel: getCategoryLabel(tx, categoryMap),
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

  const spendingByCategory = React.useMemo<Category[]>(() => {
    const expenseRows = displayTransactions.filter((tx) => tx.amount < 0);
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
  }, [displayTransactions]);

  const reviewQueue = React.useMemo(
    () => displayTransactions.filter((tx) => needsCategorizationReview(tx)).slice(0, 8),
    [displayTransactions],
  );

  const insightCards = React.useMemo(() => {
    const cards: { title: string; text: string }[] = [];
    const topCategory = spendingByCategory[0];

    if (topCategory) {
      const share = totalSpent > 0 ? Math.round((topCategory.amount / totalSpent) * 100) : 0;
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
  }, [coverage.manual, reviewQueue.length, spendingByCategory, totalSpent]);

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
      const { data } = await supabase
        .from("transactions")
        .select(
          "id,amount,details,counterparty,date,category_id_auto,category_id_user,category_confidence,category_source",
        )
        .gte("date", selectedMonth.startIso)
        .lt("date", selectedMonth.endIso)
        .order("date", { ascending: false })
        .limit(300);

      if (!data?.length) {
        setTransactions([]);
        setTxCount(0);
        setTotalSpent(0);
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
      }));

      setTransactions(rows);
      setTxCount(rows.length);

      const spent = rows
        .filter((r) => r.amount < 0)
        .reduce((s, r) => s + Math.abs(r.amount), 0);
      const income = rows
        .filter((r) => r.amount > 0)
        .reduce((s, r) => s + r.amount, 0);
      setTotalSpent(spent);
      setTotalIncome(income);
    } catch (e) {
      console.error("[v0] insights load error", e);
    }
  }, [selectedMonth.endIso, selectedMonth.startIso]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadCategories();
  }, [isFocused, loadCategories]);

  React.useEffect(() => {
    if (!isFocused) return;
    void load();
  }, [isFocused, load]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadCategories();
    void load();
  }, [backgroundStatus.lastCompletedAt, isFocused, load, loadCategories]);

  const handleReviewSave = React.useCallback(
    async (categoryId: string) => {
      if (!selectedTx) return;
      setSavingReview(true);
      try {
        await setTransactionManualCategory(selectedTx.id, categoryId, {
          reason: "insights review",
          learnFromCounterparty: true,
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

  const openReviewModal = React.useCallback((tx: ReviewableInsightTx) => {
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
  }, [categoryToGroupId]);

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
          learnFromCounterparty: true,
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

  const netSavings = (totalIncome || 3420) - (totalSpent || 1250);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Insights</Text>
        <View style={styles.monthBadge}>
          <Pressable
            style={[styles.monthNavButton, monthOffset >= 24 && styles.monthNavButtonDisabled]}
            onPress={() => setMonthOffset((current) => Math.min(current + 1, 24))}
            disabled={monthOffset >= 24}
          >
            <Text style={styles.monthNavButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.monthBadgeText}>{selectedMonth.label}</Text>
          <Pressable
            style={[styles.monthNavButton, monthOffset === 0 && styles.monthNavButtonDisabled]}
            onPress={() => setMonthOffset((current) => Math.max(current - 1, 0))}
            disabled={monthOffset === 0}
          >
            <Text style={styles.monthNavButtonText}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: FinColors.green }]}>
              +{fmt.format(totalIncome || 3420)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>
              {fmt.format(totalSpent || 1250)}
            </Text>
          </View>
        </View>

        {/* Net card */}
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Net in geselecteerde maand</Text>
          <Text style={[styles.netValue, netSavings >= 0 && { color: FinColors.green }]}>
            {netSavings >= 0 ? "+" : ""}{fmt.format(netSavings)}
          </Text>
          {txCount > 0 && (
            <Text style={styles.txNote}>{txCount} transactions analysed</Text>
          )}
        </View>

        <View style={styles.reviewSummaryCard}>
          <View style={styles.reviewSummaryHeader}>
            <Text style={styles.reviewSummaryTitle}>Categorisatiekwaliteit</Text>
            <Text style={styles.reviewSummaryValue}>
              {coverage.total ? `${coverage.categorized}/${coverage.total}` : "0/0"}
            </Text>
          </View>
          <Text style={styles.reviewSummaryText}>
            {reviewQueue.length === 0
              ? "Geen openstaande review-items deze maand."
              : `${reviewQueue.length} transacties moeten nog handmatig worden nagekeken.`}
          </Text>
          <View style={styles.reviewSummaryMeta}>
            <Text style={styles.reviewSummaryMetaText}>Auto: {coverage.auto}</Text>
            <Text style={styles.reviewSummaryMetaText}>Handmatig: {coverage.manual}</Text>
            <Text style={styles.reviewSummaryMetaText}>Open: {coverage.uncategorized}</Text>
          </View>
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          {spendingByCategory.length ? (
            <CategoryBar categories={spendingByCategory} />
          ) : (
            <Text style={styles.emptyStateText}>Nog niet genoeg gecategoriseerde uitgaven om een verdeling te tonen.</Text>
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
                  onPress={openReviewModal}
                  onConfirm={handleQuickConfirm}
                  saving={savingReview}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyStateText}>Alle transacties in deze periode hebben voldoende zekerheid of zijn al bevestigd.</Text>
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
              Kies de juiste categorie. Deze keuze wordt gebruikt om vergelijkbare transacties later automatisch te herkennen.
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
                          <Text style={styles.modalGroupCount}>{group.children.length}</Text>
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
                              <Text style={styles.modalCategoryText}>{category.name}</Text>
                            </Pressable>
                          ))
                        : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.modalEmptyText}>Geen categorieen gevonden voor deze zoekopdracht.</Text>
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
  pageTitle: { fontSize: 28, fontWeight: "700", color: FinColors.textPrimary, letterSpacing: -0.5 },
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
  monthBadgeText: { fontSize: 12, fontWeight: "600", color: FinColors.textSecondary },
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
  summaryLabel: { fontSize: 13, color: FinColors.textMuted, fontWeight: "500", marginBottom: 8 },
  summaryValue: { fontSize: 22, fontWeight: "700", color: FinColors.textPrimary },

  // Net card
  netCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
  },
  netLabel: { fontSize: 13, color: FinColors.textMuted, fontWeight: "500", marginBottom: 8 },
  netValue: { fontSize: 36, fontWeight: "700", color: FinColors.textPrimary, letterSpacing: -1 },
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
  reviewSummaryTitle: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  reviewSummaryValue: { fontSize: 14, fontWeight: "700", color: FinColors.green },
  reviewSummaryText: { fontSize: 13, color: FinColors.textSecondary, marginTop: 10, lineHeight: 20 },
  reviewSummaryMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 12 },
  reviewSummaryMetaText: { fontSize: 12, color: FinColors.textMuted },

  // Card
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: FinColors.textPrimary, marginBottom: 20 },
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
  reviewMain: { flex: 1 },
  reviewName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  reviewSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 4 },
  reviewMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
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
  reviewAmount: { fontSize: 14, fontWeight: "600", color: FinColors.textPrimary },
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
  reviewButtonText: { fontSize: 12, fontWeight: "600", color: FinColors.textPrimary },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
  },
  confirmButtonText: { fontSize: 12, fontWeight: "700", color: FinColors.green },

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
  insightTitle: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary, marginBottom: 8 },
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
  modalName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary, marginTop: 10 },
  modalSub: { fontSize: 13, color: FinColors.textMuted, marginTop: 4, lineHeight: 20 },
  modalHint: { fontSize: 12, color: FinColors.textSecondary, marginTop: 10, lineHeight: 18 },
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
  modalCategoryText: { fontSize: 14, color: FinColors.textPrimary, fontWeight: "600" },
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
  modalCloseText: { fontSize: 14, fontWeight: "600", color: FinColors.textPrimary },
});
