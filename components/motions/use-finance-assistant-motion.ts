import React from "react";
import { Easing, ReduceMotion, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

type UseFinanceAssistantMotionParams = {
  disabled?: boolean;
  durationMs?: number;
};

export function useFinanceAssistantMotion({
  disabled = false,
  durationMs = 7600,
}: UseFinanceAssistantMotionParams = {}) {
  const phase = useSharedValue(0);

  React.useEffect(() => {
    if (disabled) {
      phase.value = 0;
      return;
    }

    phase.value = withRepeat(
      withTiming(1, {
        duration: durationMs,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [disabled, durationMs, phase]);

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

  return motionStyle;
}
