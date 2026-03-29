import { AppIcon } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type SmartBudgetSetupEntryCardProps = {
  onStartSmart: () => void;
  onStartManual: () => void;
};

// Stitch reference component:
// "Slim je budget instellen" (screen id: d4e753cdbd354f30987f4e528ecc0532)
export function SmartBudgetSetupEntryCard({
  onStartSmart,
  onStartManual,
}: SmartBudgetSetupEntryCardProps) {
  return (
    <FinanceSettingsGroup title="Slim budget instellen met Budio">
      <View style={styles.content}>
        <FinanceText variant="body-sm" tone="secondary">
          Budio bekijkt eerst je maand en zet een voorstel klaar. Jij beslist daarna in een paar stappen wat je overneemt.
        </FinanceText>
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <AppIcon name="check-circle" size={14} color={FinColors.green} />
            <Text style={styles.trustText}>Voorstel eerst</Text>
          </View>
          <View style={styles.trustBadge}>
            <AppIcon name="shield" size={14} color={FinColors.textSecondary} />
            <Text style={styles.trustText}>Altijd controle achteraf</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <FinanceButton label="Slim met Budio" onPress={onStartSmart} fullWidth />
          <FinanceButton
            label="Handmatig"
            variant="secondary"
            onPress={onStartManual}
            fullWidth
          />
        </View>
      </View>
    </FinanceSettingsGroup>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: FinSpacing.m,
    gap: FinSpacing.s,
  },
  actions: {
    gap: FinSpacing.xs,
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x2,
  },
  trustText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
});
