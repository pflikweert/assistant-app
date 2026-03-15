import { Tabs } from "expo-router";
import React from "react";
import { useSession } from "../_layout";

import { HapticTab } from "@/components/haptic-tab";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { runPendingCategorizationInBackground } from "@/services/categorization";

function TabIcon({
  color,
  name,
}: {
  color: string;
  name: AppIconName;
}) {
  return <AppIcon name={name} size={22} color={color} variant="outlined" />;
}

export default function TabLayout() {
  const { user } = useSession();

  React.useEffect(() => {
    if (!user) return;
    runPendingCategorizationInBackground();
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: FinColors.tabActive,
        tabBarInactiveTintColor: FinColors.tabInactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: FinColors.tabBg,
          borderTopColor: FinColors.borderSubtle,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name="space-dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name="receipt-long" />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name="insights" />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: "Budget",
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name="account-balance-wallet" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
