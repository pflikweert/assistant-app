import { AppIcon } from "@/components/ui/app-icon";
import type { HelpAssistantQuickAction } from "@/services/help-assistant-quick-actions";
import { FinColors } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type HelpAssistantQuickActionsProps = {
  actions: HelpAssistantQuickAction[];
  onPressAction: (action: HelpAssistantQuickAction) => void;
};

export function HelpAssistantQuickActions({
  actions,
  onPressAction,
}: HelpAssistantQuickActionsProps) {
  return (
    <View style={styles.wrap}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onPressAction(action)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <View style={styles.topRow}>
            <AppIcon
              name="auto-awesome"
              size={15}
              color={FinColors.textSecondary}
              variant="outlined"
            />
            <Text style={styles.label}>{action.label}</Text>
          </View>
          <Text style={styles.description}>{action.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  button: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.84,
  },
  label: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "700",
    flexShrink: 1,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textSecondary,
  },
});
