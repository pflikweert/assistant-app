import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

type FinanceBudgetStatusToggleProps = {
  excluded: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  subtitle?: string;
  budgetBucketLabel?: string | null;
};

export function FinanceBudgetStatusToggle({
  excluded,
  onToggle,
  disabled = false,
  subtitle = "Markeer als uitzondering",
  budgetBucketLabel = null,
}: FinanceBudgetStatusToggleProps) {
  const isOutsideBudget = excluded;
  const statusLabel = isOutsideBudget
    ? "Buiten budget opgenomen"
    : budgetBucketLabel
      ? `Binnen budget ${budgetBucketLabel} opgenomen`
      : "Binnen budget opgenomen";

  return (
    <View
      style={[
        styles.card,
        isOutsideBudget ? styles.cardOutsideBudget : styles.cardInsideBudget,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <AppIcon
            name={isOutsideBudget ? "error-outline" : "check-circle-outline"}
            size={20}
            color={isOutsideBudget ? FinColors.red : FinColors.warningText}
            variant="outlined"
          />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.title}>{statusLabel}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={excluded}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{
            false: "#e7e8ea",
            true: "#e7e8ea",
          }}
          thumbColor={excluded ? FinColors.red : "#ffffff"}
          ios_backgroundColor="#e7e8ea"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 0,
  },
  cardInsideBudget: {
    backgroundColor: "#f0f1f2",
  },
  cardOutsideBudget: {
    backgroundColor: "#f0f1f2",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f1f2",
  },
  copyWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: FinColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});
