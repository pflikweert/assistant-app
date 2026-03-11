import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FinColors } from "@/constants/theme";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/services/supabase";

const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

// ─── Category bar ─────────────────────────────────────────────────────────────
type Category = { label: string; amount: number; color: string };

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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const [totalSpent, setTotalSpent] = React.useState(0);
  const [totalIncome, setTotalIncome] = React.useState(0);
  const [txCount, setTxCount] = React.useState(0);

  const DEMO_CATEGORIES: Category[] = [
    { label: "Groceries", amount: 380, color: CAT_COLORS[0] },
    { label: "Transport", amount: 210, color: CAT_COLORS[1] },
    { label: "Utilities", amount: 155, color: CAT_COLORS[2] },
    { label: "Dining", amount: 290, color: CAT_COLORS[3] },
    { label: "Other", amount: 95, color: CAT_COLORS[4] },
  ];

  const load = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select("amount,details,counterparty,date")
        .order("date", { ascending: false })
        .limit(200);

      if (!data?.length) return;
      setTxCount(data.length);

      const spent = data.filter((r: any) => r.amount < 0).reduce((s: number, r: any) => s + Math.abs(r.amount), 0);
      const income = data.filter((r: any) => r.amount > 0).reduce((s: number, r: any) => s + r.amount, 0);
      setTotalSpent(spent);
      setTotalIncome(income);
    } catch (e) {
      console.error("[v0] insights load error", e);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const netSavings = (totalIncome || 3420) - (totalSpent || 1250);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Insights</Text>
        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>This month</Text>
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
          <Text style={styles.netLabel}>Net this month</Text>
          <Text style={[styles.netValue, netSavings >= 0 && { color: FinColors.green }]}>
            {netSavings >= 0 ? "+" : ""}{fmt.format(netSavings)}
          </Text>
          {txCount > 0 && (
            <Text style={styles.txNote}>{txCount} transactions analysed</Text>
          )}
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          <CategoryBar categories={DEMO_CATEGORIES} />
        </View>

        {/* AI Insights */}
        <Text style={styles.sectionLabel}>Insights</Text>
        <InsightCard
          title="Restaurant spending up"
          text="You spent 30% more on dining this week compared to your monthly average."
        />
        <InsightCard
          title="Subscription review"
          text="You have 7 active subscriptions totalling EUR 120/month. Consider reviewing unused services."
        />
        <InsightCard
          title="Savings on track"
          text="Your grocery spending is 12% lower this month. Great progress!"
        />
      </ScrollView>
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
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  monthBadgeText: { fontSize: 12, fontWeight: "600", color: FinColors.textSecondary },
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

  // Card
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: FinColors.textPrimary, marginBottom: 20 },

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
});
