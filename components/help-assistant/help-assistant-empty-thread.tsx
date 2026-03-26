import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function HelpAssistantEmptyThread() {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <AppIcon
          name="question-answer"
          size={20}
          color={FinColors.warningText}
          variant="outlined"
        />
      </View>
      <Text style={styles.title}>Nog geen gesprek gestart</Text>
      <Text style={styles.copy}>
        Stel een vraag over dit scherm of kies een snelle actie om te beginnen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
});
