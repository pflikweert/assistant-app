import { TransactionCategoryIcon } from "@/components/category-icon";
import { FinColors } from "@/constants/theme";
import { getTransactionCategories } from "@/services/categorization-repository";
import {
    formatCategorizationStatus,
    useCategorizationStatus,
} from "@/services/categorization-status";
import {
    buildCategoryRecordMap,
    getCategorizationCoverage,
    getCategoryPathLabel,
} from "@/services/category-display";
import { supabase } from "@/services/supabase";
import type { CategoryRecord } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type DashboardTx = {
  id: string;
  counterparty: string;
  date: string;
  amount: number;
  seq: number;
  runningBalance: number | null;
  category_id_auto: string | null;
  category_id_user: string | null;
};

type DashboardTxRow = DashboardTx & { categoryLabel: string };

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({
  tx,
  categoryMap,
}: {
  tx: DashboardTxRow;
  categoryMap: Map<string, CategoryRecord>;
}) {
  const isPos = tx.amount >= 0;
  return (
    <View style={styles.txRow}>
      <View style={styles.txIconWrap}>
        <TransactionCategoryIcon row={tx} categoryById={categoryMap} />
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>
          {tx.counterparty || "Unknown"}
        </Text>
        <View style={styles.txMetaRow}>
          <Text style={styles.txSub} numberOfLines={1}>
            {tx.date}
          </Text>
          <Text style={styles.txCategory}>{tx.categoryLabel}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, isPos && styles.txAmountPos]}>
        {isPos ? "+" : ""}
        {fmt.format(tx.amount)}
      </Text>
    </View>
  );
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  accent,
  isEmpty,
}: {
  label: string;
  value: string;
  accent?: boolean;
  isEmpty?: boolean;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          accent && !isEmpty && { color: FinColors.green },
          isEmpty && styles.emptyAmountText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<DashboardTx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [monthlySpent, setMonthlySpent] = React.useState<number | null>(null);
  const [monthlyIncome, setMonthlyIncome] = React.useState<number | null>(null);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );
  const coverage = React.useMemo(
    () => getCategorizationCoverage(transactions),
    [transactions],
  );
  const hasTransactions = transactions.length > 0;
  const recentTransactions = React.useMemo<DashboardTxRow[]>(
    () =>
      transactions.map((tx) => ({
        ...tx,
        categoryLabel: getCategoryPathLabel(tx, categoryMap),
      })),
    [transactions, categoryMap],
  );

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.error("[v0] dashboard categories error", error);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select(
          "id,counterparty,date,amount,metadata,category_id_auto,category_id_user",
        )
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .limit(50);

      if (!data) return;
      const rows: DashboardTx[] = data.map((r: any) => {
        const md = r.metadata || {};
        const rawSeq = String(md["Volgnr"] || "").replace(/^0+/, "");
        const saldoRaw = md["Saldo na trn"];
        let runningBalance: number | null = null;
        if (saldoRaw != null) {
          const n = parseFloat(
            String(saldoRaw).replace(/\./g, "").replace(",", "."),
          );
          runningBalance = isNaN(n) ? null : n;
        }
        return {
          id: r.id,
          counterparty: String(r.counterparty || "").trim(),
          date: r.date,
          amount: r.amount,
          seq: parseInt(rawSeq || "0", 10) || 0,
          runningBalance,
          category_id_auto: r.category_id_auto || null,
          category_id_user: r.category_id_user || null,
        };
      });
      rows.sort((a, b) =>
        a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1,
      );

      if (!rows.length) {
        setTransactions([]);
        setBalance(null);
        setMonthlySpent(null);
        setMonthlyIncome(null);
        return;
      }

      setTransactions(rows.slice(0, 5));

      const latestBalance =
        rows.find((r) => r.runningBalance != null)?.runningBalance ?? null;
      setBalance(latestBalance);

      // Calculate monthly totals
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const monthTxs = data.filter((r: any) => r.date >= monthStart);
      const spent = monthTxs
        .filter((r: any) => r.amount < 0)
        .reduce((s: number, r: any) => s + Math.abs(r.amount), 0);
      const income = monthTxs
        .filter((r: any) => r.amount > 0)
        .reduce((s: number, r: any) => s + r.amount, 0);
      setMonthlySpent(spent);
      setMonthlyIncome(income);
    } catch (e) {
      console.error("[v0] dashboard load error", e);
    }
  }, []);

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text
            style={[
              styles.balanceAmount,
              !hasTransactions && styles.emptyAmountText,
            ]}
          >
            {hasTransactions && balance != null
              ? fmt.format(balance)
              : "Nog geen data"}
          </Text>
          <View style={styles.accountRow}>
            <View style={styles.accountDot} />
            <Text style={styles.accountText}>
              {hasTransactions
                ? "Main Account"
                : "Importeer transacties om saldo te tonen"}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill
            label="Income"
            value={
              hasTransactions && monthlyIncome != null
                ? `+${fmt.format(monthlyIncome)}`
                : "Nog geen data"
            }
            accent
            isEmpty={!hasTransactions}
          />
          <StatPill
            label="Expenses"
            value={
              hasTransactions && monthlySpent != null
                ? fmt.format(monthlySpent)
                : "Nog geen data"
            }
            isEmpty={!hasTransactions}
          />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Categorisatie</Text>
            <Text style={styles.statusValue}>
              {coverage.total
                ? `${coverage.categorized}/${coverage.total}`
                : "0/0"}
            </Text>
          </View>
          <Text style={styles.statusSubtext}>
            {coverage.uncategorized === 0
              ? "Alle recente transacties zijn gecategoriseerd."
              : `${coverage.uncategorized} transacties hebben nog review nodig.`}
          </Text>
          <View style={styles.statusBarTrack}>
            <View
              style={[
                styles.statusBarFill,
                {
                  width: `${coverage.total ? Math.round((coverage.categorized / coverage.total) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <View style={styles.statusMetaRow}>
            <Text style={styles.statusMetaText}>Auto: {coverage.auto}</Text>
            <Text style={styles.statusMetaText}>
              Handmatig: {coverage.manual}
            </Text>
          </View>
          <View style={styles.backgroundStatusBox}>
            <Text style={styles.backgroundStatusLabel}>Achtergrondstatus</Text>
            <Text style={styles.backgroundStatusText}>
              {formatCategorizationStatus(backgroundStatus)}
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/csv-import")}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>+</Text>
            </View>
            <Text style={styles.actionLabel}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/transactions")}
          >
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
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            recentTransactions.map((tx, i) => (
              <React.Fragment key={tx.id}>
                <TxRow tx={tx} categoryMap={categoryMap} />
                {i < recentTransactions.length - 1 && (
                  <View style={styles.divider} />
                )}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
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
  avatarText: {
    color: FinColors.textSecondary,
    fontWeight: "600",
    fontSize: 14,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  // Balance card — premium dark card style
  balanceCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  balanceLabel: {
    fontSize: 13,
    color: FinColors.textMuted,
    fontWeight: "500",
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -1,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FinColors.green,
  },
  accountText: {
    fontSize: 13,
    color: FinColors.textSecondary,
    fontWeight: "500",
  },

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
  statLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "500",
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: "700", color: FinColors.textPrimary },
  emptyAmountText: {
    fontSize: 16,
    color: FinColors.textMuted,
    fontWeight: "600",
  },

  // Quick actions
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginTop: 28,
    marginBottom: 12,
  },
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
  actionIconText: {
    fontSize: 20,
    color: FinColors.textPrimary,
    fontWeight: "500",
  },
  actionLabel: { fontSize: 12, color: FinColors.textMuted, fontWeight: "500" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
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
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  txIconWrap: {
    marginRight: 14,
  },
  txMid: { flex: 1 },
  txName: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
    flexWrap: "wrap",
  },
  txSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 3 },
  txCategory: {
    fontSize: 11,
    color: FinColors.textPrimary,
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  txAmount: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  txAmountPos: { color: FinColors.green },

  statusCard: {
    marginTop: 16,
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  statusValue: { fontSize: 14, fontWeight: "700", color: FinColors.green },
  statusSubtext: {
    fontSize: 12,
    color: FinColors.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  statusBarTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  statusBarFill: {
    height: "100%",
    backgroundColor: FinColors.green,
    borderRadius: 999,
  },
  statusMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusMetaText: { fontSize: 12, color: FinColors.textSecondary },
  backgroundStatusBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
  },
  backgroundStatusLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    marginBottom: 6,
  },
  backgroundStatusText: {
    fontSize: 13,
    color: FinColors.textPrimary,
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 68,
  },
  emptyText: {
    fontSize: 14,
    color: FinColors.textMuted,
    textAlign: "center",
    paddingVertical: 24,
  },
});
