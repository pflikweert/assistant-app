import { BudgetCategoryProgressRow } from "@/components/budget-category-progress-row";
import { type AppIconName } from "@/components/ui/app-icon";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinColors } from "@/constants/theme";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export type BudgetWeekBreakdownRow = {
  key: string;
  label: string;
  iconName: AppIconName;
  usedAmount: number;
  totalBudget: number;
};

type BudgetWeekBreakdownModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  periodLabel: string;
  totalSpent: number;
  totalBudget: number;
  items: BudgetWeekBreakdownRow[];
};

export function BudgetWeekBreakdownModal({
  visible,
  onClose,
  title,
  periodLabel,
  totalSpent,
  totalBudget,
  items,
}: BudgetWeekBreakdownModalProps) {
  const totalRemaining = Math.max(totalBudget - totalSpent, 0);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={`${periodLabel} · variabele uitgaven per categorie`}
      sheetStyle={styles.sheet}
      bodyStyle={styles.body}
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totaal gebruikt</Text>
          <Text style={styles.summaryValue}>{fmt.format(totalSpent)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Totaal budget</Text>
          <Text style={styles.summaryValue}>{fmt.format(totalBudget)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelStrong}>Resterend</Text>
          <Text style={styles.summaryValueStrong}>{fmt.format(totalRemaining)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.length ? (
          items.map((item) => {
            const utilization =
              item.totalBudget > 0
                ? item.usedAmount / item.totalBudget
                : item.usedAmount > 0
                  ? Number.POSITIVE_INFINITY
                  : 0;
            const remainingAmount = Math.max(item.totalBudget - item.usedAmount, 0);

            return (
              <View key={item.key} style={styles.block}>
                <BudgetCategoryProgressRow
                  label={item.label}
                  iconName={item.iconName}
                  utilization={utilization}
                  actual={item.usedAmount}
                  budget={item.totalBudget}
                  hideAmountMeta
                />
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Gebruikt {fmt.format(item.usedAmount)}</Text>
                  <Text style={styles.metaText}>Resterend {fmt.format(remainingAmount)}</Text>
                  <Text style={styles.metaText}>Budget {fmt.format(item.totalBudget)}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>
            Nog geen variabele uitgaven of budgetregels gevonden in deze week.
          </Text>
        )}
      </ScrollView>
    </FinanceBottomSheetShell>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "88%",
  },
  body: {
    marginTop: 14,
  },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  summaryLabelStrong: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  summaryValueStrong: {
    fontSize: 13,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  scroll: {
    marginTop: 12,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 20,
  },
  block: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
});
