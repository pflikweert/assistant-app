import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceText } from "@/components/ui/finance-text";
import { FinSpacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type BudgetMonthActionCardProps = {
  recommendation: string;
  onOpenInsights: () => void;
  onOpenManage: () => void;
};

export function BudgetMonthActionCard({
  recommendation,
  onOpenInsights,
  onOpenManage,
}: BudgetMonthActionCardProps) {
  return (
    <FinanceDetailCard
      title="Actie voor nu"
      subtitle="Kies direct je volgende stap."
      bodyStyle={styles.body}
    >
      <FinanceText variant="body-sm" tone="secondary">
        {recommendation}
      </FinanceText>
      <View style={styles.actionsRow}>
        <FinanceButton label="Open insights" onPress={onOpenInsights} style={styles.actionButton} />
        <FinanceButton
          label="Budget beheren"
          variant="secondary"
          onPress={onOpenManage}
          style={styles.actionButton}
        />
      </View>
    </FinanceDetailCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: FinSpacing.s,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 164,
  },
});
