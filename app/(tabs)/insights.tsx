import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FinColors } from "@/constants/theme";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/services/supabase";

const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

// ─── Mini donut / category bar ────────────────────────────────────────────────
type Category = { label: string; amount: number; color: string };

const CAT_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#e879f9", "#fb923c", "#64748b"];

function CategoryBar({ categories }: { categories: Category[] }) {
  const total = categories.reduce((s, c) => s + c.amount, 0) || 1;
  return (
    <View style={{ gap: 10 }}>
      {/* bar */}
      <View style={{ flexDirection: "row", height: 8, borderRadius: 8, overflow: "hidden", gap: 2 }}>
        {categories.map((cat, i) => (
          <View key={i} style={{ flex: cat.amount / total, backgroundColor: cat.color }} />
        ))}
      </View>
      {/* legend */}
      <View style={{ gap: 8 }}>
        {categories.map((cat, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
              <Text style={{ fontSize: 13, color: FinColors.textSecondary }}>{cat.label}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Text style={{ fontSize: 13, color: FinColors.textMuted }}>
                {Math.round((cat.amount / total) * 100)}%
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: FinColors.textPrimary, minWidth: 70, textAlign: "right" }}>
                {fmt.format(cat.amount)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ icon, text, accent }: { icon: string; text: string; accent?: boolean }) {
  return (
    <View style={[styles.insightCard, accent && styles.insightCardAccent]}>
      <View style={[styles.insightIcon, accent && styles.insightIconAccent]}>
        <Text style={{ fontSize: 16, color: accent ? "#0f172a" : FinColors.green }}>{icon}</Text>
      </View>
      <Text style={[styles.insightText, accent && { color: "#0f172a" }]}>{text}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const [totalSpent, setTotalSpent] = React.useState(0);
  const [totalIncome, setTotalIncome] = React.useState(0);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [txCount, setTxCount] = React.useState(0);

  const DEMO_CATEGORIES: Category[] = [
    { label: "Groceries", amount: 380, color: CAT_COLORS[0] },
    { label: "Transport", amount: 210, color: CAT_COLORS[1] },
    { label: "Utilities", amount: 155, color: CAT_COLORS[2] },
    { label: "Dining", amount: 290, color: CAT_COLORS[3] },
    { label: "Subscriptions", amount: 120, color: CAT_COLORS[4] },
    { label: "Other", amount: 95, color: CAT_COLORS[5] },
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

  const displayCategories = categories.length ? categories : DEMO_CATEGORIES;
  const netSavings = totalIncome - totalSpent;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Spending Insights</Text>
        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>This month</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Monthly summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={[styles.summaryValue, { color: FinColors.green }]}>
                +{fmt.format(totalIncome || 3420)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={[styles.summaryValue, { color: FinColors.red }]}>
                -{fmt.format(totalSpent || 1250)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={[styles.summaryValue, { color: netSavings >= 0 ? FinColors.green : FinColors.red }]}>
                {netSavings >= 0 ? "+" : ""}{fmt.format(netSavings || 2170)}
              </Text>
            </View>
          </View>
          {txCount > 0 && (
            <Text style={styles.txCountNote}>{txCount} transactions analysed</Text>
          )}
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          <CategoryBar categories={displayCategories} />
        </View>

        {/* AI insights */}
        <Text style={styles.sectionLabel}>AI Insights</Text>
        <InsightCard icon="↑" text="You spent 30% more on restaurants this week compared to last week." />
        <InsightCard icon="!" text="Unusual activity: 3 transactions above €200 this week." />
        <InsightCard icon="✓" text="Great job — your grocery spending is down 12% this month." accent />

        {/* Savings suggestion */}
        <Text style={styles.sectionLabel}>Savings Opportunities</Text>
        <View style={styles.savingCard}>
          <View style={styles.savingHeader}>
            <View style={styles.savingIconWrap}>
              <Text style={{ fontSize: 16, color: FinColors.green }}>$</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingTitle}>Reduce subscriptions</Text>
              <Text style={styles.savingSubtitle}>You have 7 active subscriptions</Text>
            </View>
            <Text style={styles.savingAmount}>€120 / mo</Text>
          </View>
          <Text style={styles.savingBody}>
            You could save <Text style={{ color: FinColors.green, fontWeight: "700" }}>€120 per month</Text> by auditing and cancelling unused subscriptions.
          </Text>
          <TouchableOpacity style={styles.savingBtn}>
            <Text style={styles.savingBtnText}>View subscriptions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.savingCard}>
          <View style={styles.savingHeader}>
            <View style={styles.savingIconWrap}>
              <Text style={{ fontSize: 16, color: FinColors.green }}>↓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingTitle}>Coffee & dining</Text>
              <Text style={styles.savingSubtitle}>High vs. previous month</Text>
            </View>
            <Text style={styles.savingAmount}>€65 / mo</Text>
          </View>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 24, fontWeight: "800", color: FinColors.textPrimary },
  monthBadge: {
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  monthBadgeText: { fontSize: 11, fontWeight: "600", color: FinColors.textSecondary },
  scroll: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },

  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: FinColors.textPrimary, marginBottom: 16 },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 11, color: FinColors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 17, fontWeight: "800" },
  summaryDivider: { width: 1, height: 40, backgroundColor: FinColors.borderSubtle },
  txCountNote: { fontSize: 11, color: FinColors.textMuted, textAlign: "center", marginTop: 14 },

  sectionLabel: { fontSize: 11, fontWeight: "700", color: FinColors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4 },

  insightCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  insightCardAccent: { backgroundColor: FinColors.green, borderColor: FinColors.green },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: FinColors.greenBg,
    justifyContent: "center",
    alignItems: "center",
  },
  insightIconAccent: { backgroundColor: "rgba(0,0,0,0.15)" },
  insightText: { flex: 1, fontSize: 13, color: FinColors.textSecondary, lineHeight: 19 },

  savingCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 12,
  },
  savingHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  savingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: FinColors.greenBg,
    justifyContent: "center",
    alignItems: "center",
  },
  savingTitle: { fontSize: 14, fontWeight: "700", color: FinColors.textPrimary },
  savingSubtitle: { fontSize: 11, color: FinColors.textMuted, marginTop: 2 },
  savingAmount: { fontSize: 15, fontWeight: "800", color: FinColors.green },
  savingBody: { fontSize: 13, color: FinColors.textSecondary, lineHeight: 20 },
  savingBtn: {
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  savingBtnText: { fontSize: 12, fontWeight: "600", color: FinColors.textPrimary },
});
