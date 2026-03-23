import { AppIcon } from "@/components/ui/app-icon";
import { TransactionListRow } from "@/components/transactions/transaction-list-row";
import { FinColors } from "@/constants/theme";
import type { CategoryRecord } from "@/types/categorization";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type FinanceTransactionsBlockItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  dateLabel?: string;
  amount: number;
  runningBalance?: number | null;
  categoryAutoId?: string | null;
  categoryUserId?: string | null;
};

type FinanceTransactionsBlockProps = {
  title: string;
  items: FinanceTransactionsBlockItem[];
  categoryById: Map<string, CategoryRecord>;
  onPressItem: (id: string) => void;
  onPressSeeAll?: () => void;
  seeAllLabel?: string;
  maxItems?: number;
  showRunningBalance?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function FinanceTransactionsBlock({
  title,
  items,
  categoryById,
  onPressItem,
  onPressSeeAll,
  seeAllLabel = "Bekijk alles",
  maxItems = 6,
  showRunningBalance = false,
  emptyTitle = "Nog geen transacties",
  emptyDescription = "Zodra er transacties zijn, zie je hier een rustige momentopname.",
}: FinanceTransactionsBlockProps) {
  const visibleItems = items.slice(0, Math.max(maxItems, 0));

  return (
    <View style={styles.block}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{title}</Text>
        {onPressSeeAll ? (
          <TouchableOpacity onPress={onPressSeeAll}>
            <Text style={styles.seeAllText}>{seeAllLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.listWrap}>
        {visibleItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <AppIcon name="history" size={24} color={FinColors.textMuted} variant="outlined" />
            </View>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyDescription}>{emptyDescription}</Text>
          </View>
        ) : (
          visibleItems.map((item, index) => (
            <TransactionListRow
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              meta={item.meta}
              dateLabel={item.dateLabel}
              showDate={Boolean(item.dateLabel)}
              amount={item.amount}
              runningBalance={item.runningBalance}
              showRunningBalance={showRunningBalance}
              categoryAutoId={item.categoryAutoId}
              categoryUserId={item.categoryUserId}
              categoryById={categoryById}
              showDivider={index < visibleItems.length - 1}
              onPress={() => onPressItem(item.id)}
            />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  listWrap: {
    backgroundColor: "transparent",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: 28,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  emptyDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
});
