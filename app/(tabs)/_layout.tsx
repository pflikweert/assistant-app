import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSession } from "../_layout";

import { HapticTab } from "@/components/haptic-tab";
import { FinColors } from "@/constants/theme";
import { runPendingCategorizationInBackground } from "@/services/categorization";

// Simple SVG-free icon using React Native primitives
function TabIcon({
  color,
  type,
}: {
  color: string;
  type: "dashboard" | "transactions" | "insights" | "budget" | "settings";
}) {
  const s = 22;
  if (type === "dashboard") {
    return (
      <View style={{ width: s, height: s, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", flex: 1, justifyContent: "space-between" }}>
          <View
            style={[styles.iconBlock, { backgroundColor: color, flex: 1 }]}
          />
          <View
            style={[styles.iconBlock, { backgroundColor: color, flex: 1, marginLeft: 3 }]}
          />
        </View>
        <View style={{ flexDirection: "row", flex: 1, marginTop: 3, justifyContent: "space-between" }}>
          <View
            style={[styles.iconBlock, { backgroundColor: color, flex: 1 }]}
          />
          <View
            style={[styles.iconBlock, { backgroundColor: color, flex: 1, marginLeft: 3 }]}
          />
        </View>
      </View>
    );
  }
  if (type === "transactions") {
    return (
      <View style={{ width: s, height: s, justifyContent: "center" }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              height: 2.5,
              backgroundColor: color,
              borderRadius: 2,
              marginTop: i === 0 ? 0 : 4,
              width: i === 0 ? "100%" : i === 1 ? "75%" : "55%",
            }}
          />
        ))}
      </View>
    );
  }
  if (type === "insights") {
    return (
      <View
        style={{
          width: s,
          height: s,
          justifyContent: "flex-end",
          flexDirection: "row",
          alignItems: "flex-end",
        }}
      >
        {[8, 14, 10, 18].map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              backgroundColor: color,
              borderRadius: 2,
              marginLeft: i === 0 ? 0 : 3,
            }}
          />
        ))}
      </View>
    );
  }
  if (type === "budget") {
    return (
      <View style={{ width: s, height: s, justifyContent: "space-between" }}>
        <View
          style={{
            height: 7,
            borderRadius: 3,
            borderWidth: 2,
            borderColor: color,
          backgroundColor: "transparent",
        }}
      />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View
            style={{
              flex: 1,
              height: 10,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 6,
              borderRadius: 2,
              backgroundColor: color,
              marginLeft: 3,
              marginTop: 4,
            }}
          />
        </View>
      </View>
    );
  }
  // settings — gear-like circles
  return (
    <View
      style={{
        width: s,
        height: s,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: s,
          height: s,
          borderRadius: s / 2,
          borderWidth: 2,
          borderColor: color,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
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
          tabBarIcon: ({ color }) => <TabIcon color={color} type="dashboard" />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} type="transactions" />
          ),
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
        name="budget"
        options={{
          title: "Budget",
          tabBarIcon: ({ color }) => <TabIcon color={color} type="budget" />,
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

const styles = StyleSheet.create({
  iconBlock: {
    borderRadius: 3,
  },
});
