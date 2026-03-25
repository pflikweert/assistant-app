import { FinColors } from "@/constants/theme";
import BudioIcon from "@/assets/images/budio-yellow-icon.svg";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

type FinanceLoadingSplashProps = {
  title?: string;
  subtitle?: string;
  note?: string;
  style?: StyleProp<ViewStyle>;
};

export function FinanceLoadingSplash({
  title = "Gegevens laden",
  subtitle = "We zetten je overzicht klaar.",
  note = "Even geduld.",
  style,
}: FinanceLoadingSplashProps) {
  return (
    <View style={[styles.stage, style]}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <View accessible accessibilityLabel="Budio" style={styles.badge}>
            <BudioIcon width={44} height={44} />
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Synchroniseren</Text>
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.visualStack} accessible={false}>
          <View style={[styles.visualBar, styles.visualBarStrong]} />
          <View style={[styles.visualBar, styles.visualBarMedium]} />
          <View style={[styles.visualBar, styles.visualBarLight]} />
        </View>

        <View style={styles.loadingRow}>
          <ActivityIndicator color={FinColors.warningText} />
          <Text style={styles.loadingText}>{note}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 88,
    overflow: "hidden",
  },
  orbTop: {
    position: "absolute",
    top: -110,
    right: -84,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(242,201,76,0.12)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -108,
    left: -74,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(235,243,255,0.25)",
  },
  card: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 22,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 12,
    boxShadow: "0px 18px 30px rgba(17,17,17,0.08)",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  chipText: {
    color: FinColors.textSecondary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: FinColors.textPrimary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  subtitle: {
    color: FinColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  visualStack: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  visualBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
  },
  visualBarStrong: {
    width: "82%",
    backgroundColor: "rgba(242,201,76,0.34)",
  },
  visualBarMedium: {
    width: "66%",
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  visualBarLight: {
    width: "44%",
    backgroundColor: "rgba(235,243,255,0.9)",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
  },
  loadingText: {
    flex: 1,
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
