import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { FinColors } from "@/constants/theme";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type FinancePrimaryCtaButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  showLeadingPlusIcon?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  iconName?: AppIconName;
};

export function FinancePrimaryCtaButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  showLeadingPlusIcon = true,
  style,
  labelStyle,
  iconName = "add",
}: FinancePrimaryCtaButtonProps) {
  const isDisabled = disabled || loading || !onPress;

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.button, isDisabled && styles.buttonDisabled, style]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={FinColors.textPrimary} />
        ) : showLeadingPlusIcon ? (
          <AppIcon name={iconName} size={16} color={FinColors.textPrimary} />
        ) : null}
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 20,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
});
