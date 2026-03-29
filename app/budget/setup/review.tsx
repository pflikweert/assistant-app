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

function modeLabel(mode: string) {
  const value = String(mode || "").toLowerCase();
  if (value === "balans") return "Balans";
  if (value === "bespaarmodus") return "Bespaarmodus";
  if (value === "handmatig") return "Handmatig";
  return "Standaard";
}

function monthFeelLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "krap") return "Krappe maand";
  if (normalized === "ruim") return "Ruime maand";
  return "Haalbare maand";
}

function strictnessLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "licht") return "Lichte sturing";
  if (normalized === "streng") return "Strakke sturing";
  return "Normale sturing";
}

function reserveProtectionLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "hoog") return "Hoog beschermd";
  if (normalized === "laag") return "Laag beschermd";
  return "Gemiddeld beschermd";
}

export default function BudgetSetupReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    month?: string;
    mode?: string;
    variableTotal?: string;
    categoryCount?: string;
    savingsTarget?: string;
    adjustedCount?: string;
    monthFeel?: string;
    strictness?: string;
    primaryReason?: string;
    reserveProtectionLevel?: string;
    biggestAttentionPoint?: string;
    nextBestStepTitle?: string;
    nextBestStepWhy?: string;
  }>();

  const monthKey = resolveMonthKey(params.month);
  const monthLabel = getMonthOptionByKey(monthKey)?.label || "Deze maand";
  const variableTotal = Number(params.variableTotal || 0) || 0;
  const categoryCount = Number(params.categoryCount || 0) || 0;
  const savingsTarget = Number(params.savingsTarget || 0) || 0;
  const adjustedCount = Number(params.adjustedCount || 0) || 0;
  const mode = modeLabel(String(params.mode || "standaard"));
  const monthFeel = monthFeelLabel(String(params.monthFeel || "haalbaar"));
  const strictness = strictnessLabel(String(params.strictness || "normaal"));
  const primaryReason =
    String(params.primaryReason || "").trim() ||
    "Budio heeft eerst vaste lasten en reserve beschermd.";
  const reserveProtection = reserveProtectionLabel(
    String(params.reserveProtectionLevel || "middel"),
  );
  const biggestAttentionPoint =
    String(params.biggestAttentionPoint || "").trim() ||
    "Blijf je variabele tempo in de gaten houden.";
  const nextBestStepTitle =
    String(params.nextBestStepTitle || "").trim() || "Houd deze lijn rustig vast";
  const nextBestStepWhy =
    String(params.nextBestStepWhy || "").trim() ||
    "Zo blijft je maand voorspelbaar en veilig.";

  return (
    <FinanceUtilityShell
      title="Budget toegepast"
      subtitle={monthLabel}
      onBack={() => router.back()}
      hero={{
        eyebrow: "Klaar",
        title: "Je voorstel staat actief",
        subtitle: "Hier zie je wat is ingesteld en waar je nog kunt finetunen.",
      }}
    >
      <View style={styles.stack}>
        <FinanceSettingsGroup title="Status">
          <View style={styles.groupContent}>
            <FinanceInlineCallout
              iconName="check-circle"
              tone="highlight"
              text="Budio heeft je voorstel verwerkt in je budgetplan."
            />
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Wat dit plan betekent voor je maand">
          <View style={styles.groupContent}>
            <View style={styles.summaryList}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Maandgevoel</Text>
                <Text style={styles.summaryValue}>{monthFeel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sturingsniveau</Text>
                <Text style={styles.summaryValue}>{strictness}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reservebescherming</Text>
                <Text style={styles.summaryValue}>{reserveProtection}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Belangrijkste aandachtspunt</Text>
                <Text style={styles.summaryValue}>{biggestAttentionPoint}</Text>
              </View>
            </View>
            <FinanceInlineCallout iconName="insights" text={primaryReason} />
            <View style={styles.nextStepCard}>
              <Text style={styles.nextStepTitle}>{nextBestStepTitle}</Text>
              <Text style={styles.nextStepWhy}>{nextBestStepWhy}</Text>
            </View>
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Ingesteld door Budio">
          <View style={styles.groupContent}>
            <View style={styles.summaryList}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Strategie</Text>
                <Text style={styles.summaryValue}>{mode}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Variabele ruimte</Text>
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

        <FinanceSettingsGroup title="Door jou aangepast">
          <View style={styles.groupContent}>
            <FinanceInlineCallout
              iconName={adjustedCount > 0 ? "tune" : "info-outline"}
              text={
                adjustedCount > 0
                  ? `Je hebt ${adjustedCount} aanpassing${adjustedCount === 1 ? "" : "en"} gedaan voordat je toepaste.`
                  : "Je hebt het voorstel zonder extra aanpassingen toegepast."
              }
            />
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Waar finetunen nog zinvol is">
          <View style={styles.groupContent}>
            <View style={styles.actions}>
              <FinanceButton
                label="Inkomsten"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup/proposal",
                    params: { month: monthKey, mode: String(params.mode || "standaard"), focus: "income" },
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
                    params: { month: monthKey, mode: String(params.mode || "standaard"), focus: "fixed" },
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
                    params: { month: monthKey, mode: String(params.mode || "standaard"), focus: "distribution" },
                  })
                }
                fullWidth
              />
            </View>
            <Text style={styles.disclaimer}>
              Voorspellingen blijven verwachtingen op basis van bekende data.
            </Text>
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Klaar">
          <View style={styles.groupContent}>
            <FinanceButton
              label="Terug naar Budget"
              onPress={() =>
                router.push({
                  pathname: "/budget",
                  params: { segment: "manage", month: monthKey },
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
  nextStepCard: {
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    padding: FinSpacing.s,
    gap: FinSpacing.x2,
  },
  nextStepTitle: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  nextStepWhy: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
  },
  actions: {
    gap: FinSpacing.xs,
  },
  disclaimer: {
    ...FinTypography.caption,
    color: FinColors.textMuted,
  },
});
