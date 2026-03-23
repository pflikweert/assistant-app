import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceAvatarBadgeProps = {
  label?: string;
  size?: number;
};

export function FinanceAvatarBadge({
  label = "PF",
  size = 40,
}: FinanceAvatarBadgeProps) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.warningText,
  },
});
