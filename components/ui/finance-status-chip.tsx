import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type FinanceStatusTone = "good" | "watch" | "critical" | "neutral";

type FinanceStatusChipProps = {
  label: string;
  tone: FinanceStatusTone;
};

export function FinanceStatusChip({ label, tone }: FinanceStatusChipProps) {
  return (
    <View style={[styles.chip, tone === "good" && styles.chipGood, tone === "watch" && styles.chipWatch, tone === "critical" && styles.chipCritical]}>
      <View
        style={[
          styles.dot,
          tone === "good" && styles.dotGood,
          tone === "watch" && styles.dotWatch,
          tone === "critical" && styles.dotCritical,
        ]}
      />
      <Text
        style={[
          styles.label,
          tone === "good" && styles.labelGood,
          tone === "watch" && styles.labelWatch,
          tone === "critical" && styles.labelCritical,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipGood: {
    backgroundColor: "#e7f3a8",
  },
  chipWatch: {
    backgroundColor: FinColors.warningBg,
  },
  chipCritical: {
    backgroundColor: FinColors.redBg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.textMuted,
  },
  dotGood: {
    backgroundColor: "#10b981",
  },
  dotWatch: {
    backgroundColor: FinColors.warningText,
  },
  dotCritical: {
    backgroundColor: FinColors.red,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1,
    color: FinColors.textSecondary,
    textTransform: "uppercase",
  },
  labelGood: {
    color: "#5b6a1b",
  },
  labelWatch: {
    color: FinColors.warningText,
  },
  labelCritical: {
    color: FinColors.red,
  },
});
