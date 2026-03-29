import { AppIcon } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type IncomeSourceRow = {
  key: string;
  label: string;
  enabled: boolean;
};

type BudgetManageIncomeSourcesGroupProps = {
  includedIncomeLabel: string;
  rows: IncomeSourceRow[];
  monthBreakdownText: string;
  onEdit: () => void;
};

export function BudgetManageIncomeSourcesGroup({
  includedIncomeLabel,
  rows,
  monthBreakdownText,
  onEdit,
}: BudgetManageIncomeSourcesGroupProps) {
  return (
    <FinanceSettingsGroup title="Inkomend budget">
      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              <FinanceText variant="body-sm" weight="extrabold" tone="primary">
                Inkomend budget
              </FinanceText>
              <FinanceText variant="caption" tone="secondary">
                Bronnen die Budio meeneemt voor je maandruimte.
              </FinanceText>
            </View>
            <View style={styles.metricPill}>
              <FinanceText variant="caption" weight="bold" tone="muted">
                Meegeteld
              </FinanceText>
              <FinanceText variant="caption" weight="extrabold" tone="secondary">
                {includedIncomeLabel}
              </FinanceText>
            </View>
          </View>
          <View style={styles.infoList}>
            {rows.map((row) => (
              <View key={row.key} style={styles.infoRow}>
                <View style={styles.infoMain}>
                  <AppIcon
                    name={row.enabled ? "check-circle" : "radio-button-unchecked"}
                    size={16}
                    color={row.enabled ? FinColors.green : FinColors.textMuted}
                  />
                  <FinanceText variant="body-sm" tone="secondary">
                    {row.label}
                  </FinanceText>
                </View>
                <FinanceText variant="caption" tone="muted" weight="bold">
                  {row.enabled ? "Aan" : "Uit"}
                </FinanceText>
              </View>
            ))}
          </View>
          <FinanceText variant="caption" tone="muted">
            {monthBreakdownText}
          </FinanceText>
          <FinanceButton
            label="Bronnen bewerken"
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
