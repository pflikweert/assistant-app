import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinColors } from "@/constants/theme";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
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

function formatCompactBalance(value: number) {
  const parts = formatBalanceParts(value);
  return `${parts.currency}${parts.integer}${parts.decimal}${parts.fraction}`;
}

type DashboardBalanceSummaryProps = {
  surfaceBalances: FinancialSurfaceBalanceSnapshot | null;
  monthLabel: string;
  hasTransactions: boolean;
  scopeLabel?: string | null;
};

function resolveFreeToSpendStatusText(
  surfaceBalances: FinancialSurfaceBalanceSnapshot | null,
) {
  const operational = surfaceBalances?.currentOperationalBalance.amount ?? null;
  const reserved = surfaceBalances?.currentReservedBalance ?? null;

  if (operational == null) {
    return "Vrij besteedbaar volgt zodra de actuele stand bekend is.";
  }

  if (reserved?.source === "unavailable" || reserved?.source === "not_configured") {
    return "Vrij besteedbaar volgt zodra gereserveerd geld bekend is.";
  }

  return "Vrij besteedbaar volgt zodra de operationele ruimte volledig kan worden bepaald.";
}

export function DashboardBalanceSummary({
  surfaceBalances,
  monthLabel,
  hasTransactions,
  scopeLabel,
}: DashboardBalanceSummaryProps) {
  const operational = surfaceBalances?.currentOperationalBalance.amount ?? null;
  const reserved = surfaceBalances?.currentReservedBalance;
  const freeToSpendNow = surfaceBalances?.freeToSpendNow.amount ?? null;
  const expectedEnd = surfaceBalances?.expectedEndOperationalBalance.amount ?? null;
  const netWorth = surfaceBalances?.currentNetWorth.amount ?? null;
  const primaryFormatted =
    freeToSpendNow == null ? null : formatBalanceParts(freeToSpendNow);
  // This is operational room only. Month and week budget are shown elsewhere,
  // so the empty state should explain why this operational layer cannot yet be
  // determined instead of borrowing budget language.
  const freeToSpendStatusText =
    freeToSpendNow == null ? resolveFreeToSpendStatusText(surfaceBalances) : null;
  const supportValues = [
    {
      label: "Huidig saldo",
      value: operational,
    },
    {
      label: "Gereserveerd",
      value: reserved?.amount ?? null,
    },
    {
      label: "Totaal vermogen",
      value: netWorth,
    },
  ];

  const statusLabel =
    expectedEnd == null
      ? `Forecast volgt voor ${monthLabel}`
      : expectedEnd < 0
        ? `Let op voor ${monthLabel}`
        : `Je zit op schema voor ${monthLabel}`;

  return (
    <View style={styles.card}>
      <View style={styles.centerStack}>
        {scopeLabel ? (
          <View style={styles.scopePill}>
            <Text style={styles.scopePillText}>{scopeLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.kicker}>Vrij besteedbaar</Text>

        {primaryFormatted ? (
          <Text style={[styles.amount, !hasTransactions && styles.amountMuted]}>
            <Text style={styles.currency}>{primaryFormatted.currency}</Text>
            <Text style={styles.integer}>{primaryFormatted.integer}</Text>
            <Text style={styles.decimal}>{primaryFormatted.decimal}</Text>
            <Text style={styles.fraction}>{primaryFormatted.fraction}</Text>
          </Text>
        ) : (
          <View style={styles.amountFallbackWrap}>
            <Text style={[styles.amount, styles.amountMuted]}>
              Nog niet vast te stellen
            </Text>
            {freeToSpendStatusText ? (
              <Text style={styles.amountHint}>{freeToSpendStatusText}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.forecastPill}>
          <Text style={styles.forecastPillLabel}>Verwacht eindsaldo:</Text>
          <Text style={styles.forecastPillValue}>
            {expectedEnd == null ? "n.b." : formatCompactBalance(expectedEnd)}
          </Text>
        </View>

        <View style={styles.supportGrid}>
          {supportValues.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.supportItem,
                index < supportValues.length - 1 && styles.supportItemDivider,
              ]}
            >
              <Text style={styles.supportLabel}>{item.label}</Text>
              <Text style={styles.supportValue}>
                {item.value == null ? "n.b." : formatCompactBalance(item.value)}
              </Text>
            </View>
          ))}
        </View>

        <FinanceInlineCallout
          text={statusLabel}
          iconName={
            expectedEnd != null && expectedEnd < 0
              ? "warning"
              : "check-circle-outline"
          }
          tone="highlight"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  centerStack: {
    alignItems: "center",
    gap: 16,
  },
  scopePill: {
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scopePillText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: FinColors.textSecondary,
  },
  kicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: FinColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2.1,
  },
  forecastPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.08)",
    paddingHorizontal: 20,
    paddingVertical: 11,
    boxShadow: "0px 4px 10px rgba(17,17,17,0.03)",
    elevation: 0,
  },
  forecastPillLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  forecastPillValue: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  amount: {
    textAlign: "center",
    fontSize: 66,
    lineHeight: 70,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -2.4,
  },
  amountMuted: {
    fontSize: 20,
    lineHeight: 28,
    color: FinColors.textMuted,
    letterSpacing: 0,
  },
  amountFallbackWrap: {
    alignItems: "center",
    gap: 6,
  },
  amountHint: {
    maxWidth: 280,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
  },
  currency: {
    fontSize: 66,
    lineHeight: 70,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -2.4,
  },
  integer: {
    fontSize: 66,
    lineHeight: 70,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -2.4,
  },
  decimal: {
    fontSize: 66,
    lineHeight: 70,
    fontWeight: "900",
    color: FinColors.textSecondary,
    letterSpacing: -2.4,
  },
  fraction: {
    fontSize: 66,
    lineHeight: 70,
    fontWeight: "900",
    color: FinColors.textSecondary,
    letterSpacing: -2.4,
  },
  supportGrid: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 8,
  },
  supportItem: {
    flexGrow: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
  },
  supportItemDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(17,17,17,0.09)",
  },
  supportLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: FinColors.textSecondary,
    textTransform: "uppercase",
  },
  supportValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.8,
  },
});
