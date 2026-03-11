import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { FinColors } from "@/constants/theme";

// Simple SVG-free icon using React Native primitives
function TabIcon({
  color,
  type,
}: {
  color: string;
  type: "dashboard" | "transactions" | "insights" | "settings";
}) {
  const s = 22;
  if (type === "dashboard") {
    return (
      <View style={{ width: s, height: s, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", gap: 3, flex: 1 }}>
          <View style={[styles.iconBlock, { backgroundColor: color, flex: 1 }]} />
          <View style={[styles.iconBlock, { backgroundColor: color, flex: 1 }]} />
        </View>
        <View style={{ flexDirection: "row", gap: 3, flex: 1, marginTop: 3 }}>
          <View style={[styles.iconBlock, { backgroundColor: color, flex: 1 }]} />
          <View style={[styles.iconBlock, { backgroundColor: color, flex: 1 }]} />
        </View>
      </View>
    );
  }
  if (type === "transactions") {
    return (
      <View style={{ width: s, height: s, justifyContent: "center", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              height: 2.5,
              backgroundColor: color,
              borderRadius: 2,
              width: i === 0 ? "100%" : i === 1 ? "75%" : "55%",
            }}
          />
        ))}
      </View>
    );
  }
  if (type === "insights") {
    return (
      <View style={{ width: s, height: s, justifyContent: "flex-end", flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        {[8, 14, 10, 18].map((h, i) => (
          <View key={i} style={{ flex: 1, height: h, backgroundColor: color, borderRadius: 2 }} />
        ))}
      </View>
    );
  }
  // settings — gear-like circles
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 2, borderColor: color, justifyContent: "center", alignItems: "center" }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function TabLayout() {
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
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon color={color} type="dashboard" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => <TabIcon color={color} type="transactions" />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => <TabIcon color={color} type="insights" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon color={color} type="settings" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBlock: {
    borderRadius: 3,
  },
});
