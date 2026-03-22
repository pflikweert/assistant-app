import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { FinanceQuickMenu, type FinanceQuickMenuKey } from "./finance-quick-menu";

export function DockedTabBar({ state, navigation }: BottomTabBarProps) {
  const activeKey = (state.routes[state.index]?.name || "index") as FinanceQuickMenuKey;

  return (
    <FinanceQuickMenu
      activeKey={activeKey}
      onSelect={(key) => {
        const route = state.routes.find((candidate) => candidate.name === key);
        if (!route) return;

        const isFocused = state.routes[state.index]?.name === key;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
    />
  );
}
