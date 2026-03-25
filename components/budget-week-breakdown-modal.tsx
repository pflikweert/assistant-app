import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinColors } from "@/constants/theme";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

export type BudgetWeekBreakdownTransaction = {
  id: string;
  title: string;
  date: string;
  amount: number;
};

type BudgetWeekBreakdownModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  periodLabel: string;
  totalSpent: number;
  totalBudget: number;
  items: BudgetWeekBreakdownRow[];
  expandedCategoryKeys: string[];
  onToggleCategory: (key: string) => void;
  transactionsByCategory: Record<string, BudgetWeekBreakdownTransaction[]>;
  loadingCategoryKeys: string[];
  categoryErrors: Record<string, string>;
  onOpenTransaction: (transactionId: string) => void;
};

function formatTransactionDate(value: string) {
  const parsed = new Date(`${String(value || "").slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return String(value || "");
  return parsed.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function BudgetWeekBreakdownModal({
  visible,
  onClose,
  title,
  periodLabel,
  totalSpent,
  totalBudget,
  items,
  expandedCategoryKeys,
  onToggleCategory,
  transactionsByCategory,
  loadingCategoryKeys,
  categoryErrors,
  onOpenTransaction,
}: BudgetWeekBreakdownModalProps) {
  const totalRemaining = Math.max(totalBudget - totalSpent, 0);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={periodLabel}
      sheetStyle={styles.sheet}
      bodyStyle={styles.body}
    >
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>Variabele uitgaven per categorie</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>Budget</Text>
          <Text style={styles.summaryPillValue}>{fmt.format(totalBudget)}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>Gebruikt</Text>
          <Text style={styles.summaryPillValue}>{fmt.format(totalSpent)}</Text>
        </View>
        <View style={[styles.summaryPill, styles.summaryPillAccent]}>
          <Text style={styles.summaryPillLabelAccent}>Resterend</Text>
          <Text style={styles.summaryPillValueAccent}>{fmt.format(totalRemaining)}</Text>
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
            const clampedProgress = Number.isFinite(utilization)
              ? clamp(utilization, 0, 1)
              : 1;
            const utilizationLabel = `${fmt.format(item.usedAmount)} van budget gebruikt`;
            const isExpanded = expandedCategoryKeys.includes(item.key);
            const isLoading = loadingCategoryKeys.includes(item.key);
            const error = categoryErrors[item.key] || null;
            const transactions = transactionsByCategory[item.key] || [];

            return (
              <View key={item.key} style={styles.block}>
                <Pressable
                  onPress={() => onToggleCategory(item.key)}
                  style={({ pressed }) => [
                    styles.categoryRowPressable,
                    pressed ? styles.categoryRowPressablePressed : null,
                  ]}
                >
                  <View style={styles.categoryRowMain}>
                    <View style={styles.categoryTopRow}>
                      <View style={styles.categoryNameRow}>
                        <View style={styles.categoryIconBubble}>
                          <AppIcon
                            name={item.iconName}
                            size={17}
                            color={FinColors.textPrimary}
                            variant="outlined"
                          />
                        </View>
                        <Text style={styles.categoryLabel}>{item.label}</Text>
                      </View>
                      <View style={styles.categoryRightWrap}>
                        <Text style={styles.categoryRemaining}>
                          Resterend {fmt.format(remainingAmount)}
                        </Text>
                        <Text style={styles.categoryBudget}>
                          Budget {fmt.format(item.totalBudget)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.utilizationText}>{utilizationLabel}</Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(clampedProgress * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <AppIcon
                    name={isExpanded ? "expand-more" : "chevron-right"}
                    size={16}
                    color={FinColors.textSecondary}
                    variant="outlined"
                  />
                </Pressable>
                {isExpanded ? (
                  <View style={styles.transactionWrap}>
                    {isLoading ? (
                      <View style={styles.transactionLoadingRow}>
                        <ActivityIndicator size="small" color={FinColors.textSecondary} />
                        <Text style={styles.transactionMetaText}>Transacties laden...</Text>
                      </View>
                    ) : null}

                    {!isLoading && error ? (
                      <Text style={styles.transactionErrorText}>{error}</Text>
                    ) : null}

                    {!isLoading && !error && !transactions.length ? (
                      <Text style={styles.transactionMetaText}>
                        Geen transacties gevonden in deze categorie.
                      </Text>
                    ) : null}

                    {!isLoading && !error
                      ? transactions.map((transaction) => (
                          <Pressable
                            key={transaction.id}
                            onPress={() => onOpenTransaction(transaction.id)}
                            style={({ pressed }) => [
                              styles.transactionRow,
                              pressed ? styles.transactionRowPressed : null,
                            ]}
                          >
                            <View style={styles.transactionMain}>
                              <Text style={styles.transactionTitle} numberOfLines={1}>
                                {transaction.title}
                              </Text>
                              <Text style={styles.transactionMetaText}>
                                {formatTransactionDate(transaction.date)}
                              </Text>
                            </View>
                            <View style={styles.transactionRight}>
                              <Text style={styles.transactionAmount}>
                                {fmt.format(Math.abs(transaction.amount))}
                              </Text>
                              <AppIcon
                                name="chevron-right"
                                size={14}
                                color={FinColors.textSecondary}
                                variant="outlined"
                              />
                            </View>
                          </Pressable>
                        ))
                      : null}
                  </View>
                ) : null}
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
    marginTop: 10,
  },
  sectionLabelWrap: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: FinColors.yellowSoft,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: FinColors.warningText,
    textTransform: "uppercase",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 10,
    gap: 10,
  },
  summaryPill: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  summaryPillAccent: {
    backgroundColor: "#fdd406",
    borderColor: "#fdd406",
  },
  summaryPillLabel: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontWeight: "700",
    color: FinColors.textMuted,
  },
  summaryPillLabelAccent: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontWeight: "700",
    color: "#594a00",
  },
  summaryPillValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  summaryPillValueAccent: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: "#594a00",
    letterSpacing: -0.4,
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  categoryRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  categoryRowPressablePressed: {
    opacity: 0.86,
  },
  categoryRowMain: {
    flex: 1,
    minWidth: 0,
  },
  categoryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  categoryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  categoryIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
  },
  categoryLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  categoryRightWrap: {
    alignItems: "flex-end",
    gap: 1,
    flexShrink: 0,
  },
  categoryRemaining: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: "#856a00",
  },
  categoryBudget: {
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textMuted,
  },
  utilizationText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 15,
    color: FinColors.textSecondary,
  },
  progressTrack: {
    marginTop: 8,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#d4d5d8",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#d8b300",
  },
  transactionWrap: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 10,
    gap: 8,
  },
  transactionLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transactionRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e4e1",
    backgroundColor: "#f7f7f7",
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  transactionRowPressed: {
    opacity: 0.86,
  },
  transactionMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  transactionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  transactionTitle: {
    fontSize: 13,
    lineHeight: 17,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  transactionAmount: {
    fontSize: 13,
    lineHeight: 17,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  transactionMetaText: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  transactionErrorText: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.red,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
});
