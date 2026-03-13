import { BudgetCategoryProgressRow } from "@/components/budget-category-progress-row";
import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { computeBudgetPlan } from "@/services/budget-plan";
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
import type {
    BudgetPlanComputation,
    CategoryRecord,
} from "@/types/categorization";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
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

function getBudgetCategoryIconName(categoryKey: string) {
  if (categoryKey === "fixed_costs") return "home-work";
  if (categoryKey === "subscriptions") return "subscriptions";
  if (categoryKey === "groceries") return "shopping-basket";
  if (categoryKey === "fuel") return "local-gas-station";
  if (categoryKey === "smoking") return "smoking-rooms";
  return "payments";
}

function formatShortDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatWeekRangeLabel(startDate: string, endDateExclusive: string) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) {
    return `${formatShortDateLabel(startDate)} - ${formatShortDateLabel(endDateExclusive)}`;
  }
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const endIso = endDate.toISOString().slice(0, 10);
  return `${formatShortDateLabel(startDate)} - ${formatShortDateLabel(endIso)}`;
}

function formatRemainingDaysInWeekLabel(
  endDateExclusive: string,
  now = new Date(),
) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) return null;

  const utcToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayDiff = Math.ceil(
    (endDate.getTime() - utcToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  const remainingDays = Math.max(0, Math.min(7, dayDiff));
  const dayLabel = remainingDays === 1 ? "dag" : "dagen";
  return `${remainingDays} ${dayLabel} resterend`;
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

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
          {tx.counterparty || "Onbekend"}
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
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [monthlySpent, setMonthlySpent] = React.useState<number | null>(null);
  const [monthlyIncome, setMonthlyIncome] = React.useState<number | null>(null);
  const budgetLoadInFlight = React.useRef(false);
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
  const remainingBudget = React.useMemo(() => {
    if (!budgetPlan) return null;
    const coreMonthToDateExpenses =
      budgetPlan.monthToDateExpenses.fixedCosts +
      budgetPlan.monthToDateExpenses.subscriptions +
      budgetPlan.monthToDateExpenses.variableCosts;
    return budgetPlan.monthlyBudgetTotal - coreMonthToDateExpenses;
  }, [budgetPlan]);
  const monthSpentInBudget = React.useMemo(() => {
    if (!budgetPlan) return null;
    return (
      budgetPlan.monthToDateExpenses.fixedCosts +
      budgetPlan.monthToDateExpenses.subscriptions +
      budgetPlan.monthToDateExpenses.variableCosts
    );
  }, [budgetPlan]);
  const topCategoryRows = React.useMemo(() => {
    if (!budgetPlan) return [];

    return budgetPlan.recommendations
      .filter(
        (row) =>
          row.categoryKey !== "savings_target" &&
          row.categoryKey !== "variable_costs",
      )
      .sort((left, right) => {
        if (right.monthlyActual !== left.monthlyActual) {
          return right.monthlyActual - left.monthlyActual;
        }
        return right.utilization - left.utilization;
      })
      .slice(0, 5);
  }, [budgetPlan]);
  const currentWeekPlan = React.useMemo(() => {
    if (!budgetPlan) return null;
    return (
      budgetPlan.weeklyVariablePlan.find((week) => week.isCurrentWeek) || null
    );
  }, [budgetPlan]);
  const currentWeekRemainingDays = React.useMemo(() => {
    if (!currentWeekPlan) return null;
    return formatRemainingDaysInWeekLabel(currentWeekPlan.endDateExclusive);
  }, [currentWeekPlan]);
  const criticalBudgetRows = React.useMemo(
    () => topCategoryRows.filter((row) => row.utilization >= 1),
    [topCategoryRows],
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

  const loadBudgetWidget = React.useCallback(async () => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      return;
    }
    if (budgetLoadInFlight.current) {
      return;
    }

    budgetLoadInFlight.current = true;
    try {
      const plan = await computeBudgetPlan(new Date(), "default");
      setBudgetPlan(plan);
    } catch (error) {
      if (isMissingRelationError(error)) {
        setBudgetSchemaMissing(true);
        setBudgetPlan(null);
        return;
      }

      console.error("[v0] dashboard budget widget load error", error);
      setBudgetPlan(null);
    } finally {
      budgetLoadInFlight.current = false;
    }
  }, [budgetSchemaMissing]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadCategories();
  }, [isFocused, loadCategories]);

  React.useEffect(() => {
    if (!isFocused) return;
    void load();
    void loadBudgetWidget();
  }, [isFocused, load, loadBudgetWidget]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadCategories();
    void load();
    void loadBudgetWidget();
  }, [
    backgroundStatus.lastCompletedAt,
    isFocused,
    load,
    loadBudgetWidget,
    loadCategories,
  ]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welkom terug</Text>
          <Text style={styles.headerTitle}>Jan de Vries</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <HeaderDropdownMenu />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Totaal saldo</Text>
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
                ? "Hoofdrekening"
                : "Importeer transacties om saldo te tonen"}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill
            label="Inkomsten"
            value={
              hasTransactions && monthlyIncome != null
                ? `+${fmt.format(monthlyIncome)}`
                : "Nog geen data"
            }
            accent
            isEmpty={!hasTransactions}
          />
          <StatPill
            label="Uitgaven"
            value={
              hasTransactions && monthlySpent != null
                ? fmt.format(monthlySpent)
                : "Nog geen data"
            }
            isEmpty={!hasTransactions}
          />
        </View>

        <Pressable
          style={styles.budgetWidgetCard}
          onPress={() => router.push("/budget")}
        >
          <View style={styles.budgetWidgetHeader}>
            <Text style={styles.budgetWidgetTitle}>Budget huidige maand</Text>
            <View style={styles.budgetWidgetHintWrap}>
              <Text style={styles.budgetWidgetHint}>Bekijk</Text>
              <MaterialIcons
                name="chevron-right"
                size={16}
                color={FinColors.green}
              />
            </View>
          </View>
          {budgetPlan ? (
            <>
              <View style={styles.budgetMainRow}>
                <Text style={styles.budgetMainLabel}>Totaal budget maand</Text>
                <Text style={[styles.budgetMainValue]}>
                  {fmt.format(budgetPlan.monthlyBudgetTotal)}
                </Text>
              </View>
              <View style={styles.budgetMainRow}>
                <Text style={styles.budgetMainLabel}>
                  Uitgegeven deze maand
                </Text>
                <Text style={styles.budgetMainValue}>
                  {monthSpentInBudget == null
                    ? "Onbekend"
                    : fmt.format(monthSpentInBudget)}
                </Text>
              </View>
              <View style={styles.budgetMainRow}>
                <Text style={styles.budgetMainLabel}>Resterend budget</Text>
                <Text
                  style={[
                    styles.budgetMainValue,
                    styles.budgetMainValuePrimary,
                    remainingBudget != null && remainingBudget >= 0
                      ? styles.budgetValuePositive
                      : styles.budgetValueNegative,
                  ]}
                >
                  {remainingBudget == null
                    ? "Onbekend"
                    : fmt.format(remainingBudget)}
                </Text>
              </View>

              {currentWeekPlan ? (
                <View style={styles.currentWeekBox}>
                  <View style={styles.currentWeekTopRow}>
                    <Text style={styles.currentWeekLabel}>Huidige week</Text>
                    <Text style={styles.currentWeekWeekText}>
                      {currentWeekPlan.label}
                    </Text>
                  </View>
                  <Text style={styles.currentWeekMeta}>
                    {formatWeekRangeLabel(
                      currentWeekPlan.startDate,
                      currentWeekPlan.endDateExclusive,
                    )}
                  </Text>
                  {currentWeekRemainingDays ? (
                    <Text style={styles.currentWeekMetaHighlight}>
                      {currentWeekRemainingDays}
                    </Text>
                  ) : null}
                  <Text style={styles.currentWeekMeta}>
                    {fmt.format(currentWeekPlan.actual)} van{" "}
                    {fmt.format(currentWeekPlan.budget)} gebruikt
                  </Text>
                </View>
              ) : null}

              {criticalBudgetRows.length ? (
                <View style={styles.budgetWarningBox}>
                  <MaterialIcons
                    name="priority-high"
                    size={14}
                    color={FinColors.red}
                  />
                  <Text style={styles.budgetWarningText}>
                    {criticalBudgetRows.length} categorie
                    {criticalBudgetRows.length > 1 ? "en" : ""} boven budget.
                  </Text>
                </View>
              ) : null}

              {topCategoryRows.length ? (
                <View style={styles.variableWidgetSection}>
                  {topCategoryRows.map((row) => {
                    return (
                      <BudgetCategoryProgressRow
                        key={`top-category-${row.categoryKey}`}
                        label={row.label}
                        iconName={getBudgetCategoryIconName(row.categoryKey)}
                        utilization={row.utilization}
                        actual={row.monthlyActual}
                        budget={row.monthlyBudget}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.budgetEmptyText}>
              {budgetSchemaMissing
                ? "Budgetschema nog niet beschikbaar in deze omgeving."
                : "Budgetgegevens laden..."}
            </Text>
          )}
        </Pressable>

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
            <Text style={styles.actionLabel}>Alles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/budget")}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>$</Text>
            </View>
            <Text style={styles.actionLabel}>Budget</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recente transacties</Text>
          <TouchableOpacity onPress={() => router.push("/transactions")}>
            <Text style={styles.seeAll}>Alles bekijken</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txCard}>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>Nog geen transacties</Text>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  greeting: { fontSize: 14, color: FinColors.textSecondary, marginBottom: 4 },
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
    color: FinColors.textSecondary,
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
    color: FinColors.textSecondary,
    fontWeight: "500",
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: "700", color: FinColors.textPrimary },
  emptyAmountText: {
    fontSize: 16,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  budgetWidgetCard: {
    marginTop: 16,
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    gap: 10,
  },
  budgetWidgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetWidgetHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  budgetWidgetTitle: {
    fontSize: 15,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  budgetWidgetHint: {
    fontSize: 12,
    color: FinColors.green,
    fontWeight: "700",
  },
  budgetMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetMainLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  budgetMainValue: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  budgetMainValuePrimary: {
    fontSize: 16,
    fontWeight: "800",
  },
  budgetValuePositive: {
    color: FinColors.green,
  },
  budgetValueNegative: {
    color: FinColors.red,
  },
  budgetTopList: {
    marginTop: 4,
    gap: 6,
  },
  budgetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetTopLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  budgetTopLabel: {
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  budgetTopValue: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  budgetTopValueCritical: {
    color: FinColors.red,
  },
  budgetWarningBox: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.red,
    backgroundColor: FinColors.redBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  budgetWarningText: {
    flex: 1,
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  currentWeekBox: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  currentWeekTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  currentWeekLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  currentWeekWeekText: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  currentWeekMeta: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  currentWeekMetaHighlight: {
    fontSize: 12,
    color: FinColors.green,
    fontWeight: "700",
  },
  variableWidgetSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 8,
    gap: 8,
  },
  budgetEmptyText: {
    fontSize: 12,
    color: FinColors.textMuted,
    lineHeight: 18,
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
  actionLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "500",
  },

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
  seeAll: { fontSize: 13, color: FinColors.green, fontWeight: "600" },

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
    color: FinColors.textSecondary,
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
    color: FinColors.textSecondary,
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
