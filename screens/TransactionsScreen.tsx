import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  buildCategoryNameMap,
  getLeafCategories,
  getCategoryLabel,
} from "@/services/category-display";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
    getTransactionCategories,
    setTransactionManualCategory,
} from "@/services/categorization-repository";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import React from "react";
import {
    ActivityIndicator,
    Button,
    Modal,
    Pressable,
    ScrollView,
    SectionList,
    StyleSheet,
    View,
} from "react-native";

const PAGE_SIZE = 20;
const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

// runningBalance will be added after fetching
type Tx = {
  id: string;
  description: string;
  counterparty: string;
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

export default function TransactionsScreen() {
  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [selectedTx, setSelectedTx] = React.useState<Tx | null>(null);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const borderColor = useThemeColor({ light: "#ccc", dark: "#555" }, "text");

  const categoryById = React.useMemo(() => buildCategoryNameMap(categories), [categories]);

  const leafCategories = React.useMemo(() => {
    const curatedLeaves = getLeafCategories(categories, { curatedOnly: true });
    return curatedLeaves.length ? curatedLeaves : getLeafCategories(categories);
  }, [categories]);

  const otherCategoryId = React.useMemo(
    () =>
      categories.find((c) => c.key === "other_unknown")?.id ||
      categories.find((c) => c.key === "other")?.id ||
      null,
    [categories],
  );

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.warn("loadCategories error", error);
    }
  }, []);

  const loadPage = React.useCallback(async (pageNumber: number) => {
    setLoading(true);
    try {
      const start = pageNumber * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;
      const response = await supabase
        .from("transactions")
        .select(
          "id,details,counterparty,date,amount,metadata,category_id_auto,category_id_user,category_confidence,category_source",
        )
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

        // Keep a deterministic newest-first order when date is equal.
        rows.sort((a, b) => {
          if (a.date === b.date) return b.seq - a.seq;
          return a.date < b.date ? 1 : -1;
        });

        setTransactions(rows);
        setHasMore(rows.length === PAGE_SIZE);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [backgroundStatus.lastCompletedAt, isFocused, loadCategories, loadPage, page]);

  const iconColor = useThemeColor({}, "icon");

  // group by date for section list
  const sections = React.useMemo(() => {
    const map: Record<string, Tx[]> = {};
    transactions.forEach((tx) => {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    });
    return Object.entries(map).map(([date, data]) => ({ title: date, data }));
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

  const setCategory = React.useCallback(
    async (tx: Tx, categoryId: string, reason: string) => {
      setSavingCategory(true);
      try {
        await setTransactionManualCategory(tx.id, categoryId, {
          reason,
          learnFromCounterparty: true,
        });
        await loadPage(page);
      } catch (error) {
        console.warn("setCategory error", error);
      } finally {
        setSavingCategory(false);
      }
    },
    [loadPage, page],
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <ThemedText type="title" style={styles.heading}>
        All transactions
      </ThemedText>

      {loading && <ActivityIndicator style={{ marginVertical: 20 }} />}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <ThemedText type="subtitle" style={styles.sectionHeader}>
            {title}
          </ThemedText>
        )}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: borderColor }]}>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={iconColor}
              style={styles.icon}
            />
            <View style={styles.rowText}>
              <ThemedText style={styles.desc}>
                {item.counterparty || "Onbekende tegenpartij"}
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
                    {`${Math.round(item.categoryConfidence * 100)}% ${item.categorySource || "auto"}`}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.categoryActions}>
                <Pressable
                  style={styles.categoryActionBtn}
                  onPress={() => setSelectedTx(item)}
                >
                  <ThemedText style={styles.categoryActionText}>
                    Wijzig
                  </ThemedText>
                </Pressable>
                {otherCategoryId ? (
                  <Pressable
                    style={styles.categoryActionBtn}
                    disabled={savingCategory}
                    onPress={() =>
                      setCategory(item, otherCategoryId, "quick set other")
                    }
                  >
                    <ThemedText style={styles.categoryActionText}>
                      Snel Overig
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <View style={styles.moneyColumns}>
              <View style={styles.moneyColumn}>
                <ThemedText style={styles.columnLabel}>Bedrag</ThemedText>
                <ThemedText
                  style={[
                    styles.amount,
                    { color: item.amount < 0 ? "#d9534f" : "#5cb85c" },
                  ]}
                >
                  {`${item.amount < 0 ? "-" : "+"}${euroFormatter.format(Math.abs(item.amount))}`}
                </ThemedText>
              </View>
              <View style={styles.moneyColumn}>
                <ThemedText style={styles.columnLabel}>Saldo</ThemedText>
                <ThemedText style={styles.running}>
                  {item.runningBalance == null
                    ? "onbekend"
                    : euroFormatter.format(item.runningBalance)}
                </ThemedText>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={() =>
          !loading ? <ThemedText>No transactions found.</ThemedText> : null
        }
      />

      <Modal
        animationType="slide"
        transparent
        visible={!!selectedTx}
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText type="subtitle">Categorie wijzigen</ThemedText>
            <ThemedText style={styles.modalTxName}>
              {selectedTx?.counterparty || "Onbekende tegenpartij"}
            </ThemedText>
            <ThemedText style={styles.modalTxSub} numberOfLines={2}>
              {selectedTx?.omschrijving1 || selectedTx?.description || ""}
            </ThemedText>

            <ScrollView style={styles.modalList}>
              {leafCategories.map((category) => (
                <Pressable
                  key={category.id}
                  style={styles.modalCategoryButton}
                  disabled={!selectedTx || savingCategory}
                  onPress={async () => {
                    if (!selectedTx) return;
                    await setCategory(
                      selectedTx,
                      category.id,
                      "manual modal correction",
                    );
                    setSelectedTx(null);
                  }}
                >
                  <ThemedText>{category.name}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedTx(null)}
            >
              <ThemedText style={styles.modalCloseText}>Sluiten</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.pager}>
        <Button
          title="Previous"
          onPress={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        />
        <ThemedText style={styles.pageNumber}>Page {page + 1}</ThemedText>
        <Button
          title="Next"
          onPress={() => page >= 0 && setPage((p) => p + 1)}
          disabled={!hasMore || loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  desc: { flex: 1, fontSize: 15 },
  subDesc: { marginTop: 4, fontSize: 13, opacity: 0.8 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(125, 211, 161, 0.18)",
  },
  categoryMeta: {
    fontSize: 11,
    opacity: 0.7,
  },
  categoryActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  categoryActionBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryActionText: {
    fontSize: 11,
    opacity: 0.9,
  },
  amount: { fontSize: 17, fontWeight: "700", textAlign: "right" },
  pager: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  pageNumber: { marginHorizontal: 12 },
  icon: { marginRight: 10, marginTop: 4 },
  rowText: { flex: 1, justifyContent: "center", paddingRight: 8 },
  moneyColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  moneyColumn: {
    minWidth: 98,
    alignItems: "flex-end",
  },
  columnLabel: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 2,
  },
  running: {
    fontSize: 17,
    color: "#888",
    fontWeight: "600",
    textAlign: "right",
  },
  sectionHeader: { marginTop: 12, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "80%",
    backgroundColor: "#171717",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
  },
  modalTxName: { fontWeight: "700", marginTop: 2 },
  modalTxSub: { opacity: 0.75, fontSize: 13 },
  modalList: { marginTop: 8, marginBottom: 8 },
  modalCategoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  modalCloseButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalCloseText: { fontWeight: "600" },
});
