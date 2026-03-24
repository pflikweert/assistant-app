import { FinanceStatusChip, type FinanceStatusTone } from "@/components/ui/finance-status-chip";
import { FinColors } from "@/constants/theme";
import { RiskProgressBar } from "@/components/risk-progress-bar";
import type { BudgetRiskTone } from "@/services/budget-risk";
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapBudgetToneToStatusTone(tone: BudgetRiskTone): FinanceStatusTone {
  if (tone === "good") return "good";
  if (tone === "watch") return "watch";
  if (tone === "critical") return "critical";
  return "neutral";
}

export type BudgetMonthSummaryCardProps = {
  title?: React.ReactNode;
  status: React.ReactNode;
  remainingAmount: number;
  usedAmount: number;
  totalVariableAmount: number;
  tone: BudgetRiskTone;
  style?: StyleProp<ViewStyle>;
};

export function BudgetMonthSummaryCard({
  title = "Deze maand",
  status,
  remainingAmount,
  usedAmount,
  totalVariableAmount,
  tone,
  style,
}: BudgetMonthSummaryCardProps) {
  const progress =
    totalVariableAmount > 0
      ? clamp(usedAmount / totalVariableAmount, 0, 1)
      : 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <FinanceStatusChip label={String(status)} tone={mapBudgetToneToStatusTone(tone)} />
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amountLabel}>Nog beschikbaar</Text>
        <Text style={styles.amount}>{euroFormatter.format(remainingAmount)}</Text>
      </View>

      <View style={styles.progressWrap}>
        <RiskProgressBar progress={progress} tone={tone} height={7} />
      </View>

      <Text style={styles.meta}>
        {euroFormatter.format(usedAmount)} gebruikt van{" "}
        {euroFormatter.format(totalVariableAmount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    boxShadow: "0px 10px 24px rgba(17,17,17,0.04)",
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  amountBlock: {
    gap: 4,
  },
  amountLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: FinColors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  amount: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.2,
  },
  progressWrap: {
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
});
