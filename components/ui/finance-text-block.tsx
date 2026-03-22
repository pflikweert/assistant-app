import { FinColors } from "@/constants/theme";
import React from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

type FinanceTextBlockProps = {
  label: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
};

export function FinanceTextBlock({
  label,
  children,
  rightSlot,
  style,
  labelStyle,
  bodyStyle,
}: FinanceTextBlockProps) {
  return (
    <View style={[styles.block, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    color: FinColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  rightSlot: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  body: {
    gap: 10,
  },
});
