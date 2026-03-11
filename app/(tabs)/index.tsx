import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { FinColors } from "@/constants/theme";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

// ─── Mini sparkline chart (7 data points) ────────────────────────────────────
function SparkLine({ data }: { data: number[] }) {
  if (!data.length) return null;
  const w = 280;
  const h = 56;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const last = pts[pts.length - 1].split(",");

  // Build SVG via react-native-svg (or fallback to a View chart if unavailable)
  // We use a pure View-based bar chart as RN SVG may not be available
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 48, marginTop: 8 }}>
      {data.map((v, i) => {
        const pct = range === 0 ? 0.5 : (v - min) / range;
        const barH = Math.max(6, pct * 44);
        const isLast = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: barH,
              backgroundColor: isLast ? FinColors.green : "rgba(34,197,94,0.3)",
              borderRadius: 3,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: any }) {
  const isPos = tx.amount >= 0;
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isPos ? FinColors.greenBg : "rgba(248,113,113,0.1)" }]}>
        <Text style={{ fontSize: 14, color: isPos ? FinColors.green : FinColors.red }}>
          {isPos ? "+" : "−"}
        </Text>
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>
          {tx.counterparty || "Unknown"}
        </Text>
        <Text style={styles.txSub} numberOfLines={1}>
          {tx.omschrijving1 || ""}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isPos ? FinColors.green : FinColors.textSecondary }]}>
          {isPos ? "+" : "−"}{fmt.format(Math.abs(tx.amount))}
        </Text>
        <Text style={styles.txDate}>{tx.date}</Text>
      </View>
    </View>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [balance, setBalance] = React.useState(0);
  const [safeToSpend, setSafeToSpend] = React.useState(0);
  const [weeklyData, setWeeklyData] = React.useState<number[]>([]);

  const load = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select("id,details,counterparty,date,amount,metadata")
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .limit(20);

      if (!data) return;
      const rows = data.map((r: any) => {
        const md = r.metadata || {};
        const details = String(r.details || "");
        const rawSeq = String(md["Volgnr"] || "").replace(/^0+/, "");
        const omschrijving1 = details.split("|")[0]?.trim() || details;
        const saldoRaw = md["Saldo na trn"];
        let runningBalance: number | null = null;
        if (saldoRaw != null) {
          const n = parseFloat(String(saldoRaw).replace(/\./g, "").replace(",", "."));
          runningBalance = isNaN(n) ? null : n;
        }
        return {
          id: r.id,
          description: details,
          counterparty: String(r.counterparty || "").trim(),
          omschrijving1,
          date: r.date,
          amount: r.amount,
          seq: parseInt(rawSeq || "0", 10) || 0,
          runningBalance,
        };
      });
      rows.sort((a: any, b: any) =>
        a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1
      );
      setTransactions(rows.slice(0, 5));
      const latestBalance = rows.find((r: any) => r.runningBalance != null)?.runningBalance ?? 0;
      setBalance(latestBalance);
      setSafeToSpend(latestBalance * 0.05);

      // Build weekly spending totals (last 7 days of outgoing)
      const now = new Date();
      const daily: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        daily[d.toISOString().slice(0, 10)] = 0;
      }
      data.forEach((r: any) => {
        if (r.amount < 0 && daily.hasOwnProperty(r.date)) {
          daily[r.date] += Math.abs(r.amount);
        }
      });
      setWeeklyData(Object.values(daily));
    } catch (e) {
      console.error("[v0] dashboard load error", e);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const demoWeekly = weeklyData.some(v => v > 0) ? weeklyData : [120, 85, 210, 60, 175, 90, 145];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Good morning</Text>
          <Text style={styles.headerTitle}>Finance Assistant</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={{ color: FinColors.bgBase, fontWeight: "700", fontSize: 15 }}>JD</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>{fmt.format(balance)}</Text>
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceBadgeText}>Main Account</Text>
          </View>
        </View>

        {/* Safe to spend */}
        <View style={styles.safeCard}>
          <View>
            <Text style={styles.safeLabel}>Safe to spend today</Text>
            <Text style={styles.safeAmount}>{fmt.format(safeToSpend)}</Text>
          </View>
          <View style={styles.safeIcon}>
            <Text style={{ fontSize: 18 }}>✓</Text>
          </View>
        </View>

        {/* Weekly chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly Spending</Text>
            <Text style={styles.cardBadge}>Last 7 days</Text>
          </View>
          <SparkLine data={demoWeekly} />
          <View style={styles.weekLabels}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <Text key={i} style={styles.weekLabel}>{d}</Text>
            ))}
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push("/transactions")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            transactions.map((tx, i) => (
              <React.Fragment key={tx.id}>
                <TxRow tx={tx} />
                {i < transactions.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  headerSub: { fontSize: 13, color: FinColors.textMuted, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: FinColors.textPrimary },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FinColors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },

  // Balance card
  balanceCard: {
    backgroundColor: FinColors.green,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  balanceLabel: { fontSize: 13, color: "rgba(0,0,0,0.55)", fontWeight: "600" },
  balanceAmount: { fontSize: 38, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  balanceBadge: {
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  balanceBadgeText: { fontSize: 11, fontWeight: "600", color: "rgba(0,0,0,0.6)" },

  // Safe to spend
  safeCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
  },
  safeLabel: { fontSize: 12, color: FinColors.textSecondary, marginBottom: 4 },
  safeAmount: { fontSize: 26, fontWeight: "700", color: FinColors.green },
  safeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FinColors.greenBg,
    justifyContent: "center",
    alignItems: "center",
  },

  // Generic card
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: FinColors.textPrimary },
  cardBadge: { fontSize: 11, color: FinColors.textMuted, backgroundColor: FinColors.bgElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  seeAll: { fontSize: 12, color: FinColors.green, fontWeight: "600" },

  weekLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 10, color: FinColors.textMuted },

  // Transaction row
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txMid: { flex: 1, justifyContent: "center" },
  txName: { fontSize: 14, fontWeight: "600", color: FinColors.textPrimary },
  txSub: { fontSize: 11, color: FinColors.textMuted, marginTop: 2 },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 14, fontWeight: "700" },
  txDate: { fontSize: 10, color: FinColors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: FinColors.borderSubtle },
  emptyText: { fontSize: 13, color: FinColors.textMuted, textAlign: "center", paddingVertical: 16 },
});
