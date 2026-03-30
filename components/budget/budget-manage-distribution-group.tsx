import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type DistributionRow = {
  key: string;
  label: string;
  amountLabel: string;
  iconName: AppIconName;
};

type BudgetManageDistributionGroupProps = {
  rows: DistributionRow[];
  onEdit: () => void;
};

export function BudgetManageDistributionGroup({
  rows,
  onEdit,
}: BudgetManageDistributionGroupProps) {
  return (
    <FinanceSettingsGroup title="Budget verdeling">
      <View style={styles.content}>
        <View style={styles.section}>
          <FinanceText variant="caption" tone="secondary">
            Alle categorieën met het ingestelde maandbudget.
          </FinanceText>
          <View style={styles.infoList}>
            {rows.map((row) => (
              <View key={row.key} style={styles.infoRow}>
                <View style={styles.infoMain}>
                  <AppIcon name={row.iconName} size={16} color={FinColors.textSecondary} />
                  <FinanceText variant="body-sm" tone="secondary">
                    {row.label}
                  </FinanceText>
                </View>
                <FinanceText variant="caption" tone="primary" weight="extrabold">
                  {row.amountLabel}
                </FinanceText>
              </View>
            ))}
          </View>
          <FinanceButton
            label="Budgetten wijzigen"
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
  infoMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
    flex: 1,
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
