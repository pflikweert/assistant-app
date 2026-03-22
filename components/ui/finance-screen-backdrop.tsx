import React from "react";
import { StyleSheet, View } from "react-native";

type FinanceScreenBackdropProps = {
  tone?: "warm" | "neutral";
};

export function FinanceScreenBackdrop({
  tone = "warm",
}: FinanceScreenBackdropProps) {
  return (
    <View style={[styles.fill, styles.fillPointerEvents]}>
      <View style={styles.base} />
      <View
        style={[
          styles.topWash,
          tone === "neutral" && styles.topWashNeutral,
        ]}
      />
      <View style={styles.blueFadeTop} />
      <View style={styles.blueFadeMid} />
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
    backgroundColor: "#ffffff",
  },
  topWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(255,255,255,0.70)",
  },
  topWashNeutral: {
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  blueFadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: "rgba(245,249,255,0.40)",
  },
  blueFadeMid: {
    position: "absolute",
    top: 140,
    left: 0,
    right: 0,
    height: 340,
    backgroundColor: "rgba(235,243,255,0.20)",
  },
  backdropGlowTop: {
    position: "absolute",
    top: -70,
    right: -98,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(242,201,76,0.11)",
  },
  backdropGlowTopNeutral: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  backdropGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -110,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "rgba(229,238,249,0.16)",
  },
  backdropGlowBottomNeutral: {
    backgroundColor: "rgba(242,201,76,0.05)",
  },
});
