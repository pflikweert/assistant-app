import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import { applyBudgetSetupProposal } from "@/services/budget-setup-apply";
import {
  clearBudgetSetupReviewContext,
  getBudgetSetupReviewContext,
} from "@/services/budget-setup-review-context";
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

function reserveProtectionLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "hoog") return "Hoog beschermd";
  if (normalized === "laag") return "Laag beschermd";
  return "Gemiddeld beschermd";
}

export default function BudgetSetupReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string; mode?: string }>();
  const context = getBudgetSetupReviewContext();

  const monthKey = resolveMonthKey(params.month || context?.monthKey);
  const monthLabel = getMonthOptionByKey(monthKey)?.label || "Deze maand";

  const [applying, setApplying] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const hasContext = Boolean(context?.proposal);

  const summary = React.useMemo(() => {
    if (!context?.proposal) return null;
    const monthlyRows = context.proposal.applyPayload.monthlyVariableBudgets;
    const variableTotal = monthlyRows.reduce((sum, row) => sum + Math.max(0, Math.round(row.amount)), 0);
    const categoryCount = monthlyRows.filter((row) => row.amount > 0).length;
    return {
      mode: modeLabel(context.proposal.selectedMode),
      variableTotal,
      categoryCount,
      savingsTarget: context.proposal.applyPayload.planSettings.savingsTargetMonthly || 0,
      monthFeel: monthFeelLabel(context.proposal.planMeaning.monthFeel),
      reserveProtection: reserveProtectionLabel(context.proposal.safetyImpact.reserveProtectionLevel),
      primaryReason: context.proposal.planMeaning.primaryReason,
      biggestAttentionPoint: context.proposal.safetyImpact.biggestAttentionPoint,
      nextBestStepTitle: context.proposal.nextBestStep.title,
      nextBestStepWhy: context.proposal.nextBestStep.why,
      adjustedCount: context.adjustmentCount,
    };
  }, [context]);

  const handleApply = React.useCallback(async () => {
    if (!context?.proposal) {
      setErrorMessage("Deze review heeft geen actief voorstel meer. Ga een stap terug.");
      return;
    }
    setApplying(true);
    setErrorMessage(null);
    try {
      await applyBudgetSetupProposal({
        proposal: context.proposal,
        monthStartIso: context.monthStartIso,
        planKey: "default",
        idempotencyKey: context.proposal.proposalId,
      });
      clearBudgetSetupReviewContext();
      router.push({
        pathname: "/budget",
        params: { segment: "manage", month: monthKey },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Toepassen is mislukt.");
    } finally {
      setApplying(false);
    }
  }, [context, monthKey, router]);

  return (
    <FinanceUtilityShell
      title="Je maand staat klaar"
      subtitle={monthLabel}
      onBack={() => router.back()}
      hero={{
        eyebrow: "Review",
        title: "Controleer en bevestig je maandplan",
        subtitle: "Kort, duidelijk en klaar om te gebruiken.",
      }}
    >
      <View style={styles.stack}>
        {!hasContext || !summary ? (
          <FinanceSettingsGroup title="Review niet beschikbaar">
            <View style={styles.groupContent}>
              <FinanceInlineCallout
                iconName="info-outline"
                text="Er is geen actief voorstel om te bevestigen. Start opnieuw vanaf de vorige stap."
              />
              <FinanceButton
                label="Terug naar voorstel"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup/proposal",
                    params: { month: monthKey, mode: String(params.mode || "standaard") },
                  })
                }
                fullWidth
              />
            </View>
          </FinanceSettingsGroup>
        ) : (
          <>
            <FinanceSettingsGroup title="Wat dit plan betekent voor jouw maand">
              <View style={styles.groupContent}>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Maandgevoel</Text>
                    <Text style={styles.summaryValue}>{summary.monthFeel}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reservebescherming</Text>
                    <Text style={styles.summaryValue}>{summary.reserveProtection}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Belangrijkste aandachtspunt</Text>
                    <Text style={styles.summaryValue}>{summary.biggestAttentionPoint}</Text>
                  </View>
                </View>
                <FinanceInlineCallout iconName="insights" text={summary.primaryReason} />
                <View style={styles.nextStepCard}>
                  <Text style={styles.nextStepTitle}>{summary.nextBestStepTitle}</Text>
                  <Text style={styles.nextStepWhy}>{summary.nextBestStepWhy}</Text>
                </View>
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Wat Budio heeft ingesteld">
              <View style={styles.groupContent}>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Aanpak</Text>
                    <Text style={styles.summaryValue}>{summary.mode}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Vrij te verdelen</Text>
                    <Text style={styles.summaryValue}>{fmt.format(summary.variableTotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Klaargezette budgetten</Text>
                    <Text style={styles.summaryValue}>{String(summary.categoryCount)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reserve per maand</Text>
                    <Text style={styles.summaryValue}>{fmt.format(summary.savingsTarget)}</Text>
                  </View>
                </View>
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Wil je nog iets aanpassen?">
              <View style={styles.groupContent}>
                <FinanceInlineCallout
                  iconName={summary.adjustedCount > 0 ? "tune" : "check-circle"}
                  text={
                    summary.adjustedCount > 0
                      ? `Je hebt al ${summary.adjustedCount} aanpassing${summary.adjustedCount === 1 ? "" : "en"} gedaan.`
                      : "Je plan staat klaar. Je kunt nu bevestigen of nog één stap aanpassen."
                  }
                />
                {errorMessage ? (
                  <FinanceInlineCallout iconName="error-outline" text={errorMessage} />
                ) : null}
                <View style={styles.actions}>
                  <FinanceButton
                    label="Gebruik dit plan"
                    onPress={() => void handleApply()}
                    loading={applying}
                    fullWidth
                  />
                  <FinanceButton
                    label="Nog iets aanpassen"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/budget/setup/proposal",
                        params: { month: monthKey, mode: String(params.mode || "standaard") },
                      })
                    }
                    fullWidth
                  />
                </View>
              </View>
            </FinanceSettingsGroup>
          </>
        )}
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
});
