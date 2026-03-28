import React from "react";
import {
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
};

export function FinancePressableSurface({
  onPress,
  children,
  style,
  pressedStyle,
  disabled = false,
}: FinancePressableSurfaceProps) {
  if (!onPress) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [style, pressed ? pressedStyle : null]}
    >
      {children}
    </Pressable>
  );
}
