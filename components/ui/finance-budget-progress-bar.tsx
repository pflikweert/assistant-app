import { FinColors } from "@/constants/theme";
import type { BudgetRiskTone } from "@/services/budget-risk";
import React from "react";
import { StyleSheet, View } from "react-native";

type FinanceBudgetProgressBarProps = {
  progress: number;
  tone: BudgetRiskTone;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFillColor(tone: BudgetRiskTone) {
  if (tone === "good") return "#10b981";
  if (tone === "watch") return FinColors.yellow;
  if (tone === "critical") return FinColors.red;
  return FinColors.textMuted;
}

export function FinanceBudgetProgressBar({
  progress,
  tone,
}: FinanceBudgetProgressBarProps) {
  const bounded = clamp(progress, 0, 100);

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          {
            width: `${bounded}%`,
            backgroundColor: getFillColor(tone),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 9,
    borderRadius: 0,
    backgroundColor: "rgba(17,17,17,0.05)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 0,
  },
});
