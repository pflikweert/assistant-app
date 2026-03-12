import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { generateBudgetCoachReport } from "@/services/budget-coach";
import { recomputeCurrentMonthCashflowForecast } from "@/services/forecasting";
import { computeBudgetPlan } from "@/services/budget-plan";
import {
    upsertBudgetPlanSettings,
    upsertMonthlyBudgetValue,
} from "@/services/budget-plan-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import type {
  BudgetCategoryKey,
  BudgetIncomeInclusionSettings,
  BudgetPlanComputation,
  BudgetPlanMode,
} from "@/types/categorization";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import React from "react";
import {
    Modal,
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

const BUDGET_EDIT_ORDER: BudgetCategoryKey[] = [
  "fixed_costs",
  "subscriptions",
  "variable_costs",
  "groceries",
  "fuel",
  "smoking",
  "other",
  "savings_target",
];

const BUDGET_MODE_OPTIONS: { value: BudgetPlanMode; label: string }[] = [
  { value: "active_savings", label: "Actief sparen" },
  { value: "balanced", label: "Gebalanceerd" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_INCLUDE_INCOME: BudgetIncomeInclusionSettings = {
  salary: true,
  childBudget: true,
  structuralOther: false,
  variable: false,
};

const INCOME_SOURCE_OPTIONS: {
  key: keyof BudgetIncomeInclusionSettings;
  label: string;
}[] = [
  { key: "salary", label: "Salaris" },
  { key: "childBudget", label: "Kindgebonden budget" },
  { key: "structuralOther", label: "Overige structurele inkomsten" },
  { key: "variable", label: "Variabele/eenmalige inkomsten" },
];

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthBounds(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);

  return {
    start,
    end,
    startIso: toLocalIsoDate(start),
    endIso: toLocalIsoDate(end),
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
  };
}

function parseBudgetAmountInput(value: string): number | null {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(parsed, 0);
}

function formatUtilization(value: number) {
  if (!Number.isFinite(value)) return ">100%";
  return `${Math.round(value * 100)}%`;
}

function formatBudgetModeLabel(mode: BudgetPlanMode) {
  if (mode === "active_savings") return "Actief sparen";
  if (mode === "balanced") return "Gebalanceerd";
  return "Custom";
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;

  return message.includes("relation") && message.includes("does not exist");
}

export default function BudgetScreen() {
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [budgetCoachLoading, setBudgetCoachLoading] = React.useState(false);
  const [budgetEditOpen, setBudgetEditOpen] = React.useState(false);
  const [savingBudgetEdit, setSavingBudgetEdit] = React.useState(false);
  const [budgetModeDraft, setBudgetModeDraft] =
    React.useState<BudgetPlanMode>("active_savings");
  const [budgetFactorDraft, setBudgetFactorDraft] = React.useState("0.90");
  const [budgetIncomeDraft, setBudgetIncomeDraft] =
    React.useState<BudgetIncomeInclusionSettings>(DEFAULT_INCLUDE_INCOME);
  const [budgetDraftValues, setBudgetDraftValues] = React.useState<
    Partial<Record<BudgetCategoryKey, string>>
  >({});

  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();
  const budgetLoadInFlight = React.useRef(false);

  const selectedMonth = React.useMemo(
    () => getMonthBounds(monthOffset),
    [monthOffset],
  );

  const recommendationRows = React.useMemo(() => {
    if (!budgetPlan) return [];
    return budgetPlan.recommendations.filter(
      (row) => row.categoryKey !== "savings_target",
    );
  }, [budgetPlan]);

  const topUtilizationRows = React.useMemo(() => {
    return [...recommendationRows]
      .sort((left, right) => right.utilization - left.utilization)
      .slice(0, 3);
  }, [recommendationRows]);

  const editableBudgetRows = React.useMemo(() => {
    if (!budgetPlan) return [];
    const byKey = new Map(
      budgetPlan.recommendations.map((row) => [row.categoryKey, row]),
    );

    return BUDGET_EDIT_ORDER.map((key) => byKey.get(key)).filter(
      (row): row is BudgetPlanComputation["recommendations"][number] =>
        Boolean(row),
    );
  }, [budgetPlan]);

  const warningSummary = React.useMemo(() => {
    const summary = {
      critical: 0,
      warning: 0,
      info: 0,
    };

    for (const warning of budgetPlan?.warnings || []) {
      if (warning.severity === "critical") summary.critical += 1;
      else if (warning.severity === "warning") summary.warning += 1;
      else summary.info += 1;
    }

    return summary;
  }, [budgetPlan?.warnings]);

  const remainingBudget = React.useMemo(() => {
    if (!budgetPlan) return null;
    return budgetPlan.monthlyBudgetTotal - budgetPlan.monthToDateExpenses.total;
  }, [budgetPlan]);

  const budgetProgress = React.useMemo(() => {
    if (!budgetPlan || budgetPlan.monthlyBudgetTotal <= 0) return 0;
    return Math.min(
      1,
      Math.max(
        0,
        budgetPlan.monthToDateExpenses.total / budgetPlan.monthlyBudgetTotal,
      ),
    );
  }, [budgetPlan]);

  const loadBudgetPlan = React.useCallback(async () => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      setBudgetCoachLoading(false);
      return;
    }
    if (budgetLoadInFlight.current) {
      return;
    }

    budgetLoadInFlight.current = true;

    try {
      const referenceDate = new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
      const computed = await computeBudgetPlan(referenceDate, "default");
      setBudgetPlan(computed);

      setBudgetCoachLoading(true);
      try {
        const liveCoachReport = await generateBudgetCoachReport(computed);
        setBudgetPlan((current) => {
          if (!current) return current;
          if (
            current.planKey !== computed.planKey ||
            current.referenceDate !== computed.referenceDate ||
            current.monthStart !== computed.monthStart
          ) {
            return current;
          }

          return {
            ...current,
            coachReport: liveCoachReport,
          };
        });
      } finally {
        setBudgetCoachLoading(false);
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        setBudgetSchemaMissing(true);
        setBudgetPlan(null);
        setBudgetCoachLoading(false);
        return;
      }

      console.error("[budget] load error", error);
      setBudgetPlan(null);
      setBudgetCoachLoading(false);
    } finally {
      budgetLoadInFlight.current = false;
    }
  }, [budgetSchemaMissing, selectedMonth.endIso]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadBudgetPlan();
  }, [isFocused, loadBudgetPlan]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadBudgetPlan();
  }, [backgroundStatus.lastCompletedAt, isFocused, loadBudgetPlan]);

  const openBudgetEdit = React.useCallback(() => {
    if (!budgetPlan) return;

    setBudgetModeDraft(budgetPlan.settings.mode);
    setBudgetFactorDraft(budgetPlan.settings.adjustmentFactor.toFixed(2));
    setBudgetIncomeDraft({
      salary: budgetPlan.settings.includeIncome.salary,
      childBudget: budgetPlan.settings.includeIncome.childBudget,
      structuralOther: budgetPlan.settings.includeIncome.structuralOther,
      variable: budgetPlan.settings.includeIncome.variable,
    });

    const nextDraft: Partial<Record<BudgetCategoryKey, string>> = {};
    for (const row of budgetPlan.recommendations) {
      nextDraft[row.categoryKey] = row.monthlyBudget.toFixed(2);
    }

    setBudgetDraftValues(nextDraft);
    setBudgetEditOpen(true);
  }, [budgetPlan]);

  const saveBudgetEdit = React.useCallback(async () => {
    if (!budgetPlan) return;

    setSavingBudgetEdit(true);
    setBudgetEditOpen(false);
    try {
      const parsedFactor = parseBudgetAmountInput(budgetFactorDraft);
      const safeFactor = Math.max(
        0.01,
        Math.min(1.5, parsedFactor ?? budgetPlan.settings.adjustmentFactor),
      );

      await upsertBudgetPlanSettings({
        planKey: "default",
        mode: budgetModeDraft,
        adjustmentFactor: safeFactor,
        includeIncome: budgetIncomeDraft,
      });

      const updates: Promise<unknown>[] = [];
      for (const row of editableBudgetRows) {
        const rawValue = budgetDraftValues[row.categoryKey];
        const parsed = parseBudgetAmountInput(rawValue || "");
        if (parsed == null) continue;

        updates.push(
          upsertMonthlyBudgetValue({
            planKey: "default",
            monthStartIso: selectedMonth.startIso,
            categoryKey: row.categoryKey,
            monthlyBudget: parsed,
            source: "manual",
          }),
        );
      }

      if (updates.length) {
        await Promise.all(updates);
      }

      const forecastReferenceDate = new Date(
        `${selectedMonth.endIso}T12:00:00.000Z`,
      );
      forecastReferenceDate.setUTCDate(forecastReferenceDate.getUTCDate() - 1);
      await recomputeCurrentMonthCashflowForecast(forecastReferenceDate).catch(
        (error) => {
          console.warn("[budget] forecast recompute after save failed", error);
        },
      );

      await loadBudgetPlan();
    } catch (error) {
      console.error("[budget] save error", error);
    } finally {
      setSavingBudgetEdit(false);
    }
  }, [
    budgetDraftValues,
    budgetFactorDraft,
    budgetIncomeDraft,
    budgetModeDraft,
    budgetPlan,
    editableBudgetRows,
    loadBudgetPlan,
    selectedMonth.endIso,
    selectedMonth.startIso,
  ]);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Budget</Text>
        <View style={styles.topActions}>
          <View style={styles.monthBadge}>
            <Pressable
              style={[
                styles.monthNavButton,
                monthOffset >= 24 && styles.monthNavButtonDisabled,
              ]}
              onPress={() =>
                setMonthOffset((current) => Math.min(current + 1, 24))
              }
              disabled={monthOffset >= 24}
            >
              <Text style={styles.monthNavButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.monthBadgeText}>{selectedMonth.label}</Text>
            <Pressable
              style={[
                styles.monthNavButton,
                monthOffset === 0 && styles.monthNavButtonDisabled,
              ]}
              onPress={() =>
                setMonthOffset((current) => Math.max(current - 1, 0))
              }
              disabled={monthOffset === 0}
            >
              <Text style={styles.monthNavButtonText}>›</Text>
            </Pressable>
          </View>
          <HeaderDropdownMenu />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {budgetPlan ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Huidige stand</Text>
              <Text
                style={[
                  styles.heroAmount,
                  remainingBudget != null && remainingBudget >= 0
                    ? styles.heroPositive
                    : styles.heroNegative,
                ]}
              >
                {remainingBudget == null
                  ? "Onbekend"
                  : fmt.format(remainingBudget)}
              </Text>
              <Text style={styles.heroSubLabel}>
                Resterend budget deze maand
              </Text>
              <View style={styles.heroProgressTrack}>
                <View
                  style={[
                    styles.heroProgressFill,
                    { width: `${Math.round(budgetProgress * 100)}%` },
                    budgetProgress >= 1 && styles.heroProgressFillCritical,
                  ]}
                />
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Weekbudget</Text>
                <Text style={styles.statValue}>
                  {fmt.format(budgetPlan.weeklyBudgetTotal)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Aanbevolen sparen</Text>
                <Text style={[styles.statValue, styles.statPositive]}>
                  {fmt.format(budgetPlan.recommendedSavings)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Mode</Text>
                <Text style={styles.statValue}>
                  {formatBudgetModeLabel(budgetPlan.settings.mode)}
                </Text>
              </View>
            </View>

            <Pressable style={styles.editButton} onPress={openBudgetEdit}>
              <Text style={styles.editButtonText}>Budget aanpassen</Text>
            </Pressable>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top categorie-utilisatie</Text>
              {topUtilizationRows.map((row) => (
                <View key={row.categoryKey} style={styles.rowWrap}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValue}>
                      {formatUtilization(row.utilization)}
                    </Text>
                  </View>
                  <Text style={styles.rowSub}>
                    {fmt.format(row.monthlyActual)} van{" "}
                    {fmt.format(row.monthlyBudget)}
                  </Text>
                  <View style={styles.utilTrack}>
                    <View
                      style={[
                        styles.utilFill,
                        {
                          width: `${Math.min(100, Math.round((Number.isFinite(row.utilization) ? row.utilization : 1.3) * 100))}%`,
                        },
                        (!Number.isFinite(row.utilization) ||
                          row.utilization >= 1.1) &&
                          styles.utilFillWarning,
                        row.utilization >= 1.25 && styles.utilFillCritical,
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Waarschuwingen</Text>
              <View style={styles.pillRow}>
                {warningSummary.critical > 0 ? (
                  <View
                    style={[styles.warningPill, styles.warningPillCritical]}
                  >
                    <Text style={styles.warningPillText}>
                      Critical {warningSummary.critical}
                    </Text>
                  </View>
                ) : null}
                {warningSummary.warning > 0 ? (
                  <View style={[styles.warningPill, styles.warningPillWarning]}>
                    <Text style={styles.warningPillText}>
                      Warning {warningSummary.warning}
                    </Text>
                  </View>
                ) : null}
                {warningSummary.info > 0 ? (
                  <View style={[styles.warningPill, styles.warningPillInfo]}>
                    <Text style={styles.warningPillText}>
                      Info {warningSummary.info}
                    </Text>
                  </View>
                ) : null}
              </View>
              {budgetPlan.warnings.slice(0, 5).map((warning, index) => (
                <View
                  key={`${warning.categoryKey}-${index}`}
                  style={styles.warningRow}
                >
                  <View
                    style={[
                      styles.warningDot,
                      warning.severity === "critical"
                        ? styles.warningDotCritical
                        : warning.severity === "warning"
                          ? styles.warningDotWarning
                          : styles.warningDotInfo,
                    ]}
                  />
                  <Text style={styles.warningText}>{warning.message}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Budget Coach</Text>
                <Pressable onPress={() => void loadBudgetPlan()}>
                  <Text style={styles.refreshText}>Vernieuwen</Text>
                </Pressable>
              </View>
              <Text style={styles.coachMetaText}>
                {budgetCoachLoading ? "Live advies ophalen..." : "Live advies"}
              </Text>
              <Text style={styles.coachSummary}>
                {budgetPlan.coachReport.sections.summary}
              </Text>

              {budgetPlan.coachReport.sections.actions.map((item, index) => (
                <Text key={`action-${index}`} style={styles.coachListItem}>
                  - {item}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Budget</Text>
            <Text style={styles.emptyStateText}>
              {budgetSchemaMissing
                ? "Budgetschema nog niet beschikbaar in deze omgeving."
                : `Nog geen budgetplan beschikbaar voor ${selectedMonth.label}.`}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={budgetEditOpen}
        onRequestClose={() => setBudgetEditOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Budgetbeheer</Text>
              <Pressable
                style={styles.modalIconCloseButton}
                onPress={() => setBudgetEditOpen(false)}
              >
                <MaterialIcons
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Instellingen voor {selectedMonth.label}
            </Text>

            <Text style={styles.modalSectionTitle}>Budgetmodus</Text>
            <View style={styles.modeRow}>
              {BUDGET_MODE_OPTIONS.map((option) => {
                const selected = budgetModeDraft === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.modeButton,
                      selected && styles.modeButtonActive,
                    ]}
                    onPress={() => setBudgetModeDraft(option.value)}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        selected && styles.modeButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.modalSectionTitle}>Besparingsfactor</Text>
            <TextInput
              value={budgetFactorDraft}
              onChangeText={setBudgetFactorDraft}
              placeholder="0.90"
              placeholderTextColor={FinColors.textMuted}
              style={styles.factorInput}
              keyboardType="decimal-pad"
            />

            <Text style={styles.modalSectionTitle}>Inkomstenbasis</Text>
            <Text style={styles.modalHintText}>
              Selecteer welke inkomsten meetellen voor budget en cashflow voorspelling.
            </Text>
            <View style={styles.incomeOptionsWrap}>
              {INCOME_SOURCE_OPTIONS.map((option) => {
                const selected = budgetIncomeDraft[option.key];
                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.incomeOptionButton,
                      selected && styles.incomeOptionButtonActive,
                    ]}
                    onPress={() =>
                      setBudgetIncomeDraft((current) => ({
                        ...current,
                        [option.key]: !current[option.key],
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.incomeOptionText,
                        selected && styles.incomeOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.modalSectionTitle}>
              Maandbudget per categorie
            </Text>
            <ScrollView style={styles.editList}>
              {editableBudgetRows.map((row) => (
                <View key={row.categoryKey} style={styles.editRow}>
                  <View style={styles.editRowMain}>
                    <Text style={styles.editRowLabel}>{row.label}</Text>
                    <Text style={styles.editRowMeta}>
                      Actueel: {fmt.format(row.monthlyActual)}
                    </Text>
                  </View>
                  <TextInput
                    value={
                      budgetDraftValues[row.categoryKey] ??
                      row.monthlyBudget.toFixed(2)
                    }
                    onChangeText={(text) =>
                      setBudgetDraftValues((current) => ({
                        ...current,
                        [row.categoryKey]: text,
                      }))
                    }
                    style={styles.editInput}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => setBudgetEditOpen(false)}
                disabled={savingBudgetEdit}
              >
                <Text style={styles.modalCancelText}>Annuleren</Text>
              </Pressable>
              <Pressable
                style={[styles.modalActionButton, styles.modalSaveButton]}
                onPress={() => {
                  void saveBudgetEdit();
                }}
                disabled={savingBudgetEdit}
              >
                <Text style={styles.modalSaveText}>
                  {savingBudgetEdit ? "Opslaan..." : "Opslaan"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  monthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
  },
  monthBadgeText: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
    textTransform: "capitalize",
    minWidth: 90,
    textAlign: "center",
  },
  monthNavButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
  },
  monthNavButtonDisabled: {
    opacity: 0.35,
  },
  monthNavButtonText: {
    fontSize: 16,
    color: FinColors.textPrimary,
    fontWeight: "700",
    lineHeight: 19,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 14,
  },
  heroCard: {
    marginTop: 8,
    backgroundColor: FinColors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 20,
  },
  heroLabel: {
    fontSize: 13,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  heroAmount: {
    marginTop: 6,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroPositive: {
    color: FinColors.green,
  },
  heroNegative: {
    color: FinColors.red,
  },
  heroSubLabel: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  heroProgressTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  heroProgressFill: {
    height: "100%",
    backgroundColor: FinColors.green,
  },
  heroProgressFillCritical: {
    backgroundColor: FinColors.red,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    marginTop: 6,
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  statPositive: {
    color: FinColors.green,
  },
  editButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    paddingVertical: 12,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 13,
    color: FinColors.green,
    fontWeight: "700",
  },
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshText: {
    color: FinColors.green,
    fontSize: 12,
    fontWeight: "700",
  },
  rowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingBottom: 10,
    marginBottom: 4,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  rowValue: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  rowSub: {
    marginTop: 3,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  utilTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  utilFill: {
    height: "100%",
    backgroundColor: FinColors.green,
  },
  utilFillWarning: {
    backgroundColor: "#f5a55a",
  },
  utilFillCritical: {
    backgroundColor: FinColors.red,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  warningPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  warningPillInfo: {
    backgroundColor: "#fdf6de",
    borderColor: "#d9b95b",
  },
  warningPillWarning: {
    backgroundColor: "#fff1e6",
    borderColor: "#f5a55a",
  },
  warningPillCritical: {
    backgroundColor: "#ffebeb",
    borderColor: FinColors.red,
  },
  warningPillText: {
    color: FinColors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  warningDotInfo: {
    backgroundColor: "#d9b95b",
  },
  warningDotWarning: {
    backgroundColor: "#f5a55a",
  },
  warningDotCritical: {
    backgroundColor: FinColors.red,
  },
  warningText: {
    flex: 1,
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  coachMetaText: {
    color: FinColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  coachSummary: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  coachListItem: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    maxHeight: "85%",
    borderRadius: 16,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalIconCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  modalSectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  modeButtonText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: FinColors.green,
  },
  factorInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    color: FinColors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  modalHintText: {
    marginTop: -2,
    marginBottom: 8,
    color: FinColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  incomeOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  incomeOptionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  incomeOptionButtonActive: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  incomeOptionText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  incomeOptionTextActive: {
    color: FinColors.green,
  },
  editList: {
    maxHeight: 260,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  editRowMain: {
    flex: 1,
  },
  editRowLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  editRowMeta: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  editInput: {
    minWidth: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    color: FinColors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlign: "right",
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  modalCancelText: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  modalSaveButton: {
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  modalSaveText: {
    color: FinColors.green,
    fontSize: 14,
    fontWeight: "700",
  },
});
