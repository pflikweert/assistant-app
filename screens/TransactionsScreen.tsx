import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/services/supabase";
import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import {
    ActivityIndicator,
    Button,
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
};

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);

  const borderColor = useThemeColor({ light: "#ccc", dark: "#555" }, "text");

  const loadPage = React.useCallback(async (pageNumber: number) => {
    setLoading(true);
    try {
      const start = pageNumber * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;
      const response = await supabase
        .from("transactions")
        .select("id,details,counterparty,date,amount,metadata")
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
    loadPage(page);
  }, [loadPage, page]);

  // refresh when screen is focused (in case import happened elsewhere)
  useFocusEffect(
    React.useCallback(() => {
      loadPage(page);
    }, [loadPage, page]),
  );

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
});
