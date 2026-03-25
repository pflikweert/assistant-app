import { TransactionCategoryIcon } from "@/components/category-icon";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceLoadingSplash } from "@/components/ui/finance-loading-splash";
import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import { AppIcon } from "@/components/ui/app-icon";
import { SquareAccentBlock } from "@/components/ui/square-accent-block";
import { FinanceBudgetProgressBar } from "@/components/ui/finance-budget-progress-bar";
import { FinColors, FinSurfaces } from "@/constants/theme";
import {
  getMonthVariableBudgetUsageText,
  getMonthVariableBudgetSnapshot,
  getWeekBudgetSnapshot,
  getWeekTempoMessage,
} from "@/services/budget-risk";
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
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

function formatWeekRangeLabel(startDate: string, endDateExclusive: string) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) {
    return `${formatShortDateLabel(startDate)} - ${formatShortDateLabel(endDateExclusive)}`;
  }

  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return `${formatShortDateLabel(startDate)} - ${formatShortDateLabel(endDate.toISOString().slice(0, 10))}`;
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
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
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

  const recentTransactions = React.useMemo<DashboardTxRow[]>(
    () =>
      transactions.map((tx) => ({
        ...tx,
        categoryLabel: getCategoryPathLabel(tx, categoryMap),
      })),
    [transactions, categoryMap],
  );

  const remainingBudget = React.useMemo(() => {
    return getMonthVariableBudgetSnapshot(budgetPlan).remaining;
  }, [budgetPlan]);
  const monthBudgetSnapshot = React.useMemo(
    () => getMonthVariableBudgetSnapshot(budgetPlan),
    [budgetPlan],
  );
  const monthSpentInBudget = monthBudgetSnapshot.spent;
  const monthBudgetTotal = monthBudgetSnapshot.budget;
  const monthBudgetFill =
    monthBudgetTotal != null && monthBudgetTotal > 0 && monthSpentInBudget != null
      ? Math.max(
          0,
          Math.min(100, Math.round((monthSpentInBudget / monthBudgetTotal) * 100)),
        )
      : 0;

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

  const currentWeekProgress = React.useMemo(() => {
    return getWeekBudgetSnapshot(currentWeekPlan).progress;
  }, [currentWeekPlan]);
  const currentWeekSnapshot = React.useMemo(
    () => getWeekBudgetSnapshot(currentWeekPlan),
    [currentWeekPlan],
  );
  const currentWeekRiskTone = currentWeekSnapshot.tone;
  const monthRiskTone = monthBudgetSnapshot.tone;
  const monthBudgetStatusLabel = monthBudgetSnapshot.label.toUpperCase();

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
        rightSlot={<FinanceAvatarBadge />}
      />

      {isBootstrapping ? (
        <FinanceLoadingSplash
          title="Gegevens laden"
          subtitle="We zetten je overzicht klaar."
          note="Even geduld."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <FinanceHeroShell
            eyebrow="Huidig saldo"
            title={hasTransactions && balance != null ? fmt.format(balance) : "Nog geen data"}
            subtitle={
              hasTransactions
                ? "Actuele momentopname van je hoofdrekening."
                : "Koppel of importeer transacties om direct overzicht en budgetsturing te krijgen."
            }
            titleStyle={[
              styles.heroAmount,
              !hasTransactions && styles.emptyAmount,
            ]}
            subtitleStyle={styles.heroSupport}
          >
            <SquareAccentBlock
              style={styles.heroBudgetCard}
              onPress={() => router.push("/budget")}
            >
              <View style={styles.heroBudgetHeader}>
                <Text style={styles.heroBudgetEyebrow}>Huidig maandbudget</Text>
                <View style={styles.heroBudgetHeaderMeta}>
                  <View
                    style={[
                      styles.heroMonthStatusPill,
                      monthRiskTone === "good" && styles.heroMonthStatusPillGood,
                      monthRiskTone === "watch" && styles.heroMonthStatusPillWatch,
                      monthRiskTone === "critical" && styles.heroMonthStatusPillCritical,
                    ]}
                  >
                    <View
                      style={[
                        styles.heroMonthStatusDot,
                        monthRiskTone === "good" && styles.heroMonthStatusDotGood,
                        monthRiskTone === "watch" && styles.heroMonthStatusDotWatch,
                        monthRiskTone === "critical" && styles.heroMonthStatusDotCritical,
                      ]}
                    />
                    <Text
                      style={[
                        styles.heroMonthStatusText,
                        monthRiskTone === "good" && styles.heroMonthStatusTextGood,
                        monthRiskTone === "watch" && styles.heroMonthStatusTextWatch,
                        monthRiskTone === "critical" && styles.heroMonthStatusTextCritical,
                      ]}
                    >
                      {monthBudgetStatusLabel}
                    </Text>
                  </View>
                  <View style={styles.inlineCta}>
                    <Text style={styles.inlineCtaText}>Bekijk budget</Text>
                    <AppIcon
                      name="chevron-right"
                      size={16}
                      color={FinColors.warningText}
                    />
                  </View>
                </View>
              </View>
              <Text style={styles.heroBudgetValue}>
                {remainingBudget == null
                  ? "Nog geen data"
                  : fmt.format(Math.max(remainingBudget, 0))}
              </Text>
              <Text style={styles.heroBudgetSupport}>
                {budgetPlan
                  ? getMonthVariableBudgetUsageText(monthBudgetSnapshot, fmt)
                  : budgetSchemaMissing
                    ? "Budgetschema is nog niet beschikbaar in deze omgeving."
                    : "Budgetgegevens laden..."}
              </Text>
              {budgetPlan ? (
                <FinanceBudgetProgressBar
                  progress={monthBudgetFill}
                  tone={monthRiskTone}
                />
              ) : null}
            </SquareAccentBlock>
          </FinanceHeroShell>

          <View style={styles.contentMax}>
            <View style={styles.mainStack}>
              <View style={[styles.gridRow, isWideLayout && styles.gridRowWide]}>
                <Pressable
                  style={[
                    styles.surfaceCard,
                    styles.weekCard,
                    isWideLayout && styles.weekCardWide,
                  ]}
                  onPress={() => router.push("/budget")}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.sectionTitle}>Deze week</Text>
                      <Text style={styles.sectionSubtle}>
                        {currentWeekPlan
                          ? formatWeekRangeLabel(
                              currentWeekPlan.startDate,
                              currentWeekPlan.endDateExclusive,
                            )
                          : "Weekbudget volgt zodra je budget actief is"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.weekStatusPill,
                        currentWeekRiskTone === "good" && styles.weekStatusPillGood,
                        currentWeekRiskTone === "watch" && styles.weekStatusPillWatch,
                        currentWeekRiskTone === "critical" && styles.weekStatusPillCritical,
                      ]}
                    >
                      <View
                        style={[
                          styles.weekStatusDot,
                          currentWeekRiskTone === "good" && styles.weekStatusDotGood,
                          currentWeekRiskTone === "watch" && styles.weekStatusDotWatch,
                          currentWeekRiskTone === "critical" && styles.weekStatusDotCritical,
                        ]}
                      />
                      <Text
                        style={[
                          styles.weekStatusText,
                          currentWeekRiskTone === "good" && styles.weekStatusTextGood,
                          currentWeekRiskTone === "watch" && styles.weekStatusTextWatch,
                          currentWeekRiskTone === "critical" && styles.weekStatusTextCritical,
                        ]}
                      >
                        {currentWeekSnapshot.label.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.weekSummaryRow}>
                    <View style={styles.weekSummaryMain}>
                      <View style={styles.weekAmountRow}>
                        <Text style={styles.weekSummaryValue}>
                          {currentWeekPlan ? fmt.format(currentWeekPlan.actual) : "Nog geen data"}
                        </Text>
                        {currentWeekPlan ? (
                          <Text style={styles.weekSummaryOfBudget}>
                            van {fmt.format(currentWeekPlan.budget)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.weekMetaWrap}>
                      <Text style={styles.weekSummaryMeta}>
                        {currentWeekRemainingDays || "Deze week"}
                      </Text>
                    </View>
                  </View>
                  <FinanceBudgetProgressBar
                    progress={currentWeekProgress * 100}
                    tone={currentWeekRiskTone}
                  />
                  <View style={styles.weekHintCard}>
                    <View style={styles.weekHintIconWrap}>
                      <AppIcon
                        name="eco"
                        size={14}
                        color={FinColors.warningText}
                        variant="outlined"
                      />
                    </View>
                    <Text style={styles.weekTrendText}>
                      {getWeekTempoMessage(currentWeekPlan)}
                    </Text>
                  </View>
                </Pressable>

              </View>

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
  heroAmount: {
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.8,
  },
  emptyAmount: {
    fontSize: 20,
    lineHeight: 26,
    color: FinColors.textMuted,
    letterSpacing: 0,
  },
  heroSupport: {
    maxWidth: 720,
    fontSize: 18,
    lineHeight: 26,
    color: FinColors.textSecondary,
  },
  heroBudgetCard: {
    marginTop: 24,
  },
  heroBudgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroBudgetHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroMonthStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: FinColors.bgElevated,
  },
  heroMonthStatusPillGood: {
    backgroundColor: "#e7f3a8",
  },
  heroMonthStatusPillWatch: {
    backgroundColor: FinColors.warningBg,
  },
  heroMonthStatusPillCritical: {
    backgroundColor: FinColors.redBg,
  },
  heroMonthStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: FinColors.textMuted,
  },
  heroMonthStatusDotGood: {
    backgroundColor: "#10b981",
  },
  heroMonthStatusDotWatch: {
    backgroundColor: FinColors.warningText,
  },
  heroMonthStatusDotCritical: {
    backgroundColor: FinColors.red,
  },
  heroMonthStatusText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: FinColors.textSecondary,
  },
  heroMonthStatusTextGood: {
    color: "#5b6a1b",
  },
  heroMonthStatusTextWatch: {
    color: FinColors.warningText,
  },
  heroMonthStatusTextCritical: {
    color: FinColors.red,
  },
  heroBudgetEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    color: FinColors.textMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  heroBudgetValue: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1,
  },
  heroBudgetSupport: {
    fontSize: 13,
    lineHeight: 20,
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
  gridRow: {
    gap: 18,
  },
  gridRowWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  surfaceCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 30,
    padding: 22,
  },
  weekCard: {
    ...FinSurfaces.topLevelCard,
    gap: 14,
    borderRadius: 28,
  },
  weekCardWide: {
    flex: 1.25,
  },
  monthStatusCard: {
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  inlineCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
  },
  inlineCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  subStatsColumn: {
    gap: 10,
  },
  subStatCard: {
    backgroundColor: FinColors.bgElevated,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  subStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  subStatValue: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
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
  weekSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  weekSummaryMain: {
    flex: 1,
    minWidth: 0,
  },
  weekAmountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    flexWrap: "wrap",
  },
  weekSummaryValue: {
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.8,
  },
  weekSummaryOfBudget: {
    fontSize: 30 / 2,
    lineHeight: 24,
    fontWeight: "500",
    color: FinColors.textSecondary,
    marginBottom: 3,
  },
  weekMetaWrap: {
    minWidth: 84,
    alignItems: "flex-end",
  },
  weekSummaryMeta: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: FinColors.warningText,
    textAlign: "right",
  },
  weekTrendText: {
    flex: 1,
    fontSize: 21 / 2,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekHintCard: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weekHintIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgCard,
  },
  weekStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: FinColors.bgElevated,
  },
  weekStatusPillGood: {
    backgroundColor: "#e7f3a8",
  },
  weekStatusPillWatch: {
    backgroundColor: FinColors.warningBg,
  },
  weekStatusPillCritical: {
    backgroundColor: FinColors.redBg,
  },
  weekStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.textMuted,
  },
  weekStatusDotGood: {
    backgroundColor: "#10b981",
  },
  weekStatusDotWatch: {
    backgroundColor: FinColors.warningText,
  },
  weekStatusDotCritical: {
    backgroundColor: FinColors.red,
  },
  weekStatusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: FinColors.textSecondary,
  },
  weekStatusTextGood: {
    color: "#5b6a1b",
  },
  weekStatusTextWatch: {
    color: FinColors.warningText,
  },
  weekStatusTextCritical: {
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
