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

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: any }) {
  const isPos = tx.amount >= 0;
  return (
    <View style={styles.txRow}>
      <View style={styles.txIconWrap}>
        <Text style={styles.txIconText}>
          {(tx.counterparty || "?").charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>
          {tx.counterparty || "Unknown"}
        </Text>
        <Text style={styles.txSub} numberOfLines={1}>
          {tx.date}
        </Text>
      </View>
      <Text style={[styles.txAmount, isPos && styles.txAmountPos]}>
        {isPos ? "+" : ""}{fmt.format(tx.amount)}
      </Text>
    </View>
  );
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: FinColors.green }]}>{value}</Text>
    </View>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [balance, setBalance] = React.useState(0);
  const [monthlySpent, setMonthlySpent] = React.useState(0);
  const [monthlyIncome, setMonthlyIncome] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select("id,details,counterparty,date,amount,metadata")
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .limit(50);

      if (!data) return;
      const rows = data.map((r: any) => {
        const md = r.metadata || {};
        const details = String(r.details || "");
        const rawSeq = String(md["Volgnr"] || "").replace(/^0+/, "");
        const saldoRaw = md["Saldo na trn"];
        let runningBalance: number | null = null;
        if (saldoRaw != null) {
          const n = parseFloat(String(saldoRaw).replace(/\./g, "").replace(",", "."));
          runningBalance = isNaN(n) ? null : n;
        }
        return {
          id: r.id,
          counterparty: String(r.counterparty || "").trim(),
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

      // Calculate monthly totals
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthTxs = data.filter((r: any) => r.date >= monthStart);
      const spent = monthTxs.filter((r: any) => r.amount < 0).reduce((s: number, r: any) => s + Math.abs(r.amount), 0);
      const income = monthTxs.filter((r: any) => r.amount > 0).reduce((s: number, r: any) => s + r.amount, 0);
      setMonthlySpent(spent);
      setMonthlyIncome(income);
    } catch (e) {
      console.error("[v0] dashboard load error", e);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.headerTitle}>Jan de Vries</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JD</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{fmt.format(balance)}</Text>
          <View style={styles.accountRow}>
            <View style={styles.accountDot} />
            <Text style={styles.accountText}>Main Account</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill label="Income" value={`+${fmt.format(monthlyIncome || 3420)}`} accent />
          <StatPill label="Expenses" value={fmt.format(monthlySpent || 1250)} />
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/csv-import")}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>+</Text>
            </View>
            <Text style={styles.actionLabel}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/transactions")}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>...</Text>
            </View>
            <Text style={styles.actionLabel}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>$</Text>
            </View>
            <Text style={styles.actionLabel}>Budget</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push("/transactions")}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txCard}>
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
  
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  greeting: { fontSize: 14, color: FinColors.textMuted, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: FinColors.textPrimary, letterSpacing: -0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: FinColors.textSecondary, fontWeight: "600", fontSize: 14 },

  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  // Balance card — premium dark card style
  balanceCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  balanceLabel: { fontSize: 13, color: FinColors.textMuted, fontWeight: "500", marginBottom: 8 },
  balanceAmount: { fontSize: 42, fontWeight: "700", color: FinColors.textPrimary, letterSpacing: -1 },
  accountRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  accountDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: FinColors.green },
  accountText: { fontSize: 13, color: FinColors.textSecondary, fontWeight: "500" },

  // Stats row
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statPill: {
    flex: 1,
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  statLabel: { fontSize: 12, color: FinColors.textMuted, fontWeight: "500", marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "700", color: FinColors.textPrimary },

  // Quick actions
  actionsRow: { flexDirection: "row", justifyContent: "center", gap: 32, marginTop: 28, marginBottom: 12 },
  actionBtn: { alignItems: "center", gap: 8 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconText: { fontSize: 20, color: FinColors.textPrimary, fontWeight: "500" },
  actionLabel: { fontSize: 12, color: FinColors.textMuted, fontWeight: "500" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: FinColors.textPrimary },
  seeAll: { fontSize: 13, color: FinColors.textMuted, fontWeight: "500" },

  // Transaction card
  txCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },

  // Transaction row
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12 },
  txIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: FinColors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  txIconText: { fontSize: 15, fontWeight: "600", color: FinColors.textSecondary },
  txMid: { flex: 1 },
  txName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 3 },
  txAmount: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txAmountPos: { color: FinColors.green },
  
  divider: { height: 1, backgroundColor: FinColors.borderSubtle, marginLeft: 68 },
  emptyText: { fontSize: 14, color: FinColors.textMuted, textAlign: "center", paddingVertical: 24 },
});
