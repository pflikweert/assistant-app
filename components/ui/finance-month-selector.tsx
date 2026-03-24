import { FinColors } from "@/constants/theme";
import { AppIcon } from "@/components/ui/app-icon";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FinanceMonthSelectorProps = {
  label: string;
  canGoToOlderMonth: boolean;
  canGoToNewerMonth: boolean;
  onPressLabel: () => void;
  onGoToOlderMonth: () => void;
  onGoToNewerMonth: () => void;
};

export function FinanceMonthSelector({
  label,
  canGoToOlderMonth,
  canGoToNewerMonth,
  onPressLabel,
  onGoToOlderMonth,
  onGoToNewerMonth,
}: FinanceMonthSelectorProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={[
          styles.navButton,
          !canGoToOlderMonth && styles.navButtonDisabled,
        ]}
        onPress={onGoToOlderMonth}
        disabled={!canGoToOlderMonth}
        accessibilityRole="button"
        accessibilityLabel="Vorige maand"
      >
        <AppIcon
          name="chevron-left"
          size={22}
          color={FinColors.textSecondary}
          variant="outlined"
        />
      </Pressable>

      <Pressable
        style={styles.badge}
        onPress={onPressLabel}
        accessibilityRole="button"
        accessibilityLabel={`Kies maand: ${label}`}
      >
        <Text style={styles.badgeText}>{label}</Text>
        <AppIcon
          name="expand-more"
          size={18}
          color={FinColors.textSecondary}
          variant="outlined"
        />
      </Pressable>

      <Pressable
        style={[
          styles.navButton,
          !canGoToNewerMonth && styles.navButtonDisabled,
        ]}
        onPress={onGoToNewerMonth}
        disabled={!canGoToNewerMonth}
        accessibilityRole="button"
        accessibilityLabel="Volgende maand"
      >
        <AppIcon
          name="chevron-right"
          size={22}
          color={FinColors.textSecondary}
          variant="outlined"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    borderRadius: 999,
    padding: 6,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.28,
  },
  badge: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  badgeText: {
    fontSize: 15,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
    textTransform: "capitalize",
  },
});
