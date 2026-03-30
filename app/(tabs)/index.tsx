import { TransactionListRow } from "@/components/transactions/transaction-list-row";
import { DashboardBalanceSummary } from "@/components/dashboard/dashboard-balance-summary";
import { DashboardAssistantCallout } from "@/components/dashboard/dashboard-assistant-callout";
import {
  buildDashboardBudgetOverviewModel,
  DashboardBudgetOverviewCard,
} from "@/components/dashboard/dashboard-overview-card";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceHeaderActions } from "@/components/ui/finance-header-actions";
import { FinanceDashboardHeader } from "@/components/ui/finance-dashboard-header";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinancePressableSurface } from "@/components/ui/finance-pressable-surface";
import { MainPageSpacing } from "@/components/ui/main-page-spacing";
import { AppIcon } from "@/components/ui/app-icon";
import { SplashLoader } from "@/components/motions/SplashLoader";
import { FinColors, FinSurfaces, FinTokens } from "@/constants/theme";
import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import {
  getMoneyViewScopeLabel,
  resolveAvailableMoneyViewScopes,
  type MoneyViewScope,
} from "@/services/finance-scope";
import { loadMoneyViewScopePreference } from "@/services/finance-scope-preference";
import { formatCurrency } from "@/services/ui-formatters/currency";
import { formatDateLabel } from "@/services/ui-formatters/dates";
import {
  parseRunningBalance,
} from "@/services/latest-known-balance";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import { listBankAccountsForUser } from "@/services/bank-accounts";
import {
  resolveFinancialSurfaceStatus,
  resolveSafetyContextCopy,
} from "@/services/financial-surface-semantics";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import type {
  BudgetPlanComputation,
  CategoryRecord,
} from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const CONTENT_MAX_WIDTH = 1040;
const SAFE_TO_SPEND_VALUE_TEXT_STYLE = {
  fontSize: 42,
  lineHeight: 46,
  fontWeight: FinTokens.fontWeight.black,
  letterSpacing: -1.1,
} as const;
const SAFE_TO_SPEND_META_TITLE_TEXT_STYLE = {
  fontSize: 12,
  lineHeight: 15,
  fontWeight: FinTokens.fontWeight.extrabold,
  letterSpacing: 0.7,
} as const;
const SAFE_TO_SPEND_META_BODY_TEXT_STYLE = {
  fontSize: 12,
  lineHeight: 17,
  fontWeight: FinTokens.fontWeight.semibold,
} as const;
const SAFE_TO_SPEND_CONFIDENCE_TEXT_STYLE = {
  fontSize: 12,
  lineHeight: 15,
  fontWeight: FinTokens.fontWeight.bold,
} as const;

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
  return (
    formatDateLabel(value, {
    day: "2-digit",
    month: "2-digit",
    }) || value
  );
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<DashboardTx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [dashboardBalances, setDashboardBalances] =
    React.useState<FinancialSurfaceBalanceSnapshot | null>(null);
  const [dashboardConfidenceLabel, setDashboardConfidenceLabel] =
    React.useState<string | null>(null);
  const [safeToSpendUntilNextIncome, setSafeToSpendUntilNextIncome] =
    React.useState<number | null>(null);
  const [safeToSpendExplanation, setSafeToSpendExplanation] =
    React.useState<string | null>(null);
  const [safeToSpendIncomeAnchorLabel, setSafeToSpendIncomeAnchorLabel] =
    React.useState<string | null>(null);
  const [safeToSpendIncomeAnchorDate, setSafeToSpendIncomeAnchorDate] =
    React.useState<string | null>(null);
  const [safeToSpendEstimatedAnchorDate, setSafeToSpendEstimatedAnchorDate] =
    React.useState(false);
  const [safeToSpendProjectedCosts, setSafeToSpendProjectedCosts] =
    React.useState<number | null>(null);
  const [safeToSpendProjectedIncome, setSafeToSpendProjectedIncome] =
    React.useState<number | null>(null);
  const [projectedNetUntilNextIncome, setProjectedNetUntilNextIncome] =
    React.useState<number | null>(null);
  const [safeToSpendDeltaReason, setSafeToSpendDeltaReason] =
    React.useState<string | null>(null);
  const [safeToSpendSheetOpen, setSafeToSpendSheetOpen] = React.useState(false);
  const [safeToSpendBreakdownOpen, setSafeToSpendBreakdownOpen] =
    React.useState(false);
  const [availableScopeOptions, setAvailableScopeOptions] = React.useState<
    readonly MoneyViewScope[]
  >(["personal"]);
  const [moneyViewScope, setMoneyViewScope] = React.useState<
    import("@/services/finance-scope").MoneyViewScope
  >("personal");
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
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
    () => buildDashboardBudgetOverviewModel(budgetPlan, dashboardBalances),
    [budgetPlan, dashboardBalances],
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
  const activeMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("nl-NL", {
        month: "long",
      }).format(dashboardBudgetOverview.referenceDate),
    [dashboardBudgetOverview.referenceDate],
  );
  const dashboardHelpAssistantScreenContext = React.useMemo(
    () => ({
      kind: "budget" as const,
      monthLabel: dashboardPeriodLabel,
      monthBudgetState: dashboardBudgetOverview.monthSnapshot.state,
      monthStatusLabel: dashboardBudgetOverview.monthSnapshot.label,
      monthRiskTone:
        dashboardBudgetOverview.monthSnapshot.tone === "neutral"
          ? null
          : dashboardBudgetOverview.monthSnapshot.tone,
      remainingVariableBudget: dashboardBudgetOverview.remainingMonthlyBudget,
      spentVariableBudget: dashboardBudgetOverview.monthSnapshot.spent,
      totalVariableBudget: dashboardBudgetOverview.monthSnapshot.budget,
      weekStatusLabel: dashboardBudgetOverview.weekSnapshot.label,
      weekRiskTone: dashboardBudgetOverview.weekSnapshot.tone,
      weekRemainingBudget: dashboardBudgetOverview.weeklyBudgetRemaining,
      weekTempoDelta: dashboardBudgetOverview.weekSnapshot.tempoDelta,
      expectedFixedCosts: budgetPlan?.flowSummary.fixedCostsBudget ?? null,
      expectedSubscriptions: budgetPlan?.flowSummary.subscriptionsBudget ?? null,
      hasForecastData:
        dashboardBalances?.expectedEndOperationalBalance.amount != null,
    }),
    [
      budgetPlan?.flowSummary.fixedCostsBudget,
      budgetPlan?.flowSummary.subscriptionsBudget,
      dashboardBalances?.expectedEndOperationalBalance.amount,
      dashboardBudgetOverview.monthSnapshot.budget,
      dashboardBudgetOverview.monthSnapshot.label,
      dashboardBudgetOverview.monthSnapshot.spent,
      dashboardBudgetOverview.monthSnapshot.state,
      dashboardBudgetOverview.monthSnapshot.tone,
      dashboardBudgetOverview.weekSnapshot.label,
      dashboardBudgetOverview.weeklyBudgetRemaining,
      dashboardBudgetOverview.weekSnapshot.tone,
      dashboardBudgetOverview.weekSnapshot.tempoDelta,
      dashboardBudgetOverview.remainingMonthlyBudget,
      dashboardPeriodLabel,
    ],
  );
  const safeToSpendSemantics = React.useMemo(
    () =>
      resolveSafetyContextCopy({
        anchorLabel: safeToSpendIncomeAnchorLabel,
        anchorDate: safeToSpendIncomeAnchorDate,
        isEstimatedAnchorDate: safeToSpendEstimatedAnchorDate,
        formatDateLabel: (value) =>
          formatDateLabel(value, {
            day: "numeric",
            month: "long",
          }),
      }),
    [
      safeToSpendIncomeAnchorDate,
      safeToSpendEstimatedAnchorDate,
      safeToSpendIncomeAnchorLabel,
    ],
  );
  const dashboardStatus = React.useMemo(
    () =>
      resolveFinancialSurfaceStatus({
        activeMonthLabel,
        expectedEndOperationalBalance:
          dashboardBalances?.expectedEndOperationalBalance.amount ?? null,
        remainingMonthlyBudget: dashboardBudgetOverview.remainingMonthlyBudget,
        monthBudgetTone: dashboardBudgetOverview.monthSnapshot.tone,
      }),
    [
      activeMonthLabel,
      dashboardBalances?.expectedEndOperationalBalance.amount,
      dashboardBudgetOverview.monthSnapshot.tone,
      dashboardBudgetOverview.remainingMonthlyBudget,
    ],
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
        return;
      }

      setTransactions(recentRows);
    } catch (error) {
      console.error("[dashboard] load error", error);
    }
  }, []);

  const loadBudget = React.useCallback(async (scope: MoneyViewScope) => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      setDashboardBalances(null);
      setDashboardConfidenceLabel(null);
      setSafeToSpendUntilNextIncome(null);
      setSafeToSpendExplanation(null);
      setSafeToSpendIncomeAnchorLabel(null);
      setSafeToSpendIncomeAnchorDate(null);
      setSafeToSpendEstimatedAnchorDate(false);
      setSafeToSpendProjectedCosts(null);
      setSafeToSpendProjectedIncome(null);
      setSafeToSpendDeltaReason(null);
      setProjectedNetUntilNextIncome(null);
      return;
    }
    if (budgetLoadInFlight.current) return;

    budgetLoadInFlight.current = true;
    try {
      const userId = await requireCurrentUserId();
      const bankAccounts = await listBankAccountsForUser(userId).catch(
        () => [] as Awaited<ReturnType<typeof listBankAccountsForUser>>,
      );
      const visibleScopes = resolveAvailableMoneyViewScopes(bankAccounts, scope);
      setAvailableScopeOptions(visibleScopes);
      const result = await loadBudgetPlanForSurface({
        referenceDate: new Date(),
        planKey: "default",
        moneyViewScope: scope,
        userId,
      });
      const { plan, balances, confidence } = result;
      setBudgetPlan(plan);
      setDashboardBalances(balances);
      setDashboardConfidenceLabel(
        confidence.expectedEndOperationalBalance.label || null,
      );
      setSafeToSpendUntilNextIncome(result.safeToSpendUntilNextIncome);
      setSafeToSpendExplanation(result.safeToSpendExplanation);
      setSafeToSpendIncomeAnchorLabel(result.nextIncomeLabelAnchor || null);
      setSafeToSpendIncomeAnchorDate(result.nextIncomeDateAnchor || null);
      setSafeToSpendEstimatedAnchorDate(
        Boolean(result.safeToSpendIsEstimatedAnchorDate),
      );
      setSafeToSpendProjectedCosts(
        result.safeToSpendExplanationParts?.projectedCosts ?? null,
      );
      setSafeToSpendProjectedIncome(
        result.safeToSpendExplanationParts?.projectedIncome ?? null,
      );
      setProjectedNetUntilNextIncome(result.projectedNetUntilNextIncome);
      setSafeToSpendDeltaReason(
        result.confidenceLayer.safeToSpendUntilNextIncome.deltaReason?.message ||
          null,
      );
    } catch (error) {
      if (isMissingRelationError(error)) {
        setBudgetSchemaMissing(true);
        setBudgetPlan(null);
        setDashboardBalances(null);
        setDashboardConfidenceLabel(null);
        setSafeToSpendUntilNextIncome(null);
        setSafeToSpendExplanation(null);
        setSafeToSpendIncomeAnchorLabel(null);
        setSafeToSpendIncomeAnchorDate(null);
        setSafeToSpendEstimatedAnchorDate(false);
        setSafeToSpendProjectedCosts(null);
        setSafeToSpendProjectedIncome(null);
        setSafeToSpendDeltaReason(null);
        setProjectedNetUntilNextIncome(null);
        return;
      }

      console.error("[dashboard] budget load error", error);
      setBudgetPlan(null);
      setDashboardBalances(null);
      setDashboardConfidenceLabel(null);
      setSafeToSpendUntilNextIncome(null);
      setSafeToSpendExplanation(null);
      setSafeToSpendIncomeAnchorLabel(null);
      setSafeToSpendIncomeAnchorDate(null);
      setSafeToSpendEstimatedAnchorDate(false);
      setSafeToSpendProjectedCosts(null);
      setSafeToSpendProjectedIncome(null);
      setSafeToSpendDeltaReason(null);
      setProjectedNetUntilNextIncome(null);
    } finally {
      budgetLoadInFlight.current = false;
    }
  }, [budgetSchemaMissing]);

  const refreshActiveScopeAndBudget = React.useCallback(async () => {
    const preference = await loadMoneyViewScopePreference().catch(() => ({
      scopeView: "personal" as const,
    }));
    setMoneyViewScope(preference.scopeView);
    await loadBudget(preference.scopeView);
  }, [loadBudget]);

  const loadInitialDashboard = React.useCallback(async () => {
    try {
      await loadCategories();
      const preference = await loadMoneyViewScopePreference().catch(() => ({
        scopeView: "personal" as const,
      }));
      setMoneyViewScope(preference.scopeView);
      await loadDashboard();
      await loadBudget(preference.scopeView);
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
    if (!isFocused || !backgroundStatus.lastCompletedAt || isBootstrapping)
      return;
    void loadCategories();
    void loadDashboard().then(() => refreshActiveScopeAndBudget());
  }, [
    backgroundStatus.lastCompletedAt,
    isBootstrapping,
    isFocused,
    loadCategories,
    loadDashboard,
    refreshActiveScopeAndBudget,
  ]);

  // Dashboard follows the app-wide finance scope passively, so we refresh the
  // stored preference on focus and keep the surface in sync with Budget and Insights.
  React.useEffect(() => {
    if (!isFocused || isBootstrapping) return;
    void refreshActiveScopeAndBudget();
  }, [
    isBootstrapping,
    isFocused,
    refreshActiveScopeAndBudget,
  ]);

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDashboardHeader
        topBarStyle={styles.topBar}
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
              remainingVariableBudget: dashboardBudgetOverview.remainingMonthlyBudget,
              spentVariableBudget: dashboardBudgetOverview.monthSnapshot.spent,
              totalVariableBudget: dashboardBudgetOverview.monthSnapshot.budget,
              weekStatusLabel: dashboardBudgetOverview.weekSnapshot.label,
              weekRiskTone: dashboardBudgetOverview.weekSnapshot.tone,
              weekRemainingBudget: dashboardBudgetOverview.weeklyBudgetRemaining,
              weekTempoDelta: dashboardBudgetOverview.weekSnapshot.tempoDelta,
              expectedFixedCosts: budgetPlan?.flowSummary.fixedCostsBudget ?? null,
              expectedSubscriptions: budgetPlan?.flowSummary.subscriptionsBudget ?? null,
              hasForecastData:
                dashboardBalances?.expectedEndOperationalBalance.amount != null,
            }}
          />
        }
      />

      {isBootstrapping ? (
        <SplashLoader
          imageSource={require("../../assets/images/budio-splash-motion.png")}
          title="Budio cockpit wordt voorbereid"
          subtitle="We zetten je veilige ruimte en context rustig voor je klaar."
          label="Je overzicht wordt bijgewerkt."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.contentMax}>
            <View style={styles.mainStack}>
              <DashboardBalanceSummary
                surfaceBalances={dashboardBalances}
                activeMonthLabel={activeMonthLabel}
                remainingMonthlyBudget={dashboardBudgetOverview.remainingMonthlyBudget}
                hasTransactions={hasTransactions}
                scopeLabel={
                  availableScopeOptions.length > 1
                    ? getMoneyViewScopeLabel(moneyViewScope)
                    : null
                }
                confidenceLabel={dashboardConfidenceLabel}
                showConfidenceLabel={
                  Boolean(dashboardConfidenceLabel) && dashboardStatus.tone !== "good"
                }
                statusLabel={dashboardStatus.label}
                statusIconName={dashboardStatus.iconName}
                safeToSpendUntilNextIncome={safeToSpendUntilNextIncome}
                safeToSpendContextLabel={safeToSpendSemantics.fullLabel}
                onPressSafeToSpendExplanation={
                  safeToSpendExplanation ? () => setSafeToSpendSheetOpen(true) : null
                }
                onPressRemainingBudgetLabel={() => router.push("/budget")}
              />

              <DashboardBudgetOverviewCard
                model={dashboardBudgetOverview}
                onPress={() => router.push("/budget")}
              />

              <View style={styles.actionsRow}>
                <FinanceButton
                  label="Transacties bekijken"
                  onPress={() => router.push("/transactions")}
                  fullWidth
                  size="lg"
                  style={styles.actionButton}
                />
                <FinanceButton
                  label="Importeren"
                  variant="secondary"
                  onPress={() => router.push("/csv-import")}
                  fullWidth
                  size="lg"
                  style={styles.actionButton}
                />
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Laatste transacties</Text>
                <FinancePressableSurface
                  onPress={() => router.push("/transactions")}
                  accessibilityRole="button"
                  pressedStyle={styles.seeAllPressed}
                >
                  <Text style={styles.seeAll}>Open lijst</Text>
                </FinancePressableSurface>
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
                      <TransactionListRow
                        title={
                          tx.subscriptionProfileName || tx.counterparty || "Onbekend"
                        }
                        subtitle={tx.categoryLabel}
                        dateLabel={formatShortDateLabel(tx.date)}
                        showDate
                        amount={tx.amount}
                        runningBalance={tx.runningBalance}
                        showRunningBalance={false}
                        categoryAutoId={tx.category_id_auto}
                        categoryUserId={tx.category_id_user}
                        categoryById={categoryMap}
                        showDivider={index < recentTransactions.length - 1}
                        onPress={() => router.push(`/transactions/${tx.id}`)}
                      />
                    </React.Fragment>
                  ))
                )}
              </View>

              <DashboardAssistantCallout
                selectedPeriod={{
                  label: dashboardPeriodLabel,
                }}
                screenContext={dashboardHelpAssistantScreenContext}
              />
            </View>
          </View>
        </ScrollView>
      )}
      <FinanceBottomSheetShell
        visible={safeToSpendSheetOpen}
        title={safeToSpendSemantics.sheetTitle}
        subtitle={safeToSpendSemantics.sheetSubtitle}
        onClose={() => {
          setSafeToSpendSheetOpen(false);
          setSafeToSpendBreakdownOpen(false);
        }}
      >
        <View style={styles.safeToSpendSheetBody}>
          <View style={styles.safeToSpendSheetValueCard}>
            <Text style={styles.safeToSpendSheetValue}>
              {safeToSpendUntilNextIncome == null
                ? "Niet beschikbaar"
                : formatCurrency(safeToSpendUntilNextIncome)}
            </Text>
          </View>
          <View style={styles.safeToSpendSheetExplanationCard}>
            <Text style={styles.safeToSpendSheetExplanationTitle}>In het kort</Text>
            <Text style={styles.safeToSpendSheetText}>
              {safeToSpendExplanation ||
                "We tonen dit zodra we een betrouwbaar inkomensmoment en verwachte lasten kunnen bepalen."}
            </Text>
          </View>
          {dashboardConfidenceLabel && dashboardConfidenceLabel !== "Hoog vertrouwen" ? (
            <View style={styles.safeToSpendConfidencePill}>
              <Text style={styles.safeToSpendConfidenceText}>
                {dashboardConfidenceLabel}
              </Text>
            </View>
          ) : null}
          {dashboardBalances?.currentOperationalBalance.amount != null ? (
            <View style={styles.safeToSpendBreakdownCard}>
              <FinancePressableSurface
                onPress={() => setSafeToSpendBreakdownOpen((value) => !value)}
                accessibilityRole="button"
                style={styles.safeToSpendBreakdownToggle}
                pressedStyle={styles.safeToSpendBreakdownTogglePressed}
              >
                <Text style={styles.safeToSpendBreakdownTitle}>Berekening bekijken</Text>
                <AppIcon
                  name={safeToSpendBreakdownOpen ? "expand-less" : "expand-more"}
                  size={18}
                  color={FinColors.textSecondary}
                  variant="outlined"
                />
              </FinancePressableSurface>
              {safeToSpendBreakdownOpen ? (
                <>
                  <View style={styles.safeToSpendBreakdownList}>
                    <View style={styles.safeToSpendBreakdownItem}>
                      <Text style={styles.safeToSpendBreakdownLabel}>
                        Saldo nu
                      </Text>
                      <Text style={styles.safeToSpendBreakdownValue}>
                        {formatCurrency(
                          dashboardBalances.currentOperationalBalance.amount,
                        )}
                      </Text>
                    </View>
                    <View style={styles.safeToSpendBreakdownItem}>
                      <Text style={styles.safeToSpendBreakdownLabel}>
                        Gereserveerd voor later
                      </Text>
                      <Text style={styles.safeToSpendBreakdownValue}>
                        {formatCurrency(
                          dashboardBalances.currentReservedBalance.amount ?? 0,
                        )}
                      </Text>
                    </View>
                    <View style={styles.safeToSpendBreakdownItem}>
                      <Text style={styles.safeToSpendBreakdownLabel}>
                        Nog te verwachten lasten
                      </Text>
                      <Text
                        style={[
                          styles.safeToSpendBreakdownValue,
                          styles.safeToSpendBreakdownValueWarning,
                        ]}
                      >
                        {safeToSpendProjectedCosts == null
                          ? "n.b."
                          : formatCurrency(safeToSpendProjectedCosts)}
                      </Text>
                    </View>
                    <View style={styles.safeToSpendBreakdownItem}>
                      <Text style={styles.safeToSpendBreakdownLabel}>
                        Inkomsten vóór dat moment
                      </Text>
                      <Text
                        style={[
                          styles.safeToSpendBreakdownValue,
                          styles.safeToSpendBreakdownValuePositive,
                        ]}
                      >
                        {safeToSpendProjectedIncome == null
                          ? "n.b."
                          : formatCurrency(safeToSpendProjectedIncome)}
                      </Text>
                    </View>
                    <View style={styles.safeToSpendBreakdownDivider} />
                    <View style={styles.safeToSpendBreakdownItem}>
                      <Text style={styles.safeToSpendBreakdownLabelStrong}>
                        Ruimte die we voorzichtig vrijhouden
                      </Text>
                      <Text
                        style={[
                          styles.safeToSpendBreakdownValue,
                          styles.safeToSpendBreakdownValueStrong,
                        ]}
                      >
                        {projectedNetUntilNextIncome == null
                          ? "n.b."
                          : formatCurrency(Math.max(-projectedNetUntilNextIncome, 0))}
                      </Text>
                    </View>
                  </View>
                  {safeToSpendDeltaReason ? (
                    <View style={styles.safeToSpendBreakdownReasonCallout}>
                      <AppIcon
                        name="info-outline"
                        size={14}
                        color={FinColors.warningText}
                        variant="outlined"
                      />
                      <Text style={styles.safeToSpendBreakdownMeta}>
                        Grootste reden van voorzichtigheid: {safeToSpendDeltaReason}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </FinanceBottomSheetShell>
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
    backgroundColor: FinColors.topBarBg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.10)",
  },
  scroll: {
    paddingTop: 80,
    paddingBottom: 128,
  },
  safeToSpendSheetBody: {
    gap: FinTokens.spacing["s-plus"],
    paddingBottom: FinTokens.spacing["xs-plus"],
  },
  safeToSpendSheetValueCard: {
    borderRadius: 18,
    backgroundColor: FinColors.accent,
    paddingHorizontal: FinTokens.spacing["s-plus"],
    paddingVertical: FinTokens.spacing.s,
    boxShadow: "0px 6px 14px rgba(17,17,17,0.12)",
    elevation: 2,
  },
  safeToSpendSheetValue: {
    ...SAFE_TO_SPEND_VALUE_TEXT_STYLE,
    color: FinColors.textPrimary,
    textAlign: "center",
  },
  safeToSpendSheetExplanationCard: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: FinTokens.spacing["s-plus"],
    paddingVertical: FinTokens.spacing.s,
    gap: FinTokens.spacing.xs,
  },
  safeToSpendSheetExplanationTitle: {
    ...SAFE_TO_SPEND_META_TITLE_TEXT_STYLE,
    color: FinColors.textSecondary,
    textTransform: "uppercase",
  },
  safeToSpendSheetText: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  safeToSpendConfidencePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  safeToSpendConfidenceText: {
    ...SAFE_TO_SPEND_CONFIDENCE_TEXT_STYLE,
    color: FinColors.warningText,
  },
  safeToSpendBreakdownCard: {
    borderRadius: 20,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: FinTokens.spacing["s-plus"],
    paddingVertical: FinTokens.spacing.s,
    gap: FinTokens.spacing["xs-plus"],
  },
  safeToSpendBreakdownToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  safeToSpendBreakdownTogglePressed: {
    opacity: 0.8,
  },
  safeToSpendBreakdownTitle: {
    ...SAFE_TO_SPEND_META_TITLE_TEXT_STYLE,
    color: FinColors.textSecondary,
    textTransform: "uppercase",
  },
  safeToSpendBreakdownList: {
    gap: FinTokens.spacing.xs,
  },
  safeToSpendBreakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  safeToSpendBreakdownLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    flex: 1,
  },
  safeToSpendBreakdownLabelStrong: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  safeToSpendBreakdownValue: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  safeToSpendBreakdownValueWarning: {
    color: FinColors.red,
  },
  safeToSpendBreakdownValuePositive: {
    color: FinColors.green,
  },
  safeToSpendBreakdownValueStrong: {
    color: FinColors.red,
  },
  safeToSpendBreakdownDivider: {
    height: 1,
    borderRadius: 999,
    backgroundColor: FinColors.borderSubtle,
  },
  safeToSpendBreakdownMeta: {
    flex: 1,
    ...SAFE_TO_SPEND_META_BODY_TEXT_STYLE,
    color: FinColors.textSecondary,
  },
  safeToSpendBreakdownReasonCallout: {
    marginTop: FinTokens.spacing.xxs,
    borderRadius: 14,
    backgroundColor: FinColors.warningBg,
    paddingHorizontal: FinTokens.spacing["xs-plus"],
    paddingVertical: FinTokens.spacing.xs,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: FinTokens.spacing.xs,
  },
  contentMax: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  mainStack: {
    paddingTop: 0,
    gap: MainPageSpacing.dashboardComponents,
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
    borderColor: FinColors.redBorder,
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
    minHeight: 54,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  seeAllPressed: {
    opacity: 0.75,
  },
  txCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
