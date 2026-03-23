import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
import { MonthPickerSheet } from "@/components/month-picker-sheet";
import { AppIcon } from "@/components/ui/app-icon";
import {
  FinanceInsightCard,
  type FinanceInsightCardType,
} from "@/components/ui/finance-insight-card";
import { FinanceForecastSummaryCard } from "@/components/ui/finance-forecast-summary-card";
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
  formatAttentionCountLabel,
  type InsightsForecastSummary,
} from "@/services/insights-month-context";
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
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type InsightSignals = {
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

  const [loading, setLoading] = React.useState(true);
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
  const [highlights, setHighlights] = React.useState<InsightsHighlight[]>([]);
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);

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
  const upcomingMoments = React.useMemo(
    () =>
      buildInsightsUpcomingMoments({
        forecast,
        selectedMonth,
      }),
    [forecast, selectedMonth],
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

        let result = await fetchLatest();
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

        const fetchWithAnalysis = async () =>
          supabase
            .from("transactions")
            .select("id,amount,counterparty,date,analysis_category")
            .eq("user_id", userId)
            .gte("date", toIsoDate(lookbackStart))
            .lt("date", selectedMonth.endIso)
            .lt("amount", 0)
            .order("date", { ascending: false })
            .limit(1500);

        const fetchLegacy = async () =>
          supabase
            .from("transactions")
            .select("id,amount,counterparty,date")
            .eq("user_id", userId)
            .gte("date", toIsoDate(lookbackStart))
            .lt("date", selectedMonth.endIso)
            .lt("amount", 0)
            .order("date", { ascending: false })
            .limit(1500);

        let result = await fetchWithAnalysis();
        if (result.error && isMissingColumnError(result.error)) {
          result = await fetchLegacy();
        }

        if (result.error) throw result.error;

        const rows = ((result.data || []) as Record<string, unknown>[]).map(
          (row) => ({
            id: row.id ? String(row.id) : undefined,
            amount: Number(row.amount || 0),
            counterparty: row.counterparty ? String(row.counterparty) : null,
            date: String(row.date || ""),
            analysisCategory:
              row.analysis_category === "fixed_costs" ||
              row.analysis_category === "subscriptions" ||
              row.analysis_category === "variable_costs" ||
              row.analysis_category === "savings_transfer"
                ? row.analysis_category
                : null,
          }),
        );

        return {
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
        return { currentMonth: [], previousMonth: [], lookback: [] };
      }
    },
    [selectedMonth],
  );

  const refreshInsights = React.useCallback(async () => {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  }, [
    loadBudgetSummary,
    loadForecastSummary,
    loadInsightSignals,
    selectedMonth.key,
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
          subtitle={loading ? "We halen je maandbeeld op." : monthContext.contextLine}
        >
          <View style={styles.heroMetaRow}>
            <View style={styles.monthBadge}>
              <Text style={styles.monthLabel}>{selectedMonth.label}</Text>
            </View>
            <FinanceStatusChip
              tone={monthContext.statusTone}
              label={monthContext.statusLabel}
            />
          </View>

          <View style={styles.summaryCard}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={FinColors.textSecondary} />
                <Text style={styles.loadingText}>Maandcontext wordt opgebouwd...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.summaryTitle}>Wat dit betekent</Text>
                <Text style={styles.summaryText}>{monthContext.summaryLine}</Text>
                {monthContext.attentionCount > 0 ? (
                  <Text style={styles.summaryMeta}>
                    Open aandacht: {formatAttentionCountLabel(monthContext.attentionCount)}.
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </FinanceHeroShell>

        <View style={styles.contentMax}>
          <View style={styles.monthSelectorRow}>
            <Pressable
              style={[
                styles.monthSelectorNavButton,
                !canGoToOlderMonth && styles.monthSelectorNavButtonDisabled,
              ]}
              onPress={() => {
                if (!canGoToOlderMonth) return;
                const nextOption = monthOptions[selectedMonthIndex + 1];
                if (nextOption) setSelectedMonthKey(nextOption.key);
              }}
              disabled={!canGoToOlderMonth}
            >
              <Text style={styles.monthSelectorNavButtonText}>‹</Text>
            </Pressable>

            <Pressable
              style={styles.monthSelectorBadge}
              onPress={() => setMonthPickerOpen(true)}
            >
              <Text style={styles.monthSelectorBadgeText}>{selectedMonth.label}</Text>
              <AppIcon
                name="expand-more"
                size={18}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </Pressable>

            <Pressable
              style={[
                styles.monthSelectorNavButton,
                !canGoToNewerMonth && styles.monthSelectorNavButtonDisabled,
              ]}
              onPress={() => {
                if (!canGoToNewerMonth) return;
                const nextOption = monthOptions[selectedMonthIndex - 1];
                if (nextOption) setSelectedMonthKey(nextOption.key);
              }}
              disabled={!canGoToNewerMonth}
            >
              <Text style={styles.monthSelectorNavButtonText}>›</Text>
            </Pressable>
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

          <View style={styles.sectionBlock}>
            <FinanceSectionHeader title="Forecast" />
            <FinanceForecastSummaryCard model={forecastCard} />
          </View>

          {upcomingMoments.length > 0 ? (
            <View style={styles.sectionBlock}>
              <FinanceSectionHeader title="Komende momenten" />
              <FinanceUpcomingMomentsCard items={upcomingMoments} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <MonthPickerSheet
        visible={monthPickerOpen}
        title="Kies maand"
        helper="Historie plus 6 maanden vooruit"
        options={monthOptions}
        selectedKey={selectedMonth.key}
        onClose={() => setMonthPickerOpen(false)}
        onSelect={(key) => {
          setSelectedMonthKey(key);
          setMonthPickerOpen(false);
        }}
      />
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
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  monthBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthLabel: {
    fontSize: 13,
    lineHeight: 16,
    color: FinColors.textSecondary,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  summaryCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 14,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: FinColors.textMuted,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  summaryMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 32,
  },
  monthSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  monthSelectorNavButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  monthSelectorNavButtonDisabled: {
    opacity: 0.42,
  },
  monthSelectorNavButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  monthSelectorBadge: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  monthSelectorBadgeText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sectionBlock: {
    gap: 12,
  },
  insightsList: {
    gap: 10,
  },
});
