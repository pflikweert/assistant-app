import { FinColors } from "@/constants/theme";
import { resolveForecastAccountRules } from "@/services/forecast-account-rules";
import type { BankAccount } from "@/services/bank-accounts";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type ForecastAccountMetaInput = Partial<
  Pick<
    BankAccount,
    | "forecast_role"
    | "include_in_budget"
    | "include_in_cashflow"
    | "include_in_net_worth"
    | "is_active"
    | "owner_scope"
    | "provider"
    | "name"
  >
> & {
  account_type: BankAccount["account_type"];
};

type ForecastAccountMetaItem = {
  label: string;
  value: string;
  tone: "good" | "watch" | "muted";
};

type ForecastAccountMetaProps = {
  account: ForecastAccountMetaInput;
  variant?: "chips" | "rows";
};

function getRoleLabel(role: ReturnType<typeof resolveForecastAccountRules>["forecast_role"]) {
  switch (role) {
    case "reserve":
      return "Reserve";
    case "goal":
      return "Doel";
    case "shared":
      return "Gedeeld";
    case "observation_only":
      return "Alleen bekijken";
    case "excluded":
      return "Uitgesloten";
    case "operational":
    default:
      return "Operationeel";
  }
}

function getScopeLabel(scope: ReturnType<typeof resolveForecastAccountRules>["owner_scope"]) {
  switch (scope) {
    case "shared":
      return "Gedeeld";
    case "child":
      return "Kind";
    case "external":
      return "Extern";
    case "personal":
    default:
      return "Persoonlijk";
  }
}

function getInclusionLabel(included: boolean) {
  return included ? "Telt mee" : "Niet mee";
}

function getToneForRole(role: ForecastAccountMetaItem["tone"] | string): ForecastAccountMetaItem["tone"] {
  if (role === "good" || role === "watch" || role === "muted") return role;
  return "muted";
}

export function buildForecastAccountMetaItems(
  account: ForecastAccountMetaInput,
): ForecastAccountMetaItem[] {
  // Tijdelijke afleiding uit bestaande rekeningdata; Fase B kan hier household- en scope-invoer aan toevoegen.
  const rules = resolveForecastAccountRules(account);
  return [
    {
      label: "Rol",
      value: getRoleLabel(rules.forecast_role),
      tone:
        rules.forecast_role === "operational" || rules.forecast_role === "shared"
          ? "good"
          : rules.forecast_role === "observation_only" || rules.forecast_role === "excluded"
            ? "muted"
            : "watch",
    },
    {
      label: "Geldcontext",
      value: getScopeLabel(rules.owner_scope),
      tone: rules.owner_scope === "personal" ? "muted" : "watch",
    },
    {
      label: "Budget",
      value: getInclusionLabel(rules.include_in_budget),
      tone: getToneForRole(rules.include_in_budget ? "good" : "muted"),
    },
    {
      label: "Cashflow",
      value: getInclusionLabel(rules.include_in_cashflow),
      tone: getToneForRole(rules.include_in_cashflow ? "good" : "muted"),
    },
    {
      label: "Vermogen",
      value: getInclusionLabel(rules.include_in_net_worth),
      tone: getToneForRole(rules.include_in_net_worth ? "good" : "muted"),
    },
  ];
}

export function ForecastAccountMeta({
  account,
  variant = "rows",
}: ForecastAccountMetaProps) {
  const items = buildForecastAccountMetaItems(account);

  if (variant === "chips") {
    return (
      <View style={styles.chipWrap}>
        {items.map((item) => (
          <View
            key={item.label}
            style={[
              styles.chip,
              item.tone === "good"
                ? styles.chipGood
                : item.tone === "watch"
                  ? styles.chipWatch
                  : styles.chipMuted,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                item.tone === "good"
                  ? styles.chipTextGood
                  : item.tone === "watch"
                    ? styles.chipTextWatch
                    : styles.chipTextMuted,
              ]}
            >
              {item.label}: {item.value}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.rowCard}>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <View
            style={[
              styles.rowValue,
              item.tone === "good"
                ? styles.rowValueGood
                : item.tone === "watch"
                  ? styles.rowValueWatch
                  : styles.rowValueMuted,
            ]}
          >
            <Text
              style={[
                styles.rowValueText,
                item.tone === "good"
                  ? styles.rowValueTextGood
                  : item.tone === "watch"
                    ? styles.rowValueTextWatch
                    : styles.rowValueTextMuted,
              ]}
            >
              {item.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  chipGood: {
    backgroundColor: "#e7f3a8",
  },
  chipWatch: {
    backgroundColor: FinColors.warningBg,
  },
  chipMuted: {
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  chipText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chipTextGood: {
    color: "#5b6a1b",
  },
  chipTextWatch: {
    color: FinColors.warningText,
  },
  chipTextMuted: {
    color: FinColors.textSecondary,
  },
  rowCard: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 32,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  rowValue: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rowValueGood: {
    backgroundColor: "#e7f3a8",
  },
  rowValueWatch: {
    backgroundColor: FinColors.warningBg,
  },
  rowValueMuted: {
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  rowValueText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  rowValueTextGood: {
    color: "#5b6a1b",
  },
  rowValueTextWatch: {
    color: FinColors.warningText,
  },
  rowValueTextMuted: {
    color: FinColors.textSecondary,
  },
});
