import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import {
  applyBudgetSetupProposal,
} from "@/services/budget-setup-apply";
import {
  buildBudgetSetupProposal,
} from "@/services/budget-setup-orchestrator";
import type {
  BudgetSetupProposal,
  BudgetSetupStrategy,
  VariableCategoryKey,
} from "@/services/budget-setup-proposal-schema";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";
import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import { AppIcon } from "@/components/ui/app-icon";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
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

const STRATEGY_OPTIONS: { key: BudgetSetupStrategy; label: string }[] = [
  { key: "standaard", label: "Standaard" },
  { key: "balans", label: "Balans" },
  { key: "bespaarmodus", label: "Bespaarmodus" },
  { key: "handmatig", label: "Handmatig" },
];

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

function sortVariableRows(
  rows: { categoryKey: VariableCategoryKey; amount: number }[],
) {
  const order: VariableCategoryKey[] = ["groceries", "fuel", "smoking", "other"];
  const rank = new Map(order.map((key, index) => [key, index]));
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

export default function BudgetSetupProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string; mode?: string; stage?: string }>();
  const monthKey = resolveMonthKey(params.month);
  const monthOption = getMonthOptionByKey(monthKey);
  const monthStartIso = monthOption?.startIso || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const [selectedMode, setSelectedMode] = React.useState<BudgetSetupStrategy>(
    resolveMode(params.mode),
  );
  const [proposal, setProposal] = React.useState<BudgetSetupProposal | null>(null);
  const [state, setState] = React.useState<
    | "loading"
    | "error"
    | "empty"
    | "partial"
    | "proposal_available"
    | "proposal_needs_review"
  >("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [showIncomeSheet, setShowIncomeSheet] = React.useState(false);
  const [showFixedSheet, setShowFixedSheet] = React.useState(false);
  const [showDistributionSheet, setShowDistributionSheet] = React.useState(false);

  const [includeIncomeDraft, setIncludeIncomeDraft] = React.useState({
    salary: true,
    childBudget: true,
    structuralOther: false,
    variable: false,
  });
  const [savingsTargetDraft, setSavingsTargetDraft] = React.useState("0");
  const [variableDrafts, setVariableDrafts] = React.useState<
    Record<VariableCategoryKey, string>
  >({
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
        setSavingsTargetDraft(
          String(next.applyPayload.planSettings.savingsTargetMonthly || 0),
        );
        const drafts: Record<VariableCategoryKey, string> = {
          groceries: "0",
          fuel: "0",
          smoking: "0",
          other: "0",
        };
        for (const row of next.applyPayload.monthlyVariableBudgets) {
          drafts[row.categoryKey] = String(row.amount);
        }
        setVariableDrafts(drafts);

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

  const variableRows = React.useMemo(
    () =>
      sortVariableRows(
        proposal?.applyPayload.monthlyVariableBudgets || [
          { categoryKey: "groceries", amount: 0 },
          { categoryKey: "fuel", amount: 0 },
          { categoryKey: "smoking", amount: 0 },
          { categoryKey: "other", amount: 0 },
        ],
      ),
    [proposal],
  );

  const variableDraftTotal = React.useMemo(
    () =>
      (["groceries", "fuel", "smoking", "other"] as VariableCategoryKey[]).reduce(
        (sum, key) => sum + asMoneyDraft(variableDrafts[key]),
        0,
      ),
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
          (["groceries", "fuel", "smoking", "other"] as VariableCategoryKey[]).map(
            (categoryKey) => ({
              categoryKey,
              amount: asMoneyDraft(variableDrafts[categoryKey]),
            }),
          ),
        ),
      },
    };
  }, [includeIncomeDraft, proposal, savingsTargetDraft, selectedMode, variableDraftTotal, variableDrafts]);

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
        },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Toepassen is mislukt.",
      );
      setState("error");
    } finally {
      setApplying(false);
    }
  }, [applyPayloadProposal, monthKey, monthStartIso, router]);

  return (
    <FinanceUtilityShell
      title="Slim budget instellen"
      subtitle={monthOption?.label || "Deze maand"}
      onBack={() =>
        router.push({
          pathname: "/budget/setup",
          params: { month: monthKey },
        })
      }
      hero={{
        eyebrow: "Stap 2 van 3",
        title: "Voorsteloverzicht",
        subtitle: "Budio maakt eerst een voorstel. Daarna kies je wat je wilt bijsturen.",
      }}
    >
      <View style={styles.stack}>
        {state === "loading" ? (
          <FinanceSettingsGroup title="Analyse">
            <View style={styles.groupContent}>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={FinColors.textSecondary} />
                <FinanceText variant="body-sm" tone="secondary">
                  Budio berekent inkomen, vaste lasten, reserves en variabele ruimte.
                </FinanceText>
              </View>
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {state === "error" ? (
          <FinanceSettingsGroup title="Fout">
            <View style={styles.groupContent}>
              <FinanceInlineCallout
                iconName="error-outline"
                text={errorMessage || "Het voorstel is nu niet beschikbaar."}
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
          <FinanceSettingsGroup title="Nog geen voorstel">
            <View style={styles.groupContent}>
              <FinanceText variant="body-sm" tone="secondary">
                Er is te weinig context om nu een bruikbare verdeling te maken.
              </FinanceText>
              <FinanceButton
                label="Terug naar routekeuze"
                variant="secondary"
                onPress={() => router.push({ pathname: "/budget/setup", params: { month: monthKey } })}
                fullWidth
              />
            </View>
          </FinanceSettingsGroup>
        ) : null}

        {proposal ? (
          <>
            <FinanceSettingsGroup title="Geadviseerde modus">
              <View style={styles.groupContent}>
                {(state === "partial" || state === "proposal_needs_review") ? (
                  <FinanceInlineCallout
                    iconName="priority-high"
                    text="Voorstel vraagt extra review door beperkte of onzekere brondata."
                  />
                ) : (
                  <FinanceInlineCallout
                    iconName="check-circle"
                    text="Voorstel beschikbaar op basis van je bestaande budget- en contextdata."
                  />
                )}
                <View style={styles.modeRow}>
                  {STRATEGY_OPTIONS.map((option) => {
                    const selected = selectedMode === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        style={[styles.modeButton, selected && styles.modeButtonActive]}
                        onPress={() => {
                          setSelectedMode(option.key);
                          void loadProposal(option.key);
                        }}
                      >
                        <Text style={[styles.modeButtonText, selected && styles.modeButtonTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Voorstel-overzicht">
              <View style={styles.groupContent}>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Verwacht inkomen</Text>
                    <Text style={styles.summaryValue}>{fmt.format(proposal.expectedIncomeTotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Beschermde bedragen</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(
                        proposal.protectedAmounts.fixedCosts +
                          proposal.protectedAmounts.subscriptions +
                          proposal.protectedAmounts.reserves +
                          proposal.protectedAmounts.annualized,
                      )}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Variabele pool</Text>
                    <Text style={styles.summaryValueStrong}>{fmt.format(variableDraftTotal)}</Text>
                  </View>
                </View>
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Verdeling over variabele categorieën">
              <View style={styles.groupContent}>
                <View style={styles.categoryList}>
                  {variableRows.map((row) => (
                    <View key={row.categoryKey} style={styles.categoryRow}>
                      <View style={styles.categoryMain}>
                        <View style={styles.categoryIcon}>
                          <AppIcon
                            name={getCategoryIcon(row.categoryKey)}
                            size={15}
                            color={FinColors.textSecondary}
                          />
                        </View>
                        <View style={styles.categoryTextWrap}>
                          <Text style={styles.categoryLabel}>
                            {getCategoryLabel(row.categoryKey)}
                          </Text>
                          <Text style={styles.categoryMeta}>
                            Voorstel {fmt.format(row.amount)}
                          </Text>
                        </View>
                      </View>
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
                </View>

                <View style={styles.actions}>
                  <FinanceButton
                    label="Toepassen"
                    onPress={() => void handleApply()}
                    loading={applying}
                    fullWidth
                  />
                  <View style={styles.secondaryRow}>
                    <FinanceButton
                      label="Opnieuw verdelen"
                      variant="secondary"
                      onPress={() => void loadProposal(selectedMode)}
                      style={styles.halfAction}
                    />
                    <FinanceButton
                      label="Aanpassen"
                      variant="secondary"
                      onPress={() => setShowDistributionSheet(true)}
                      style={styles.halfAction}
                    />
                  </View>
                </View>
              </View>
            </FinanceSettingsGroup>

            <FinanceSettingsGroup title="Slim instellen per onderdeel">
              <View style={styles.groupContent}>
                <View style={styles.secondaryRow}>
                  <FinanceButton
                    label="Inkomsten"
                    variant="secondary"
                    onPress={() => setShowIncomeSheet(true)}
                    style={styles.halfAction}
                  />
                  <FinanceButton
                    label="Vaste lasten / reserves"
                    variant="secondary"
                    onPress={() => setShowFixedSheet(true)}
                    style={styles.halfAction}
                  />
                </View>
                <FinanceButton
                  label="Budgetverdeling"
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
        visible={showIncomeSheet}
        title="Inkomsten"
        subtitle="Kies welke inkomsten in je voorstel meetellen."
        onClose={() => setShowIncomeSheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {[
            { key: "salary", label: "Salaris" },
            { key: "childBudget", label: "Kindgebonden budget" },
            { key: "structuralOther", label: "Overig structureel" },
            { key: "variable", label: "Variabel" },
          ].map((item) => {
            const enabled = includeIncomeDraft[item.key as keyof typeof includeIncomeDraft];
            return (
              <Pressable
                key={item.key}
                style={[styles.sheetRow, enabled && styles.sheetRowActive]}
                onPress={() =>
                  setIncludeIncomeDraft((current) => ({
                    ...current,
                    [item.key]: !current[item.key as keyof typeof current],
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
        subtitle="Controleer beschermde bedragen en reserveinstelling."
        onClose={() => setShowFixedSheet(false)}
      >
        <View style={styles.sheetContent}>
          <View style={styles.summaryList}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vaste lasten</Text>
              <Text style={styles.summaryValue}>
                {fmt.format(proposal?.protectedAmounts.fixedCosts || 0)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Abonnementen</Text>
              <Text style={styles.summaryValue}>
                {fmt.format(proposal?.protectedAmounts.subscriptions || 0)}
              </Text>
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
        subtitle="Bewerk categoriebedragen en pas daarna het voorstel toe."
        onClose={() => setShowDistributionSheet(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {variableRows.map((row) => (
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
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.xs,
  },
  modeButton: {
    borderRadius: 999,
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
  summaryValue: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  summaryValueStrong: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "800",
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
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTextWrap: {
    flex: 1,
    gap: FinSpacing.x1,
  },
  categoryLabel: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  categoryMeta: {
    ...FinTypography.caption,
    color: FinColors.textMuted,
  },
  amountInput: {
    minWidth: 96,
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
  actions: {
    gap: FinSpacing.xs,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: FinSpacing.xs,
  },
  halfAction: {
    flex: 1,
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
  inputWrap: {
    gap: FinSpacing.x2,
  },
  inputLabel: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
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
});

