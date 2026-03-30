import React from "react";
import { Image } from "expo-image";
import {
  Platform,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FinTokens } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceLiveStatusDotMotion } from "./finance-live-status-dot-motion";
import { useSplashLoaderAnimation } from "./useSplashLoaderAnimation";
const AnimatedView = Animated.createAnimatedComponent(View);

export type SplashLoaderProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  label?: string;
  imageSource?: ImageSourcePropType;
  size?: number;
  speed?: number;
  intensity?: number;
  background?: boolean;
  testID?: string;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  eyebrowStyle?: StyleProp<TextStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function SplashLoader({
  eyebrow = "Budio",
  title = "Budio cockpit wordt voorbereid",
  subtitle = "We zetten je veilige ruimte en context rustig voor je klaar.",
  label = "Je overzicht wordt bijgewerkt.",
  imageSource,
  size = 96,
  speed = 1,
  intensity = 0.6,
  background = true,
  testID,
  reduceMotion = false,
  style,
  cardStyle,
  eyebrowStyle,
  titleStyle,
  subtitleStyle,
  labelStyle,
}: SplashLoaderProps) {
  const theme = useTheme();
  const animation = useSplashLoaderAnimation({
    size,
    speed,
    intensity,
    reduceMotion,
  });
  const motionFactor = Math.max(0.8, Math.min(1.4, size / 96));
  const contentWidth = Math.round(300 + motionFactor * 60);
  const backgroundSource = imageSource;

  const backgroundMotionStyle = useAnimatedStyle(() => {
    const cycle = animation.phase.value * Math.PI * 2;
    const driftStrength = 10 * motionFactor * Math.max(0.5, intensity);
    const driftX = Math.sin(cycle * 0.72) * driftStrength;
    const driftY = Math.cos(cycle * 0.58 + 0.25) * (driftStrength * 0.82);
    const scale = 1.06 + (animation.pulse.value - 0.94) * 0.48;
    const rotate = Math.sin(cycle * 0.26) * Math.max(0.35, intensity * 1.1);

    return {
      transform: [
        { translateX: driftX },
        { translateY: driftY },
        { scale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const hazeMotionStyle = useAnimatedStyle(() => {
    const baseOpacity = reduceMotion ? 0.42 : 0.2 + animation.glow.value * 0.28;
    const scale = reduceMotion ? 1 : 0.94 + animation.glow.value * 0.08;

    return {
      opacity: baseOpacity,
      transform: [{ scale }],
    };
  });

  const contentMotionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: reduceMotion ? 0 : (1 - animation.pulse.value) * 8,
      },
    ],
    opacity: reduceMotion ? 1 : 0.96 + animation.glow.value * 0.04,
  }));

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={`${eyebrow}: ${title}`}
      accessibilityLiveRegion="polite"
      style={[
        styles.root,
        background ? { backgroundColor: theme.colors.canvas } : null,
        style,
      ]}
    >
      <View style={styles.backgroundLayer}>
        <AnimatedView style={[styles.backgroundMotionWrap, backgroundMotionStyle]}>
          {backgroundSource ? (
            <Image
              source={backgroundSource}
              style={styles.backgroundImage}
              contentFit="cover"
              transition={0}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </AnimatedView>

        <AnimatedView style={[styles.topHaze, hazeMotionStyle]} />
        <AnimatedView style={[styles.bottomHaze, hazeMotionStyle]} />
        <View style={styles.overlayWash} />
        <View style={styles.vignetteTop} />
        <View style={styles.vignetteBottom} />
        <View style={styles.microAccent} />
      </View>

      <AnimatedView style={[styles.contentWrap, contentMotionStyle]}>
        <View
          style={[
            styles.card,
            Platform.OS === "web"
              ? ({
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                } as any)
              : null,
            cardStyle,
          ]}
        >
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowChip}>
              <FinanceLiveStatusDotMotion size={8} />
              <FinanceText
                variant="caption"
                tone="secondary"
                weight="bold"
                style={[styles.eyebrowText, eyebrowStyle]}
              >
                {eyebrow}
              </FinanceText>
            </View>
          </View>

          <FinanceText
            variant="h3"
            tone="primary"
            weight="black"
            align="center"
            style={[styles.title, titleStyle]}
          >
            {title}
          </FinanceText>

          <FinanceText
            variant="body"
            tone="secondary"
            align="center"
            style={[styles.subtitle, subtitleStyle]}
          >
            {subtitle}
          </FinanceText>

          <View style={[styles.labelPill, { maxWidth: contentWidth }]}>
            <FinanceText
              variant="caption"
              tone="muted"
              weight="bold"
              align="center"
              style={[styles.label, labelStyle]}
              numberOfLines={2}
            >
              {label}
            </FinanceText>
          </View>
        </View>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: FinTokens.spacing.l,
    paddingVertical: FinTokens.spacing["4xl"],
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  backgroundMotionWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlayWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250, 248, 242, 0.36)",
  },
  topHaze: {
    position: "absolute",
    top: -100,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.48)",
  },
  bottomHaze: {
    position: "absolute",
    bottom: -120,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "rgba(242,201,76,0.16)",
  },
  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 190,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  vignetteBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  microAccent: {
    position: "absolute",
    right: FinTokens.spacing.xl,
    bottom: FinTokens.spacing.xl,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.45)",
    backgroundColor: "rgba(255,255,255,0.52)",
    transform: [{ rotate: "45deg" }],
  },
  contentWrap: {
    width: "100%",
    maxWidth: 560,
    alignItems: "center",
  },
  card: {
    width: "100%",
    borderRadius: FinTokens.radius.xxl,
    paddingHorizontal: FinTokens.spacing.xl,
    paddingVertical: FinTokens.spacing.xl,
    alignItems: "center",
    gap: FinTokens.spacing.m,
    backgroundColor: "rgba(250, 248, 242, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.07)",
    boxShadow: "0px 18px 32px rgba(17,17,17,0.10)",
    elevation: 4,
  },
  eyebrowRow: {
    width: "100%",
    alignItems: "center",
  },
  eyebrowChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinTokens.spacing.xs,
    paddingHorizontal: FinTokens.spacing.s,
    paddingVertical: FinTokens.spacing.xs,
    borderRadius: FinTokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.60)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
  },
  eyebrowText: {
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    maxWidth: 420,
  },
  subtitle: {
    maxWidth: 440,
  },
  labelPill: {
    alignSelf: "stretch",
    paddingHorizontal: FinTokens.spacing.m,
    paddingVertical: FinTokens.spacing.s,
    borderRadius: FinTokens.radius.xl,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
  },
  label: {
    letterSpacing: 0.4,
  },
});
