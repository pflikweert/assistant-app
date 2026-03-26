import { AppIcon } from "@/components/ui/app-icon";
import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";
import Animated from "react-native-reanimated";
import { useFinanceAssistantMotion } from "@/components/motions/use-finance-assistant-motion";

type FinanceAssistantMotionGlyphProps = {
  size?: number;
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function FinanceAssistantMotionGlyph({
  size = 18,
  color = "#5b4a00",
  backgroundColor,
  disabled = false,
  style,
}: FinanceAssistantMotionGlyphProps) {
  const motionStyle = useFinanceAssistantMotion({ disabled });

  return (
    <AnimatedView
      style={[
        styles.wrap,
        backgroundColor ? { backgroundColor } : null,
        motionStyle,
        style,
      ]}
    >
      <AppIcon
        name="smart-toy"
        size={size}
        color={color}
        variant="outlined"
      />
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
