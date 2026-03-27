import { FinanceHeaderActions } from "@/components/ui/finance-header-actions";
import {
  FinanceInsightCard,
  type FinanceInsightCardType,
} from "@/components/ui/finance-insight-card";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceMonthSelectorModal } from "@/components/ui/finance-month-selector-modal";
import { FinanceForecastSummaryCard } from "@/components/ui/finance-forecast-summary-card";
import { FinanceCategorySummaryCard } from "@/components/ui/finance-category-summary-card";
import { FinanceMonthSelector } from "@/components/ui/finance-month-selector";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceSectionHeader } from "@/components/ui/finance-section-header";
import { FinanceStatusChip } from "@/components/ui/finance-status-chip";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import { FinanceUpcomingMomentsCard } from "@/components/ui/finance-upcoming-moments-card";
import { FinColors } from "@/constants/theme";
import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
import { requireCurrentUserId } from "@/services/current-user";
import {
  listForecastTimelineEvents,
  type ForecastTimelineEventRecord,
} from "@/services/forecast-timeline-events";
import {
  loadInsightsHighlightHistory,
  recordInsightsHighlightHistory,
} from "@/services/insights-highlight-history";
import {
  selectInsightsHighlights,
  type InsightsHighlight,
  type InsightsSignalTransaction,
} from "@/services/insights-highlights";
import {
  buildInsightsForecastCard,
  type InsightsForecastCardModel,
} from "@/services/insights-forecast-card";
import {
  loadLatestKnownBalanceSnapshot,
  type LatestKnownBalanceSnapshot,
} from "@/services/latest-known-balance";
import {
  buildInsightsMonthContextSummary,
  type InsightsForecastSummary,
} from "@/services/insights-month-context";
import {
  getInsightsDisplayExpectedEndBalance,
  getInsightsRemainingMonthNetTotal,
  getInsightsRemainingPlannedExpenseTotal,
  getInsightsRemainingVariableExpenseEstimate,
} from "@/services/insights-remaining-month";
import { buildInsightsCategorySummary } from "@/services/insights-category-summary";
import { buildInsightsUpcomingMoments } from "@/services/insights-upcoming-moments";
import { supabase } from "@/services/supabase";
import {
  getCurrentMonthKey,
  getMonthOptionByKey,
  listTransactionMonthOptions,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import type { BudgetPlanComputation } from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type InsightSignals = {
  all: InsightsSignalTransaction[];
  currentMonth: InsightsSignalTransaction[];
  previousMonth: InsightsSignalTransaction[];
  lookback: InsightsSignalTransaction[];
};

const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function isMissingColumnError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42703" || code === "PGRST204") return true;

  return (
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("could not find")
  );
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function getReferenceDate(selectedMonth: TransactionMonthOption) {
  if (selectedMonth.isCurrentMonth) return new Date();

  const referenceDate = new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
  referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
  return referenceDate;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPreviousMonthRange(selectedMonth: TransactionMonthOption) {
  const start = new Date(selectedMonth.year, selectedMonth.month - 2, 1);
  const end = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
  return {
    startIso: toIsoDate(start),
    endIso: toIsoDate(end),
  };
}

function resolveCardType(type: FinanceInsightCardType) {
  return type;
}

function resolveLatestTransactionDate(rows: InsightsSignalTransaction[]) {
  let latest: string | null = null;
  for (const row of rows) {
    if (!row.date) continue;
    if (!latest || row.date > latest) {
      latest = row.date;
    }
  }
  return latest;
}

function formatAmount(value: number | null) {
  if (value == null) return "Onbekend";
  return eur.format(value);
}

function formatSignedAmount(value: number | null) {
  if (value == null) return "Onbekend";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${eur.format(Math.abs(value))}`;
}

function formatSheetDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

export default function InsightsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const fallbackMonthOption = React.useMemo(
    () => getMonthOptionByKey(getCurrentMonthKey())!,
    [],
  );

  const [monthOptions, setMonthOptions] = React.useState<TransactionMonthOption[]>([
    fallbackMonthOption,
  ]);
  const [selectedMonthKey, setSelectedMonthKey] = React.useState(
    getCurrentMonthKey(),
  );
  const [forecast, setForecast] = React.useState<InsightsForecastSummary | null>(
    null,
  );
  const [budgetPlan, setBudgetPlan] = React.useState<BudgetPlanComputation | null>(
    null,
  );
  const [insightSignals, setInsightSignals] = React.useState<InsightSignals>({
    all: [],
    currentMonth: [],
    previousMonth: [],
    lookback: [],
  });
  const [highlights, setHighlights] = React.useState<InsightsHighlight[]>([]);
  const [timelineEvents, setTimelineEvents] = React.useState<
    ForecastTimelineEventRecord[]
  >([]);
  const [latestKnownBalance, setLatestKnownBalance] =
    React.useState<LatestKnownBalanceSnapshot>({
      balance: null,
      date: null,
    });
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);
  const [allCategoriesOpen, setAllCategoriesOpen] = React.useState(false);
  const [remainingMonthOpen, setRemainingMonthOpen] = React.useState(false);

  const selectedMonth = React.useMemo(
    () =>
      monthOptions.find((option) => option.key === selectedMonthKey) ||
      getMonthOptionByKey(selectedMonthKey) ||
      monthOptions[0] ||
      fallbackMonthOption,
    [fallbackMonthOption, monthOptions, selectedMonthKey],
  );
  const selectedMonthIndex = React.useMemo(
    () => monthOptions.findIndex((option) => option.key === selectedMonth.key),
    [monthOptions, selectedMonth.key],
  );
  const canGoToOlderMonth =
    selectedMonthIndex >= 0 && selectedMonthIndex < monthOptions.length - 1;
  const canGoToNewerMonth = selectedMonthIndex > 0;

  const monthContext = React.useMemo(
    () =>
      buildInsightsMonthContextSummary({
        forecast,
        budgetPlan,
        selectedMonth,
        currentBalanceOverride: latestKnownBalance.balance,
      }),
    [budgetPlan, forecast, latestKnownBalance.balance, selectedMonth],
  );
  const forecastCard = React.useMemo<InsightsForecastCardModel>(
    () =>
      buildInsightsForecastCard({
        forecast,
        budgetPlan,
        currentBalanceOverride: latestKnownBalance.balance,
      }),
    [budgetPlan, forecast, latestKnownBalance.balance],
  );
  const categorySummary = React.useMemo(
    () =>
      buildInsightsCategorySummary({
        selectedMonth,
        budgetPlan,
        currentMonthTransactions: insightSignals.currentMonth,
      }),
    [budgetPlan, insightSignals.currentMonth, selectedMonth],
  );
  const allCategoriesSummary = React.useMemo(
    () =>
      buildInsightsCategorySummary({
        selectedMonth,
        budgetPlan,
        currentMonthTransactions: insightSignals.currentMonth,
        maxRows: null,
      }),
    [budgetPlan, insightSignals.currentMonth, selectedMonth],
  );
  const upcomingMoments = React.useMemo(
    () =>
      buildInsightsUpcomingMoments({
        forecast,
        timelineEvents,
        selectedMonth,
        referenceSignals: insightSignals.all,
      }),
    [forecast, insightSignals.all, selectedMonth, timelineEvents],
  );
  const remainingVariableExpenseEstimate = React.useMemo(() => {
    return getInsightsRemainingVariableExpenseEstimate({ forecast, budgetPlan });
  }, [budgetPlan, forecast]);
  const remainingPlannedExpenseTotal = React.useMemo(() => {
    return getInsightsRemainingPlannedExpenseTotal({ forecast, budgetPlan });
  }, [budgetPlan, forecast]);
  const remainingMonthNetTotal = React.useMemo(() => {
    return getInsightsRemainingMonthNetTotal({ forecast, budgetPlan });
  }, [budgetPlan, forecast]);
  const remainingMonthExpectedEndBalance = React.useMemo(() => {
    return getInsightsDisplayExpectedEndBalance({
      forecast,
      budgetPlan,
      currentBalanceOverride: latestKnownBalance.balance,
    });
  }, [budgetPlan, forecast, latestKnownBalance.balance]);

  const loadMonthOptions = React.useCallback(async () => {
    try {
      const options = await listTransactionMonthOptions({ includeFutureMonths: 6 });
      setMonthOptions(options);
      if (options.some((option) => option.key === selectedMonthKey)) return;
      setSelectedMonthKey((options[0] || fallbackMonthOption).key);
    } catch (error) {
      console.error("[insights] month options load error", error);
      setMonthOptions([fallbackMonthOption]);
      setSelectedMonthKey(fallbackMonthOption.key);
    }
  }, [fallbackMonthOption, selectedMonthKey]);

  const loadBudgetSurface = React.useCallback(
    async (
      userId: string,
      currentBalanceOverride?: number | null,
    ): Promise<{
      forecast: InsightsForecastSummary | null;
      plan: BudgetPlanComputation | null;
    }> => {
      try {
        const reason = selectedMonth.isCurrentMonth
          ? "insights_open"
          : selectedMonth.key < getCurrentMonthKey()
            ? "historical_month_open"
            : "future_month_open";

        const result = await loadBudgetPlanForSurface({
          referenceDate: getReferenceDate(selectedMonth),
          planKey: "default",
          timelineReference: new Date(),
          forecastReason: reason,
          currentBalanceOverride,
          userId,
        });

        return result;
      } catch (error) {
        if (isMissingRelationError(error)) {
          return { forecast: null, plan: null };
        }

        console.error("[insights] budget surface load error", error);
        return { forecast: null, plan: null };
      }
    },
    [selectedMonth],
  );

  const loadInsightSignals = React.useCallback(
    async (userId: string): Promise<InsightSignals> => {
      try {
        const previous = buildPreviousMonthRange(selectedMonth);
        const lookbackStart = new Date(`${selectedMonth.startIso}T00:00:00.000Z`);
        lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 120);
        const categoryById = new Map<string, { name: string; key: string }>();

        const categoryResult = await supabase
          .from("categories")
          .select("id,key,name")
          .order("name", { ascending: true });

        if (!categoryResult.error) {
          for (const row of (categoryResult.data || []) as Record<string, unknown>[]) {
            const id = row.id ? String(row.id) : "";
            const name = row.name ? String(row.name) : "";
            const key = row.key ? String(row.key) : "";
            if (!id || !name) continue;
            categoryById.set(id, { name, key });
          }
        }

        const fetchWithAnalysis = async () =>
          supabase
            .from("transactions")
            .select("id,amount,counterparty,details,date,analysis_category,category_id_auto,category_id_user")
            .eq("user_id", userId)
            .gte("date", toIsoDate(lookbackStart))
            .lt("date", selectedMonth.endIso)
            .order("date", { ascending: false })
            .limit(1500);

        const fetchLegacy = async () =>
          supabase
            .from("transactions")
            .select("id,amount,counterparty,details,date,category_id_auto,category_id_user")
            .eq("user_id", userId)
            .gte("date", toIsoDate(lookbackStart))
            .lt("date", selectedMonth.endIso)
            .order("date", { ascending: false })
            .limit(1500);

        let result: any = await fetchWithAnalysis();
        if (result.error && isMissingColumnError(result.error)) {
          result = await fetchLegacy();
        }

        if (result.error) throw result.error;

        const rows = ((result.data || []) as Record<string, unknown>[]).map(
          (row) => ({
            id: row.id ? String(row.id) : undefined,
            amount: Number(row.amount || 0),
            counterparty: row.counterparty ? String(row.counterparty) : null,
            details: row.details ? String(row.details) : null,
            date: String(row.date || ""),
            categoryKey: (() => {
              const categoryId = row.category_id_user || row.category_id_auto;
              if (!categoryId) return null;
              return categoryById.get(String(categoryId))?.key || null;
            })(),
            categoryLabel: (() => {
              const categoryId = row.category_id_user || row.category_id_auto;
              if (!categoryId) return null;
              return categoryById.get(String(categoryId))?.name || null;
            })(),
            analysisCategory:
              row.analysis_category === "income_structural" ||
              row.analysis_category === "income_variable" ||
              row.analysis_category === "fixed_costs" ||
              row.analysis_category === "subscriptions" ||
              row.analysis_category === "variable_costs" ||
              row.analysis_category === "savings_transfer"
                ? (row.analysis_category as
                    | "income_structural"
                    | "income_variable"
                    | "fixed_costs"
                    | "subscriptions"
                    | "variable_costs"
                    | "savings_transfer")
                : null,
          }),
        );

        return {
          all: rows,
          currentMonth: rows.filter(
            (row) => row.date >= selectedMonth.startIso && row.date < selectedMonth.endIso,
          ),
          previousMonth: rows.filter(
            (row) => row.date >= previous.startIso && row.date < previous.endIso,
          ),
          lookback: rows.filter((row) => row.date < selectedMonth.startIso),
        };
      } catch (error) {
        console.error("[insights] insight signals load error", error);
        return { all: [], currentMonth: [], previousMonth: [], lookback: [] };
      }
    },
    [selectedMonth],
  );

  const refreshInsights = React.useCallback(async () => {
    const userId = await requireCurrentUserId();
    const liveBalanceSnapshot = await loadLatestKnownBalanceSnapshot(userId).catch(
      (error) => {
        console.warn("[insights] latest balance load error", error);
        return { balance: null, date: null } satisfies LatestKnownBalanceSnapshot;
      },
    );
    const [budgetSurface, insightSignals, highlightHistory] =
      await Promise.all([
        loadBudgetSurface(userId, liveBalanceSnapshot.balance),
        loadInsightSignals(userId),
        loadInsightsHighlightHistory(userId, selectedMonth.key),
      ]);
    const forecastSummary = budgetSurface.forecast;
    const budgetSummary = budgetSurface.plan;

    setForecast(forecastSummary);
    setBudgetPlan(budgetSummary);
    setLatestKnownBalance(liveBalanceSnapshot);
    setInsightSignals(insightSignals);
    const nextTimelineEvents = await listForecastTimelineEvents({
      userId,
      monthStart: selectedMonth.startIso,
    }).catch((error) => {
      console.warn("[insights] timeline events load error", error);
      return [] as ForecastTimelineEventRecord[];
    });
    setTimelineEvents(nextTimelineEvents);
    const nextHighlights = selectInsightsHighlights({
      selectedMonthKey: selectedMonth.key,
      selectedMonthLabel: selectedMonth.label,
      forecast: forecastSummary,
      budgetPlan: budgetSummary,
      currentMonthTransactions: insightSignals.currentMonth,
      previousMonthTransactions: insightSignals.previousMonth,
      lookbackTransactions: insightSignals.lookback,
      latestTransactionDateIso: resolveLatestTransactionDate(
        insightSignals.currentMonth,
      ),
      history: highlightHistory,
    });

    setHighlights(nextHighlights);

    const recordableHighlights = nextHighlights.filter((item) => item.type !== "neutral");
    if (recordableHighlights.length > 0) {
      try {
        await recordInsightsHighlightHistory(
          userId,
          selectedMonth.key,
          recordableHighlights.map((item) => ({
            meaningKey: item.meaningKey,
            fingerprint: item.fingerprint,
            signalSource: item.signalSource,
          })),
        );
      } catch (error) {
        console.warn("[insights] highlight history write failed", error);
      }
    }
  }, [
    loadBudgetSurface,
    loadInsightSignals,
    selectedMonth.key,
    selectedMonth.startIso,
    selectedMonth.label,
  ]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadMonthOptions();
  }, [isFocused, loadMonthOptions]);

  React.useEffect(() => {
    if (!isFocused) return;
    void refreshInsights();
  }, [isFocused, refreshInsights, selectedMonth.key]);

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceTopBar
        shellStyle={styles.topBar}
        title="Inzichten"
        rightSlot={
          <FinanceHeaderActions
            screenId="insights"
            selectedPeriod={{
              key: selectedMonth.key,
              label: selectedMonth.label,
              startIso: selectedMonth.startIso,
              endIsoExclusive: selectedMonth.endIso,
            }}
            screenContext={{
              kind: "insights",
              monthLabel: selectedMonth.label,
              statusLabel: monthContext.statusLabel,
              remainingPlannedExpenseTotal,
              remainingVariableExpenseEstimate,
              remainingMonthNetTotal,
              remainingMonthExpectedEndBalance,
              hasForecastData: forecast != null,
            }}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <FinanceHeroShell
          eyebrow="Maandcontext"
          title="Inzichten"
          subtitle="Een rustig overzicht van je maand en vooruitblik."
        >
          <View style={styles.heroMetaRow}>
            {monthContext.statusLabel === "Krap" ? null : (
              <FinanceStatusChip
                tone={monthContext.statusTone}
                label={monthContext.statusLabel}
              />
            )}
          </View>
        </FinanceHeroShell>

        <View style={styles.contentMax}>
          <FinanceMonthSelector
            label={selectedMonth.label}
            canGoToOlderMonth={canGoToOlderMonth}
            canGoToNewerMonth={canGoToNewerMonth}
            onPressLabel={() => setMonthPickerOpen(true)}
            onGoToOlderMonth={() => {
              if (!canGoToOlderMonth) return;
              const nextOption = monthOptions[selectedMonthIndex + 1];
              if (nextOption) setSelectedMonthKey(nextOption.key);
            }}
            onGoToNewerMonth={() => {
              if (!canGoToNewerMonth) return;
              const nextOption = monthOptions[selectedMonthIndex - 1];
              if (nextOption) setSelectedMonthKey(nextOption.key);
            }}
          />

          <View style={styles.sectionBlock}>
            <FinanceSectionHeader title="Forecast" />
            <FinanceForecastSummaryCard model={forecastCard} />
          </View>

          {highlights.length > 0 ? (
            <View style={styles.sectionBlock}>
              <FinanceSectionHeader title="Wat valt op" />
              <View style={styles.insightsList}>
                {highlights.map((item) => (
                  <FinanceInsightCard
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    type={resolveCardType(item.type)}
                    ctaLabel={item.ctaLabel}
                    onPress={
                      item.ctaPath
                        ? () => {
                            router.push(item.ctaPath as never);
                          }
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          {forecast && selectedMonth.key >= getCurrentMonthKey() ? (
            <View style={styles.sectionBlock}>
              <FinanceSectionHeader
                title="Komende momenten"
                rightSlot={
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRemainingMonthOpen(true)}
                    style={({ pressed }) => [
                      styles.remainingMonthButton,
                      pressed ? styles.remainingMonthButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.remainingMonthButtonText}>
                      Resterende maand
                    </Text>
                  </Pressable>
                }
              />
              <FinanceUpcomingMomentsCard items={upcomingMoments} />
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <FinanceSectionHeader title="Waar gaat het meeste geld naartoe?" />
            <FinanceCategorySummaryCard model={categorySummary} />
            {categorySummary.rows.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllCategoriesOpen(true)}
                style={({ pressed }) => [
                  styles.showAllButton,
                  pressed ? styles.showAllButtonPressed : null,
                ]}
              >
                <Text style={styles.showAllButtonText}>
                  Toon alle hoofdcategorieën
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <FinanceMonthSelectorModal
        visible={monthPickerOpen}
        monthOptions={monthOptions}
        selectedKey={selectedMonth.key}
        onClose={() => setMonthPickerOpen(false)}
        onConfirm={(key) => {
          setSelectedMonthKey(key);
          setMonthPickerOpen(false);
        }}
      />

      <FinanceBottomSheetShell
        visible={allCategoriesOpen}
        title="Alle hoofdcategorieën"
        subtitle="De volledige verdeling voor deze maand"
        onClose={() => setAllCategoriesOpen(false)}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetScroll}
        >
          <FinanceCategorySummaryCard
            model={allCategoriesSummary}
            showHeader={false}
          />
        </ScrollView>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={remainingMonthOpen}
        title="Resterende maand"
        subtitle={`Van nu tot het einde van ${selectedMonth.monthLabel}`}
        onClose={() => setRemainingMonthOpen(false)}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.remainingMonthSheet}
        >
          <Text style={styles.remainingMonthIntro}>
            We rekenen vanaf je laatste bekende operationele stand en laten
            daarna zien wat er deze maand waarschijnlijk nog bijkomt en afgaat.
          </Text>

          <View style={styles.remainingMonthAnchorCard}>
            <Text style={styles.remainingMonthSectionEyebrow}>
              Huidig saldo
            </Text>
            <Text style={styles.remainingMonthAnchorValue}>
              {formatAmount(
                latestKnownBalance.balance ??
                  forecast?.currentOperationalBalance ??
                  forecast?.currentBalanceAnchor ??
                  null,
              )}
            </Text>
            <Text style={styles.remainingMonthAnchorMeta}>
              {latestKnownBalance.date ||
              forecast?.currentBalanceAnchorDate
                ? `Laatste bekende operationele stand op ${formatSheetDate(
                    latestKnownBalance.date ?? forecast?.currentBalanceAnchorDate ?? null,
                  )}`
                : "Laatste bekende operationele stand in je forecast"}
            </Text>
          </View>

          <View style={styles.remainingMonthCard}>
            <Text style={styles.remainingMonthSectionEyebrow}>
              Wat er nog aankomt
            </Text>
            <View style={styles.remainingMonthRow}>
              <View style={styles.remainingMonthLabelWrap}>
                <Text style={styles.remainingMonthLabel}>Nog te ontvangen</Text>
                <Text style={styles.remainingMonthSubLabel}>
                  Inkomsten die deze maand nog binnen kunnen komen
                </Text>
              </View>
              <Text
                style={[
                  styles.remainingMonthValue,
                  styles.remainingMonthValueIncome,
                ]}
              >
                {formatSignedAmount(forecast?.remainingExpectedIncomeTotal ?? null)}
              </Text>
            </View>
            <View style={styles.remainingMonthDivider} />
            <View style={styles.remainingMonthRow}>
              <View style={styles.remainingMonthLabelWrap}>
                <Text style={styles.remainingMonthLabel}>
                  Nog vaste lasten en abonnementen
                </Text>
                <Text style={styles.remainingMonthSubLabel}>
                  Verwachte betalingen die redelijk voorspelbaar zijn
                </Text>
              </View>
              <Text
                style={[
                  styles.remainingMonthValue,
                  styles.remainingMonthValueExpense,
                ]}
              >
                {formatSignedAmount(
                  remainingPlannedExpenseTotal == null
                    ? null
                    : -remainingPlannedExpenseTotal,
                )}
              </Text>
            </View>
            <View style={styles.remainingMonthDivider} />
            <View style={styles.remainingMonthRow}>
              <View style={styles.remainingMonthLabelWrap}>
                <Text style={styles.remainingMonthLabel}>
                  Nog variabele uitgaven
                </Text>
                <Text style={styles.remainingMonthSubLabel}>
                  Schatting op basis van je budgettempo voor de rest van deze maand
                </Text>
              </View>
              <Text
                style={[
                  styles.remainingMonthValue,
                  styles.remainingMonthValueExpense,
                ]}
              >
                {formatSignedAmount(
                  remainingVariableExpenseEstimate == null
                    ? null
                    : -remainingVariableExpenseEstimate,
                )}
              </Text>
            </View>
            <View style={styles.remainingMonthDivider} />
            <View style={styles.remainingMonthRow}>
              <View style={styles.remainingMonthLabelWrap}>
                <Text style={styles.remainingMonthLabel}>Nog opzij te zetten</Text>
                <Text style={styles.remainingMonthSubLabel}>
                  Geplande spaaroverboekingen voor de rest van deze maand
                </Text>
              </View>
              <Text
                style={[
                  styles.remainingMonthValue,
                  styles.remainingMonthValueExpense,
                ]}
              >
                {formatSignedAmount(
                  forecast == null
                    ? null
                    : -(forecast.remainingExpectedSavingsOutflowTotal ?? 0),
                )}
              </Text>
            </View>
          </View>

          <View style={styles.remainingMonthNetCard}>
            <Text style={styles.remainingMonthSectionEyebrow}>
              Netto effect rest van de maand
            </Text>
            <Text
              style={[
                styles.remainingMonthNetValue,
                remainingMonthNetTotal != null && remainingMonthNetTotal >= 0
                  ? styles.remainingMonthValueIncome
                  : styles.remainingMonthValueExpense,
              ]}
            >
              {formatSignedAmount(remainingMonthNetTotal)}
            </Text>
            <Text style={styles.remainingMonthNetMeta}>
              Dit is wat er vanaf nu waarschijnlijk nog bijkomt of afgaat op je operationele stand.
            </Text>
          </View>

          <View style={styles.remainingMonthHighlight}>
            <Text style={styles.remainingMonthHighlightLabel}>
              Verwacht eindsaldo eind {selectedMonth.monthLabel}
            </Text>
            <Text style={styles.remainingMonthHighlightValue}>
              {formatAmount(remainingMonthExpectedEndBalance)}
            </Text>
            <Text style={styles.remainingMonthHighlightMeta}>
              {`${formatAmount(
                forecast?.currentOperationalBalance ?? null,
              )} nu ${
                remainingMonthNetTotal != null && remainingMonthNetTotal >= 0
                  ? "+"
                  : "-"
              } ${formatAmount(
                remainingMonthNetTotal == null
                  ? null
                  : Math.abs(remainingMonthNetTotal),
              )} verwachte mutatie op operationele stand`}
            </Text>
          </View>
        </ScrollView>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  scroll: {
    paddingBottom: 128,
  },
  heroMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 32,
  },
  sectionBlock: {
    gap: 12,
  },
  insightsList: {
    gap: 10,
  },
  showAllButton: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: "#f0f1f2",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  showAllButtonPressed: {
    opacity: 0.88,
  },
  showAllButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  remainingMonthButton: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: "#f0f1f2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  remainingMonthButtonPressed: {
    opacity: 0.88,
  },
  remainingMonthButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  sheetScroll: {
    paddingBottom: 12,
  },
  remainingMonthSheet: {
    gap: 12,
    paddingBottom: 8,
  },
  remainingMonthIntro: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  remainingMonthAnchorCard: {
    borderRadius: 28,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 6,
    boxShadow: "0px 8px 16px rgba(17,17,17,0.04)",
    elevation: 1,
  },
  remainingMonthCard: {
    borderRadius: 26,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    boxShadow: "0px 8px 16px rgba(17,17,17,0.04)",
    elevation: 1,
  },
  remainingMonthRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  remainingMonthDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FinColors.borderSubtle,
  },
  remainingMonthSectionEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  remainingMonthAnchorValue: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  remainingMonthAnchorMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  remainingMonthLabelWrap: {
    flex: 1,
    gap: 2,
  },
  remainingMonthLabel: {
    fontSize: 13,
    lineHeight: 16,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  remainingMonthSubLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textSecondary,
  },
  remainingMonthValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
    textAlign: "right",
  },
  remainingMonthValueIncome: {
    color: "#567300",
  },
  remainingMonthValueExpense: {
    color: FinColors.textPrimary,
  },
  remainingMonthNetCard: {
    borderRadius: 26,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 6,
    boxShadow: "0px 8px 16px rgba(17,17,17,0.04)",
    elevation: 1,
  },
  remainingMonthNetValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  remainingMonthNetMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  remainingMonthHighlight: {
    borderRadius: 26,
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 4,
  },
  remainingMonthHighlightLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(17,17,17,0.62)",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  remainingMonthHighlightValue: {
    fontSize: 28,
    lineHeight: 32,
    color: FinColors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  remainingMonthHighlightMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(17,17,17,0.62)",
  },
});
