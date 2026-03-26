import type { HelpAssistantQuickAction } from "@/services/help-assistant-quick-actions";
import { FinColors } from "@/constants/theme";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    outlineWidth: 0,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as any)
      : null),
  },
  buttonPressed: {
    opacity: 0.84,
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "500",
    flexShrink: 1,
  },
});
