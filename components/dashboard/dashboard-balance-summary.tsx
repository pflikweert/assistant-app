import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBalanceParts(value: number) {
  const parts = euroFormatter.formatToParts(value);
  const currency = parts.find((part) => part.type === "currency")?.value || "€";
  const integer = parts
    .filter((part) => part.type === "integer" || part.type === "group")
    .map((part) => part.value)
    .join("");
  const decimal = parts.find((part) => part.type === "decimal")?.value || ",";
  const fraction = parts.find((part) => part.type === "fraction")?.value || "00";

  return {
    currency,
    integer,
    decimal,
    fraction,
  };
}

type DashboardBalanceSummaryProps = {
  balance: number | null;
  hasTransactions: boolean;
};

export function DashboardBalanceSummary({
  balance,
  hasTransactions,
}: DashboardBalanceSummaryProps) {
  const formatted = balance == null ? null : formatBalanceParts(balance);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Huidig saldo</Text>
      <Text style={[styles.amount, !hasTransactions && styles.amountMuted]}>
        {formatted ? (
          <>
            <Text style={styles.currency}>{formatted.currency}</Text>
            <Text style={styles.integer}>{formatted.integer}</Text>
            <Text style={styles.decimal}>{formatted.decimal}</Text>
            <Text style={styles.fraction}>{formatted.fraction}</Text>
          </>
        ) : (
          "Nog geen data"
        )}
      </Text>
      <View style={styles.statusPill}>
        <AppIcon
          name="trending-up"
          size={16}
          color={FinColors.green}
          variant="outlined"
        />
        <Text style={styles.statusText}>
          {hasTransactions ? "Actueel" : "Nog geen transacties"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  amount: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.8,
  },
  amountMuted: {
    fontSize: 20,
    lineHeight: 28,
    color: FinColors.textMuted,
    letterSpacing: 0,
  },
  currency: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.8,
  },
  integer: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.8,
  },
  decimal: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    color: FinColors.textMuted,
    letterSpacing: -1.8,
  },
  fraction: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: "900",
    color: FinColors.textMuted,
    letterSpacing: -1.8,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: FinColors.yellowSoft,
  },
  statusText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.warningText,
  },
});
