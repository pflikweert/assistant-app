import { AppIcon } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import { applyBudgetSetupProposal } from "@/services/budget-setup-apply";
import { buildBudgetSetupProposal } from "@/services/budget-setup-orchestrator";
import type {
  BudgetSetupProposal,
  BudgetSetupStrategy,
  VariableCategoryKey,
} from "@/services/budget-setup-proposal-schema";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const STRATEGY_OPTIONS: { key: BudgetSetupStrategy; label: string }[] = [
  { key: "standaard", label: "Standaard" },
  { key: "balans", label: "Balans" },
  { key: "bespaarmodus", label: "Bespaarmodus" },
  { key: "handmatig", label: "Handmatig" },
];

const VARIABLE_ORDER: VariableCategoryKey[] = ["groceries", "fuel", "smoking", "other"];

type ScreenState =
  | "loading"
  | "error"
  | "empty"
  | "partial"
  | "proposal_available"
  | "proposal_needs_review";

type FocusTarget = "income" | "fixed" | "distribution";

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
  return "Overig";
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

function strictnessLabel(value: BudgetSetupProposal["planMeaning"]["strictness"]) {
  if (value === "licht") return "Lichte sturing";
  if (value === "streng") return "Strakke sturing";
  return "Normale sturing";
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

function trimVariableDraftsByAmount(current: DraftValues, amountToTrim: number): DraftValues {
  const result: DraftValues = { ...current };
  let remaining = Math.max(0, Math.round(amountToTrim));
  for (const key of ["other", "smoking", "fuel", "groceries"] as VariableCategoryKey[]) {
    if (remaining <= 0) break;
    const value = asMoneyDraft(result[key]);
    const deduction = Math.min(value, remaining);
    result[key] = String(Math.max(0, value - deduction));
    remaining -= deduction;
  }
  return result;
}

export default function BudgetSetupProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string; mode?: string; stage?: string; focus?: string }>();
  const monthKey = resolveMonthKey(params.month);
  const monthOption = getMonthOptionByKey(monthKey);
  const monthStartIso =
    monthOption?.startIso ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const [selectedMode, setSelectedMode] = React.useState<BudgetSetupStrategy>(resolveMode(params.mode));
  const [proposal, setProposal] = React.useState<BudgetSetupProposal | null>(null);
  const [state, setState] = React.useState<ScreenState>("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);

  const [showRefineSheet, setShowRefineSheet] = React.useState(false);
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

  const openFocusSheet = React.useCallback((focus: FocusTarget) => {
    if (focus === "income") {
      setShowIncomeSheet(true);
      return;
    }
    if (focus === "fixed") {
      setShowFixedSheet(true);
      return;
    }
    setShowDistributionSheet(true);
  }, []);

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

  React.useEffect(() => {
    const focus = String(params.focus || "").trim().toLowerCase();
    if (!focus || state === "loading") return;
    if (focus === "income" || focus === "fixed" || focus === "distribution") {
      openFocusSheet(focus as FocusTarget);
    }
  }, [openFocusSheet, params.focus, state]);

  const variableRows = React.useMemo(() => {
    const baseRows = proposal?.applyPayload.monthlyVariableBudgets ||
      VARIABLE_ORDER.map((categoryKey) => ({ categoryKey, amount: 0 }));
    return sortVariableRows(baseRows);
  }, [proposal]);

  const variableDraftTotal = React.useMemo(
    () => VARIABLE_ORDER.reduce((sum, key) => sum + asMoneyDraft(variableDrafts[key]), 0),
    [variableDrafts],
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
        monthlyVariableBudgets: sortVariableRows(
          VARIABLE_ORDER.map((categoryKey) => ({
            categoryKey,
            amount: asMoneyDraft(variableDrafts[categoryKey]),
          })),
        ),
      },
    };
  }, [includeIncomeDraft, proposal, savingsTargetDraft, selectedMode, variableDraftTotal, variableDrafts]);

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

  const handleApply = React.useCallback(async () => {
    if (!applyPayloadProposal) return;
    setApplying(true);
    setErrorMessage(null);
    try {
      const result = await applyBudgetSetupProposal({
        proposal: applyPayloadProposal,
        monthStartIso,
        planKey: "default",
        idempotencyKey: applyPayloadProposal.proposalId,
      });
      router.push({
        pathname: "/budget/setup/review",
        params: {
          month: monthKey,
          mode: applyPayloadProposal.selectedMode,
          variableTotal: String(result.summary.configuredVariableBudgetTotal),
          categoryCount: String(result.summary.configuredCategoryCount),
          savingsTarget: String(result.summary.configuredSavingsTargetMonthly || 0),
          adjustedCount: String(adjustmentCount),
          monthFeel: applyPayloadProposal.planMeaning.monthFeel,
          strictness: applyPayloadProposal.planMeaning.strictness,
          primaryReason: applyPayloadProposal.planMeaning.primaryReason,
          reserveProtectionLevel: applyPayloadProposal.safetyImpact.reserveProtectionLevel,
          biggestAttentionPoint: applyPayloadProposal.safetyImpact.biggestAttentionPoint,
          nextBestStepTitle: applyPayloadProposal.nextBestStep.title,
          nextBestStepWhy: applyPayloadProposal.nextBestStep.why,
        },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Toepassen is mislukt.");
      setState("error");
    } finally {
      setApplying(false);
    }
  }, [adjustmentCount, applyPayloadProposal, monthKey, monthStartIso, router]);

  const applyModeOnly = React.useCallback((mode: BudgetSetupStrategy) => {
    setSelectedMode(mode);
    void loadProposal(mode);
  }, [loadProposal]);

  const applyVariableScale = React.useCallback((factor: number) => {
    setVariableDrafts((current) => {
      const next: DraftValues = { ...current };
      for (const key of VARIABLE_ORDER) {
        next[key] = fromMoneyDraft(asMoneyDraft(current[key]) * factor);
      }
      return next;
    });
  }, []);

  const makeMoreSavings = React.useCallback(() => {
    setSavingsTargetDraft((current) => String(asMoneyDraft(current) + 50));
    setVariableDrafts((current) => trimVariableDraftsByAmount(current, 50));
  }, []);

  const handleCoachAction = React.useCallback(
    (actionKey: BudgetSetupProposal["coachActions"][number]["actionKey"]) => {
      if (actionKey === "rebalance_now") {
        void loadProposal(selectedMode);
        return;
      }
      if (actionKey === "make_roomier") {
        applyVariableScale(1.08);
        return;
      }
      if (actionKey === "make_tighter") {
        applyVariableScale(0.92);
        return;
      }
      if (actionKey === "protect_savings") {
        makeMoreSavings();
      }
    },
    [applyVariableScale, loadProposal, makeMoreSavings, selectedMode],
  );

  const confidenceLabel = React.useMemo(() => {
    if (!proposal) return "";
    if (proposal.confidence.level === "hoog") return "Hoge betrouwbaarheid";
    if (proposal.confidence.level === "middel") return "Gemiddelde betrouwbaarheid";
    return "Lagere betrouwbaarheid";
  }, [proposal]);

  return (
    <FinanceUtilityShell
      title="Slim budget instellen"
      subtitle={monthOption?.label || "Deze maand"}
      onBack={() => router.push({ pathname: "/budget/setup", params: { month: monthKey } })}
      hero={{
        eyebrow: "Voorstel eerst",
        title: "Budio heeft een voorstel voor je maand",
        subtitle: "In één oogopslag zien, dan toepassen of gericht bijsturen.",
      }}
    >
      <View style={styles.stack}>
        {state === "loading" ? (
          <FinanceSettingsGroup title="Voorstel wordt opgebouwd">
            <View style={styles.groupContent}>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={FinColors.textSecondary} />
                <FinanceText variant="body-sm" tone="secondary">
                  Budio kijkt naar inkomsten, vaste lasten, reserves en recente maandtrend.
                </FinanceText>
              </View>
              <View style={styles.loadingList}>
                <Text style={styles.loadingItem}>Inkomstenbasis controleren</Text>
                <Text style={styles.loadingItem}>Beschermde bedragen bepalen</Text>
                <Text style={styles.loadingItem}>Variabele ruimte verdelen</Text>
              </View>
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {state === "error" ? (
          <FinanceSettingsGroup title="Voorstel nu niet beschikbaar">
            <View style={styles.groupContent}>
              <FinanceInlineCallout
                iconName="error-outline"
                text={errorMessage || "Er ging iets mis bij het opbouwen van je voorstel."}
              />
              <FinanceButton
                label="Opnieuw proberen"
                variant="secondary"
                onPress={() => void loadProposal(selectedMode)}
                fullWidth
              />
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {state === "empty" ? (
          <FinanceSettingsGroup title="Nog geen bruikbaar voorstel">
            <View style={styles.groupContent}>
              <FinanceText variant="body-sm" tone="secondary">
                Er is nu te weinig context om veilig te verdelen. Je kunt handmatig doorgaan en later opnieuw proberen.
              </FinanceText>
              <FinanceButton
                label="Ga naar handmatig"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/budget/setup",
                    params: { month: monthKey, stage: "refine" },
                  })
                }
                fullWidth
              />
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {proposal ? (
          <>
            <FinanceSettingsGroup title="Strategie en maandgevoel">
              <View style={styles.groupContent}>
                {state === "proposal_needs_review" ? (
                  <FinanceInlineCallout
                    iconName="priority-high"
                    text="Check dit voorstel extra goed: een deel van de brondata is onzeker of onvolledig."
                  />
                ) : state === "partial" ? (
                  <FinanceInlineCallout
                    iconName="insights"
                    text="Voorstel is conservatief opgebouwd met beperkte context."
                  />
                ) : (
                  <FinanceInlineCallout
                    iconName="check-circle"
                    text="Voorstel klaar op basis van je bestaande budget- en contextdata."
                  />
                )}

                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Geadviseerde strategie</Text>
                    <Text style={styles.summaryValue}>
                      {STRATEGY_OPTIONS.find((option) => option.key === proposal.selectedMode)?.label || "Standaard"}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Maandgevoel</Text>
                    <Text style={styles.summaryValue}>{monthFeelLabel(proposal.planMeaning.monthFeel)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Sturingsniveau</Text>
                    <Text style={styles.summaryValue}>{strictnessLabel(proposal.planMeaning.strictness)}</Text>
                  </View>
                </View>

                <View style={styles.modeRow}>
                  {STRATEGY_OPTIONS.map((option) => {
                    const selected = selectedMode === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        style={[styles.modeButton, selected && styles.modeButtonActive]}
                        onPress={() => applyModeOnly(option.key)}
                      >
                        <Text style={[styles.modeButtonText, selected && styles.modeButtonTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.rationaleText}>{proposal.planMeaning.primaryReason}</Text>
                <Text style={styles.helperText}>{confidenceLabel}</Text>
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Veiligheid en impact">
              <View style={styles.groupContent}>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Ruimte voor variabele uitgaven</Text>
                    <Text style={styles.summaryValueStrong}>{fmt.format(variableDraftTotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reservebescherming</Text>
                    <Text style={styles.summaryValue}>
                      {reserveProtectionLabel(proposal.safetyImpact.reserveProtectionLevel)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Belangrijkste aandachtspunt</Text>
                    <Text style={styles.summaryValue}>{proposal.safetyImpact.biggestAttentionPoint}</Text>
                  </View>
                </View>
                <FinanceInlineCallout
                  iconName="insights"
                  text={`Dit voorstel houdt ongeveer ${fmt.format(
                    proposal.safetyImpact.variableRoomMonthly,
                  )} variabele ruimte per maand over.`}
                />
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Beste volgende stap">
              <View style={styles.groupContent}>
                <View style={styles.nextStepCard}>
                  <Text style={styles.nextStepTitle}>{proposal.nextBestStep.title}</Text>
                  <Text style={styles.nextStepWhy}>{proposal.nextBestStep.why}</Text>
                  <Text style={styles.nextStepConstraint}>
                    Focus: {proposal.nextBestStep.dominantConstraint.replace(/_/g, " ")}
                  </Text>
                </View>
                <FinanceButton
                  label="Toepassen"
                  onPress={() => void handleApply()}
                  loading={applying}
                  fullWidth
                />
                <View style={styles.secondaryRow}>
                  <FinanceButton
                    label="1 ding aanpassen"
                    variant="secondary"
                    onPress={() => setShowRefineSheet(true)}
                    style={styles.halfAction}
                  />
                  <FinanceButton
                    label="Opnieuw verdelen"
                    variant="secondary"
                    onPress={() => void loadProposal(selectedMode)}
                    style={styles.halfAction}
                  />
                </View>
                <View style={styles.refinementWrap}>
                  {(proposal.coachActions.length ? proposal.coachActions : []).map((action) => (
                    <Pressable
                      key={action.actionKey}
                      style={styles.refinementChip}
                      onPress={() => handleCoachAction(action.actionKey)}
                    >
                      <Text style={styles.refinementText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {adjustmentCount > 0 ? (
                  <FinanceText variant="caption" tone="secondary">
                    Concept aangepast ({adjustmentCount} wijziging{adjustmentCount === 1 ? "" : "en"}).
                  </FinanceText>
                ) : null}
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Verdeling over variabele categorieën">
              <View style={styles.groupContent}>
                <View style={styles.rationaleList}>
                  {(proposal.rationale.length ? proposal.rationale : proposal.adjustmentNotes)
                    .slice(0, 2)
                    .map((item) => (
                      <View key={item} style={styles.rationaleRow}>
                        <View style={styles.rationaleDot} />
                        <Text style={styles.rationaleText}>{item}</Text>
                      </View>
                    ))}
                </View>
                <View style={styles.categoryList}>
                  {sortVariableRows(
                    VARIABLE_ORDER.map((key) => ({
                      categoryKey: key,
                      amount: asMoneyDraft(variableDrafts[key]),
                    })),
                  ).map((row) => (
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
                <View style={styles.coachList}>
                  {(proposal.suggestedCategoriesV2 || []).slice(0, 6).map((item) => (
                    <View key={item.id} style={styles.coachRow}>
                      <View style={styles.coachRowMain}>
                        <Text style={styles.coachLabel}>{item.label}</Text>
                        <Text style={styles.coachMeta}>
                          {item.type === "sub" ? "Subcategorie" : "Hoofdcategorie"} ·{" "}
                          {item.source === "trend"
                            ? "Trend"
                            : item.source === "forecast"
                              ? "Forecast"
                              : "Trend + forecast"}
                        </Text>
                        <Text style={styles.coachWhy}>{item.why}</Text>
                      </View>
                      <Text style={styles.coachAmount}>{fmt.format(item.suggestedAmount)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </FinanceSettingsGroup>
          </>
        ) : null}
      </View>

      <FinanceBottomSheetShell
        visible={showRefineSheet}
        title="Wat wil je bijsturen?"
        subtitle="Kies één onderdeel. Je kunt daarna direct toepassen."
        onClose={() => setShowRefineSheet(false)}
      >
        <View style={styles.sheetContent}>
          <FinanceButton
            label="Inkomsten"
            variant="secondary"
            onPress={() => {
              setShowRefineSheet(false);
              setShowIncomeSheet(true);
            }}
            fullWidth
          />
          <FinanceButton
            label="Vaste lasten / reserves"
            variant="secondary"
            onPress={() => {
              setShowRefineSheet(false);
              setShowFixedSheet(true);
            }}
            fullWidth
          />
          <FinanceButton
            label="Budgetverdeling"
            variant="secondary"
            onPress={() => {
              setShowRefineSheet(false);
              setShowDistributionSheet(true);
            }}
            fullWidth
          />
        </View>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={showIncomeSheet}
        title="Inkomsten"
        subtitle="Kies welke inkomsten meetellen in dit voorstel."
        onClose={() => setShowIncomeSheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {[
            { key: "salary", label: "Salaris" },
            { key: "childBudget", label: "Kindgebonden budget" },
            { key: "structuralOther", label: "Overig structureel" },
            { key: "variable", label: "Variabel" },
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
        title="Vaste lasten / reserves"
        subtitle="Controleer beschermde bedragen en je maandreserve."
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
        title="Budgetverdeling"
        subtitle="Pas bedragen aan per categorie."
        onClose={() => setShowDistributionSheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {sortVariableRows(variableRows).map((row) => (
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
  groupContent: {
    padding: FinSpacing.m,
    gap: FinSpacing.s,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.s,
  },
  loadingList: {
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgInput,
    padding: FinSpacing.s,
    gap: FinSpacing.x2,
  },
  loadingItem: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  helperText: {
    ...FinTypography.caption,
    color: FinColors.textMuted,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.xs,
  },
  modeButton: {
    borderRadius: FinRadius.pill,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x2,
  },
  modeButtonActive: {
    borderColor: FinColors.warningText,
    backgroundColor: FinColors.yellowSoft,
  },
  modeButtonText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: FinColors.textPrimary,
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
  summaryLabelStrong: {
    ...FinTypography.caption,
    color: FinColors.textPrimary,
    flex: 1,
    fontWeight: "800",
  },
  summaryValue: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  summaryValueStrong: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "900",
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
    textTransform: "capitalize",
  },
  rationaleList: {
    gap: FinSpacing.x2,
  },
  rationaleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: FinSpacing.x2,
  },
  rationaleDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: FinColors.textMuted,
  },
  rationaleText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    flex: 1,
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
  secondaryRow: {
    flexDirection: "row",
    gap: FinSpacing.xs,
  },
  halfAction: {
    flex: 1,
  },
  refinementWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  refinementChip: {
    borderRadius: FinRadius.pill,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x2,
  },
  refinementText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  coachList: {
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    overflow: "hidden",
  },
  coachRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: FinSpacing.xs,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.s,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  coachRowMain: {
    flex: 1,
    gap: FinSpacing.x2,
  },
  coachLabel: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  coachMeta: {
    ...FinTypography.caption,
    color: FinColors.textMuted,
  },
  coachWhy: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
  },
  coachAmount: {
    ...FinTypography.caption,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  sheetContent: {
    paddingHorizontal: FinSpacing.m,
    paddingBottom: FinSpacing.x24,
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
  },
  sheetRowActive: {
    borderColor: FinColors.warningText,
  },
  sheetLabel: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
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
