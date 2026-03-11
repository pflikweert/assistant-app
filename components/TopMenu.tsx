import { useThemeColor } from "@/hooks/use-theme-color";
import { useRouter } from "expo-router";
import React from "react";
import { Button, StyleSheet, View } from "react-native";

export default function TopMenu() {
  const router = useRouter();

  const background = useThemeColor({}, "background");
  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Button title="Import CSV" onPress={() => router.push("/csv-import")} />
      <Button title="View all" onPress={() => router.push("/transactions")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 10,
  },
});
