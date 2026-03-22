import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
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
  title: string;
  subtitle: string;
  steps: string[];
  note?: string;
  style?: StyleProp<ViewStyle>;
};

export function FinanceLoadingSplash({
  title,
  subtitle,
  steps,
  note,
  style,
}: FinanceLoadingSplashProps) {
  return (
    <View style={[styles.stage, style]}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <AppIcon name="sync" size={22} color={FinColors.warningText} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Gegevens ophalen</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.stepList}>
          {steps.map((step) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.loadingRow}>
          <ActivityIndicator color={FinColors.warningText} />
          <Text style={styles.loadingText}>Even geduld, we zetten je overzicht klaar.</Text>
        </View>

        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 88,
    paddingBottom: 128,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 18,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: FinColors.yellowSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    gap: 10,
  },
  eyebrow: {
    color: FinColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: FinColors.textPrimary,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: FinColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  stepList: {
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FinColors.warningText,
  },
  stepText: {
    flex: 1,
    color: FinColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
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
    lineHeight: 19,
  },
  note: {
    color: FinColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
