import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
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

export type BudgetMonthBreakdownTone = "neutral" | "good" | "watch" | "critical";

export type BudgetMonthBreakdownRow = {
  key: string;
  label: string;
  description: string;
  amount: number;
  icon: AppIconName;
  tone?: BudgetMonthBreakdownTone;
};

type BudgetMonthBreakdownCardProps = {
  title?: string;
  items: BudgetMonthBreakdownRow[];
  style?: StyleProp<ViewStyle>;
};

function getIconBubbleStyle(tone?: BudgetMonthBreakdownTone) {
  if (tone === "good") return styles.iconBubbleGood;
  if (tone === "watch") return styles.iconBubbleWatch;
  if (tone === "critical") return styles.iconBubbleCritical;
  return styles.iconBubbleNeutral;
}

function getIconColor(tone?: BudgetMonthBreakdownTone) {
  if (tone === "good") return FinColors.green;
  if (tone === "watch") return FinColors.warningText;
  if (tone === "critical") return FinColors.red;
  return FinColors.textSecondary;
}

function BudgetMonthBreakdownRowView({
  row,
  isLast,
}: {
  row: BudgetMonthBreakdownRow;
  isLast: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBubble, getIconBubbleStyle(row.tone)]}>
          <AppIcon
            name={row.icon}
            size={18}
            color={getIconColor(row.tone)}
            variant="outlined"
          />
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.label} numberOfLines={1}>
            {row.label}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {row.description}
          </Text>
        </View>
      </View>

      <Text style={styles.amount} numberOfLines={1}>
        {euroFormatter.format(row.amount)}
      </Text>
    </View>
  );
}

export function BudgetMonthBreakdownCard({
  title = "Verdeling van de maand",
  items,
  style,
}: BudgetMonthBreakdownCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.list}>
        {items.map((row, index) => (
          <BudgetMonthBreakdownRowView
            key={row.key}
            row={row}
            isLast={index === items.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.3,
  },
  list: {
    overflow: "hidden",
    borderRadius: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.06)",
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconBubbleNeutral: {
    backgroundColor: FinColors.bgElevated,
  },
  iconBubbleGood: {
    backgroundColor: "rgba(47,125,87,0.10)",
  },
  iconBubbleWatch: {
    backgroundColor: FinColors.warningBg,
  },
  iconBubbleCritical: {
    backgroundColor: FinColors.redBg,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  amount: {
    minWidth: 84,
    textAlign: "right",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.2,
  },
});
