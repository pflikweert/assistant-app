import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { BudgetSetupStrategySelector } from "@/components/budget/budget-setup-strategy-selector";
import {
  BUDGET_SETUP_DEFAULT_SMART_STRATEGY,
  BUDGET_SETUP_SMART_STRATEGIES,
} from "@/services/budget-setup-strategy-copy";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinSpacing } from "@/constants/theme";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

type SetupRouteParams = {
  month?: string;
  mode?: string;
};

const BUDGET_SETUP_STEPS = [
  { key: "choice", label: "Keuze" },
  { key: "proposal", label: "Voorstel" },
  { key: "review", label: "Toepassen" },
] as const;

function resolveMonthKey(value: string | null | undefined) {
  const fallback = getCurrentMonthKey();
  const candidate = String(value || "").trim();
  if (!candidate) return fallback;
  const option = getMonthOptionByKey(candidate);
  return option?.key || fallback;
}

function resolveSmartMode(value: string | null | undefined) {
  const candidate = String(value || "").trim().toLowerCase();
  if (candidate === "standaard") return "standaard";
  if (candidate === "balans") return "balans";
  if (candidate === "bespaarmodus") return "bespaarmodus";
  return BUDGET_SETUP_DEFAULT_SMART_STRATEGY;
}

export default function BudgetSetupChoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SetupRouteParams>();
  const monthKey = resolveMonthKey(params.month);
  const monthLabel = getMonthOptionByKey(monthKey)?.label || "Deze maand";
  const [selectedStrategy, setSelectedStrategy] = React.useState(() =>
    resolveSmartMode(params.mode),
  );

  return (
    <FinanceUtilityShell
      title="Budget beheer"
      subtitle={monthLabel}
      onBack={() => router.back()}
      hero={{
        eyebrow: "Slim budget instellen",
        title: "Kies hoe Budio je maand opbouwt",
        subtitle: "Balans staat standaard aan. De keuze stuurt de volgende berekening.",
      }}
    >
      <View style={styles.stack}>
        <FinanceStepIndicator
          steps={[...BUDGET_SETUP_STEPS]}
          currentStepKey="choice"
          style={styles.stepIndicator}
        />
        <BudgetSetupStrategySelector
          selectedStrategy={selectedStrategy}
          visibleStrategies={BUDGET_SETUP_SMART_STRATEGIES}
          onChange={setSelectedStrategy}
        />

        <FinanceSettingsGroup title="Wat Budio meeneemt">
          <View style={styles.groupContent}>
            <FinanceInlineCallout
              iconName="insights"
              text="We kijken naar je maand, bekende inkomsten, vaste lasten, reserves en uitgaventrend."
            />
            <FinanceInlineCallout
              iconName="shield"
              text="Deze keuze bepaalt hoe Budio de volgende berekening opbouwt."
            />
            <FinanceText variant="body-sm" tone="secondary">
              Je kunt de aanpak in de volgende stap altijd nog bijsturen.
            </FinanceText>
            <FinanceButton
              label="Ga naar voorstel"
              onPress={() =>
                router.push({
                  pathname: "/budget/setup/proposal",
                  params: { month: monthKey, mode: selectedStrategy },
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
  stepIndicator: {
    paddingHorizontal: FinSpacing.s,
  },
  groupContent: {
    padding: FinSpacing.m,
    gap: FinSpacing.s,
  },
});
