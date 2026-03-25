import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { TransactionListRow } from "@/components/transactions/transaction-list-row";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinColors } from "@/constants/theme";
import type { CategoryRecord } from "@/types/categorization";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const wholeEuroFmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
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
  counterparty?: string | null;
  date: string;
  amount: number;
  categoryAutoId?: string | null;
  categoryUserId?: string | null;
  category_id_auto?: string | null;
  category_id_user?: string | null;
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
  categoryById: Map<string, CategoryRecord>;
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

function formatWholeEuroDown(value: number) {
  return wholeEuroFmt.format(Math.floor(Math.max(value, 0)));
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
  categoryById,
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
          <Text style={styles.summaryPillValue}>
            {formatWholeEuroDown(totalBudget)}
          </Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillLabel}>Gebruikt</Text>
          <Text style={styles.summaryPillValue}>
            {formatWholeEuroDown(totalSpent)}
          </Text>
        </View>
        <View style={[styles.summaryPill, styles.summaryPillAccent]}>
          <Text style={styles.summaryPillLabelAccent}>Resterend</Text>
          <Text style={styles.summaryPillValueAccent}>
            {formatWholeEuroDown(totalRemaining)}
          </Text>
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
                      ? transactions.map((transaction, index) => {
                          const receiverLabel =
                            String(transaction.counterparty || "").trim() ||
                            transaction.title;
                          const descriptionLabel =
                            String(transaction.counterparty || "").trim()
                              ? transaction.title
                              : undefined;

                          return (
                            <TransactionListRow
                              key={transaction.id}
                              title={receiverLabel}
                              subtitle={descriptionLabel}
                              meta={formatTransactionDate(transaction.date)}
                              amount={transaction.amount}
                              showRunningBalance={false}
                              categoryAutoId={
                                transaction.categoryAutoId ??
                                transaction.category_id_auto ??
                                null
                              }
                              categoryUserId={
                                transaction.categoryUserId ??
                                transaction.category_id_user ??
                                null
                              }
                              categoryById={categoryById}
                              showDivider={index < transactions.length - 1}
                              onPress={() => onOpenTransaction(transaction.id)}
                              style={styles.transactionListRow}
                            />
                          );
                        })
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  summaryPillValueAccent: {
    fontSize: 20,
    lineHeight: 24,
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
  transactionListRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e4e1",
    backgroundColor: "#f7f7f7",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  transactionLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
