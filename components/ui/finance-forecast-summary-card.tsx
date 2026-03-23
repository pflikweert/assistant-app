import { FinColors } from "@/constants/theme";
import type { InsightsForecastCardModel } from "@/services/insights-forecast-card";
import { AppIcon } from "@/components/ui/app-icon";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceForecastSummaryCardProps = {
  model: InsightsForecastCardModel;
};

export function FinanceForecastSummaryCard({
  model,
}: FinanceForecastSummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{model.title}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{model.statusLabel}</Text>
        </View>
      </View>

      <Text style={[styles.amount, model.isFallback && styles.amountFallback]}>
        {model.amountLabel}
      </Text>

      <View style={styles.lowestCard}>
        <View style={styles.lowestLabelRow}>
          <View style={styles.lowestIconWrap}>
            <AppIcon
              name="event"
              size={14}
              color={FinColors.warningText}
              variant="outlined"
            />
          </View>
          <Text style={styles.lowestLabel}>Laagste saldo</Text>
        </View>
        <Text style={styles.lowestAmount}>{model.lowestBalanceLabel}</Text>
        {model.lowestBalanceDateLabel ? (
          <Text style={styles.lowestDate}>Rond {model.lowestBalanceDateLabel}</Text>
        ) : null}
      </View>

      <Text style={styles.explanation}>{model.explanation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.16)",
    backgroundColor: "#080b08",
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.52)",
    textTransform: "uppercase",
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusPillText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#2b2500",
    textTransform: "uppercase",
  },
  amount: {
    marginTop: 2,
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "800",
    letterSpacing: -1.3,
    color: "rgba(255,255,255,0.94)",
  },
  amountFallback: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  lowestCard: {
    marginTop: 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(20,27,39,0.42)",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  lowestLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lowestIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(138,100,0,0.14)",
  },
  lowestLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: "rgba(255,255,255,0.60)",
    textTransform: "uppercase",
  },
  lowestAmount: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
    color: "rgba(255,255,255,0.94)",
  },
  lowestDate: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
  },
  explanation: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.76)",
  },
});
