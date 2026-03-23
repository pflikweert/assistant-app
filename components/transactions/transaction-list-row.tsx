import { TransactionCategoryIcon } from "@/components/category-icon";
import { FinColors } from "@/constants/theme";
import type { CategoryRecord } from "@/types/categorization";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type TransactionListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  amount: number;
  runningBalance?: number | null;
  showRunningBalance?: boolean;
  showDate?: boolean;
  dateLabel?: string;
  categoryAutoId?: string | null;
  categoryUserId?: string | null;
  categoryById: Map<string, CategoryRecord>;
  onPress: () => void;
  maxWidth?: number;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TransactionListRow({
  title,
  subtitle = "",
  meta = "",
  amount,
  runningBalance = null,
  showRunningBalance = true,
  showDate = false,
  dateLabel,
  categoryAutoId = null,
  categoryUserId = null,
  categoryById,
  onPress,
  maxWidth,
  showDivider = false,
  style,
}: TransactionListRowProps) {
  const isPositive = amount >= 0;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        maxWidth ? { maxWidth } : null,
        showDivider && styles.rowDivider,
        style,
      ]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={styles.rowIconWrap}>
        <TransactionCategoryIcon
          row={{
            category_id_auto: categoryAutoId,
            category_id_user: categoryUserId,
          }}
          categoryById={categoryById}
          size={20}
          bubbleSize={42}
        />
      </View>

      <View style={styles.rowBody}>
        {showDate && dateLabel ? (
          <Text style={styles.rowDate} numberOfLines={1}>
            {dateLabel}
          </Text>
        ) : null}
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      <View style={styles.amountColumn}>
        <Text style={[styles.amount, isPositive ? styles.amountPositive : styles.amountNegative]}>
          {`${isPositive ? "+" : "-"}${euroFormatter.format(Math.abs(amount))}`}
        </Text>
        {showRunningBalance ? (
          <Text style={styles.running}>
            {runningBalance == null
              ? "Saldo onbekend"
              : `Saldo ${euroFormatter.format(runningBalance)}`}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    width: "100%",
    alignSelf: "center",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FinColors.borderSubtle,
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowBody: {
    flex: 1,
    paddingRight: 10,
  },
  rowDate: {
    marginBottom: 3,
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textMuted,
  },
  amountColumn: {
    minWidth: 92,
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "right",
  },
  amountPositive: {
    color: FinColors.green,
  },
  amountNegative: {
    color: FinColors.textPrimary,
  },
  running: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 13,
    color: FinColors.textMuted,
    textAlign: "right",
  },
});
