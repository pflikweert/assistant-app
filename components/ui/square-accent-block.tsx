import React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

type SquareAccentBlockProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function SquareAccentBlock({
  children,
  onPress,
  style,
  contentStyle,
}: SquareAccentBlockProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.block,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: "#FDE68A",
    borderRadius: 0,
    borderWidth: 0,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.92,
  },
  content: {
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 14,
  },
});
