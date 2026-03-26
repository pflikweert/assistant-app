import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type HelpAssistantContextChipProps = {
  label: string;
};

export function HelpAssistantContextChip({
  label,
}: HelpAssistantContextChipProps) {
  return (
    <View style={styles.chip}>
      <AppIcon
        name="my-location"
        size={15}
        color={FinColors.warningText}
        variant="outlined"
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.warningBg,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.warningText,
  },
});
