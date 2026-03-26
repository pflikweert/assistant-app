import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
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
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type AssistantTheme = {
  primary: string;
  text: string;
};

type AiAssistantResponseProps = {
  isLoading: boolean;
  text: string;
  theme: AssistantTheme;
  onTypingComplete?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const LOADER_SIZE = 116;
const MIN_TYPING_DURATION = 650;
const MAX_TYPING_DURATION = 5400;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function withAlpha(hexOrRgb: string, alpha: number) {
  if (hexOrRgb.startsWith("#")) {
    const hex = hexOrRgb.slice(1);
    if (hex.length === 3) {
      const r = parseInt(`${hex[0]}${hex[0]}`, 16);
      const g = parseInt(`${hex[1]}${hex[1]}`, 16);
      const b = parseInt(`${hex[2]}${hex[2]}`, 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return hexOrRgb;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildTypingWeights(text: string) {
  const cumulative: number[] = [];
  let total = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    let weight = 1;
    if (char === " ") weight = 0.45;
    else if (char === "\n") weight = 1.25;
    else if (char === "." || char === "," || char === ";" || char === ":")
      weight = 1.8;
    else if (char === "!" || char === "?") weight = 2.2;
    total += weight;
    cumulative.push(total);
  }

  return { cumulative, total };
}

function resolveTypedCount(progress: number, cumulative: number[], total: number) {
  "worklet";
  if (cumulative.length === 0 || total <= 0) return 0;
  const target = progress * total;
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cumulative[mid] < target) low = mid + 1;
    else high = mid;
  }
  return clamp(low + 1, 0, cumulative.length);
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function AiAssistantResponse({
  isLoading,
  text,
  theme,
  onTypingComplete,
  testID,
  style,
}: AiAssistantResponseProps) {
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [isTypingPhase, setIsTypingPhase] = React.useState(!isLoading);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = React.useRef(false);

  const motionPhase = useSharedValue(isLoading ? 0 : 1); // 0 loader, 1 response
  const flow = useSharedValue(0);
  const typingProgress = useSharedValue(0);
  const cursorPulse = useSharedValue(1);

  const { cumulative, total } = React.useMemo(() => buildTypingWeights(text), [text]);
  const jitter = React.useMemo(() => (hashString(text || "seed") % 11) / 100, [text]);
  const typingDuration = React.useMemo(
    () => clamp(total * (34 + jitter * 18), MIN_TYPING_DURATION, MAX_TYPING_DURATION),
    [jitter, total],
  );

  React.useEffect(() => {
    flow.value = withRepeat(
      withTiming(1, {
        duration: 2800,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(flow);
    };
  }, [flow]);

  React.useEffect(() => {
    cursorPulse.value = withRepeat(
      withTiming(0.15, {
        duration: 620,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(cursorPulse);
    };
  }, [cursorPulse]);

  React.useEffect(() => {
    completedRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isLoading) {
      setIsTypingPhase(false);
      setVisibleCount(0);
      typingProgress.value = 0;
      motionPhase.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    setIsTypingPhase(true);
    motionPhase.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });

    // Slight pause keeps the response natural before typing starts.
    timerRef.current = setTimeout(() => {
      typingProgress.value = 0;
      typingProgress.value = withTiming(1, {
        duration: Math.round(typingDuration),
        easing: Easing.linear,
      });
    }, 220);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLoading, motionPhase, typingDuration, typingProgress]);

  const typedCount = useDerivedValue(() =>
    resolveTypedCount(typingProgress.value, cumulative, total),
  );
  const handleTypingComplete = React.useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onTypingComplete?.();
  }, [onTypingComplete]);

  useAnimatedReaction(
    () => typedCount.value,
    (next, prev) => {
      if (next === prev) return;
      runOnJS(setVisibleCount)(next);
    },
    [typedCount],
  );
  useAnimatedReaction(
    () => typedCount.value,
    (next) => {
      if (isLoading) return;
      if (text.length === 0) return;
      if (next >= text.length) {
        runOnJS(handleTypingComplete)();
      }
    },
    [handleTypingComplete, isLoading, text.length],
  );

  const loaderStyle = useAnimatedStyle(() => ({
    opacity: 1 - motionPhase.value,
    transform: [{ scale: 1 - motionPhase.value * 0.03 }],
  }));

  const responseStyle = useAnimatedStyle(() => ({
    opacity: motionPhase.value,
    transform: [{ scale: 0.985 + motionPhase.value * 0.015 }],
  }));

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorPulse.value,
  }));
  const webBlobLargeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(flow.value * Math.PI * 2) * 7 },
      { translateY: Math.cos(flow.value * Math.PI * 2) * 4 },
      { scale: 0.96 + flow.value * 0.08 },
      { rotate: `${-8 + Math.sin(flow.value * Math.PI * 2) * 3}deg` },
    ],
  }));
  const webBlobSmallStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 18 + Math.cos(flow.value * Math.PI * 2 + 0.7) * 6 },
      { translateY: -6 + Math.sin(flow.value * Math.PI * 2 + 1.1) * 4 },
      { scale: 0.95 + (1 - flow.value) * 0.1 },
    ],
  }));

  const blobAX = useDerivedValue(
    () => LOADER_SIZE * (0.48 + Math.sin(flow.value * Math.PI * 2) * 0.08),
  );
  const blobAY = useDerivedValue(
    () => LOADER_SIZE * (0.49 + Math.cos(flow.value * Math.PI * 2) * 0.06),
  );
  const blobAR = useDerivedValue(() => LOADER_SIZE * (0.26 + flow.value * 0.04));
  const blobBX = useDerivedValue(
    () => LOADER_SIZE * (0.54 + Math.cos(flow.value * Math.PI * 2 + 0.8) * 0.09),
  );
  const blobBY = useDerivedValue(
    () => LOADER_SIZE * (0.52 + Math.sin(flow.value * Math.PI * 2 + 0.6) * 0.08),
  );
  const blobBR = useDerivedValue(() => LOADER_SIZE * (0.2 + (1 - flow.value) * 0.05));
  const blobOpacity = useDerivedValue(() => 0.22 + flow.value * 0.18);

  const shownText = React.useMemo(() => text.slice(0, visibleCount), [text, visibleCount]);
  const showCursor = isTypingPhase && visibleCount < text.length;
  const isWeb = Platform.OS === "web";

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        style,
      ]}
    >
      <AnimatedView style={[styles.loaderLayer, loaderStyle]} pointerEvents="none">
        {isWeb ? (
          <AnimatedView style={styles.webBlobWrap}>
            <AnimatedView
              style={[
                styles.webBlobLarge,
                {
                  backgroundColor: withAlpha(theme.primary, 0.22),
                },
                webBlobLargeStyle,
              ]}
            />
            <AnimatedView
              style={[
                styles.webBlobSmall,
                {
                  backgroundColor: withAlpha(theme.primary, 0.12),
                },
                webBlobSmallStyle,
              ]}
            />
          </AnimatedView>
        ) : (
          <Canvas style={styles.loaderCanvas}>
            <Fill color="transparent" />
            <Group>
              <Circle cx={blobAX} cy={blobAY} r={blobAR} opacity={blobOpacity}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(LOADER_SIZE, LOADER_SIZE)}
                  colors={[withAlpha(theme.primary, 0.45), withAlpha(theme.primary, 0.08)]}
                />
              </Circle>
              <Circle cx={blobBX} cy={blobBY} r={blobBR} opacity={blobOpacity}>
                <LinearGradient
                  start={vec(LOADER_SIZE, 0)}
                  end={vec(0, LOADER_SIZE)}
                  colors={[withAlpha(theme.primary, 0.28), withAlpha(theme.primary, 0.04)]}
                />
              </Circle>
            </Group>
          </Canvas>
        )}
      </AnimatedView>

      <AnimatedView style={[styles.responseLayer, responseStyle]}>
        <Text style={[styles.responseText, { color: theme.text }]}>
          {shownText}
          {showCursor ? (
            <Animated.Text style={[styles.cursor, cursorStyle, { color: theme.text }]}>
              |
            </Animated.Text>
          ) : null}
        </Text>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    paddingVertical: 4,
    minHeight: 72,
    justifyContent: "center",
  },
  loaderLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderCanvas: {
    width: LOADER_SIZE,
    height: LOADER_SIZE * 0.76,
  },
  webBlobWrap: {
    width: LOADER_SIZE,
    height: LOADER_SIZE * 0.72,
    alignItems: "center",
    justifyContent: "center",
  },
  webBlobLarge: {
    position: "absolute",
    width: 74,
    height: 54,
    borderRadius: 999,
  },
  webBlobSmall: {
    position: "absolute",
    width: 54,
    height: 42,
    borderRadius: 999,
  },
  responseLayer: {
    minHeight: 30,
    justifyContent: "center",
  },
  responseText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  cursor: {
    fontWeight: "400",
  },
});
