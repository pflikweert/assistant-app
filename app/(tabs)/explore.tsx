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

const MERCHANT_ICONS: Record<string, string> = {
  supermarket: "S",
  grocery: "S",
  gas: "G",
  petrol: "G",
  heating: "H",
  energy: "E",
  salary: "$",
  salaris: "$",
  transfer: "T",
  bank: "B",
};

function merchantIcon(name: string) {
  const n = name.toLowerCase();
  for (const [key, icon] of Object.entries(MERCHANT_ICONS)) {
    if (n.includes(key)) return icon;
  }
  return name.charAt(0).toUpperCase() || "?";
}

const FILTER_PILLS = ["All", "Income", "Expenses", "Transfers"];

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
      <View style={[styles.iconBubble, { backgroundColor: isPos ? FinColors.greenBg : "rgba(148,163,184,0.08)" }]}>
        <Text style={{ color: isPos ? FinColors.green : FinColors.textSecondary, fontSize: 13, fontWeight: "700" }}>
          {merchantIcon(item.counterparty || item.omschrijving1 || "?")}
        </Text>
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>{item.counterparty || "Unknown"}</Text>
        <Text style={styles.txSub} numberOfLines={1}>{item.omschrijving1}</Text>
      </View>
      {isPos ? (
        <View style={styles.posTag}>
          <Text style={styles.posTagText}>+{fmt.format(item.amount)}</Text>
        </View>
      ) : (
        <Text style={styles.negAmt}>{fmt.format(item.amount)}</Text>
      )}
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
    if (filter === "Transfers") return transactions.filter(t => t.counterparty?.toLowerCase().includes("transfer") || t.omschrijving1?.toLowerCase().includes("transfer"));
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

      {loading && <ActivityIndicator color={FinColors.green} style={{ marginVertical: 12 }} />}

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
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Pager */}
      <View style={styles.pager}>
        <TouchableOpacity
          style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
          onPress={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          <Text style={[styles.pageBtnText, page === 0 && { color: FinColors.textMuted }]}>Previous</Text>
        </TouchableOpacity>
        <Text style={styles.pageNum}>Page {page + 1}</Text>
        <TouchableOpacity
          style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
          onPress={() => setPage(p => p + 1)}
          disabled={!hasMore || loading}
        >
          <Text style={[styles.pageBtnText, !hasMore && { color: FinColors.textMuted }]}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: FinColors.textPrimary },

  pillRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 16, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  pillActive: { backgroundColor: FinColors.greenBg, borderColor: FinColors.greenBorder },
  pillText: { fontSize: 12, fontWeight: "600", color: FinColors.textSecondary },
  pillTextActive: { color: FinColors.green },

  sectionHeader: {
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: FinColors.bgBase,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: FinColors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: FinColors.bgBase,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txMid: { flex: 1 },
  txName: { fontSize: 14, fontWeight: "600", color: FinColors.textPrimary },
  txSub: { fontSize: 11, color: FinColors.textMuted, marginTop: 2 },

  posTag: {
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  posTagText: { fontSize: 12, fontWeight: "700", color: FinColors.green },
  negAmt: { fontSize: 14, fontWeight: "600", color: FinColors.textSecondary },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: FinColors.borderSubtle, marginLeft: 52 },
  empty: { textAlign: "center", color: FinColors.textMuted, paddingVertical: 32, fontSize: 14 },

  pager: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: FinColors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontWeight: "600", color: FinColors.textPrimary },
  pageNum: { fontSize: 13, color: FinColors.textSecondary, fontWeight: "600" },
});
