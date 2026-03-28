import { FinColors } from "@/constants/theme";
import type { BudgetRiskTone } from "@/services/budget-risk";
import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type FinanceBudgetProgressBarProps = {
  progress: number;
  tone: BudgetRiskTone;
  style?: StyleProp<ViewStyle>;
  fillStyle?: StyleProp<ViewStyle>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFillColor(tone: BudgetRiskTone) {
  if (tone === "good") return FinColors.budgetProgressGood;
  if (tone === "watch") return FinColors.budgetProgressWatch;
  if (tone === "critical") return FinColors.budgetProgressCritical;
  return FinColors.budgetProgressNeutral;
}

export function FinanceBudgetProgressBar({
  progress,
  tone,
  style,
  fillStyle,
}: FinanceBudgetProgressBarProps) {
  const bounded = clamp(progress, 0, 100);

  return (
    <View style={[styles.track, style]}>
      <View
        style={[
          styles.fill,
          fillStyle,
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
    backgroundColor: FinColors.budgetProgressTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 0,
  },
});
