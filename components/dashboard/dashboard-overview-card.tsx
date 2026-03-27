import { AppIcon } from "@/components/ui/app-icon";
import { FinanceBudgetProgressBar } from "@/components/ui/finance-budget-progress-bar";
import { FinanceStatusChip, type FinanceStatusTone } from "@/components/ui/finance-status-chip";
import { FinColors } from "@/constants/theme";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import {
  getMonthVariableBudgetSnapshot,
  getMonthVariableBudgetUsageText,
  getWeekBudgetSnapshot,
  getWeekTempoMessage,
  type BudgetRiskTone,
} from "@/services/budget-risk";
import type {
  BudgetPlanComputation,
  BudgetWeekPlanRow,
} from "@/types/categorization";
import React from "react";
import {
  Pressable,
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

function mapBudgetToneToStatusTone(tone: BudgetRiskTone): FinanceStatusTone {
  if (tone === "good") return "good";
  if (tone === "watch") return "watch";
  if (tone === "critical") return "critical";
  return "neutral";
}

function formatMonthBadgeLabel(referenceDate: Date) {
  return new Intl.DateTimeFormat("nl-NL", { month: "short" })
    .format(referenceDate)
    .replace(/\./g, "")
    .toUpperCase();
}

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
    monthBadgeLabel: formatMonthBadgeLabel(referenceDate),
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
  const month = model.monthSnapshot;
  const week = model.weekSnapshot;
  const cardContent = (
    <View style={[styles.card, style]}>
      <View style={styles.monthHeaderRow}>
        <View style={styles.monthHeaderText}>
          <Text style={styles.sectionEyebrow}>Resterend maandbudget</Text>
          <Text style={styles.monthTitle}>
            {month.state === "no_data"
              ? "Nog geen data"
              : model.remainingMonthlyBudget == null
                ? "Nog geen variabel budget"
                : euroFormatter.format(model.remainingMonthlyBudget)}
          </Text>
        </View>
        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>{model.monthBadgeLabel}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <FinanceStatusChip
          label={month.label}
          tone={mapBudgetToneToStatusTone(month.tone)}
        />
      </View>

      <View style={styles.monthProgressBlock}>
        <FinanceBudgetProgressBar
          progress={month.progress * 100}
          tone={month.tone}
        />
        <View style={styles.progressMetaRow}>
          <Text style={styles.progressMetaText}>
            {model.monthProgressLabel || "Nog geen maandbudget"}
          </Text>
          {model.lowestOperationalPointLabel ? (
            <Text style={styles.progressMetaText}>
              {model.lowestOperationalPointLabel}
            </Text>
          ) : null}
        </View>
        <Text style={styles.usageText}>{model.monthUsageText}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.weekHeaderRow}>
        <View style={styles.weekHeaderText}>
          <Text style={styles.sectionEyebrow}>Weekbudget status</Text>
          <Text style={styles.sectionSubtle}>
            {model.weekRangeLabel || "Weekbudget volgt zodra je budget actief is"}
          </Text>
        </View>
        <View style={styles.weekHeaderIcon}>
          <AppIcon
            name="bar-chart"
            size={18}
            color={FinColors.warningText}
            variant="outlined"
          />
        </View>
      </View>

      <View style={styles.weekSummaryRow}>
        <View style={styles.weekSummaryMain}>
          <Text style={styles.weekRemaining}>
            {model.weeklyBudgetRemaining == null
              ? "Nog geen data"
              : `${euroFormatter.format(model.weeklyBudgetRemaining)} resterend`}
          </Text>
          <Text style={styles.weekUsageText}>{model.weekUsageText}</Text>
        </View>
        {model.weekRemainingDaysLabel ? (
          <Text style={styles.weekRemainingDays}>
            {model.weekRemainingDaysLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.weekStatusRow}>
        <FinanceStatusChip
          label={week.label}
          tone={mapBudgetToneToStatusTone(week.tone)}
        />
        {model.weekProgressLabel ? (
          <Text style={styles.weekProgressLabel}>{model.weekProgressLabel}</Text>
        ) : null}
      </View>

      <FinanceBudgetProgressBar
        progress={week.progress * 100}
        tone={week.tone}
      />

      <View style={styles.weekHintCard}>
        <View style={styles.weekHintIconWrap}>
          <AppIcon
            name="trending-up"
            size={14}
            color={FinColors.warningText}
            variant="outlined"
          />
        </View>
        <Text style={styles.weekHintText}>{model.weekTempoMessage}</Text>
      </View>
    </View>
  );

  if (!onPress) return cardContent;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.cardPressed : null]}
    >
      {cardContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 30,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
    boxShadow: "0px 10px 24px rgba(17,17,17,0.05)",
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.92,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  monthHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 12,
    lineHeight: 14,
    color: FinColors.textMuted,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  monthTitle: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.2,
  },
  monthBadge: {
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    color: FinColors.warningText,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  statusRow: {
    marginTop: -2,
  },
  monthProgressBlock: {
    gap: 8,
  },
  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressMetaText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  usageText: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  weekHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  weekHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionSubtle: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
  },
  weekSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    lineHeight: 30,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.6,
  },
  weekUsageText: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekRemainingDays: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: FinColors.warningText,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    textAlign: "right",
  },
  weekStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  weekProgressLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
    fontWeight: "700",
    textAlign: "right",
  },
  weekHintCard: {
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
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgCard,
  },
  weekHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
});
