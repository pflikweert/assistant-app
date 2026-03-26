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
import { useTheme } from "@/hooks/use-theme";

export type SplashLoaderParams = {
  size: number;
  speed: number;
  intensity: number;
  reduceMotion?: boolean;
};

type SplashLoaderAnimation = {
  phase: SharedValue<number>;
  ringProgress: SharedValue<number>;
  pulse: SharedValue<number>;
  glow: SharedValue<number>;
};

const clamp01 = (value: number) => {
  "worklet";
  return Math.max(0, Math.min(1, value));
};

export function useSplashLoaderAnimation(
  params: SplashLoaderParams,
): SplashLoaderAnimation {
  const { motion } = useTheme();
  const standardEasing = motion.easing.standard;
  const slowDuration = motion.duration.slow;
  const ambientDuration = motion.duration.ambient;

  const inputSpeed = Number.isFinite(params.speed) ? params.speed : 1;
  const normalizedSpeed = Math.max(0.4, Math.min(2.2, inputSpeed));
  const normalizedIntensity = Math.max(
    0,
    Math.min(1, Number.isFinite(params.intensity) ? params.intensity : 0.6),
  );
  const sizeFactor = Math.max(0.8, Math.min(1.4, params.size / 96));

  const phaseRaw = useSharedValue(0);
  const ringRaw = useSharedValue(0.08);
  const pulseRaw = useSharedValue(0.55);
  const glowRaw = useSharedValue(0.45);

  useEffect(() => {
    const reduceMotionMode = params.reduceMotion
      ? ReduceMotion.Always
      : ReduceMotion.System;
    const timingEasing = Easing.bezier(
      standardEasing[0],
      standardEasing[1],
      standardEasing[2],
      standardEasing[3],
    );

    if (params.reduceMotion) {
      phaseRaw.value = 0.28;
      ringRaw.value = 0.22;
      pulseRaw.value = 0.56;
      glowRaw.value = 0.5;
      return;
    }

    phaseRaw.value = withRepeat(
      withTiming(1, {
        duration: Math.round(ambientDuration / normalizedSpeed),
        easing: timingEasing,
        reduceMotion: reduceMotionMode,
      }),
      -1,
      false,
    );
    ringRaw.value = withRepeat(
      withTiming(1, {
        duration: Math.round((ambientDuration * 1.45) / normalizedSpeed),
        easing: timingEasing,
        reduceMotion: reduceMotionMode,
      }),
      -1,
      false,
    );
    pulseRaw.value = withRepeat(
      withTiming(1, {
        duration: Math.round((slowDuration * 1.15) / normalizedSpeed),
        easing: timingEasing,
        reduceMotion: reduceMotionMode,
      }),
      -1,
      true,
    );
    glowRaw.value = withRepeat(
      withTiming(1, {
        duration: Math.round((ambientDuration * 0.88) / normalizedSpeed),
        easing: timingEasing,
        reduceMotion: reduceMotionMode,
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(phaseRaw);
      cancelAnimation(ringRaw);
      cancelAnimation(pulseRaw);
      cancelAnimation(glowRaw);
    };
  }, [
    ambientDuration,
    normalizedSpeed,
    params.reduceMotion,
    phaseRaw,
    pulseRaw,
    ringRaw,
    glowRaw,
    slowDuration,
    standardEasing,
  ]);

  const phase = useDerivedValue(() => phaseRaw.value % 1);
  const ringProgress = useDerivedValue(() => {
    const trimOffset = 0.06 + normalizedIntensity * 0.2;
    return (ringRaw.value + trimOffset) % 1;
  });
  const pulse = useDerivedValue(() => {
    const base = 0.94 + normalizedIntensity * 0.07;
    const wave = pulseRaw.value * 0.05 * sizeFactor;
    return clamp01(base + wave);
  });
  const glow = useDerivedValue(() => {
    const minGlow = 0.16 + normalizedIntensity * 0.08;
    const wave = glowRaw.value * 0.14;
    return clamp01(minGlow + wave);
  });

  return {
    phase,
    ringProgress,
    pulse,
    glow,
  };
}
