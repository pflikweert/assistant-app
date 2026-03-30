import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
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

type FinanceLiveStatusDotMotionProps = {
  size?: number;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function FinanceLiveStatusDotMotion({
  size = 8,
  color = FinColors.green,
  disabled = false,
  style,
}: FinanceLiveStatusDotMotionProps) {
  const phase = useSharedValue(0);

  React.useEffect(() => {
    if (disabled) {
      phase.value = 0;
      return;
    }

    phase.value = withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [disabled, phase]);

  const motionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(phase.value, [0, 1], [0.62, 1]);
    const scale = interpolate(phase.value, [0, 1], [0.88, 1.06]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <AnimatedView
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        motionStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    alignSelf: "center",
  },
});
