import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

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
  const phase = useSharedValue(0);

  React.useEffect(() => {
    if (disabled) {
      phase.value = 0;
      return;
    }

    phase.value = withRepeat(
      withTiming(1, {
        duration: 7600,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [disabled, phase]);

  const motionStyle = useAnimatedStyle(() => {
    const p = phase.value;
    const lift =
      p < 0.12
        ? 0
        : p < 0.22
          ? interpolate(p, [0.12, 0.22], [0, -2.2])
          : p < 0.32
            ? interpolate(p, [0.22, 0.32], [-2.2, 0])
            : 0;
    const tilt =
      p < 0.12
        ? 0
        : p < 0.22
          ? interpolate(p, [0.12, 0.22], [0, -4])
          : p < 0.32
            ? interpolate(p, [0.22, 0.32], [-4, 0])
            : 0;
    const scale =
      p < 0.12
        ? 1
        : p < 0.22
          ? interpolate(p, [0.12, 0.22], [1, 1.03])
          : p < 0.32
            ? interpolate(p, [0.22, 0.32], [1.03, 1])
            : 1;

    return {
      transform: [
        { translateY: lift },
        { rotateZ: `${tilt}deg` },
        { scale },
      ],
    };
  });

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
        motionStyle,
      ]}
    >
      <AppIcon
        name="smart-toy"
        size={18}
        color="#5b4a00"
        variant="outlined"
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
