import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { RiskProgressBar } from "@/components/risk-progress-bar";
import { FinColors } from "@/constants/theme";
import { getBudgetRiskTone } from "@/services/budget-risk";
import React from "react";
import {
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function formatUtilization(value: number) {
  if (!Number.isFinite(value)) return ">100%";
  return `${Math.round(value * 100)}%`;
}

export function BudgetCategoryProgressRow({
  label,
  iconName,
  utilization,
  actual,
  budget,
  onPress,
  showChevron = false,
  chevronExpanded = false,
  style,
}: {
  label: string;
  iconName: AppIconName;
  utilization: number;
  actual: number;
  budget: number;
  onPress?: () => void;
  showChevron?: boolean;
  chevronExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = Number.isFinite(utilization)
    ? Math.min(Math.max(utilization, 0), 1)
    : 1;
  const tone = getBudgetRiskTone(utilization);
  const isWatch = tone === "watch";
  const isOverBudget = tone === "critical";

  const content = (
    <>
      <View style={styles.topRow}>
        <View style={styles.leftWrap}>
          <View style={styles.iconWrap}>
            <AppIcon
              name={iconName}
              size={14}
              color={FinColors.textPrimary}
              variant="outlined"
            />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {showChevron ? (
            <AppIcon
              name={chevronExpanded ? "expand-more" : "chevron-right"}
              size={16}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          ) : null}
        </View>
        <Text
          style={[
            styles.meta,
            isWatch && styles.metaWatch,
            isOverBudget && styles.metaCritical,
          ]}
        >
          {budget > 0
            ? `${formatUtilization(utilization)} gebruikt`
            : "Geen budget"}
        </Text>
      </View>

      <RiskProgressBar progress={progress} tone={tone} style={styles.track} />

      <Text style={styles.amountMeta}>
        {fmt.format(actual)} van {fmt.format(budget)}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable style={[styles.root, style]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.root, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  leftWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  label: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  meta: {
    fontSize: 11,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  metaCritical: {
    color: FinColors.red,
  },
  metaWatch: {
    color: FinColors.warningText,
  },
  track: {
    height: 6,
  },
  amountMeta: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
});
