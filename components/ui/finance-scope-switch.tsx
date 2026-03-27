import {
  getMoneyViewScopeLabel,
  type MoneyViewScope,
} from "@/services/finance-scope";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FinanceScopeSwitchProps = {
  value: MoneyViewScope;
  options: readonly MoneyViewScope[];
  onChange: (scope: MoneyViewScope) => void;
};

export function FinanceScopeSwitch({
  value,
  options,
  onChange,
}: FinanceScopeSwitchProps) {
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel="Financiële scope"
    >
      {options.map((scope) => {
        const active = scope === value;
        return (
          <Pressable
            key={scope}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(scope)}
            style={({ pressed }) => [
              styles.segment,
              active ? styles.segmentActive : styles.segmentInactive,
              pressed && styles.pillPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                active ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {getMoneyViewScopeLabel(scope)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 74,
    padding: 4,
    borderRadius: 28,
    backgroundColor: "#f2f2ef",
  },
  segment: {
    flex: 1,
    minHeight: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  segmentInactive: {
    backgroundColor: "transparent",
  },
  segmentActive: {
    backgroundColor: "#ffffff",
    boxShadow: "0px 4px 12px rgba(0,0,0,0.07)",
    elevation: 2,
  },
  pillPressed: {
    opacity: 0.92,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  labelInactive: {
    color: "#757575",
  },
  labelActive: {
    color: "#8a7200",
  },
});
