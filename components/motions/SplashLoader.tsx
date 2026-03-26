import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import {
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  Path,
  vec,
} from "@shopify/react-native-skia";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/use-theme";
import { useSplashLoaderAnimation } from "./useSplashLoaderAnimation";

export type SplashLoaderProps = {
  label?: string;
  size?: number;
  speed?: number;
  intensity?: number;
  background?: boolean;
  testID?: string;
  reduceMotion?: boolean;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function SplashLoader({
  label = "Laden…",
  size = 96,
  speed = 1,
  intensity = 0.6,
  background = true,
  testID,
  reduceMotion = false,
}: SplashLoaderProps) {
  const theme = useTheme();
  const animation = useSplashLoaderAnimation({
    size,
    speed,
    intensity,
    reduceMotion,
  });

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animation.pulse.value }],
    opacity: reduceMotion ? 1 : 0.9 + animation.glow.value * 0.1,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${animation.phase.value * Math.PI * 2}rad` },
      { scale: 1 },
    ],
    opacity: reduceMotion
      ? 0.72
      : 0.62 + animation.glow.value * 0.14 + animation.ringProgress.value * 0.08,
  }));
  const glowAlpha = useDerivedValue(() =>
    reduceMotion ? 0.26 : 0.18 + animation.glow.value * 0.32,
  );
  const coreRadius = useDerivedValue(() => size * (0.26 + animation.pulse.value * 0.08));
  const haloRadius = useDerivedValue(() => size * (0.36 + animation.pulse.value * 0.13));
  const webHaloStyle = useAnimatedStyle(() => ({
    opacity: glowAlpha.value,
  }));
  const webCorePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animation.pulse.value }],
  }));

  const frameSize = Math.round(size * 1.8);
  const center = frameSize / 2;
  const ringRadius = size * 0.49;
  const ringPath = React.useMemo(() => {
    const startAngle = (-112 * Math.PI) / 180;
    const endAngle = (112 * Math.PI) / 180;
    const startX = center + ringRadius * Math.cos(startAngle);
    const startY = center + ringRadius * Math.sin(startAngle);
    const endX = center + ringRadius * Math.cos(endAngle);
    const endY = center + ringRadius * Math.sin(endAngle);
    return `M ${startX} ${startY} A ${ringRadius} ${ringRadius} 0 1 1 ${endX} ${endY}`;
  }, [center, ringRadius]);
  const isWeb = Platform.OS === "web";

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        background && { backgroundColor: theme.colors.canvas },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <AnimatedView style={breathingStyle}>
        {isWeb ? (
          <AnimatedView
            style={[
              styles.webCanvasFallback,
              {
                width: frameSize,
                height: frameSize,
              },
            ]}
          >
            <AnimatedView
              style={[
                styles.webHalo,
                {
                  width: size * 1.02,
                  height: size * 1.02,
                  borderRadius: size * 0.51,
                  backgroundColor: theme.colors.brandPrimary,
                },
                webHaloStyle,
              ]}
            />
            <AnimatedView
              style={[
                styles.webCore,
                {
                  width: size * 0.64,
                  height: size * 0.64,
                  borderRadius: size * 0.32,
                  backgroundColor: theme.colors.brandHighlight,
                  borderColor: theme.colors.brandAccent,
                },
                webCorePulseStyle,
              ]}
            />
            <AnimatedView
              style={[
                styles.webRing,
                {
                  width: size * 1.06,
                  height: size * 1.06,
                  borderRadius: size * 0.53,
                  borderColor: theme.colors.brandAccent,
                },
                ringStyle,
              ]}
            />
          </AnimatedView>
        ) : (
          <AnimatedView style={ringStyle}>
            <Canvas style={{ width: frameSize, height: frameSize }}>
              <Fill color="transparent" />
              <Group>
                <Circle cx={center} cy={center} r={haloRadius} opacity={glowAlpha}>
                  {/* Tweak colors here to match a future brand refresh. */}
                  <LinearGradient
                    start={vec(center - size * 0.45, center - size * 0.45)}
                    end={vec(center + size * 0.45, center + size * 0.45)}
                    colors={[theme.colors.brandPrimary, theme.colors.brandAccent]}
                  />
                </Circle>
                <Circle cx={center} cy={center} r={coreRadius} opacity={0.88}>
                  <LinearGradient
                    start={vec(center - size * 0.2, center - size * 0.2)}
                    end={vec(center + size * 0.2, center + size * 0.2)}
                    colors={[theme.colors.brandPrimary, theme.colors.brandHighlight]}
                  />
                </Circle>
              </Group>
              <Path
                path={ringPath}
                style="stroke"
                strokeWidth={Math.max(1.2, size * 0.02)}
                opacity={0.9}
                color={theme.colors.brandAccent}
              />
            </Canvas>
          </AnimatedView>
        )}
      </AnimatedView>

      <Text
        style={[styles.label, { color: theme.colors.textMuted }]}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  webCanvasFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  webHalo: {
    position: "absolute",
    opacity: 0.26,
  },
  webCore: {
    position: "absolute",
    borderWidth: 1,
    opacity: 0.9,
  },
  webRing: {
    position: "absolute",
    borderWidth: 1.4,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
    opacity: 0.8,
  },
});
