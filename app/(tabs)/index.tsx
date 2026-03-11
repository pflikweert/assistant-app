import { Button, ScrollView, StyleSheet, View } from "react-native";

import TopMenu from "@/components/TopMenu";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import React from "react";

// transactions loaded from Supabase (last 5 by date descending)

export default function DashboardScreen() {
  const [transactions, setTransactions] = React.useState<
    Array<{ id: string; description: string; date: string; amount: number }>
  >([]);
  const router = useRouter();
  const [balance, setBalance] = React.useState(0);
  const [safeToSpend, setSafeToSpend] = React.useState(0);

  const borderColor = useThemeColor({ light: "#ccc", dark: "#555" }, "text");

  const parseSaldo = (s: any) => {
    if (s == null) return null;
    const str = String(s).replace(/\./g, "").replace(",", ".").trim();
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const load = React.useCallback(async () => {
    console.log("loading dashboard transactions");
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,details,date,amount,metadata")
        .order("date", { ascending: false })
        .limit(10);
      if (error) {
        console.warn("failed to load transactions", error);
      } else {
        console.log("dashboard fetched", data?.length, "rows", data);
        let bal = 0;
        // map and respect volgnummer for ordering
        const enriched = (data || []).map((r: any) => {
          const md = r.metadata || {};
          const seq = parseInt(String(md["Volgnr"] || ""), 10) || 0;
          return { raw: r, seq };
        });
        enriched.sort((a, b) => a.seq - b.seq);
        const rows = enriched.map(({ raw }) => {
          const md = raw.metadata || {};
          const saldo = parseSaldo(md["Saldo na trn"]);
          if (saldo != null) bal = saldo;
          else bal += raw.amount || 0;
          return {
            id: raw.id,
            description: raw.details,
            date: raw.date,
            amount: raw.amount,
            runningBalance: bal,
          };
        });
        setTransactions(rows as any);
        setBalance(bal);
        setSafeToSpend((bal / (rows.length || 1)) * 0.1);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const { useFocusEffect } = require("@react-navigation/native");
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1 }}>
      <TopMenu />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Balance</ThemedText>
          <ThemedText type="title" style={styles.amount}>
            ${balance.toFixed(2)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Safe to spend today</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.amount}>
            ${safeToSpend.toFixed(2)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Recent transactions</ThemedText>
          <ThemedText>Count: {transactions.length}</ThemedText>
          {transactions.map((tx) => {
            return (
              <ThemedView
                key={tx.id}
                style={[styles.transaction, { borderBottomColor: borderColor }]}
              >
                <ThemedText>{tx.description}</ThemedText>
                <ThemedText>{tx.date}</ThemedText>
                <ThemedText
                  style={[
                    styles.transactionAmount,
                    { color: tx.amount < 0 ? "#d9534f" : "#5cb85c" },
                  ]}
                >
                  {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                </ThemedText>
              </ThemedView>
            );
          })}
          <Button
            title="Show all transactions"
            onPress={() => router.push("/transactions")}
          />
        </ThemedView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  amount: {
    marginTop: 4,
  },
  transaction: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionAmount: {
    fontWeight: "600",
  },
});
