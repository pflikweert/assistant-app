import { FinanceStatusChip, type FinanceStatusTone } from "@/components/ui/finance-status-chip";
import { FinColors } from "@/constants/theme";
import type { BudgetRiskTone } from "@/services/budget-risk";
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapBudgetToneToStatusTone(tone: BudgetRiskTone): FinanceStatusTone {
  if (tone === "good") return "good";
  if (tone === "watch") return "watch";
  if (tone === "critical") return "critical";
  return "neutral";
}

function getProgressRingStyle(tone: BudgetRiskTone) {
  if (tone === "good") return styles.progressRingGood;
  if (tone === "watch") return styles.progressRingWatch;
  if (tone === "critical") return styles.progressRingCritical;
  return styles.progressRingNeutral;
}

export type BudgetMonthSummaryCardProps = {
  title?: React.ReactNode;
  status: React.ReactNode;
  remainingAmount: number;
  usedAmount: number;
  totalVariableAmount: number;
  tone: BudgetRiskTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BudgetMonthSummaryCard({
  title = "Deze maand",
  status,
  remainingAmount,
  usedAmount,
  totalVariableAmount,
  tone,
  onPress,
  style,
}: BudgetMonthSummaryCardProps) {
  const progress =
    totalVariableAmount > 0
      ? clamp(usedAmount / totalVariableAmount, 0, 1)
      : 0;

  const content = (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.remainingLine}>
            <Text style={styles.remainingAmount}>{euroFormatter.format(remainingAmount)}</Text>{" "}
            resterend
          </Text>
          <Text style={styles.supportLine}>
            {euroFormatter.format(usedAmount)} uitgegeven van{" "}
            {euroFormatter.format(totalVariableAmount)} richtbedrag
          </Text>
        </View>

        <View style={[styles.progressRing, getProgressRingStyle(tone)]}>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <FinanceStatusChip
          label={String(status)}
          tone={mapBudgetToneToStatusTone(tone)}
        />
        <Text style={styles.footerLabel}>Variabele ruimte</Text>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.cardPressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    boxShadow: "0px 10px 24px rgba(17,17,17,0.04)",
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.9,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: FinColors.textMuted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  remainingLine: {
    marginTop: 2,
    fontSize: 26,
    lineHeight: 32,
    color: FinColors.textSecondary,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  remainingAmount: {
    color: FinColors.textPrimary,
    fontWeight: "900",
  },
  supportLine: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  progressRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  progressRingNeutral: {
    borderColor: FinColors.textMuted,
  },
  progressRingGood: {
    borderColor: FinColors.green,
  },
  progressRingWatch: {
    borderColor: FinColors.yellow,
  },
  progressRingCritical: {
    borderColor: FinColors.red,
  },
  progressText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: FinColors.textPrimary,
  },
  footerRow: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(17,17,17,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
    fontWeight: "700",
  },
});
