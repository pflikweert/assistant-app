import React from "react";
import { StyleSheet, View } from "react-native";

type FinanceScreenBackdropProps = {
  tone?: "warm" | "neutral";
};

const HORIZONTAL_GRID_LINES = [
  "12%",
  "28%",
  "44%",
  "60%",
  "76%",
];

const VERTICAL_GRID_LINES = [
  "12%",
  "30%",
  "48%",
  "66%",
  "84%",
];

export function FinanceScreenBackdrop({
  tone = "warm",
}: FinanceScreenBackdropProps) {
  return (
    <View style={[styles.fill, styles.fillPointerEvents]}>
      <View style={styles.base} />
      <View style={styles.paperLayer} />
      <View
        style={[styles.topWash, tone === "neutral" && styles.topWashNeutral]}
      />

      <View style={styles.gridWrap}>
        {HORIZONTAL_GRID_LINES.map((top) => (
          <View key={`h-${top}`} style={[styles.gridHorizontal, { top }]} />
        ))}
        {VERTICAL_GRID_LINES.map((left) => (
          <View key={`v-${left}`} style={[styles.gridVertical, { left }]} />
        ))}
      </View>
      <View style={styles.techLineLeft} />
      <View style={styles.techLineRight} />
      <View style={styles.techLineDiagA} />
      <View style={styles.techLineDiagB} />
      <View
        style={[
          styles.backdropGlowTop,
          tone === "neutral" && styles.backdropGlowTopNeutral,
        ]}
      />
      <View
        style={[
          styles.backdropGlowBottom,
          tone === "neutral" && styles.backdropGlowBottomNeutral,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  fillPointerEvents: {
    pointerEvents: "none",
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fafbff",
  },
  paperLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,251,255,0.92)",
  },
  topWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: "rgba(250,251,255,0.78)",
  },
  topWashNeutral: {
    backgroundColor: "rgba(250,251,255,0.58)",
  },
  coolFadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: "rgba(237,244,255,0.56)",
  },
  coolFadeMid: {
    position: "absolute",
    top: 180,
    left: 0,
    right: 0,
    height: 360,
    backgroundColor: "rgba(227,236,252,0.30)",
  },
  gridWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  gridHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(62,92,142,0.02)",
  },
  gridVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(62,92,142,0.02)",
  },
  techLineLeft: {
    position: "absolute",
    top: "12%",
    left: "6%",
    width: "22%",
    height: 1,
    backgroundColor: "rgba(108,139,190,0.06)",
  },
  techLineRight: {
    position: "absolute",
    top: "28%",
    right: "7%",
    width: "26%",
    height: 1,
    backgroundColor: "rgba(108,139,190,0.06)",
  },
  techLineDiagA: {
    position: "absolute",
    top: "42%",
    left: "-8%",
    width: "42%",
    height: 1,
    backgroundColor: "rgba(108,139,190,0.04)",
    transform: [{ rotate: "-18deg" }],
  },
  techLineDiagB: {
    position: "absolute",
    top: "70%",
    right: "-10%",
    width: "46%",
    height: 1,
    backgroundColor: "rgba(108,139,190,0.035)",
    transform: [{ rotate: "-16deg" }],
  },
  backdropGlowTop: {
    position: "absolute",
    top: -84,
    right: -108,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: "rgba(242,201,76,0.10)",
  },
  backdropGlowTopNeutral: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  backdropGlowBottom: {
    position: "absolute",
    bottom: -156,
    left: -126,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(210,225,246,0.34)",
  },
  backdropGlowBottomNeutral: {
    backgroundColor: "rgba(242,201,76,0.06)",
  },
});
