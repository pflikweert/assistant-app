import React from "react";
import {
  type AccessibilityRole,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type FinancePressableSurfaceProps = {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
};

export function FinancePressableSurface({
  onPress,
  children,
  style,
  pressedStyle,
  disabled = false,
  accessibilityRole,
}: FinancePressableSurfaceProps) {
  if (!onPress) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      style={({ pressed }) => [style, pressed ? pressedStyle : null]}
    >
      {children}
    </Pressable>
  );
}
