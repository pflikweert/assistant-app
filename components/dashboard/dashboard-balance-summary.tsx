import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBalanceParts(value: number) {
  const parts = euroFormatter.formatToParts(value);
  const sign = parts.find((part) => part.type === "minusSign")?.value || "";
  const currency = `${sign}${parts.find((part) => part.type === "currency")?.value || "€"}`;
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
  activeMonthLabel: string;
  remainingMonthlyBudget: number | null;
  monthBudgetTone?: "neutral" | "good" | "watch" | "critical";
  hasTransactions: boolean;
  scopeLabel?: string | null;
  confidenceLabel?: string | null;
  showConfidenceLabel?: boolean;
  statusLabel?: string | null;
  statusIconName?: "check-circle-outline" | "warning" | null;
  safeToSpendUntilNextIncome?: number | null;
  safeToSpendContextLabel?: string | null;
  onPressSafeToSpendExplanation?: (() => void) | null;
  onPressRemainingBudgetLabel?: (() => void) | null;
};

export function DashboardBalanceSummary({
  surfaceBalances,
  activeMonthLabel,
  remainingMonthlyBudget,
  monthBudgetTone: _monthBudgetTone = "neutral",
  hasTransactions,
  scopeLabel,
  confidenceLabel,
  showConfidenceLabel = false,
  statusLabel,
  statusIconName = null,
  safeToSpendUntilNextIncome,
  safeToSpendContextLabel,
  onPressSafeToSpendExplanation,
  onPressRemainingBudgetLabel,
}: DashboardBalanceSummaryProps) {
  const operational = surfaceBalances?.currentOperationalBalance.amount ?? null;
  const expectedEnd = surfaceBalances?.expectedEndOperationalBalance.amount ?? null;
  const netWorth = surfaceBalances?.currentNetWorth.amount ?? null;
  const netWorthAddsContext =
    netWorth != null &&
    (operational == null || Math.abs(netWorth - operational) >= 0.01);
  const primaryFormatted =
    remainingMonthlyBudget == null
      ? null
      : formatBalanceParts(remainingMonthlyBudget);
  const supportValues = [
    {
      label: "Saldo nu",
      value: operational,
    },
    {
      label: safeToSpendContextLabel || "Extra ruimte tot volgende inkomsten",
      value: safeToSpendUntilNextIncome ?? null,
      interactive: Boolean(onPressSafeToSpendExplanation),
    },
    ...(netWorthAddsContext
      ? [
          {
            label: "Totaal vermogen",
            value: netWorth,
          },
        ]
      : []),
  ];

  const resolvedStatusLabel =
    statusLabel ||
    (expectedEnd == null
      ? `Forecast volgt voor ${activeMonthLabel}`
      : expectedEnd < 0 ||
          _monthBudgetTone === "critical" ||
          (remainingMonthlyBudget != null && remainingMonthlyBudget < 0)
        ? `Let op voor ${activeMonthLabel}`
        : `Je zit op schema voor ${activeMonthLabel}`);
  const resolvedStatusIconName =
    statusIconName ||
    (resolvedStatusLabel.toLowerCase().includes("let op")
      ? "warning"
      : "check-circle-outline");

  return (
    <View style={styles.card}>
      <View style={styles.centerStack}>
        {scopeLabel ? (
          <View style={styles.scopePill}>
            <Text style={styles.scopePillText}>{scopeLabel}</Text>
          </View>
        ) : null}
        {onPressRemainingBudgetLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onPressRemainingBudgetLabel}
            style={({ pressed }) => [
              styles.kickerPressable,
              pressed ? styles.kickerPressed : null,
            ]}
          >
            <Text style={styles.kicker}>{`Resterend budget ${activeMonthLabel}`}</Text>
          </Pressable>
        ) : (
          <Text style={styles.kicker}>{`Resterend budget ${activeMonthLabel}`}</Text>
        )}

        {primaryFormatted ? (
          <Text style={[styles.amount, !hasTransactions && styles.amountMuted]}>
            <Text style={styles.currency}>{primaryFormatted.currency}</Text>
            <Text style={styles.integer}>{primaryFormatted.integer}</Text>
            <Text style={styles.decimal}>{primaryFormatted.decimal}</Text>
            <Text style={styles.fraction}>{primaryFormatted.fraction}</Text>
          </Text>
        ) : (
          <View style={styles.amountFallbackWrap}>
            <Text style={[styles.amount, styles.amountMuted]}>Nog niet bekend</Text>
            <Text style={styles.amountHint}>
              We tonen dit zodra je maandbudget voor {activeMonthLabel} beschikbaar is.
            </Text>
          </View>
        )}

        <View style={styles.forecastPill}>
          <Text style={styles.forecastPillLabel}>Verwacht eindsaldo:</Text>
          <Text style={styles.forecastPillValue}>
            {expectedEnd == null ? "n.b." : formatCompactBalance(expectedEnd)}
          </Text>
        </View>
        {showConfidenceLabel && confidenceLabel ? (
          <Text style={styles.confidenceLabel}>
            {confidenceLabel}
          </Text>
        ) : null}

        <View style={styles.supportGrid}>
          {supportValues.map((item, index) => {
            const itemStyles = [
              styles.supportItem,
              index < supportValues.length - 1 && styles.supportItemDivider,
            ];

            if (item.interactive) {
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={onPressSafeToSpendExplanation || undefined}
                  style={({ pressed }) => [
                    itemStyles,
                    pressed ? styles.supportItemPressed : null,
                  ]}
                >
                  <View style={styles.supportLabelWrap}>
                    <View style={styles.supportLabelRow}>
                      <Text style={styles.supportLabel}>{item.label}</Text>
                      <AppIcon
                        name="info-outline"
                        size={12}
                        color={FinColors.textMuted}
                        variant="outlined"
                      />
                    </View>
                  </View>
                  <Text style={styles.supportValue}>
                    {item.value == null ? "n.b." : formatCompactBalance(item.value)}
                  </Text>
                </Pressable>
              );
            }

            return (
              <View
                key={item.label}
                style={itemStyles}
              >
                <View style={styles.supportLabelWrap}>
                  <Text style={styles.supportLabel}>{item.label}</Text>
                </View>
                <Text style={styles.supportValue}>
                  {item.value == null ? "n.b." : formatCompactBalance(item.value)}
                </Text>
              </View>
            );
          })}
        </View>

        <FinanceInlineCallout
          text={resolvedStatusLabel}
          iconName={resolvedStatusIconName}
          tone="highlight"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
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
  kickerPressable: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kickerPressed: {
    opacity: 0.72,
    backgroundColor: "rgba(17,17,17,0.04)",
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
  confidenceLabel: {
    marginTop: -4,
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textSecondary,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 320,
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
    alignItems: "stretch",
  },
  supportItem: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    gap: 4,
  },
  supportItemDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(17,17,17,0.09)",
  },
  supportItemPressed: {
    opacity: 0.8,
  },
  supportLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: FinColors.textSecondary,
    textTransform: "uppercase",
    textAlign: "center",
  },
  supportLabelWrap: {
    minHeight: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  supportLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  supportValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
    textAlign: "center",
  },
});
