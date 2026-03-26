import { Tabs } from "expo-router";
import { useSession } from "../_layout";

import { DockedTabBar } from "@/components/navigation/docked-tab-bar";

export default function TabLayout() {
  const { user } = useSession();

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
