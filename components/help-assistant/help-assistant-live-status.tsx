import { FinanceAssistantMotionGlyph } from "@/components/motions/finance-assistant-motion-glyph";
import { FinanceLiveStatusDotMotion } from "@/components/motions/finance-live-status-dot-motion";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type HelpAssistantLiveStatusProps = {
  active: boolean;
};

export function HelpAssistantLiveStatus({
  active,
}: HelpAssistantLiveStatusProps) {
  return (
    <View style={styles.liveStatusWrap}>
      <View style={styles.liveStatusAvatar}>
        <FinanceAssistantMotionGlyph
          size={13}
          color={FinColors.textPrimary}
          disabled={!active}
        />
      </View>
      <View style={styles.livePill}>
        <FinanceLiveStatusDotMotion disabled={!active} />
        <Text style={styles.livePillLabel}>Live</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  liveStatusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveStatusAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(17,17,17,0.05)",
  },
  livePillLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: FinColors.textSecondary,
  },
});
