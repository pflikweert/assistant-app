import { Button, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import TopMenu from "@/components/TopMenu";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import React from "react";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type DashboardTx = {
  id: string;
  description: string;
  counterparty: string;
  omschrijving1: string;
  date: string;
  amount: number;
  seq: number;
  runningBalance: number | null;
};

export default function DashboardScreen() {
  const [transactions, setTransactions] = React.useState<DashboardTx[]>([]);
  const router = useRouter();
  const [balance, setBalance] = React.useState(0);
  const [safeToSpend, setSafeToSpend] = React.useState(0);

  const borderColor = useThemeColor({ light: "#ccc", dark: "#555" }, "text");
  const iconColor = useThemeColor({}, "icon");

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
        .select("id,details,counterparty,date,amount,metadata")
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .limit(10);
      if (error) {
        console.warn("failed to load transactions", error);
      } else {
        console.log("dashboard fetched", data?.length, "rows", data);
        const rows = (data || []).map((raw: any) => {
          const md = raw.metadata || {};
          const details = String(raw.details || "");
          const rawSeq = String(md["Volgnr"] || "").replace(/^0+/, "");
          const omschrijving1 = details.split("|")[0]?.trim() || details;
          return {
            id: raw.id,
            description: details,
            counterparty: String(raw.counterparty || "").trim(),
            omschrijving1,
            date: raw.date,
            amount: raw.amount,
            seq: parseInt(rawSeq || "0", 10) || 0,
            runningBalance: parseSaldo(md["Saldo na trn"]),
          };
        });

        rows.sort((a, b) => {
          if (a.date === b.date) return b.seq - a.seq;
          return a.date < b.date ? 1 : -1;
        });

        const latestWithBalance = rows.find((tx) => tx.runningBalance != null);
        const latestBalance = latestWithBalance?.runningBalance ?? 0;

        setTransactions(rows);
        setBalance(latestBalance);
        setSafeToSpend((latestBalance / (rows.length || 1)) * 0.1);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const sections = React.useMemo(() => {
    const map: Record<string, DashboardTx[]> = {};
    transactions.forEach((tx) => {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    });
    return Object.entries(map).map(([date, data]) => ({ title: date, data }));
  }, [transactions]);

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
            {euroFormatter.format(balance)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Safe to spend today</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.amount}>
            {euroFormatter.format(safeToSpend)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Recent transactions</ThemedText>
          {sections.map((section) => (
            <View key={section.title}>
              <ThemedText type="subtitle" style={styles.sectionHeader}>{section.title}</ThemedText>
              {section.data.map((tx) => (
                <ThemedView
                  key={tx.id}
                  style={[styles.transactionRow, { borderBottomColor: borderColor }]}
                >
                  <IconSymbol name="chevron.right" size={20} color={iconColor} style={styles.icon} />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.desc}>{tx.counterparty || "Onbekende tegenpartij"}</ThemedText>
                    <ThemedText style={styles.subDesc}>{tx.omschrijving1 || tx.description}</ThemedText>
                  </View>
                  <View style={styles.moneyColumns}>
                    <View style={styles.moneyColumn}>
                      <ThemedText style={styles.columnLabel}>Bedrag</ThemedText>
                      <ThemedText
                        style={[
                          styles.transactionAmount,
                          { color: tx.amount < 0 ? "#d9534f" : "#5cb85c" },
                        ]}
                      >
                        {`${tx.amount < 0 ? "-" : "+"}${euroFormatter.format(Math.abs(tx.amount))}`}
                      </ThemedText>
                    </View>
                    <View style={styles.moneyColumn}>
                      <ThemedText style={styles.columnLabel}>Saldo</ThemedText>
                      <ThemedText style={styles.runningBalance}>
                        {tx.runningBalance == null ? "onbekend" : euroFormatter.format(tx.runningBalance)}
                      </ThemedText>
                    </View>
                  </View>
                </ThemedView>
              ))}
            </View>
          ))}
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
  sectionHeader: {
    marginTop: 12,
    fontWeight: "600",
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 8,
  },
  icon: {
    marginRight: 10,
    marginTop: 4,
  },
  desc: {
    flex: 1,
    fontSize: 15,
  },
  subDesc: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.8,
  },
  moneyColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  moneyColumn: {
    minWidth: 98,
    alignItems: "flex-end",
  },
  columnLabel: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 2,
  },
  transactionAmount: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
  },
  runningBalance: {
    fontSize: 17,
    color: "#888",
    fontWeight: "600",
    textAlign: "right",
  },
});
