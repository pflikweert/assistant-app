import { FinColors } from "@/constants/theme";
import type { HelpAssistantQuickAction } from "@/services/help-assistant-quick-actions";
import React from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useBudioAssistantEmptyStateAnimation } from "@/components/motions/useBudioAssistantEmptyStateAnimation";
import { useTheme } from "@/hooks/use-theme";

type CopyVariant = {
  title: string;
  copy: string;
};

export type BudioAssistantEmptyStateProps = {
  visible: boolean;
  actions: HelpAssistantQuickAction[];
  onPressAction: (action: HelpAssistantQuickAction) => void;
  onExitComplete?: () => void;
  assistantLabel?: string;
  greetingTitle?: string;
  intensity?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const COPY_VARIANTS: CopyVariant[] = [
  {
    title: "Waar wil je vandaag meer grip op krijgen?",
    copy: "Vraag gerust iets over je budget, transacties of forecast.",
  },
  {
    title: "Ik kijk rustig met je mee.",
    copy: "Stel een vraag over je geld, ruimte of wat er nog aankomt.",
  },
  {
    title: "Budio staat klaar om mee te denken.",
    copy: "Begin met iets over je budget, uitgaven of overzicht.",
  },
];

const ACTIVE_COPY = COPY_VARIANTS[0];
const AnimatedView = Animated.createAnimatedComponent(View);
const isWeb = Platform.OS === "web";
const EMPTY_STATE_BG = "#f0f1f2";

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!cancelled) setReducedMotion(Boolean(value));
      })
      .catch(() => {
        // Ignore platform quirks and keep the default.
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (value) => setReducedMotion(Boolean(value)),
    );

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}

function EmptyStateActionChip({
  action,
  onPress,
}: {
  action: HelpAssistantQuickAction;
  onPress: (action: HelpAssistantQuickAction) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityHint={action.description}
      onPress={() => onPress(action)}
      style={({ pressed, hovered, focused }) => [
        styles.chip,
        hovered && styles.chipHovered,
        focused && styles.chipFocused,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={styles.chipLabel} numberOfLines={2}>
        {action.label}
      </Text>
    </Pressable>
  );
}

export function BudioAssistantEmptyState({
  visible,
  actions,
  onPressAction,
  onExitComplete,
  assistantLabel = "Hulpassistent",
  greetingTitle = "Hoi,",
  intensity,
  testID,
  style,
}: BudioAssistantEmptyStateProps) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const reducedMotionPreference = usePrefersReducedMotion();
  const reducedMotion = reducedMotionPreference;
  const visualSize = React.useMemo(() => {
    const base = Math.round(width * 0.28);
    return Math.max(132, Math.min(176, base || 144));
  }, [width]);
  const center = visualSize / 2;
  const orbit = useBudioAssistantEmptyStateAnimation({
    intensity,
    reduceMotion: reducedMotion,
  });
  const entranceProgress = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    if (reducedMotion) {
      entranceProgress.value = visible ? 1 : 0;
      if (!visible) {
        onExitComplete?.();
      }
      return;
    }

    if (visible) {
      entranceProgress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    entranceProgress.value = withTiming(
      0,
      {
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(onExitComplete || (() => undefined))();
        }
      },
    );
  }, [entranceProgress, onExitComplete, reducedMotion, visible]);

  React.useEffect(
    () => () => {
      cancelAnimation(entranceProgress);
    },
    [entranceProgress],
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: entranceProgress.value,
    transform: [
      { translateY: (1 - entranceProgress.value) * 12 },
      { scale: 0.98 + entranceProgress.value * 0.02 },
    ],
  }));
  const visualRotationStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${(orbit.orbit.value - 0.5) * 8}deg` },
      { scale: 0.995 + orbit.breath.value * 0.01 },
    ],
  }));

  const blobMotionX = useDerivedValue(
    () => (orbit.drift.value - 0.5) * visualSize * 0.08,
  );
  const blobMotionY = useDerivedValue(
    () => (orbit.breath.value - 0.5) * visualSize * 0.06,
  );
  const blobCounterX = useDerivedValue(
    () => (0.5 - orbit.drift.value) * visualSize * 0.07,
  );
  const blobCounterY = useDerivedValue(
    () => (0.5 - orbit.shimmer.value) * visualSize * 0.045,
  );
  const blobASize = useDerivedValue(
    () => visualSize * (0.54 + orbit.haloScale.value * 0.05),
  );
  const blobBSize = useDerivedValue(
    () => visualSize * (0.39 + orbit.coreScale.value * 0.04),
  );
  const blobCSize = useDerivedValue(
    () => visualSize * (0.14 + orbit.shimmer.value * 0.015),
  );
  const blobGlowOpacity = useDerivedValue(
    () => 0.18 + orbit.glowOpacity.value * 0.18,
  );
  const blobCoreOpacity = useDerivedValue(
    () => 0.14 + orbit.glowOpacity.value * 0.12,
  );
  const blobAccentOpacity = useDerivedValue(
    () => 0.08 + orbit.dotOpacity.value * 0.08,
  );
  const blobAStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: blobMotionX.value - visualSize * 0.18 },
      { translateY: blobMotionY.value - visualSize * 0.02 },
      { scale: 0.96 + orbit.haloScale.value * 0.05 },
    ],
    opacity: orbit.glowOpacity.value,
  }));
  const blobBStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: blobCounterX.value + visualSize * 0.12 },
      { translateY: blobCounterY.value + visualSize * 0.01 },
      { scale: 0.95 + orbit.coreScale.value * 0.06 },
    ],
    opacity: 0.9,
  }));
  const blobCStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (orbit.orbit.value - 0.5) * visualSize * 0.03 + visualSize * 0.07,
      },
      {
        translateY:
          (0.5 - orbit.breath.value) * visualSize * 0.025 - visualSize * 0.01,
      },
      { scale: 0.95 + orbit.shimmer.value * 0.04 },
    ],
    opacity: orbit.dotOpacity.value,
  }));

  const emptyChips = actions.slice(0, 4);
  const showAssistantLabel = assistantLabel.trim().length > 0;

  return (
    <AnimatedView
      testID={testID}
      style={[
        styles.root,
        style,
        containerStyle,
        visible ? styles.pointerEventsAuto : styles.pointerEventsNone,
      ]}
    >
      <View style={styles.surface}>
        <View style={[styles.visualWrap, styles.pointerEventsNone]}>
          <AnimatedView
            style={[
              styles.visualMotion,
              visualRotationStyle,
              {
                width: visualSize,
                height: visualSize,
              },
            ]}
          >
            {isWeb ? (
              <AnimatedView
                style={[
                  styles.webVisual,
                  {
                    width: visualSize,
                    height: visualSize,
                  },
                ]}
              >
              <AnimatedView
                style={[
                  styles.webHalo,
                  {
                    width: visualSize * 0.76,
                    height: visualSize * 0.54,
                    borderRadius: visualSize * 0.28,
                    backgroundColor: theme.colors.brandPrimary,
                  },
                  blobAStyle,
                ]}
              />
              <AnimatedView
                style={[
                  styles.webCore,
                  {
                    width: visualSize * 0.52,
                    height: visualSize * 0.4,
                    borderRadius: visualSize * 0.2,
                    backgroundColor: theme.colors.brandHighlight,
                  },
                  blobBStyle,
                ]}
              />
              <AnimatedView
                style={[
                  styles.webAccent,
                  {
                    width: visualSize * 0.2,
                    height: visualSize * 0.14,
                    borderRadius: visualSize * 0.07,
                    backgroundColor: theme.colors.brandAccent,
                  },
                  blobCStyle,
                ]}
              />
              </AnimatedView>
            ) : (
              <Canvas style={{ width: visualSize, height: visualSize }}>
                <Fill color="transparent" />
                <Group>
                  <Circle
                    cx={center - visualSize * 0.14 + blobMotionX}
                    cy={center - visualSize * 0.03 + blobMotionY}
                    r={blobASize}
                    opacity={blobGlowOpacity}
                  >
                    <LinearGradient
                      start={vec(
                        center - visualSize * 0.38,
                        center - visualSize * 0.28,
                      )}
                      end={vec(
                        center + visualSize * 0.34,
                        center + visualSize * 0.24,
                      )}
                      colors={[
                        theme.colors.brandPrimary,
                        theme.colors.brandHighlight,
                      ]}
                    />
                  </Circle>
                  <Circle
                    cx={center + visualSize * 0.1 + blobCounterX}
                    cy={center + visualSize * 0.02 + blobCounterY}
                    r={blobBSize}
                    opacity={blobCoreOpacity}
                  >
                    <LinearGradient
                      start={vec(
                        center - visualSize * 0.24,
                        center - visualSize * 0.18,
                      )}
                      end={vec(
                        center + visualSize * 0.2,
                        center + visualSize * 0.16,
                      )}
                      colors={[
                        theme.colors.brandHighlight,
                        theme.colors.brandAccent,
                      ]}
                    />
                  </Circle>
                  <Circle
                    cx={center + visualSize * 0.16 + blobMotionX * 0.35}
                    cy={center - visualSize * 0.08 + blobMotionY * 0.3}
                    r={blobCSize}
                    opacity={blobAccentOpacity}
                    color={theme.colors.brandAccent}
                  />
                </Group>
              </Canvas>
            )}
          </AnimatedView>
        </View>

        <View style={styles.copyWrap}>
          {showAssistantLabel ? (
            <Text style={styles.badge}>{assistantLabel}</Text>
          ) : null}
          <Text style={styles.title}>{greetingTitle}</Text>
          <Text style={styles.subtitle}>{ACTIVE_COPY.title}</Text>
          <Text style={styles.copy}>{ACTIVE_COPY.copy}</Text>
        </View>

        <View style={styles.chipsWrap}>
          {emptyChips.map((action) => (
            <EmptyStateActionChip
              key={action.id}
              action={action}
              onPress={onPressAction}
            />
          ))}
        </View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 280,
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  pointerEventsAuto: {
    pointerEvents: "auto",
  },
  pointerEventsNone: {
    pointerEvents: "none",
  },
  surface: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: EMPTY_STATE_BG,
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 20,
  },
  visualWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 132,
    paddingTop: 4,
  },
  visualMotion: {
    alignItems: "center",
    justifyContent: "center",
  },
  webVisual: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  webHalo: {
    position: "absolute",
    opacity: 0.16,
  },
  webCore: {
    position: "absolute",
    opacity: 0.18,
  },
  webAccent: {
    position: "absolute",
    opacity: 0.1,
  },
  copyWrap: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontWeight: "800",
    color: FinColors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.1,
    fontWeight: "600",
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
    textAlign: "center",
    maxWidth: 340,
  },
  chipsWrap: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
  },
  chip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    outlineWidth: 0,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as const)
      : null),
  },
  chipHovered: {
    backgroundColor: FinColors.bgCard,
    borderColor: "rgba(17,17,17,0.12)",
  },
  chipFocused: {
    borderColor: FinColors.greenBorder,
  },
  chipPressed: {
    opacity: 0.84,
    transform: [{ translateY: 1 }],
  },
  chipLabel: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "500",
    color: FinColors.textPrimary,
    textAlign: "center",
  },
});
