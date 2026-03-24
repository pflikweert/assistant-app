import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
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
import { computeBudgetPlan } from "@/services/budget-plan";
import { requireCurrentUserId } from "@/services/current-user";
import { ensureForecastFresh } from "@/services/forecast-refresh";
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
  buildInsightsMonthContextSummary,
  type InsightsForecastSummary,
} from "@/services/insights-month-context";
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
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);
  const [allCategoriesOpen, setAllCategoriesOpen] = React.useState(false);

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
      }),
    [budgetPlan, forecast, selectedMonth],
  );
  const forecastCard = React.useMemo<InsightsForecastCardModel>(
    () =>
      buildInsightsForecastCard({
        forecast,
        selectedMonth,
      }),
    [forecast, selectedMonth],
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

  const loadForecastSummary = React.useCallback(
    async (userId: string): Promise<InsightsForecastSummary | null> => {
      try {
        const reason = selectedMonth.isCurrentMonth
          ? "insights_open"
          : selectedMonth.key < getCurrentMonthKey()
            ? "historical_month_open"
            : "future_month_open";

        await ensureForecastFresh({
          reason,
          referenceDate: getReferenceDate(selectedMonth),
        }).catch(() => null);

        const fetchLatest = async () =>
          supabase
            .from("monthly_cashflow_forecasts")
            .select(
              "month_start,forecast_reference_date,cash_risk_flag,risk_flag,expected_end_of_month_balance,lowest_expected_balance,lowest_expected_balance_date,next_expected_event_date,next_expected_event_label,expected_income_total,remaining_expected_income_total,remaining_expected_expense_total,upcoming_committed_income_total,upcoming_committed_expense_total,expected_fixed_costs,expected_subscriptions,expected_variable_costs",
            )
            .eq("user_id", userId)
            .eq("month_start", selectedMonth.startIso)
            .maybeSingle();

        const fetchLegacy = async () =>
          supabase
            .from("monthly_cashflow_forecasts")
            .select("month_start,risk_flag,expected_end_of_month_balance")
            .eq("user_id", userId)
            .eq("month_start", selectedMonth.startIso)
            .maybeSingle();

        let result: any = await fetchLatest();
        if (result.error && isMissingColumnError(result.error)) {
          result = await fetchLegacy();
        }

        if (result.error) {
          if (isMissingRelationError(result.error)) {
            return null;
          }
          throw result.error;
        }

        if (!result.data) {
          return null;
        }

        const row = result.data as Record<string, unknown>;
        return {
          monthStart: String(row.month_start || selectedMonth.startIso),
          forecastReferenceDate: row.forecast_reference_date
            ? String(row.forecast_reference_date)
            : null,
          cashRiskFlag:
            row.cash_risk_flag === "cash_gap_warning" ? "cash_gap_warning" : "none",
          riskFlag: row.risk_flag === "deficit_warning" ? "deficit_warning" : "none",
          expectedEndBalance:
            row.expected_end_of_month_balance == null
              ? null
              : Number(row.expected_end_of_month_balance),
          lowestExpectedBalance:
            row.lowest_expected_balance == null
              ? null
              : Number(row.lowest_expected_balance),
          lowestExpectedBalanceDate: row.lowest_expected_balance_date
            ? String(row.lowest_expected_balance_date)
            : null,
          nextExpectedEventDate: row.next_expected_event_date
            ? String(row.next_expected_event_date)
            : null,
          nextExpectedEventLabel: row.next_expected_event_label
            ? String(row.next_expected_event_label)
            : null,
          expectedIncomeTotal:
            row.expected_income_total == null
              ? null
              : Number(row.expected_income_total),
          remainingExpectedIncomeTotal:
            row.remaining_expected_income_total == null
              ? null
              : Number(row.remaining_expected_income_total),
          remainingExpectedExpenseTotal:
            row.remaining_expected_expense_total == null
              ? null
              : Number(row.remaining_expected_expense_total),
          upcomingCommittedIncomeTotal:
            row.upcoming_committed_income_total == null
              ? null
              : Number(row.upcoming_committed_income_total),
          upcomingCommittedExpenseTotal:
            row.upcoming_committed_expense_total == null
              ? null
              : Number(row.upcoming_committed_expense_total),
          expectedFixedCosts:
            row.expected_fixed_costs == null
              ? null
              : Number(row.expected_fixed_costs),
          expectedSubscriptions:
            row.expected_subscriptions == null
              ? null
              : Number(row.expected_subscriptions),
          expectedVariableCosts:
            row.expected_variable_costs == null
              ? null
              : Number(row.expected_variable_costs),
        };
      } catch (error) {
        console.error("[insights] forecast summary load error", error);
        return null;
      }
    },
    [selectedMonth],
  );

  const loadBudgetSummary = React.useCallback(
    async (): Promise<BudgetPlanComputation | null> => {
      try {
        const referenceDate = getReferenceDate(selectedMonth);
        const plan = await computeBudgetPlan(referenceDate, "default", new Date());
        return plan;
      } catch (error) {
        if (isMissingRelationError(error)) {
          return null;
        }

        console.error("[insights] budget summary load error", error);
        return null;
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
    const [forecastSummary, budgetSummary, insightSignals, highlightHistory] =
      await Promise.all([
        loadForecastSummary(userId),
        loadBudgetSummary(),
        loadInsightSignals(userId),
        loadInsightsHighlightHistory(userId, selectedMonth.key),
      ]);

    setForecast(forecastSummary);
    setBudgetPlan(budgetSummary);
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
    loadBudgetSummary,
    loadForecastSummary,
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
        rightSlot={<FinanceAvatarBadge />}
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
              <FinanceSectionHeader title="Komende momenten" />
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
  sheetScroll: {
    paddingBottom: 12,
  },
});
