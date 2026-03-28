import { AppIcon } from "@/components/ui/app-icon";
import { FinanceBudgetProgressBar } from "@/components/ui/finance-budget-progress-bar";
import { FinancePressableSurface } from "@/components/ui/finance-pressable-surface";
import { FinColors, FinSurfaces } from "@/constants/theme";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import {
  getMonthVariableBudgetSnapshot,
  getMonthVariableBudgetUsageText,
  getWeekBudgetSnapshot,
  getWeekTempoMessage,
} from "@/services/budget-risk";
import type {
  BudgetPlanComputation,
  BudgetWeekPlanRow,
} from "@/types/categorization";
import React from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function formatWeekRangeLabel(startDate: string, endDateExclusive: string) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  const start = new Date(`${startDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return `${start.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
  })} - ${endDate.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
  })}`;
}

function formatRemainingDaysInWeekLabel(
  endDateExclusive: string,
  referenceDate: Date,
) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) return null;

  const utcToday = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
  const dayDiff = Math.ceil(
    (endDate.getTime() - utcToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  const remainingDays = Math.max(0, Math.min(7, dayDiff));
  const dayLabel = remainingDays === 1 ? "dag" : "dagen";
  return `${remainingDays} ${dayLabel} resterend`;
}

export type DashboardBudgetOverviewModel = {
  referenceDate: Date;
  monthBadgeLabel: string;
  monthSnapshot: ReturnType<typeof getMonthVariableBudgetSnapshot>;
  remainingMonthlyBudget: number | null;
  monthProgressLabel: string | null;
  monthUsageText: string;
  lowestOperationalPointLabel: string | null;
  currentWeekPlan: BudgetWeekPlanRow | null;
  weekSnapshot: ReturnType<typeof getWeekBudgetSnapshot>;
  weeklyBudgetRemaining: number | null;
  weekRangeLabel: string | null;
  weekRemainingDaysLabel: string | null;
  weekProgressLabel: string | null;
  weekUsageText: string;
  weekTempoMessage: string;
};

export function buildDashboardBudgetOverviewModel(
  budgetPlan: BudgetPlanComputation | null,
  forecastSurface: FinancialSurfaceBalanceSnapshot | null = null,
  referenceDate = budgetPlan ? new Date(budgetPlan.referenceDate) : new Date(),
): DashboardBudgetOverviewModel {
  const monthSnapshot = getMonthVariableBudgetSnapshot(budgetPlan);
  const currentWeekPlan =
    budgetPlan?.weeklyVariablePlan.find((week) => week.isCurrentWeek) ?? null;
  const weekSnapshot = getWeekBudgetSnapshot(currentWeekPlan, referenceDate);
  const lowestOperationalPoint =
    forecastSurface?.lowestOperationalPointInMonth.amount ?? null;

  return {
    referenceDate,
    monthBadgeLabel: "",
    monthSnapshot,
    remainingMonthlyBudget: monthSnapshot.remaining,
    monthProgressLabel:
      monthSnapshot.state === "no_data"
        ? null
        : `${Math.round(monthSnapshot.progress * 100)}% verbruikt`,
    monthUsageText: getMonthVariableBudgetUsageText(monthSnapshot, euroFormatter),
    lowestOperationalPointLabel:
      lowestOperationalPoint == null
        ? null
        : `Laagste punt ${euroFormatter.format(lowestOperationalPoint)}`,
    currentWeekPlan,
    weekSnapshot,
    weeklyBudgetRemaining: weekSnapshot.remaining,
    weekRangeLabel: currentWeekPlan
      ? formatWeekRangeLabel(
          currentWeekPlan.startDate,
          currentWeekPlan.endDateExclusive,
        )
      : null,
    weekRemainingDaysLabel: currentWeekPlan
      ? formatRemainingDaysInWeekLabel(
          currentWeekPlan.endDateExclusive,
          referenceDate,
        )
      : null,
    weekProgressLabel:
      weekSnapshot.state === "no_data"
        ? null
        : `${Math.round(weekSnapshot.progress * 100)}% van weekbudget`,
    weekUsageText:
      weekSnapshot.spent != null && weekSnapshot.budget != null
        ? `${euroFormatter.format(weekSnapshot.spent)} uitgegeven van ${euroFormatter.format(weekSnapshot.budget)} weekbudget`
        : "Weekbudget volgt zodra je budget actief is",
    weekTempoMessage: getWeekTempoMessage(currentWeekPlan, referenceDate),
  };
}

type DashboardBudgetOverviewCardProps = {
  model: DashboardBudgetOverviewModel;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function DashboardBudgetOverviewCard({
  model,
  onPress,
  style,
}: DashboardBudgetOverviewCardProps) {
  const week = model.weekSnapshot;
  const weekStatusLabel = week.label || "Let op";
  const cardContent = (
    <View style={[styles.card, style]}>
      <View style={styles.weekSectionHeader}>
        <Text style={styles.weekSectionTitle}>Weekbudget status</Text>
        <Text style={styles.weekSectionRange}>
          {model.weekRangeLabel || "Weekbudget volgt zodra je budget actief is"}
        </Text>
      </View>

      <View style={styles.weekCard}>
        <View style={styles.weekSummaryRow}>
          <View style={styles.weekSummaryMain}>
            <Text style={styles.weekRemaining}>
              {model.weeklyBudgetRemaining == null
                ? "Nog geen data"
                : `${euroFormatter.format(model.weeklyBudgetRemaining)} resterend`}
            </Text>
            <Text style={styles.weekUsageText}>{model.weekUsageText}</Text>
          </View>
          <View style={styles.weekDaysWrap}>
            {model.weekRemainingDaysLabel ? (
              <>
                <Text style={styles.weekDaysPrimary}>
                  {model.weekRemainingDaysLabel.replace(" resterend", "")}
                </Text>
                <Text style={styles.weekDaysSecondary}>resterend</Text>
              </>
            ) : (
              <Text style={styles.weekDaysSecondary}>n.b.</Text>
            )}
          </View>
        </View>

        <FinanceBudgetProgressBar
          progress={week.progress * 100}
          tone={week.tone}
          style={styles.weekProgressTrack}
          fillStyle={styles.weekProgressFill}
        />

        <View style={styles.weekMetaRow}>
          <View style={styles.weekStatusPill}>
            <View style={styles.weekStatusDot} />
            <Text style={styles.weekStatusPillText}>{weekStatusLabel}</Text>
          </View>
          {model.weekProgressLabel ? (
            <Text style={styles.weekProgressLabel}>{model.weekProgressLabel}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.coachingCard}>
        <View style={styles.coachingIconWrap}>
          <AppIcon
            name="emoji-objects"
            size={18}
            color={FinColors.warningText}
            variant="outlined"
          />
        </View>
        <Text style={styles.coachingText}>{model.weekTempoMessage}</Text>
      </View>
    </View>
  );

  return (
    <FinancePressableSurface
      onPress={onPress}
      pressedStyle={styles.cardPressed}
    >
      {cardContent}
    </FinancePressableSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  weekSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
  },
  weekSectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  weekSectionRange: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekCard: {
    ...FinSurfaces.mainPageTintedCard,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  weekSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  weekSummaryMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  weekRemaining: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  weekUsageText: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekDaysWrap: {
    alignItems: "flex-end",
  },
  weekDaysPrimary: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  weekDaysSecondary: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: FinColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  weekProgressTrack: {
    height: 8,
    borderRadius: 999,
  },
  weekProgressFill: {
    borderRadius: 999,
  },
  weekMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  weekStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: FinColors.warningText,
  },
  weekStatusPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  weekProgressLabel: {
    fontSize: 10,
    lineHeight: 12,
    color: FinColors.textSecondary,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "right",
  },
  coachingCard: {
    borderRadius: 24,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
  },
  coachingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.warningBg,
  },
  coachingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
});
