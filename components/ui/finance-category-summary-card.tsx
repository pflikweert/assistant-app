import { FinanceBudgetProgressBar } from "@/components/ui/finance-budget-progress-bar";
import { FinColors } from "@/constants/theme";
import type { InsightsCategorySummaryModel } from "@/services/insights-category-summary";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceCategorySummaryCardProps = {
  model: InsightsCategorySummaryModel;
  showHeader?: boolean;
};

export function FinanceCategorySummaryCard({
  model,
  showHeader = true,
}: FinanceCategorySummaryCardProps) {
  if (!model.rows.length) {
    return (
      <View style={styles.card}>
        {showHeader ? (
          <View style={styles.header}>
            <Text style={styles.title}>{model.title}</Text>
            <Text style={styles.subtitle}>{model.subtitle}</Text>
          </View>
        ) : null}
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{model.emptyTitle}</Text>
          <Text style={styles.emptyDescription}>{model.emptyDescription}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {showHeader ? (
        <View style={styles.header}>
          <Text style={styles.title}>{model.title}</Text>
          <Text style={styles.subtitle}>{model.subtitle}</Text>
        </View>
      ) : null}

      <View style={styles.rows}>
        {model.rows.map((row, index) => (
          <View
            key={`${row.categoryKey}-${index}`}
            style={[
              styles.row,
              index < model.rows.length - 1 ? styles.rowDivider : null,
            ]}
          >
            <View style={styles.rowHeader}>
              <Text numberOfLines={1} style={styles.rowTitle}>
                {row.label}
              </Text>
              <View style={styles.amountCol}>
                <Text style={styles.kindLabel}>{row.statusLabel}</Text>
                <Text style={styles.amount}>{row.amountLabel}</Text>
              </View>
            </View>

            <Text numberOfLines={2} style={styles.context}>
              {row.contextLabel}
            </Text>

            {row.progress != null ? (
              <View style={styles.progressWrap}>
                <FinanceBudgetProgressBar
                  progress={row.progress * 100}
                  tone={row.progressTone || "neutral"}
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    backgroundColor: "#f3f3f5",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 4,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  rows: {
    paddingBottom: 6,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.06)",
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.2,
  },
  amountCol: {
    alignItems: "flex-end",
    gap: 2,
    minWidth: 88,
  },
  kindLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1,
    color: FinColors.textMuted,
    textTransform: "uppercase",
  },
  amount: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.3,
    textAlign: "right",
  },
  context: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  progressWrap: {
    marginTop: 2,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: "#f7f8f9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  emptyDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textSecondary,
  },
});
