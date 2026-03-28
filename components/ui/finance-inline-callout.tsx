import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type FinanceInlineCalloutProps = {
  text: string;
  iconName: AppIconName;
  tone?: "default" | "highlight";
};

export function FinanceInlineCallout({
  text,
  iconName,
  tone = "default",
}: FinanceInlineCalloutProps) {
  const highlight = tone === "highlight";

  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={[styles.iconWrap, highlight && styles.iconWrapHighlight]}>
        <AppIcon
          name={iconName}
          size={14}
          color={FinColors.warningText}
          variant="outlined"
        />
      </View>
      <Text style={[styles.text, highlight && styles.textHighlight]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardHighlight: {
    backgroundColor: FinColors.yellowSoft,
    boxShadow: "0px 8px 16px rgba(242,201,76,0.18)",
    elevation: 1,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgCard,
  },
  iconWrapHighlight: {
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  textHighlight: {
    color: FinColors.warningText,
    fontWeight: "800",
  },
});
