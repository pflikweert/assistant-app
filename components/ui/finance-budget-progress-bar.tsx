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
  if (tone === "watch") return "#f9e287";
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
    backgroundColor: "#e3e9ec",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 0,
  },
});
