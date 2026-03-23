import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type FinanceSubscriptionCalloutProps = {
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
};

export function FinanceSubscriptionCallout({
  title,
  description,
  actionLabel,
  onPress,
}: FinanceSubscriptionCalloutProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBubble}>
          <AppIcon name="auto-awesome" size={18} color={FinColors.warningText} variant="outlined" />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.88}>
        <AppIcon name="link" size={14} color="#fff6d4" variant="outlined" />
        <Text style={styles.actionButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#fff6d3",
    borderWidth: 1,
    borderColor: "#fef2bc",
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
  },
  copyWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: "#6a5c13",
    fontSize: 32 / 2,
    lineHeight: 22,
    fontWeight: "800",
  },
  description: {
    color: "#6a5c13",
    fontSize: 30 / 2,
    lineHeight: 22,
    fontWeight: "500",
  },
  actionButton: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#6d5a00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: "#fff6d4",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
});
