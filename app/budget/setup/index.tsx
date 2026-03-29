import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type SetupRouteParams = {
  month?: string;
  stage?: string;
};

type SetupRouteChoice = "smart" | "manual";

function resolveMonthKey(value: string | null | undefined) {
  const fallback = getCurrentMonthKey();
  const candidate = String(value || "").trim();
  if (!candidate) return fallback;
  const option = getMonthOptionByKey(candidate);
  return option?.key || fallback;
}

export default function BudgetSetupChoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SetupRouteParams>();
  const monthKey = resolveMonthKey(params.month);
  const monthLabel = getMonthOptionByKey(monthKey)?.label || "Deze maand";
  const [choice, setChoice] = React.useState<SetupRouteChoice>(
    params.stage === "refine" ? "manual" : "smart",
  );

  React.useEffect(() => {
    if (params.stage === "refine") {
      setChoice("manual");
    }
  }, [params.stage]);

  return (
    <FinanceUtilityShell
      title="Budget beheer"
      subtitle={monthLabel}
      onBack={() => router.back()}
      hero={{
        eyebrow: "Slim budget instellen",
        title: "Budio zet eerst een voorstel klaar",
        subtitle:
          "Geen leeg startscherm. Je ziet meteen een voorstel op basis van je maandcontext.",
      }}
    >
      <View style={styles.stack}>
        <FinanceSettingsGroup title="Kies je route">
          <View style={styles.groupContent}>
            <View style={styles.segmentTrack}>
              <Pressable
                onPress={() => setChoice("smart")}
                style={[styles.segmentButton, choice === "smart" && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentLabel, choice === "smart" && styles.segmentLabelActive]}>
                  Slim met Budio
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setChoice("manual")}
                style={[styles.segmentButton, choice === "manual" && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentLabel, choice === "manual" && styles.segmentLabelActive]}>
                  Handmatig
                </Text>
              </Pressable>
            </View>

            {choice === "smart" ? (
              <>
                <FinanceText variant="body-sm" tone="secondary">
                  Budio maakt eerst een voorstel met inkomsten, vaste lasten, reserves en uitgaventrend.
                </FinanceText>
                <FinanceButton
                  label="Start slim voorstel"
                  onPress={() =>
                    router.push({
                      pathname: "/budget/setup/proposal",
                      params: { month: monthKey, mode: "standaard" },
                    })
                  }
                  fullWidth
                />
              </>
            ) : (
              <>
                <FinanceText variant="body-sm" tone="secondary">
                  Je stelt alles zelf in. Budio blijft suggesties geven waar dat helpt.
                </FinanceText>
                <FinanceButton
                  label="Ga handmatig verder"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/budget/setup/proposal",
                      params: { month: monthKey, mode: "handmatig", stage: "refine" },
                    })
                  }
                  fullWidth
                />
              </>
            )}
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Wat Budio meeneemt">
          <View style={styles.groupContent}>
            <FinanceInlineCallout
              iconName="insights"
              text="Actieve maand, inkomsten, vaste lasten, abonnementen en reserves."
            />
            <FinanceInlineCallout
              iconName="shield"
              text="Je kunt na toepassen altijd finetunen per onderdeel."
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
  segmentTrack: {
    flexDirection: "row",
    gap: FinSpacing.x2,
    borderRadius: FinRadius.pill,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    padding: FinSpacing.x1,
  },
  segmentButton: {
    flex: 1,
    borderRadius: FinRadius.pill,
    paddingVertical: FinSpacing.x2,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: FinColors.bgCard,
  },
  segmentLabel: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  segmentLabelActive: {
    color: FinColors.textPrimary,
  },
});
