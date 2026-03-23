import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type FinanceQuickMenuKey =
  | "index"
  | "transactions"
  | "insights"
  | "budget";

export type FinanceQuickMenuItem = {
  key: FinanceQuickMenuKey;
  label: string;
  icon: AppIconName;
};

export const FINANCE_QUICK_MENU_ITEMS: FinanceQuickMenuItem[] = [
  { key: "index", label: "Dashboard", icon: "space-dashboard" },
  { key: "transactions", label: "Transacties", icon: "receipt-long" },
  { key: "insights", label: "Insights", icon: "insights" },
  { key: "budget", label: "Budget", icon: "account-balance-wallet" },
];

type FinanceQuickMenuProps = {
  activeKey?: FinanceQuickMenuKey | null;
  onSelect: (key: FinanceQuickMenuKey) => void;
};

export function FinanceQuickMenu({
  activeKey,
  onSelect,
}: FinanceQuickMenuProps) {
  return (
    <View style={[styles.outer, styles.outerPointerEvents]}>
      <View style={styles.shell}>
        {FINANCE_QUICK_MENU_ITEMS.map((item) => {
          const isActive = activeKey != null && item.key === activeKey;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              onPress={() => onSelect(item.key)}
              style={({ pressed }) => [
                styles.item,
                isActive && styles.itemFocused,
                pressed && styles.itemPressed,
              ]}
            >
              <AppIcon
                name={item.icon}
                size={20}
                color={isActive ? FinColors.textPrimary : FinColors.tabInactive}
                variant="outlined"
              />
              <Text
                style={[styles.label, isActive && styles.labelFocused]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 24,
  },
  outerPointerEvents: {
    pointerEvents: "box-none",
  },
  shell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(246,245,242,0.98)",
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 10,
    boxShadow: "0px 10px 22px rgba(17,17,17,0.12)",
    elevation: 18,
  },
  item: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 999,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  itemFocused: {
    backgroundColor: FinColors.yellow,
  },
  itemPressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "700",
    color: FinColors.tabInactive,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  labelFocused: {
    color: FinColors.textPrimary,
  },
});
