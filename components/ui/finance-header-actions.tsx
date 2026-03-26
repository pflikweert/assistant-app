import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
import { FinanceHelpAssistantTrigger } from "@/components/ui/finance-help-assistant-trigger";
import type {
  HelpAssistantPeriodContext,
  HelpAssistantScreenContextData,
  HelpAssistantScreenId,
} from "@/services/help-assistant-context";
import React from "react";
import { StyleSheet, View } from "react-native";

type FinanceHeaderActionsProps = {
  screenId: HelpAssistantScreenId;
  selectedPeriod?: HelpAssistantPeriodContext | null;
  screenContext?: HelpAssistantScreenContextData | null;
};

export function FinanceHeaderActions({
  screenId,
  selectedPeriod,
  screenContext,
}: FinanceHeaderActionsProps) {
  return (
    <View style={styles.row}>
      <FinanceAvatarBadge />
      <FinanceHelpAssistantTrigger
        screenId={screenId}
        selectedPeriod={selectedPeriod}
        screenContext={screenContext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
