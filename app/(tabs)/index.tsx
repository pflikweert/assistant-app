import { TransactionCategoryIcon } from "@/components/category-icon";
import { DashboardBalanceSummary } from "@/components/dashboard/dashboard-balance-summary";
import {
  buildDashboardBudgetOverviewModel,
  DashboardBudgetOverviewCard,
} from "@/components/dashboard/dashboard-overview-card";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceHeaderActions } from "@/components/ui/finance-header-actions";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import { AppIcon } from "@/components/ui/app-icon";
import { SplashLoader } from "@/components/motions/SplashLoader";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import {
  parseRunningBalance,
  resolveLatestKnownBalanceSnapshot,
} from "@/services/latest-known-balance";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import type {
  BudgetPlanComputation,
  CategoryRecord,
} from "@/types/categorization";
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
const CONTENT_MAX_WIDTH = 1040;

type DashboardTx = {
  id: string;
  counterparty: string;
  subscriptionProfileName?: string | null;
  date: string;
  amount: number;
  seq: number;
  runningBalance: number | null;
  category_id_auto: string | null;
  category_id_user: string | null;
};

type DashboardTxRow = DashboardTx & { categoryLabel: string };

function formatShortDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function TxRow({
  tx,
  categoryMap,
}: {
  tx: DashboardTxRow;
  categoryMap: Map<string, CategoryRecord>;
}) {
  const isPositive = tx.amount >= 0;

  return (
    <View style={styles.txRow}>
      <View style={styles.txIconWrap}>
        <TransactionCategoryIcon row={tx} categoryById={categoryMap} />
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={2}>
          {tx.subscriptionProfileName || tx.counterparty || "Onbekend"}
        </Text>
        <Text style={styles.txSub} numberOfLines={1}>
          {formatShortDateLabel(tx.date)} • {tx.categoryLabel}
        </Text>
      </View>
      <Text style={[styles.txAmount, isPositive && styles.txAmountPos]}>
        {isPositive ? "+" : ""}
        {fmt.format(tx.amount)}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<DashboardTx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const budgetLoadInFlight = React.useRef(false);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );

  const hasTransactions = transactions.length > 0;
  const dashboardBudgetOverview = React.useMemo(
    () => buildDashboardBudgetOverviewModel(budgetPlan),
    [budgetPlan],
  );

  const recentTransactions = React.useMemo<DashboardTxRow[]>(
    () =>
      transactions.map((tx) => ({
        ...tx,
        categoryLabel: getCategoryPathLabel(tx, categoryMap),
      })),
    [transactions, categoryMap],
  );
  const dashboardPeriodLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("nl-NL", {
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.error("[dashboard] categories error", error);
    }
  }, []);

  const loadDashboard = React.useCallback(async () => {
    try {
      const userId = await requireCurrentUserId();
      const { data } = await supabase
        .from("transactions")
        .select(
          "id,counterparty,date,amount,metadata,category_id_auto,category_id_user",
        )
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .limit(50);

      if (!data) return;

      const rows: DashboardTx[] = data.map((row: any) => {
        const metadata = row.metadata || {};
        const rawSeq = String(metadata["Volgnr"] || "").replace(/^0+/, "");

        return {
          id: row.id,
          counterparty: String(row.counterparty || "").trim(),
          date: row.date,
          amount: row.amount,
          seq: Number.parseInt(rawSeq || "0", 10) || 0,
          runningBalance: parseRunningBalance(metadata),
          category_id_auto: row.category_id_auto || null,
          category_id_user: row.category_id_user || null,
        };
      });

      rows.sort((left, right) =>
        left.date === right.date
          ? right.seq - left.seq
          : left.date < right.date
            ? 1
            : -1,
      );

      const recentRows = rows.slice(0, 3);
      if (recentRows.length) {
        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          recentRows.map((row) => row.id),
        );
        recentRows.forEach((row) => {
          row.subscriptionProfileName = subscriptionNames[row.id] || null;
        });
      }

      if (!rows.length) {
        setTransactions([]);
        setBalance(null);
        return;
      }

      setTransactions(recentRows);

      const latestBalance = resolveLatestKnownBalanceSnapshot(
        (data || []) as {
          date?: string | null;
          metadata?: Record<string, unknown> | null;
        }[],
      ).balance;

      setBalance(latestBalance);
    } catch (error) {
      console.error("[dashboard] load error", error);
    }
  }, []);

  const loadBudget = React.useCallback(async () => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      return;
    }
    if (budgetLoadInFlight.current) return;

    budgetLoadInFlight.current = true;
    try {
      const { plan } = await loadBudgetPlanForSurface({
        referenceDate: new Date(),
        planKey: "default",
      });
      setBudgetPlan(plan);
    } catch (error) {
      if (isMissingRelationError(error)) {
        setBudgetSchemaMissing(true);
        setBudgetPlan(null);
        return;
      }

      console.error("[dashboard] budget load error", error);
      setBudgetPlan(null);
    } finally {
      budgetLoadInFlight.current = false;
    }
  }, [budgetSchemaMissing]);

  const loadInitialDashboard = React.useCallback(async () => {
    try {
      await Promise.all([loadCategories(), loadDashboard(), loadBudget()]);
    } finally {
      setIsBootstrapping(false);
    }
  }, [loadBudget, loadCategories, loadDashboard]);

  React.useEffect(() => {
    if (!isFocused || !isBootstrapping) return;
    void loadInitialDashboard();
  }, [isBootstrapping, isFocused, loadInitialDashboard]);

  React.useEffect(() => {
    if (!isFocused || isBootstrapping) return;
    void loadCategories();
  }, [isBootstrapping, isFocused, loadCategories]);

  React.useEffect(() => {
    if (!isFocused || isBootstrapping) return;
    void loadDashboard();
    void loadBudget();
  }, [isBootstrapping, isFocused, loadBudget, loadDashboard]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt || isBootstrapping)
      return;
    void loadCategories();
    void loadDashboard();
    void loadBudget();
  }, [
    backgroundStatus.lastCompletedAt,
    isBootstrapping,
    isFocused,
    loadBudget,
    loadCategories,
    loadDashboard,
  ]);

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceTopBar
        shellStyle={styles.topBar}
        title="Budio"
        rightSlot={
          <FinanceHeaderActions
            screenId="dashboard"
            selectedPeriod={{
              label: dashboardPeriodLabel,
            }}
            screenContext={{
              kind: "budget",
              monthLabel: dashboardPeriodLabel,
              monthBudgetState: dashboardBudgetOverview.monthSnapshot.state,
              monthStatusLabel: dashboardBudgetOverview.monthSnapshot.label,
              monthRiskTone:
                dashboardBudgetOverview.monthSnapshot.tone === "neutral"
                  ? null
                  : dashboardBudgetOverview.monthSnapshot.tone,
              remainingVariableBudget: dashboardBudgetOverview.monthSnapshot.remaining,
              spentVariableBudget: dashboardBudgetOverview.monthSnapshot.spent,
              totalVariableBudget: dashboardBudgetOverview.monthSnapshot.budget,
              weekStatusLabel: dashboardBudgetOverview.weekSnapshot.label,
              weekRiskTone: dashboardBudgetOverview.weekSnapshot.tone,
              weekRemainingBudget: dashboardBudgetOverview.weekSnapshot.remaining,
              weekTempoDelta: dashboardBudgetOverview.weekSnapshot.tempoDelta,
              expectedFixedCosts: budgetPlan?.flowSummary.fixedCostsBudget ?? null,
              expectedSubscriptions: budgetPlan?.flowSummary.subscriptionsBudget ?? null,
              hasForecastData: false,
            }}
          />
        }
      />

      {isBootstrapping ? (
        <SplashLoader label="Gegevens laden…" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <FinanceHeroShell
            eyebrow="Dashboard"
            title="Overzicht"
            subtitle="Je actuele geldstand staat direct onder de hero, daarna volgen maand en week."
            titleStyle={styles.heroTitle}
            subtitleStyle={styles.heroSupport}
          />

          <View style={styles.contentMax}>
            <View style={styles.mainStack}>
              <DashboardBalanceSummary
                balance={balance}
                hasTransactions={hasTransactions}
              />

              <DashboardBudgetOverviewCard
                model={dashboardBudgetOverview}
                onPress={() => router.push("/budget")}
              />

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => router.push("/transactions")}
                >
                  <Text style={styles.actionButtonPrimaryText}>Transacties bekijken</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push("/csv-import")}
                >
                  <Text style={styles.actionButtonText}>Importeren</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Laatste transacties</Text>
                <TouchableOpacity onPress={() => router.push("/transactions")}>
                  <Text style={styles.seeAll}>Open lijst</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.txCard}>
                {recentTransactions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconWrap}>
                      <AppIcon
                        name="history"
                        size={28}
                        color={FinColors.textMuted}
                        variant="outlined"
                      />
                    </View>
                    <Text style={styles.emptyTitle}>Nog geen transacties</Text>
                    <Text style={styles.emptyText}>
                      Zodra er transacties zijn, zie je hier een rustige momentopname van je laatste bewegingen.
                    </Text>
                  </View>
                ) : (
                  recentTransactions.map((tx, index) => (
                    <React.Fragment key={tx.id}>
                      <TxRow tx={tx} categoryMap={categoryMap} />
                      {index < recentTransactions.length - 1 ? (
                        <View style={styles.divider} />
                      ) : null}
                    </React.Fragment>
                  ))
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  scroll: {
    paddingBottom: 128,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.8,
  },
  heroSupport: {
    maxWidth: 720,
    fontSize: 18,
    lineHeight: 26,
    color: FinColors.textSecondary,
  },
  contentMax: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  mainStack: {
    paddingTop: 24,
    gap: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: -2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSubtle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  statusChipGood: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  statusChipWatch: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  statusChipCritical: {
    backgroundColor: FinColors.redBg,
    borderColor: "rgba(197,93,76,0.18)",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  statusChipTextGood: {
    color: FinColors.green,
  },
  statusChipTextWatch: {
    color: FinColors.warningText,
  },
  statusChipTextCritical: {
    color: FinColors.red,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  actionButtonPrimary: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  txCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  txIconWrap: {
    marginRight: 14,
  },
  txMid: {
    flex: 1,
    paddingRight: 10,
  },
  txName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  txSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  txAmountPos: {
    color: FinColors.green,
  },
  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 68,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
});
