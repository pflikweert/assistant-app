import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceSectionHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export function FinanceSectionHeader({
  title,
  subtitle,
  rightSlot,
}: FinanceSectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <View style={styles.titleMain}>
          <View style={styles.accentBar} />
          <Text style={styles.title}>{title}</Text>
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  titleMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  accentBar: {
    width: 5,
    height: 24,
    borderRadius: 999,
    backgroundColor: FinColors.warningText,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  rightSlot: {
    flexShrink: 0,
  },
});
