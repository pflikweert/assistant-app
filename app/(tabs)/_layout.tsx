import { Tabs } from "expo-router";
import React from "react";
import { useSession } from "../_layout";

import { DockedTabBar } from "@/components/navigation/docked-tab-bar";
import { runPendingCategorizationInBackground } from "@/services/categorization";

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
        headerShown: false,
      }}
      tabBar={(props) => <DockedTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: "Budget",
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
