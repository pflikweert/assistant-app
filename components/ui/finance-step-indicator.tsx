import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { FinColors } from "@/constants/theme";

export type FinanceStepIndicatorStep = {
  key: string;
  label: string;
};

type FinanceStepIndicatorProps = {
  steps: FinanceStepIndicatorStep[];
  currentStepKey: string;
  completedStepKeys?: string[];
  style?: StyleProp<ViewStyle>;
};

function getStepState(
  stepKey: string,
  currentStepKey: string,
  completedStepKeys: Set<string>,
) {
  if (completedStepKeys.has(stepKey)) return "done" as const;
  if (stepKey === currentStepKey) return "current" as const;
  return "upcoming" as const;
}

export function FinanceStepIndicator({
  steps,
  currentStepKey,
  completedStepKeys = [],
  style,
}: FinanceStepIndicatorProps) {
  const completedSet = React.useMemo(
    () => new Set(completedStepKeys),
    [completedStepKeys],
  );

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        {steps.map((step, index) => {
          const state = getStepState(step.key, currentStepKey, completedSet);
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepWrap}>
                <View
                  style={[
                    styles.circle,
                    state === "done" && styles.circleDone,
                    state === "current" && styles.circleCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.circleText,
                      state === "done" && styles.circleTextDone,
                      state === "current" && styles.circleTextCurrent,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.label,
                    state === "done" && styles.labelDone,
                    state === "current" && styles.labelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {!isLast ? (
                <View style={styles.railWrap}>
                  <View
                    style={[
                      styles.rail,
                      completedSet.has(step.key) && styles.railDone,
                    ]}
                  />
                </View>
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepWrap: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  circleCurrent: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  circleText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: FinColors.textSecondary,
  },
  circleTextDone: {
    color: FinColors.bgBase,
  },
  circleTextCurrent: {
    color: FinColors.textPrimary,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    color: FinColors.textMuted,
    fontWeight: "700",
  },
  labelDone: {
    color: FinColors.textPrimary,
  },
  labelCurrent: {
    color: FinColors.textPrimary,
  },
  railWrap: {
    width: 24,
    alignItems: "center",
    paddingTop: 16,
  },
  rail: {
    width: "100%",
    height: 2,
    borderRadius: 999,
    backgroundColor: FinColors.borderSubtle,
  },
  railDone: {
    backgroundColor: FinColors.textPrimary,
  },
});
