import { FinColors } from "@/constants/theme";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function TopMenu() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.btn} onPress={() => router.push("/csv-import")}>
        <Text style={styles.btnText}>Import CSV</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => router.push("/transactions")}>
        <Text style={[styles.btnText, { color: "#0f172a" }]}>View all</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: FinColors.bgBase,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  btnPrimary: {
    backgroundColor: FinColors.green,
    borderColor: FinColors.green,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
});
