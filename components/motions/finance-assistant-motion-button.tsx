import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { FinanceAssistantMotionGlyph } from "@/components/motions/finance-assistant-motion-glyph";
import { useFinanceAssistantMotion } from "@/components/motions/use-finance-assistant-motion";

type FinanceAssistantMotionButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function FinanceAssistantMotionButton({
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
}: FinanceAssistantMotionButtonProps) {
  const motionStyle = useFinanceAssistantMotion({ disabled });

  return (
    <AnimatedTouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      activeOpacity={0.86}
      disabled={disabled}
      style={[
        styles.button,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      <FinanceAssistantMotionGlyph
        size={18}
        color="#5b4a00"
        disabled={disabled}
        style={motionStyle}
      />
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
    boxShadow: "0px 4px 10px rgba(17,17,17,0.08)",
    elevation: 1,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
