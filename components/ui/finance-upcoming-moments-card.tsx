import { FinColors } from "@/constants/theme";
import type { InsightsUpcomingMoment } from "@/services/insights-upcoming-moments";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceUpcomingMomentsCardProps = {
  items: InsightsUpcomingMoment[];
};

function resolveAmountColor(tone: InsightsUpcomingMoment["amountTone"]) {
  if (tone === "income") return "#567300";
  if (tone === "expense") return FinColors.red;
  return FinColors.textPrimary;
}

export function FinanceUpcomingMomentsCard({ items }: FinanceUpcomingMomentsCardProps) {
  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <View
          key={item.id}
          style={[styles.row, index < items.length - 1 ? styles.rowWithDivider : null]}
        >
          <View style={styles.dateCol}>
            <Text style={styles.month}>{item.monthLabel}</Text>
            <Text style={styles.day}>{item.dayLabel}</Text>
          </View>

          <View style={styles.bodyCol}>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            <Text numberOfLines={2} style={styles.subtitle}>
              {item.subtitle}
            </Text>
          </View>

          <View style={styles.amountCol}>
            <Text style={[styles.amount, { color: resolveAmountColor(item.amountTone) }]}>
              {item.amountLabel}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    overflow: "hidden",
  },
  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  dateCol: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: FinColors.borderSubtle,
    paddingRight: 8,
    gap: 2,
  },
  month: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1,
    color: FinColors.textMuted,
    fontWeight: "700",
  },
  day: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.7,
  },
  bodyCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: -0.2,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 13,
    color: FinColors.textSecondary,
    fontWeight: "500",
  },
  amountCol: {
    alignItems: "flex-end",
    minWidth: 84,
  },
  amount: {
    fontSize: 15,
    lineHeight: 17,
    letterSpacing: -0.25,
    fontWeight: "800",
    textAlign: "right",
  },
});
