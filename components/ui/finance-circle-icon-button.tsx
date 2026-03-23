import { AppIcon, type AppIconName, type AppIconVariant } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";

type FinanceCircleIconButtonProps = {
  icon: AppIconName;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: number;
  iconSize?: number;
  iconColor?: string;
  iconVariant?: AppIconVariant;
  style?: StyleProp<ViewStyle>;
};

export function FinanceCircleIconButton({
  icon,
  onPress,
  disabled = false,
  accessibilityLabel,
  size = 40,
  iconSize = 18,
  iconColor = FinColors.textPrimary,
  iconVariant = "outlined",
  style,
}: FinanceCircleIconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <AppIcon name={icon} size={iconSize} color={iconColor} variant={iconVariant} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
