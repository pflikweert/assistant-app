import { FinColors } from "@/constants/theme";
import type { BudgetRiskTone } from "@/services/budget-risk";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

const TONE_FILL_COLOR: Record<BudgetRiskTone, string> = {
  neutral: FinColors.textMuted,
  good: FinColors.green,
  watch: FinColors.yellow,
  critical: FinColors.red,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function RiskProgressBar({
  progress,
  tone,
  height = 10,
  style,
}: {
  progress: number;
  tone: BudgetRiskTone;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const clampedProgress = clamp(progress, 0, 1);
  const radius = Math.max(height / 2, 4);

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: radius },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(clampedProgress * 100)}%`,
            borderRadius: radius,
            backgroundColor: TONE_FILL_COLOR[tone],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
