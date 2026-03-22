import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type GestureResponderEvent,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function snapToStep(value: number, min: number, max: number, step: number) {
  if (step <= 0) return clamp(value, min, max);
  const normalized = Math.round((value - min) / step) * step + min;
  return clamp(normalized, min, max);
}

export function BudgetAmountSlider({
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const safeMin = sanitizeNumber(min, 0);
  const safeMax = Math.max(safeMin, sanitizeNumber(max, safeMin));
  const safeStep = Math.max(1, sanitizeNumber(step, 25));
  const boundedValue = clamp(sanitizeNumber(value, safeMin), safeMin, safeMax);
  const progress =
    safeMax > safeMin ? (boundedValue - safeMin) / (safeMax - safeMin) : 0;

  const setFromTouch = React.useCallback(
    (locationX: number) => {
      if (trackWidth <= 0 || safeMax <= safeMin || disabled) return;
      const ratio = clamp(locationX / trackWidth, 0, 1);
      const raw = safeMin + ratio * (safeMax - safeMin);
      onChange(snapToStep(raw, safeMin, safeMax, safeStep));
    },
    [disabled, onChange, safeMax, safeMin, safeStep, trackWidth],
  );

  const decrease = React.useCallback(() => {
    if (disabled) return;
    onChange(snapToStep(boundedValue - safeStep, safeMin, safeMax, safeStep));
  }, [boundedValue, disabled, onChange, safeMax, safeMin, safeStep]);

  const increase = React.useCallback(() => {
    if (disabled) return;
    onChange(snapToStep(boundedValue + safeStep, safeMin, safeMax, safeStep));
  }, [boundedValue, disabled, onChange, safeMax, safeMin, safeStep]);

  const handleTrackTouch = React.useCallback(
    (event: GestureResponderEvent) => {
      setFromTouch(event.nativeEvent.locationX);
    },
    [setFromTouch],
  );

  return (
    <View style={[styles.root, disabled && styles.rootDisabled]}>
      <View style={styles.valueRow}>
        <Text style={styles.valueLabel}>Gekozen besparing</Text>
        <Text style={styles.valueText}>{fmt.format(boundedValue)}</Text>
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
          onPress={decrease}
          disabled={disabled}
        >
          <AppIcon
            name="remove"
            size={18}
            color={disabled ? FinColors.textMuted : FinColors.textPrimary}
            variant="outlined"
          />
        </Pressable>

        <View
          style={styles.trackWrap}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderGrant={handleTrackTouch}
          onResponderMove={handleTrackTouch}
        >
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]}
            />
          </View>
          <View
            style={[
              styles.thumb,
              styles.thumbPointerEvents,
              { left: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>

        <Pressable
          style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
          onPress={increase}
          disabled={disabled}
        >
          <AppIcon
            name="add"
            size={18}
            color={disabled ? FinColors.textMuted : FinColors.textPrimary}
            variant="outlined"
          />
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{fmt.format(safeMin)}</Text>
        <Text style={styles.rangeText}>{fmt.format(safeMax)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  rootDisabled: {
    opacity: 0.55,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  valueLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  valueText: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonDisabled: {
    backgroundColor: FinColors.bgCard,
  },
  trackWrap: {
    flex: 1,
    height: 36,
    justifyContent: "center",
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: FinColors.green,
  },
  thumb: {
    position: "absolute",
    top: 6,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: FinColors.green,
    borderWidth: 2,
    borderColor: FinColors.bgCard,
  },
  thumbPointerEvents: {
    pointerEvents: "none",
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rangeText: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
});
