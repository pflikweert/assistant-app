import { HelpAssistantSheet } from "@/components/help-assistant/help-assistant-sheet";
import { FinanceAssistantMotionButton } from "@/components/motions/finance-assistant-motion-button";
import {
  buildHelpAssistantContext,
  type HelpAssistantContext,
  type HelpAssistantPeriodContext,
  type HelpAssistantScreenContextData,
  type HelpAssistantScreenId,
} from "@/services/help-assistant-context";
import { usePathname } from "expo-router";
import React from "react";
import type { ReactNode } from "react";

type FinanceHelpAssistantTriggerProps = {
  screenId: HelpAssistantScreenId;
  selectedPeriod?: HelpAssistantPeriodContext | null;
  screenContext?: HelpAssistantScreenContextData | null;
  renderTrigger?: (input: {
    onPress: () => void;
    context: HelpAssistantContext;
  }) => ReactNode;
};

export function FinanceHelpAssistantTrigger({
  screenId,
  selectedPeriod,
  screenContext,
  renderTrigger,
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
      {renderTrigger ? (
        renderTrigger({
          onPress: () => setOpen(true),
          context,
        })
      ) : (
        <FinanceAssistantMotionButton
          onPress={() => setOpen(true)}
          accessibilityLabel={`Open hulpassistent voor ${context.screenTitle}`}
        />
      )}
      <HelpAssistantSheet
        visible={open}
        context={context}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
