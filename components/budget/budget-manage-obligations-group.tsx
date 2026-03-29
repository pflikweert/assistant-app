import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type ObligationRow = {
  key: string;
  label: string;
  amountLabel: string;
};

type BudgetManageObligationsGroupProps = {
  totalLabel: string;
  rows: ObligationRow[];
  onEdit: () => void;
};

export function BudgetManageObligationsGroup({
  totalLabel,
  rows,
  onEdit,
}: BudgetManageObligationsGroupProps) {
  return (
    <FinanceSettingsGroup title="Vaste lasten en reserves">
      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              <FinanceText variant="body-sm" weight="extrabold" tone="primary">
                Vaste lasten en reserves
              </FinanceText>
              <FinanceText variant="caption" tone="secondary">
                Zo bouwt Budio je maandelijkse verplichtingen op.
              </FinanceText>
            </View>
            <View style={styles.metricPill}>
              <FinanceText variant="caption" weight="bold" tone="muted">
                Totaal
              </FinanceText>
              <FinanceText variant="caption" weight="extrabold" tone="secondary">
                {totalLabel}
              </FinanceText>
            </View>
          </View>
          <View style={styles.infoList}>
            {rows.map((row) => (
              <View key={row.key} style={styles.infoRow}>
                <FinanceText variant="body-sm" tone="secondary">
                  {row.label}
                </FinanceText>
                <FinanceText variant="caption" tone="primary" weight="extrabold">
                  {row.amountLabel}
                </FinanceText>
              </View>
            ))}
          </View>
          <FinanceButton
            label="Vaste lasten en reserves bewerken"
            variant="ghost"
            size="sm"
            style={styles.secondaryAction}
            labelStyle={styles.secondaryActionText}
            onPress={onEdit}
          />
        </View>
      </View>
    </FinanceSettingsGroup>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: FinSpacing.m,
  },
  section: {
    gap: FinSpacing.s,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: FinSpacing.s,
  },
  headerMain: {
    flex: 1,
    gap: FinSpacing.x1,
  },
  metricPill: {
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x2,
    alignItems: "flex-end",
    gap: FinSpacing.x1,
  },
  infoList: {
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgInput,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.s,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  secondaryAction: {
    alignSelf: "flex-start",
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: FinSpacing.s,
  },
  secondaryActionText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
  },
});
