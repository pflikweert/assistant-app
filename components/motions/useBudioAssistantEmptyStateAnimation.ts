import { useEffect } from "react";
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type UseBudioAssistantEmptyStateAnimationParams = {
  intensity?: number;
  reduceMotion?: boolean;
};

type BudioAssistantEmptyStateAnimation = {
  breath: SharedValue<number>;
  drift: SharedValue<number>;
  orbit: SharedValue<number>;
  shimmer: SharedValue<number>;
  coreScale: SharedValue<number>;
  haloScale: SharedValue<number>;
  ringScale: SharedValue<number>;
  ringOpacity: SharedValue<number>;
  glowOpacity: SharedValue<number>;
  dotOpacity: SharedValue<number>;
};

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

// Tweak this one value to speed up or slow down the entire empty-state motion.
export const EMPTY_STATE_MOTION_SPEED = 1.45;

export function useBudioAssistantEmptyStateAnimation({
  intensity = 0.64,
  reduceMotion = false,
}: UseBudioAssistantEmptyStateAnimationParams): BudioAssistantEmptyStateAnimation {
  const normalizedSpeed = EMPTY_STATE_MOTION_SPEED;
  const normalizedIntensity = clamp(
    Number.isFinite(intensity) ? intensity : 0.64,
    0.2,
    1,
  );

  const breath = useSharedValue(0.22);
  const drift = useSharedValue(0.12);
  const orbit = useSharedValue(0.18);
  const shimmer = useSharedValue(0.16);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.34;
      drift.value = 0.18;
      orbit.value = 0.24;
      shimmer.value = 0.16;
      return;
    }

    const reducedMotionMode = reduceMotion
      ? ReduceMotion.Always
      : ReduceMotion.System;
    const breathingDuration = Math.round(5200 / normalizedSpeed);
    const driftDuration = Math.round(6400 / normalizedSpeed);
    const orbitDuration = Math.round(14600 / normalizedSpeed);
    const shimmerDuration = Math.round(5600 / normalizedSpeed);

    breath.value = withRepeat(
      withTiming(1, {
        duration: breathingDuration,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: reducedMotionMode,
      }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, {
        duration: driftDuration,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: reducedMotionMode,
      }),
      -1,
      true,
    );
    orbit.value = withRepeat(
      withTiming(1, {
        duration: orbitDuration,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: reducedMotionMode,
      }),
      -1,
      false,
    );
    shimmer.value = withRepeat(
      withTiming(1, {
        duration: shimmerDuration,
        // `sine` is not available in every Reanimated build, so keep this conservative.
        easing: Easing.inOut(Easing.ease),
        reduceMotion: reducedMotionMode,
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(drift);
      cancelAnimation(orbit);
      cancelAnimation(shimmer);
    };
  }, [breath, drift, orbit, reduceMotion, shimmer, normalizedSpeed]);

  const coreScale = useDerivedValue(
    () => 0.985 + breath.value * (0.018 + normalizedIntensity * 0.018),
  );
  const haloScale = useDerivedValue(
    () => 0.995 + breath.value * (0.046 + normalizedIntensity * 0.03),
  );
  const ringScale = useDerivedValue(
    () => 0.985 + drift.value * (0.018 + normalizedIntensity * 0.024),
  );
  const ringOpacity = useDerivedValue(
    () => 0.1 + drift.value * (0.08 + normalizedIntensity * 0.06),
  );
  const glowOpacity = useDerivedValue(
    () => 0.09 + breath.value * (0.08 + normalizedIntensity * 0.08),
  );
  const dotOpacity = useDerivedValue(
    () => 0.12 + shimmer.value * (0.06 + normalizedIntensity * 0.06),
  );

  return {
    breath,
    drift,
    orbit,
    shimmer,
    coreScale,
    haloScale,
    ringScale,
    ringOpacity,
    glowOpacity,
    dotOpacity,
  };
}
