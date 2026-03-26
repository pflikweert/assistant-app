import { HelpAssistantSheet } from "@/components/help-assistant/help-assistant-sheet";
import {
  buildHelpAssistantContext,
  type HelpAssistantPeriodContext,
  type HelpAssistantScreenContextData,
  type HelpAssistantScreenId,
} from "@/services/help-assistant-context";
import { FinanceCircleIconButton } from "@/components/ui/finance-circle-icon-button";
import { FinColors } from "@/constants/theme";
import { usePathname } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

type FinanceHelpAssistantTriggerProps = {
  screenId: HelpAssistantScreenId;
  selectedPeriod?: HelpAssistantPeriodContext | null;
  screenContext?: HelpAssistantScreenContextData | null;
};

export function FinanceHelpAssistantTrigger({
  screenId,
  selectedPeriod,
  screenContext,
}: FinanceHelpAssistantTriggerProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const context = React.useMemo(
    () =>
      buildHelpAssistantContext({
        screenId,
        routeName: pathname,
        selectedPeriod,
        screenContext,
      }),
    [pathname, screenContext, screenId, selectedPeriod],
  );

  return (
    <>
      <FinanceCircleIconButton
        icon="help-outline"
        onPress={() => setOpen(true)}
        accessibilityLabel={`Open hulpassistent voor ${context.screenTitle}`}
        iconColor={FinColors.warningText}
        iconVariant="outlined"
        style={styles.trigger}
      />
      <HelpAssistantSheet
        visible={open}
        context={context}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
});
