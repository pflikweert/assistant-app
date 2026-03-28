import { FinTokens } from "@/constants/theme";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { FinanceText } from "@/components/ui/finance-text";

export type FinanceButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";
export type FinanceButtonSize = "sm" | "md" | "lg";

type FinanceButtonProps = {
  onPress?: () => void;
  label: string;
  accessibilityLabel?: string;
  variant?: FinanceButtonVariant;
  size?: FinanceButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 38, paddingHorizontal: FinTokens.spacing.m, gap: FinTokens.spacing.xs },
  md: { minHeight: 46, paddingHorizontal: FinTokens.spacing.m, gap: FinTokens.spacing.xs },
  lg: { minHeight: 54, paddingHorizontal: FinTokens.spacing.l, gap: FinTokens.spacing.s },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: FinTokens.color.accent,
  },
  secondary: {
    backgroundColor: FinTokens.color.surfaceSoft,
    borderWidth: 1,
    borderColor: FinTokens.color.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: FinTokens.color.redBg,
    borderWidth: 1,
    borderColor: FinTokens.color.redBorder,
  },
  icon: {
    backgroundColor: FinTokens.color.surfaceSoft,
    borderWidth: 1,
    borderColor: FinTokens.color.borderSubtle,
    minWidth: 46,
    paddingHorizontal: FinTokens.spacing.s,
  },
});

const labelToneByVariant: Record<FinanceButtonVariant, Parameters<typeof FinanceText>[0]["tone"]> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "secondary",
  danger: "danger",
  icon: "secondary",
};

export function FinanceButton({
  onPress,
  label,
  accessibilityLabel,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  labelStyle,
}: FinanceButtonProps) {
  const isDisabled = disabled || loading || !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={FinTokens.color.textPrimary} />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
          <FinanceText
            variant="body-sm"
            weight="extrabold"
            tone={labelToneByVariant[variant]}
            style={labelStyle}
          >
            {label}
          </FinanceText>
          {rightIcon ? <View style={styles.iconSlot}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: FinTokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.9,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: FinTokens.spacing.xs,
  },
  iconSlot: {
    width: FinTokens.icon.md,
    height: FinTokens.icon.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
