import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
    getTransactionCategories,
    setTransactionManualCategory,
} from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import { requireCurrentUserId } from "@/services/current-user";
import {
    buildCategoryNameMap,
    getCategoryLabel,
} from "@/services/category-display";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { Link } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Button,
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
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const borderColor = useThemeColor({ light: "#ccc", dark: "#555" }, "text");

  const categoryById = React.useMemo(
    () => buildCategoryNameMap(categories),
    [categories],
  );

  const otherCategoryId = React.useMemo(
    () =>
      categories.find((c) => c.key === "other_unknown")?.id ||
      categories.find((c) => c.key === "other")?.id ||
      null,
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
          learnFromCounterparty: false,
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
        Alle transacties
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
          <Link
            href={{ pathname: "/transaction-detail", params: { id: item.id } }}
            asChild
          >
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: borderColor }]}
              activeOpacity={0.7}
            >
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
                    <ThemedText style={styles.categoryMeta}>
                      Handmatig
                    </ThemedText>
                  ) : item.categoryConfidence != null ? (
                    <ThemedText style={styles.categoryMeta}>
                      {`${Math.round(item.categoryConfidence * 100)}% ${item.categorySource || "automatisch"}`}
                    </ThemedText>
                  ) : null}
                </View>
                {otherCategoryId ? (
                  <View style={styles.categoryActions}>
                    <Pressable
                      style={styles.categoryActionBtn}
                      disabled={savingCategory}
                      onPress={(event) => {
                        event.stopPropagation();
                        void setCategory(item, otherCategoryId, "snel overig");
                      }}
                    >
                      <ThemedText style={styles.categoryActionText}>
                        Snel Overig
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
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
            </TouchableOpacity>
          </Link>
        )}
        ListEmptyComponent={() =>
          !loading ? <ThemedText>Geen transacties gevonden.</ThemedText> : null
        }
      />

      <View style={styles.pager}>
        <Button
          title="Vorige"
          onPress={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        />
        <ThemedText style={styles.pageNumber}>Pagina {page + 1}</ThemedText>
        <Button
          title="Volgende"
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
