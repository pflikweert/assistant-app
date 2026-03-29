import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function resolveMonthKey(value: string | null | undefined) {
  const fallback = getCurrentMonthKey();
  const candidate = String(value || "").trim();
  if (!candidate) return fallback;
  const option = getMonthOptionByKey(candidate);
  return option?.key || fallback;
}

export default function BudgetSetupReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    month?: string;
    mode?: string;
    variableTotal?: string;
    categoryCount?: string;
    savingsTarget?: string;
  }>();
  const monthKey = resolveMonthKey(params.month);
  const monthLabel = getMonthOptionByKey(monthKey)?.label || "Deze maand";
  const variableTotal = Number(params.variableTotal || 0) || 0;
  const categoryCount = Number(params.categoryCount || 0) || 0;
  const savingsTarget = Number(params.savingsTarget || 0) || 0;
  const mode = String(params.mode || "standaard");

  return (
    <FinanceUtilityShell
      title="Budget toegepast"
      subtitle={monthLabel}
      onBack={() => router.back()}
      hero={{
        eyebrow: "Stap 3 van 3",
        title: "Review",
        subtitle: "Je voorstel is toegepast. Hier zie je wat is ingesteld en wat je nog kunt finetunen.",
      }}
    >
      <View style={styles.stack}>
        <FinanceSettingsGroup title="Succes">
          <View style={styles.groupContent}>
            <FinanceInlineCallout
              iconName="check-circle"
              tone="highlight"
              text="Voorstel toegepast op je bestaande budgetplan."
            />
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Wat is ingesteld">
          <View style={styles.groupContent}>
            <View style={styles.summaryList}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Modus</Text>
                <Text style={styles.summaryValue}>{mode}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Variabel budget totaal</Text>
                <Text style={styles.summaryValue}>{fmt.format(variableTotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Categorieën ingesteld</Text>
                <Text style={styles.summaryValue}>{String(categoryCount)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reserve per maand</Text>
                <Text style={styles.summaryValue}>{fmt.format(savingsTarget)}</Text>
              </View>
            </View>
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Nog finetunen">
          <View style={styles.groupContent}>
            <View style={styles.actions}>
              <FinanceButton
                label="Inkomsten bijsturen"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup/proposal",
                    params: { month: monthKey, mode, stage: "refine", focus: "income" },
                  })
                }
                fullWidth
              />
              <FinanceButton
                label="Vaste lasten / reserves"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup/proposal",
                    params: { month: monthKey, mode, stage: "refine", focus: "fixed" },
                  })
                }
                fullWidth
              />
              <FinanceButton
                label="Budgetverdeling"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup/proposal",
                    params: { month: monthKey, mode, stage: "refine", focus: "distribution" },
                  })
                }
                fullWidth
              />
            </View>
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Klaar">
          <View style={styles.groupContent}>
            <FinanceButton
              label="Terug naar Budget"
              onPress={() =>
                router.push({
                  pathname: "/budget",
                  params: { segment: "manage_new", month: monthKey },
                })
              }
              fullWidth
            />
          </View>
        </FinanceSettingsGroup>
      </View>
    </FinanceUtilityShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: FinSpacing.m,
  },
  groupContent: {
    padding: FinSpacing.m,
    gap: FinSpacing.s,
  },
  summaryList: {
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgInput,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.xs,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  summaryLabel: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    flex: 1,
  },
  summaryValue: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  actions: {
    gap: FinSpacing.xs,
  },
});

