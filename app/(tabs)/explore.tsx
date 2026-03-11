import React from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/services/supabase";
import { FinColors } from "@/constants/theme";

const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const PAGE_SIZE = 30;

const FILTER_PILLS = ["All", "Income", "Expenses"];

type Tx = {
  id: string;
  counterparty: string;
  omschrijving1: string;
  date: string;
  amount: number;
  seq: number;
};

function TxItem({ item }: { item: Tx }) {
  const isPos = item.amount >= 0;
  return (
    <View style={styles.txRow}>
      <View style={styles.iconBubble}>
        <Text style={styles.iconText}>
          {(item.counterparty || "?").charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>{item.counterparty || "Unknown"}</Text>
        <Text style={styles.txSub} numberOfLines={1}>{item.omschrijving1}</Text>
      </View>
      <Text style={[styles.txAmount, isPos && styles.txAmountPos]}>
        {isPos ? "+" : ""}{fmt.format(item.amount)}
      </Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const label = title === today ? "Today" : title === yesterday ? "Yesterday" : title;
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function TransactionsTab() {
  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [filter, setFilter] = React.useState("All");

  const loadPage = React.useCallback(async (p: number) => {
    setLoading(true);
    try {
      const start = p * PAGE_SIZE;
      const { data } = await supabase
        .from("transactions")
        .select("id,details,counterparty,date,amount,metadata")
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .range(start, start + PAGE_SIZE - 1);

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
        };
      });
      rows.sort((a, b) => a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1);
      setTransactions(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.error("[v0] transactions load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadPage(page); }, [loadPage, page]);
  useFocusEffect(React.useCallback(() => { loadPage(page); }, [loadPage, page]));

  const filtered = React.useMemo(() => {
    if (filter === "Income") return transactions.filter(t => t.amount > 0);
    if (filter === "Expenses") return transactions.filter(t => t.amount < 0);
    return transactions;
  }, [transactions, filter]);

  const sections = React.useMemo(() => {
    const map: Record<string, Tx[]> = {};
    filtered.forEach(tx => {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    });
    return Object.entries(map).map(([date, data]) => ({ title: date, data }));
  }, [filtered]);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Transactions</Text>
      </View>

      {/* Filter pills */}
      <View style={styles.pillRow}>
        {FILTER_PILLS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.pill, filter === p && styles.pillActive]}
            onPress={() => setFilter(p)}
          >
            <Text style={[styles.pillText, filter === p && styles.pillTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color={FinColors.textSecondary} style={{ marginVertical: 12 }} />}

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        renderItem={({ item, index, section }) => (
          <>
            <TxItem item={item} />
            {index < section.data.length - 1 && <View style={styles.divider} />}
          </>
        )}
        ListEmptyComponent={() =>
          !loading ? <Text style={styles.empty}>No transactions found.</Text> : null
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Pager */}
      <View style={styles.pager}>
        <TouchableOpacity
          style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
          onPress={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          <Text style={[styles.pageBtnText, page === 0 && { opacity: 0.4 }]}>Previous</Text>
        </TouchableOpacity>
        <Text style={styles.pageNum}>{page + 1}</Text>
        <TouchableOpacity
          style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
          onPress={() => setPage(p => p + 1)}
          disabled={!hasMore || loading}
        >
          <Text style={[styles.pageBtnText, !hasMore && { opacity: 0.4 }]}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: FinColors.textPrimary, letterSpacing: -0.5 },

  pillRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 8 },
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
  sectionTitle: { fontSize: 13, fontWeight: "600", color: FinColors.textMuted, textTransform: "uppercase", letterSpacing: 1 },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: FinColors.bgBase,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  iconText: { fontSize: 15, fontWeight: "600", color: FinColors.textSecondary },
  txMid: { flex: 1 },
  txName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 3 },
  txAmount: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txAmountPos: { color: FinColors.green },

  divider: { height: 1, backgroundColor: FinColors.borderSubtle, marginLeft: 58 },
  empty: { textAlign: "center", color: FinColors.textMuted, paddingVertical: 40, fontSize: 14 },

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
  pageBtnText: { fontSize: 13, fontWeight: "600", color: FinColors.textPrimary },
  pageNum: { fontSize: 14, color: FinColors.textMuted, fontWeight: "600", minWidth: 24, textAlign: "center" },
});
