import { AppIcon } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import { buildBudgetSetupProposal } from "@/services/budget-setup-orchestrator";
import {
  BUDGET_SETUP_SMART_STRATEGIES,
  getBudgetSetupStrategyDescription,
  getBudgetSetupStrategyLabel,
} from "@/services/budget-setup-strategy-copy";
import type {
  BudgetSetupProposal,
  BudgetSetupStrategy,
  VariableCategoryKey,
} from "@/services/budget-setup-proposal-schema";
import { setBudgetSetupReviewContext } from "@/services/budget-setup-review-context";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const VARIABLE_ORDER: VariableCategoryKey[] = ["groceries", "fuel", "smoking", "other"];
const BUDGET_SETUP_STEPS = [
  { key: "choice", label: "Keuze" },
  { key: "proposal", label: "Voorstel" },
  { key: "review", label: "Toepassen" },
] as const;

type ScreenState =
  | "loading"
  | "error"
  | "empty"
  | "partial"
  | "proposal_available"
  | "proposal_needs_review";

type DraftValues = Record<VariableCategoryKey, string>;

type IncludeIncomeDraft = {
  salary: boolean;
  childBudget: boolean;
  structuralOther: boolean;
  variable: boolean;
};

function resolveMonthKey(value: string | null | undefined) {
  const fallback = getCurrentMonthKey();
  const candidate = String(value || "").trim();
  if (!candidate) return fallback;
  const option = getMonthOptionByKey(candidate);
  return option?.key || fallback;
}

function resolveMode(value: string | null | undefined): BudgetSetupStrategy {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "balans") return "balans";
  if (raw === "bespaarmodus") return "bespaarmodus";
  if (raw === "handmatig") return "handmatig";
  return "standaard";
}

function asMoneyDraft(value: string) {
  const normalized = String(value || "").replace(/[^0-9]/g, "");
  if (!normalized) return 0;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function fromMoneyDraft(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.round(value));
}

function sortVariableRows(rows: { categoryKey: VariableCategoryKey; amount: number }[]) {
  const rank = new Map(VARIABLE_ORDER.map((key, index) => [key, index]));
  return [...rows].sort(
    (left, right) => (rank.get(left.categoryKey) ?? 99) - (rank.get(right.categoryKey) ?? 99),
  );
}

function getCategoryLabel(categoryKey: VariableCategoryKey) {
  if (categoryKey === "groceries") return "Boodschappen";
  if (categoryKey === "fuel") return "Brandstof";
  if (categoryKey === "smoking") return "Roken";
  return "Overige ruimte";
}

function getCategoryIcon(categoryKey: VariableCategoryKey) {
  if (categoryKey === "groceries") return "shopping-bag";
  if (categoryKey === "fuel") return "local-gas-station";
  if (categoryKey === "smoking") return "smoking-rooms";
  return "pie-chart";
}

function monthFeelLabel(value: BudgetSetupProposal["planMeaning"]["monthFeel"]) {
  if (value === "krap") return "Krappe maand";
  if (value === "ruim") return "Ruime maand";
  return "Haalbare maand";
}

function reserveProtectionLabel(
  value: BudgetSetupProposal["safetyImpact"]["reserveProtectionLevel"],
) {
  if (value === "hoog") return "Hoog beschermd";
  if (value === "laag") return "Laag beschermd";
  return "Gemiddeld beschermd";
}

function buildDraftsFromProposal(proposal: BudgetSetupProposal): DraftValues {
  const next: DraftValues = {
    groceries: "0",
    fuel: "0",
    smoking: "0",
    other: "0",
  };
  for (const row of proposal.applyPayload.monthlyVariableBudgets) {
    next[row.categoryKey] = fromMoneyDraft(row.amount);
  }
  return next;
}

function buildEffectiveRows(input: {
  drafts: DraftValues;
  showSmoking: boolean;
}) {
  const amounts: Record<VariableCategoryKey, number> = {
    groceries: asMoneyDraft(input.drafts.groceries),
    fuel: asMoneyDraft(input.drafts.fuel),
    smoking: asMoneyDraft(input.drafts.smoking),
    other: asMoneyDraft(input.drafts.other),
  };
  if (!input.showSmoking && amounts.smoking > 0) {
    amounts.other += amounts.smoking;
    amounts.smoking = 0;
  }
  return sortVariableRows(
    VARIABLE_ORDER.map((categoryKey) => ({
      categoryKey,
      amount: amounts[categoryKey],
    })),
  );
}

export default function BudgetSetupProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string; mode?: string }>();
  const monthKey = resolveMonthKey(params.month);
  const monthOption = getMonthOptionByKey(monthKey);
  const monthStartIso =
    monthOption?.startIso ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const [selectedMode, setSelectedMode] = React.useState<BudgetSetupStrategy>(resolveMode(params.mode));
  const [proposal, setProposal] = React.useState<BudgetSetupProposal | null>(null);
  const [state, setState] = React.useState<ScreenState>("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [showStrategySheet, setShowStrategySheet] = React.useState(false);
  const [showIncomeSheet, setShowIncomeSheet] = React.useState(false);
  const [showFixedSheet, setShowFixedSheet] = React.useState(false);
  const [showDistributionSheet, setShowDistributionSheet] = React.useState(false);

  const [includeIncomeDraft, setIncludeIncomeDraft] = React.useState<IncludeIncomeDraft>({
    salary: true,
    childBudget: true,
    structuralOther: false,
    variable: false,
  });
  const [savingsTargetDraft, setSavingsTargetDraft] = React.useState("0");
  const [variableDrafts, setVariableDrafts] = React.useState<DraftValues>({
    groceries: "0",
    fuel: "0",
    smoking: "0",
    other: "0",
  });

  const loadProposal = React.useCallback(
    async (strategy: BudgetSetupStrategy) => {
      setState("loading");
      setErrorMessage(null);
      try {
        const referenceDate = new Date(`${monthStartIso}T12:00:00.000Z`);
        const next = await buildBudgetSetupProposal({
          referenceDate,
          monthStartIso,
          selectedMode: strategy,
        });

        setProposal(next);
        setSelectedMode(next.selectedMode);
        setIncludeIncomeDraft({ ...next.applyPayload.planSettings.includeIncome });
        setSavingsTargetDraft(String(next.applyPayload.planSettings.savingsTargetMonthly || 0));
        setVariableDrafts(buildDraftsFromProposal(next));

        if (next.variableBudgetPool <= 0) {
          setState("empty");
        } else if (next.needsReviewFlags.length > 0) {
          setState("proposal_needs_review");
        } else if (next.confidence.level === "laag") {
          setState("partial");
        } else {
          setState("proposal_available");
        }
      } catch {
        setErrorMessage("Voorstel ophalen is mislukt. Probeer opnieuw.");
        setState("error");
      }
    },
    [monthStartIso],
  );

  React.useEffect(() => {
    void loadProposal(resolveMode(params.mode));
  }, [loadProposal, params.mode]);

  const smokingSupportStrong = React.useMemo(() => {
    if (!proposal) return false;
    const smoking = proposal.suggestedCategories.find((item) => item.categoryKey === "smoking");
    if (!smoking) return false;
    return Boolean(smoking.basedOnTrend && (smoking.trendWindowMonths || 0) >= 2 && smoking.suggestedAmount > 0);
  }, [proposal]);

  const effectiveVariableRows = React.useMemo(
    () =>
      buildEffectiveRows({
        drafts: variableDrafts,
        showSmoking: smokingSupportStrong,
      }),
    [smokingSupportStrong, variableDrafts],
  );

  const visibleDistributionRows = React.useMemo(
    () => effectiveVariableRows.filter((row) => row.categoryKey !== "smoking" || smokingSupportStrong),
    [effectiveVariableRows, smokingSupportStrong],
  );

  const variableDraftTotal = React.useMemo(
    () => effectiveVariableRows.reduce((sum, row) => sum + row.amount, 0),
    [effectiveVariableRows],
  );

  const applyPayloadProposal = React.useMemo(() => {
    if (!proposal) return null;
    return {
      ...proposal,
      selectedMode,
      variableBudgetPool: variableDraftTotal,
      applyPayload: {
        ...proposal.applyPayload,
        planSettings: {
          ...proposal.applyPayload.planSettings,
          strategy: selectedMode,
          includeIncome: { ...includeIncomeDraft },
          savingsTargetMonthly: asMoneyDraft(savingsTargetDraft),
          applySavingsTargetToVariableBudget:
            selectedMode === "balans" || selectedMode === "bespaarmodus",
        },
        monthlyVariableBudgets: effectiveVariableRows,
      },
    };
  }, [effectiveVariableRows, includeIncomeDraft, proposal, savingsTargetDraft, selectedMode, variableDraftTotal]);

  const adjustmentCount = React.useMemo(() => {
    if (!proposal || !applyPayloadProposal) return 0;
    let count = 0;
    if (proposal.selectedMode !== applyPayloadProposal.selectedMode) count += 1;
    if (
      (proposal.applyPayload.planSettings.savingsTargetMonthly || 0) !==
      (applyPayloadProposal.applyPayload.planSettings.savingsTargetMonthly || 0)
    ) {
      count += 1;
    }
    for (const key of ["salary", "childBudget", "structuralOther", "variable"] as const) {
      if (
        proposal.applyPayload.planSettings.includeIncome[key] !==
        applyPayloadProposal.applyPayload.planSettings.includeIncome[key]
      ) {
        count += 1;
      }
    }
    for (const row of applyPayloadProposal.applyPayload.monthlyVariableBudgets) {
      const base = proposal.applyPayload.monthlyVariableBudgets.find(
        (item) => item.categoryKey === row.categoryKey,
      );
      if ((base?.amount || 0) !== row.amount) count += 1;
    }
    return count;
  }, [applyPayloadProposal, proposal]);

  const handleContinueToReview = React.useCallback(() => {
    if (!applyPayloadProposal) return;
    setBudgetSetupReviewContext({
      monthKey,
      monthStartIso,
      adjustmentCount,
      proposal: applyPayloadProposal,
    });
    router.push({
      pathname: "/budget/setup/review",
      params: {
        month: monthKey,
        mode: applyPayloadProposal.selectedMode,
      },
    });
  }, [adjustmentCount, applyPayloadProposal, monthKey, monthStartIso, router]);

  const runDeferredProposalReload = React.useCallback(
    (strategy: BudgetSetupStrategy) => {
      InteractionManager.runAfterInteractions(() => {
        void loadProposal(strategy);
      });
    },
    [loadProposal],
  );

  const otherShare = React.useMemo(() => {
    if (variableDraftTotal <= 0) return 0;
    const otherAmount = effectiveVariableRows.find((row) => row.categoryKey === "other")?.amount || 0;
    return otherAmount / variableDraftTotal;
  }, [effectiveVariableRows, variableDraftTotal]);

  return (
    <FinanceUtilityShell
      title="Je maand klaarzetten"
      subtitle={monthOption?.label || "Deze maand"}
      onBack={() => router.push({ pathname: "/budget/setup", params: { month: monthKey } })}
      hero={{
        eyebrow: "Maandplan",
        title: "Budio zet je maand alvast rustig klaar",
        subtitle: "We rekenen mee, beschermen eerst wat vast staat en laten daarna zien wat er overblijft.",
      }}
    >
      <View style={styles.stack}>
        <FinanceStepIndicator
          steps={[...BUDGET_SETUP_STEPS]}
          currentStepKey="proposal"
          completedStepKeys={["choice"]}
          style={styles.stepIndicator}
        />
        {state === "loading" ? (
          <FinanceSettingsGroup title="We zetten je maand klaar">
            <View style={styles.groupContent}>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={FinColors.textSecondary} />
                <FinanceText variant="body-sm" tone="secondary">
                  Budio kijkt naar je inkomen, vaste lasten, bescherming en ruimte voor deze maand.
                </FinanceText>
              </View>
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {state === "error" ? (
          <FinanceSettingsGroup title="Je maandplan lukt nu even niet">
            <View style={styles.groupContent}>
              <FinanceInlineCallout
                iconName="error-outline"
                text={errorMessage || "Het klaarzetten van je maand is even mislukt."}
              />
              <FinanceButton
                label="Probeer opnieuw"
                variant="secondary"
                onPress={() => runDeferredProposalReload(selectedMode)}
                fullWidth
              />
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {state === "empty" ? (
          <FinanceSettingsGroup title="We missen nog wat om dit goed te doen">
            <View style={styles.groupContent}>
              <FinanceText variant="body-sm" tone="secondary">
                Er is nu te weinig bekend om je maand rustig klaar te zetten. Je kunt de aanpak opnieuw kiezen.
              </FinanceText>
              <FinanceButton
                label="Terug naar aanpak"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup",
                    params: { month: monthKey },
                  })
                }
                fullWidth
              />
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {proposal ? (
          <>
            <FinanceSettingsGroup title="Hier rekenen we deze maand mee">
              <View style={styles.groupContent}>
                <FinanceInlineCallout
                  iconName="insights"
                  text={`Voor deze maand rekenen we met ${fmt.format(proposal.expectedIncomeTotal)} aan inkomen.`}
                />
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Salaris</Text>
                    <Text style={styles.summaryValue}>{includeIncomeDraft.salary ? "Mee" : "Niet mee"}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Kindgebonden budget</Text>
                    <Text style={styles.summaryValue}>{includeIncomeDraft.childBudget ? "Mee" : "Niet mee"}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Overig inkomen</Text>
                    <Text style={styles.summaryValue}>
                      {includeIncomeDraft.structuralOther || includeIncomeDraft.variable ? "Deels mee" : "Niet mee"}
                    </Text>
                  </View>
                </View>
                <FinanceButton
                  label="Pas dit aan"
                  variant="secondary"
                  onPress={() => setShowIncomeSheet(true)}
                  fullWidth
                />
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Dit beschermen we eerst">
              <View style={styles.groupContent}>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Vaste lasten</Text>
                    <Text style={styles.summaryValue}>{fmt.format(proposal.protectedAmounts.fixedCosts)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Abonnementen</Text>
                    <Text style={styles.summaryValue}>{fmt.format(proposal.protectedAmounts.subscriptions)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reserve per maand</Text>
                    <Text style={styles.summaryValue}>{fmt.format(asMoneyDraft(savingsTargetDraft))}</Text>
                  </View>
                </View>
                <FinanceInlineCallout
                  iconName="shield"
                  text={`Zo blijft je bescherming deze maand ${reserveProtectionLabel(proposal.safetyImpact.reserveProtectionLevel).toLowerCase()}.`}
                />
                <FinanceButton
                  label="Pas bescherming aan"
                  variant="secondary"
                  onPress={() => setShowFixedSheet(true)}
                  fullWidth
                />
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Dit blijft er voor je maand over">
              <View style={styles.groupContent}>
                <View style={styles.heroDecisionCard}>
                  <Text style={styles.decisionEyebrow}>{monthFeelLabel(proposal.planMeaning.monthFeel)}</Text>
                  <Text style={styles.heroDecisionAmount}>{fmt.format(variableDraftTotal)}</Text>
                  <Text style={styles.nextStepTitle}>blijft er over om vrij te verdelen</Text>
                  <Text style={styles.nextStepWhy}>{proposal.nextBestStep.why}</Text>
                </View>
                <View style={styles.strategyBlock}>
                  <Text style={styles.strategyLabel}>Gekozen aanpak</Text>
                  <Text style={styles.strategyValue}>{getBudgetSetupStrategyLabel(selectedMode)}</Text>
                  <Text style={styles.strategyDescription}>
                    {getBudgetSetupStrategyDescription(selectedMode)}
                  </Text>
                  <Text style={styles.strategyReason}>
                    Waarom dit past: {proposal.planMeaning.primaryReason}
                  </Text>
                </View>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Aandachtspunt</Text>
                    <Text style={styles.summaryValue}>{proposal.safetyImpact.biggestAttentionPoint}</Text>
                  </View>
                </View>
                <FinanceButton
                  label="Kies een andere aanpak"
                  variant="secondary"
                  onPress={() => setShowStrategySheet(true)}
                  fullWidth
                />
                <FinanceButton label="Bekijk mijn maandplan" onPress={handleContinueToReview} fullWidth />
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Deze budgetten zetten we alvast klaar">
              <View style={styles.groupContent}>
                <View style={styles.categoryList}>
                  {visibleDistributionRows.map((row) => (
                    <View key={row.categoryKey} style={styles.categoryRow}>
                      <View style={styles.categoryMain}>
                        <View style={styles.categoryIcon}>
                          <AppIcon
                            name={getCategoryIcon(row.categoryKey)}
                            size={14}
                            color={FinColors.textSecondary}
                          />
                        </View>
                        <Text style={styles.categoryLabel}>{getCategoryLabel(row.categoryKey)}</Text>
                      </View>
                      <Text style={styles.categoryAmount}>{fmt.format(row.amount)}</Text>
                    </View>
                  ))}
                </View>
                {smokingSupportStrong ? null : (
                  <FinanceInlineCallout
                    iconName="info-outline"
                    text="We laten roken alleen los zien als je transacties daar duidelijk genoeg op wijzen."
                  />
                )}
                {otherShare >= 0.35 ? (
                  <FinanceInlineCallout
                    iconName="insights"
                    text="Een groter deel staat nu nog als overige ruimte. Alleen verder verdelen als dat je helpt kiezen."
                  />
                ) : null}
                {adjustmentCount > 0 ? (
                  <FinanceText variant="caption" tone="secondary">
                    Je hebt al {adjustmentCount} aanpassing{adjustmentCount === 1 ? "" : "en"} gedaan.
                  </FinanceText>
                ) : null}
                <FinanceButton
                  label="Pas verdeling aan"
                  variant="secondary"
                  onPress={() => setShowDistributionSheet(true)}
                  fullWidth
                />
              </View>
            </FinanceSettingsGroup>
          </>
        ) : null}
      </View>

      <FinanceBottomSheetShell
        visible={showStrategySheet}
        title="Kies de aanpak voor deze maand"
        subtitle="Balans staat standaard aan. Kies wat het best past bij deze maand."
        onClose={() => setShowStrategySheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {BUDGET_SETUP_SMART_STRATEGIES.map((strategy) => {
            const selected = selectedMode === strategy;
            return (
              <Pressable
                key={strategy}
                style={[styles.sheetRow, selected && styles.sheetRowActive]}
                onPress={() => {
                  setShowStrategySheet(false);
                  setSelectedMode(strategy);
                  runDeferredProposalReload(strategy);
                }}
              >
                <View style={styles.sheetRowText}>
                  <Text style={styles.sheetLabel}>{getBudgetSetupStrategyLabel(strategy)}</Text>
                  <Text style={styles.sheetDescription}>
                    {getBudgetSetupStrategyDescription(strategy)}
                  </Text>
                </View>
                <Text style={styles.sheetValue}>{selected ? "Gekozen" : "Kies"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={showIncomeSheet}
        title="Pas je inkomen aan"
        subtitle="Kies wat we voor deze maand meenemen."
        onClose={() => setShowIncomeSheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {[
            { key: "salary", label: "Salaris" },
            { key: "childBudget", label: "Kindgebonden budget" },
            { key: "structuralOther", label: "Overig structureel" },
            { key: "variable", label: "Variabel inkomen" },
          ].map((item) => {
            const enabled = includeIncomeDraft[item.key as keyof IncludeIncomeDraft];
            return (
              <Pressable
                key={item.key}
                style={[styles.sheetRow, enabled && styles.sheetRowActive]}
                onPress={() =>
                  setIncludeIncomeDraft((current) => ({
                    ...current,
                    [item.key]: !current[item.key as keyof IncludeIncomeDraft],
                  }))
                }
              >
                <Text style={styles.sheetLabel}>{item.label}</Text>
                <Text style={styles.sheetValue}>{enabled ? "Aan" : "Uit"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={showFixedSheet}
        title="Pas je bescherming aan"
        subtitle="Controleer wat eerst apart blijft staan."
        onClose={() => setShowFixedSheet(false)}
      >
        <View style={styles.sheetContent}>
          <View style={styles.summaryList}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vaste lasten</Text>
              <Text style={styles.summaryValue}>{fmt.format(proposal?.protectedAmounts.fixedCosts || 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Abonnementen</Text>
              <Text style={styles.summaryValue}>{fmt.format(proposal?.protectedAmounts.subscriptions || 0)}</Text>
            </View>
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Reserve per maand</Text>
            <TextInput
              value={savingsTargetDraft}
              onChangeText={(text) => setSavingsTargetDraft(String(asMoneyDraft(text)))}
              keyboardType="number-pad"
              style={styles.amountInputLarge}
            />
          </View>
        </View>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={showDistributionSheet}
        title="Pas je verdeling aan"
        subtitle="Werk alleen bij wat echt helpt voor deze maand."
        onClose={() => setShowDistributionSheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {visibleDistributionRows.map((row) => (
            <View key={row.categoryKey} style={styles.sheetDistributionRow}>
              <Text style={styles.sheetLabel}>{getCategoryLabel(row.categoryKey)}</Text>
              <TextInput
                value={variableDrafts[row.categoryKey]}
                onChangeText={(text) =>
                  setVariableDrafts((current) => ({
                    ...current,
                    [row.categoryKey]: String(asMoneyDraft(text)),
                  }))
                }
                keyboardType="number-pad"
                style={styles.amountInput}
              />
            </View>
          ))}
        </ScrollView>
      </FinanceBottomSheetShell>
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.s,
  },
  summaryList: {
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgInput,
    overflow: "hidden",
  },
  strategyBlock: {
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: FinSpacing.s,
    gap: FinSpacing.x2,
  },
  strategyLabel: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  strategyValue: {
    ...FinTypography["body-lg"],
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  strategyDescription: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
  },
  strategyReason: {
    ...FinTypography.caption,
    color: FinColors.textPrimary,
    fontWeight: "600",
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
  nextStepConstraint: {
    ...FinTypography.caption,
    color: FinColors.textMuted,
  },
  heroDecisionCard: {
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: FinSpacing.m,
    gap: FinSpacing.x2,
  },
  decisionEyebrow: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  heroDecisionAmount: {
    ...FinTypography.h2,
    color: FinColors.textPrimary,
    fontWeight: "900",
  },
  categoryList: {
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgInput,
    overflow: "hidden",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.s,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.xs,
  },
  categoryMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
    flex: 1,
  },
  categoryIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  categoryAmount: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  sheetContent: {
    paddingHorizontal: FinSpacing.m,
    paddingBottom: FinSpacing["2xl"],
    gap: FinSpacing.s,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.s,
    gap: FinSpacing.s,
  },
  sheetRowActive: {
    borderColor: FinColors.warningText,
  },
  sheetRowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  sheetLabel: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  sheetDescription: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
  },
  sheetValue: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  sheetDistributionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.s,
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.s,
  },
  inputWrap: {
    gap: FinSpacing.x2,
  },
  inputLabel: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  amountInput: {
    minWidth: 100,
    borderRadius: FinRadius.md,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x2,
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    textAlign: "right",
  },
  amountInputLarge: {
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.s,
    ...FinTypography.body,
    color: FinColors.textPrimary,
  },
});
