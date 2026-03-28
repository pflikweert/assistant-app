import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinancePressableSurface } from "@/components/ui/finance-pressable-surface";
import { FinColors, FinTokens } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type FinanceInsightCardType = "trend" | "reassurance" | "attention" | "neutral";

type FinanceInsightCardProps = {
  title: string;
  description: string;
  type: FinanceInsightCardType;
  ctaLabel?: string;
  onPress?: () => void;
};

function resolveVisual(type: FinanceInsightCardType): {
  icon: AppIconName;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  titleColor: string;
  accentColor: string;
} {
  if (type === "attention") {
    return {
      icon: "stars",
      iconColor: FinColors.warningText,
      iconBg: "transparent",
      borderColor: "rgba(138,100,0,0.20)",
      titleColor: FinColors.warningText,
      accentColor: FinColors.warningText,
    };
  }

  if (type === "reassurance") {
    return {
      icon: "check-circle",
      iconColor: FinTokens.color.statusGoodText,
      iconBg: "transparent",
      borderColor: "rgba(16,185,129,0.16)",
      titleColor: FinTokens.color.statusGoodText,
      accentColor: FinTokens.color.statusGoodText,
    };
  }

  if (type === "trend") {
    return {
      icon: "trending-up",
      iconColor: FinColors.warningText,
      iconBg: "transparent",
      borderColor: FinColors.warningBorder,
      titleColor: FinColors.warningText,
      accentColor: FinColors.warningText,
    };
  }

  return {
    icon: "info",
    iconColor: FinColors.textSecondary,
    iconBg: "transparent",
    borderColor: FinColors.borderSubtle,
    titleColor: FinColors.textPrimary,
    accentColor: FinColors.border,
  };
}

export function FinanceInsightCard({
  title,
  description,
  type,
  ctaLabel,
  onPress,
}: FinanceInsightCardProps) {
  const visual = resolveVisual(type);
  const pressable = Boolean(onPress);

  return (
    <FinancePressableSurface
      onPress={onPress}
      disabled={!pressable}
      style={[styles.card, { borderColor: visual.borderColor }]}
      pressedStyle={pressable ? styles.cardPressed : null}
    >
      <View style={[styles.leftAccent, { backgroundColor: visual.accentColor }]} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.iconWrap, { backgroundColor: visual.iconBg }]}>
            <AppIcon name={visual.icon} size={18} color={visual.iconColor} variant="outlined" />
          </View>
          <Text style={[styles.title, { color: visual.titleColor }]}>{title}</Text>
        </View>
        <Text style={styles.description}>{description}</Text>

        {ctaLabel && onPress ? (
          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <AppIcon
              name="chevron-right"
              size={16}
              color={FinColors.textPrimary}
              variant="outlined"
            />
          </View>
        ) : null}
      </View>
    </FinancePressableSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: FinColors.bgCard,
    paddingVertical: 16,
    paddingRight: 16,
    paddingLeft: 0,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
  },
  cardPressed: {
    opacity: 0.92,
  },
  leftAccent: {
    width: 4,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    alignSelf: "stretch",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: FinColors.textSecondary,
  },
  ctaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ctaText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
});
