import { BudgetAmountSlider } from "@/components/budget-amount-slider";
import { BudgetCategoryProgressRow } from "@/components/budget-category-progress-row";
import {
  BudgetMonthBreakdownCard,
  type BudgetMonthBreakdownRow,
} from "@/components/budget-month-breakdown-card";
import {
  BudgetWeekBreakdownModal,
  type BudgetWeekBreakdownRow,
} from "@/components/budget-week-breakdown-modal";
import {
  BudgetPressureList,
  type BudgetPressureItem,
} from "@/components/budget-pressure-list";
import { BudgetMonthSummaryCard } from "@/components/budget-month-summary-card";
import { BudgetWeekRhythmCard } from "@/components/budget-week-rhythm-card";
import { BudgetMonthActionCard } from "@/components/budget/budget-month-action-card";
import { SmartBudgetSetupEntryCard } from "@/components/budget/smart-budget-setup-entry-card";
import { TransactionCategoryIcon } from "@/components/category-icon";
import { RiskProgressBar } from "@/components/risk-progress-bar";
import {
  FinColors,
  FinSpacing,
  FinSurfaces,
  FinTypography,
} from "@/constants/theme";
import { FinanceHeaderActions } from "@/components/ui/finance-header-actions";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceSettingsRow } from "@/components/ui/finance-settings-row";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceMonthSelector } from "@/components/ui/finance-month-selector";
import { FinanceMonthSelectorModal } from "@/components/ui/finance-month-selector-modal";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceBudgetProgressBar } from "@/components/ui/finance-budget-progress-bar";
import { FinanceStatusChip } from "@/components/ui/finance-status-chip";
import { MainPageSpacing } from "@/components/ui/main-page-spacing";
import { FinanceScopeSwitch } from "@/components/ui/finance-scope-switch";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import {
  resolveAvailableMoneyViewScopes,
  type MoneyViewScope,
} from "@/services/finance-scope";
import {
  resolveLockedVariableMainCategories,
  shouldPersistCategoryOnBudgetSave,
} from "@/services/budget-lock-utils";
import {
  resolveIncludedIncomePreview,
} from "@/services/budget-plan";
import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
import {
  getBudgetCategoryDisplayLabel,
  VARIABLE_BUDGET_BREAKDOWN_KEYS,
  type VariableBudgetCategoryKey,
} from "@/services/budget-week-attention";
import {
  getBudgetRiskLabel,
  getBudgetRiskProgress,
  getBudgetRiskTone,
  getMonthVariableBudgetUsageText,
  getMonthVariableBudgetSnapshot,
  getWeekBudgetSnapshot,
  type BudgetRiskTone,
} from "@/services/budget-risk";
import {
  getTransactionCategories,
  setTransactionBudgetExcluded,
} from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import {
  loadMoneyViewScopePreference,
  upsertMoneyViewScopePreference,
} from "@/services/finance-scope-preference";
import { markForecastDirty } from "@/services/forecast-refresh";
import { listBankAccountsForUser } from "@/services/bank-accounts";
import {
  listAnnualObligationReserveRules,
  setAnnualObligationReserveRuleStatus,
  upsertAnnualObligationReserveRule,
  type AnnualObligationReserveRule,
} from "@/services/reserve-rules";
import { listTransactionSubscriptionProfileNames } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import {
  getCurrentMonthKey,
  getMonthOptionByKey,
  listTransactionMonthOptions,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import {
  resetMonthlyBudgetValues,
  upsertBudgetPlanSettings,
  upsertMonthlyBudgetValue,
} from "@/services/budget-plan-repository";
import {
  formatForecastExpenseSourceLabel,
  getForecastExpenseSourceDescription,
} from "@/services/forecast-expense-source-display";
import {
  buildAnnualReserveSheetSummary,
  getBudgetInclusionTogglePresentation,
} from "@/services/ui-formatters/labels";
import { resolveSafetyContextCopy } from "@/services/financial-surface-semantics";
import type { ForecastSurfaceSummary } from "@/services/budget-plan-surface";
import type {
  BudgetCategoryKey,
  BudgetForecastExpenseSource,
  BudgetIncomeInclusionSettings,
  BudgetOutsideExpenseItem,
  BudgetPlanComputation,
  BudgetPlanMode,
  BudgetRecommendationRow,
  BudgetWeekPlanRow,
  CategoryRecord,
} from "@/types/categorization";
import { AppIcon } from "@/components/ui/app-icon";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const SEGMENTS = [
  { key: "new", label: "Nieuw" },
  { key: "month", label: "Maand" },
  { key: "manage", label: "Beheer" },
] as const;

const BUDGET_EDIT_ORDER: BudgetCategoryKey[] = [
  "fixed_costs",
  "subscriptions",
  "variable_costs",
  "groceries",
  "fuel",
  "smoking",
  "other",
];

const BUDGET_MODE_OPTIONS: { value: BudgetPlanMode; label: string }[] = [
  { value: "active_savings", label: "Actief sparen" },
  { value: "balanced", label: "Gebalanceerd" },
  { value: "custom", label: "Aangepast" },
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
  { key: "structuralOther", label: "Overig structureel" },
  { key: "variable", label: "Variabel" },
];

const SAVINGS_SLIDER_STEP = 25;
const FUTURE_BUDGET_MONTH_COUNT = 6;
const CONTENT_MAX_WIDTH = 1040;

type SegmentKey = (typeof SEGMENTS)[number]["key"];
type BudgetDraftValues = Partial<Record<BudgetCategoryKey, string>>;
type InlineWeekTransaction = {
  id: string;
  date: string;
  title: string;
  counterparty: string | null;
  subscriptionProfileName?: string | null;
  amount: number;
  budgetExcluded: boolean;
  category_id_auto: string | null;
  category_id_user: string | null;
};
type BudgetInlineTransactionRowProps = {
  tx: InlineWeekTransaction;
  categoryById: Map<string, CategoryRecord>;
  overlapLabel?: string | null;
  onOpen: () => void;
  onToggle?: () => void;
  isUpdating?: boolean;
};

function BudgetInlineTransactionRow({
  tx,
  categoryById,
  overlapLabel,
  onOpen,
  onToggle,
  isUpdating = false,
}: BudgetInlineTransactionRowProps) {
  const inclusion = getBudgetInclusionTogglePresentation(tx.budgetExcluded);
  const categoryLabel = getCategoryPathLabel(tx, categoryById);
  const metaParts = [formatDetailDateLabel(tx.date)];
  if (tx.counterparty) {
    metaParts.push(tx.counterparty);
  }

  return (
    <View style={styles.inlineTransactionRow}>
      <Pressable style={styles.inlineTransactionMainPressable} onPress={onOpen}>
        <View style={styles.inlineTransactionLeading}>
          <TransactionCategoryIcon
            row={tx}
            categoryById={categoryById}
            size={16}
            bubbleSize={34}
          />
          <View style={styles.inlineTransactionContent}>
            <Text style={styles.inlineTransactionTitle}>
              {tx.subscriptionProfileName || tx.title}
            </Text>
            <View style={styles.inlineTransactionCategoryRow}>
              <Text style={styles.inlineTransactionCategory}>{categoryLabel}</Text>
              {overlapLabel ? (
                <View style={styles.inlineOverlapChip}>
                  <Text style={styles.inlineOverlapChipText}>{overlapLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.inlineTransactionsMeta}>
              {metaParts.join(" · ")}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.inlineTransactionRight}>
        <Text style={styles.inlineTransactionAmount}>
          {fmt.format(Math.abs(tx.amount))}
        </Text>
        {onToggle ? (
          <Pressable
            style={[
              styles.inlineExcludeToggle,
              tx.budgetExcluded && styles.inlineExcludeToggleActive,
            ]}
            onPress={onToggle}
            disabled={isUpdating}
          >
            <View style={styles.inlineExcludeToggleInner}>
              <AppIcon
                name={inclusion.iconName}
                size={12}
                color={inclusion.tone === "excluded" ? FinColors.warningText : FinColors.green}
              />
              <Text
                style={[
                  styles.inlineExcludeToggleText,
                  tx.budgetExcluded && styles.inlineExcludeToggleTextActive,
                ]}
              >
                {inclusion.label}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function roundToStepCeil(value: number, step: number) {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
}

function sanitizeNonNegativeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sanitizeBudgetAmountDraft(value: string) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizeBudgetAmount(value: number, fallback = 0) {
  if (!Number.isFinite(value)) return Math.max(Math.round(fallback), 0);
  return Math.max(Math.round(value), 0);
}

function parseBudgetAmountDraft(
  value: string | null | undefined,
  fallback = 0,
) {
  const normalized = sanitizeBudgetAmountDraft(String(value || ""));
  if (!normalized) return normalizeBudgetAmount(fallback);

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return normalizeBudgetAmount(fallback);
  return normalizeBudgetAmount(parsed, fallback);
}

function parseBudgetAmountInput(value: string): number | null {
  const normalized = sanitizeBudgetAmountDraft(value);
  if (!normalized) return null;
  return parseBudgetAmountDraft(normalized, 0);
}

function formatBudgetAmountDraft(value: number) {
  return String(normalizeBudgetAmount(value));
}

function normalizeLookupValue(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTransactionTitle(details: string) {
  const value = String(details || "");
  const subject = value.split("|")[0]?.trim() || value.trim();
  return subject || "Onbekende omschrijving";
}

function getWeekSubcategoryCacheKey(
  weekNumber: number,
  mainCategoryKey: string,
  subcategoryKey: string,
) {
  return `${weekNumber}:${mainCategoryKey}:${subcategoryKey}`;
}

function formatWeekRangeLabel(week: BudgetWeekPlanRow) {
  const start = new Date(`${week.startDate}T00:00:00.000Z`);
  const end = new Date(`${week.endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return week.label;
  }

  end.setUTCDate(end.getUTCDate() - 1);
  const startLabel = start.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
  return `${startLabel} - ${endLabel}`;
}

function formatBudgetMonthYear(monthStartIso: string) {
  const parsed = new Date(`${String(monthStartIso || "").slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return String(monthStartIso || "");
  return parsed.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });
}

function getMonthOverlapLabel(
  txDateIso: string,
  monthStartIso: string | null | undefined,
) {
  if (!txDateIso || !monthStartIso) return null;

  const txDate = new Date(`${txDateIso}T00:00:00.000Z`);
  const monthStart = new Date(`${monthStartIso}T00:00:00.000Z`);
  if (Number.isNaN(txDate.getTime()) || Number.isNaN(monthStart.getTime())) {
    return null;
  }

  const nextMonthStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
  );

  if (txDate < monthStart) return "Vorige maand";
  if (txDate >= nextMonthStart) return "Volgende maand";
  return null;
}

function getIsoWeekNumberFromStartDate(startDateIso: string) {
  const date = new Date(`${startDateIso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const dayOfYear =
    Math.floor((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

function formatBudgetWeekLabel(week: BudgetWeekPlanRow) {
  const isoWeekNumber = getIsoWeekNumberFromStartDate(week.startDate);
  if (isoWeekNumber == null) return week.label;
  return `Week ${isoWeekNumber} (${week.weekNumber})`;
}

function formatDetailDateLabel(value: string | null) {
  if (!value) return "onbekend";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "onbekend";
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

function isVariableBreakdownKey(categoryKey: BudgetCategoryKey) {
  return VARIABLE_BUDGET_BREAKDOWN_KEYS.includes(categoryKey);
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getBudgetModeDescription(mode: BudgetPlanMode) {
  if (mode === "active_savings") {
    return "Automatisch een ambitieuzer spaardoel met minder vrije variabele ruimte.";
  }
  if (mode === "balanced") {
    return "Meer rust en buffer, met een gematigd automatisch spaardoel.";
  }
  return "Je kiest zelf hoeveel je deze maand wilt overhouden. Werkt in stappen van 25 euro.";
}

function getAutomaticModePreviewMeta(
  mode: Exclude<BudgetPlanMode, "custom">,
  isCurrentMode: boolean,
) {
  if (isCurrentMode) {
    return mode === "active_savings"
      ? "Dit is het automatische spaardoel dat nu wordt gebruikt."
      : "Dit is het gebalanceerde doel dat nu wordt gebruikt.";
  }

  return mode === "active_savings"
    ? "Na opslaan wordt een ambitieuzer automatisch doel voor deze maand gebruikt."
    : "Na opslaan wordt een rustiger automatisch doel voor deze maand gebruikt.";
}

function formatBudgetSourceLabel(
  source: BudgetPlanComputation["recommendations"][number]["overrideSource"],
) {
  if (source === "monthly_override") return "zelf gekozen";
  if (source === "category_override") return "bijgestuurd";
  if (source === "settings") return "ingesteld";
  if (source === "trend_lock") return "vastgezet";
  return "volgt trend";
}

function getIncludedIncomePreview(
  plan: BudgetPlanComputation | null,
  includeIncome: BudgetIncomeInclusionSettings,
) {
  if (!plan) return 0;
  return normalizeBudgetAmount(
    resolveIncludedIncomePreview(plan.trend.income, {
      ...plan.settings,
      includeIncome: {
        ...plan.settings.includeIncome,
        ...includeIncome,
      },
    }).total,
  );
}

function getRiskStyle(tone: BudgetRiskTone) {
  if (tone === "good") {
    return {
      chip: styles.statusChipGood,
      text: styles.statusChipTextGood,
    };
  }
  if (tone === "watch") {
    return {
      chip: styles.statusChipWatch,
      text: styles.statusChipTextWatch,
    };
  }
  return {
    chip: tone === "critical" ? styles.statusChipCritical : null,
    text: tone === "critical" ? styles.statusChipTextCritical : null,
  };
}

function getRiskStatusTone(
  tone: BudgetRiskTone,
): "good" | "watch" | "critical" | "neutral" {
  if (tone === "good") return "good";
  if (tone === "watch") return "watch";
  if (tone === "critical") return "critical";
  return "neutral";
}

function getVariableCategoryIconName(categoryKey: string) {
  if (categoryKey === "groceries") return "shopping-basket";
  if (categoryKey === "fuel") return "local-gas-station";
  if (categoryKey === "smoking") return "smoking-rooms";
  return "more-horiz";
}

function resolveVariableCategoryKeyForCategoryRecord(
  categoryId: string | null | undefined,
  categoryById: Map<string, CategoryRecord>,
): VariableBudgetCategoryKey | null {
  const categoryChain: CategoryRecord[] = [];
  let current = categoryId ? categoryById.get(categoryId) || null : null;
  const visited = new Set<string>();
  let sawVariableCategory = false;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    categoryChain.push(current);

    const key = String(current.key || "").toLowerCase().trim();
    const budgetGroup = String(current.budget_group || "")
      .toLowerCase()
      .trim();

    if (budgetGroup === "subscriptions") {
      return null;
    }
    if (
      budgetGroup === "savings" ||
      key === "savings" ||
      key === "savings_transfer" ||
      key.startsWith("savings_")
    ) {
      return null;
    }
    if (budgetGroup === "fixed") {
      return null;
    }
    if (key.includes("groceries") || key.includes("supermarket")) {
      return "groceries";
    }
    if (key.includes("fuel")) {
      return "fuel";
    }
    if (key.includes("smoking")) {
      return "smoking";
    }
    if (
      budgetGroup === "variable" ||
      key === "variable_costs" ||
      key.startsWith("shopping") ||
      key.startsWith("care") ||
      key.startsWith("health")
    ) {
      sawVariableCategory = true;
    }

    current = current.parent_id ? categoryById.get(current.parent_id) || null : null;
  }

  if (sawVariableCategory || categoryChain.length > 0) {
    return "other";
  }

  return null;
}

function resolveVariableCategoryKeyForTransaction(
  row: Pick<
    InlineWeekTransaction,
    "category_id_auto" | "category_id_user" | "title" | "counterparty"
  >,
  categoryById: Map<string, CategoryRecord>,
): VariableBudgetCategoryKey | null {
  const fromAssignedCategory = resolveVariableCategoryKeyForCategoryRecord(
    row.category_id_user || row.category_id_auto,
    categoryById,
  );
  if (fromAssignedCategory) return fromAssignedCategory;

  const haystack = normalizeLookupValue(
    `${row.counterparty || ""} ${row.title || ""}`,
  );
  if (
    haystack.includes("jumbo") ||
    haystack.includes("plus") ||
    haystack.includes("albert heijn") ||
    haystack.includes(" ah ") ||
    haystack.includes("lidl") ||
    haystack.includes("aldi") ||
    haystack.includes("coop") ||
    haystack.includes("boodschap")
  ) {
    return "groceries";
  }
  if (
    haystack.includes("shell") ||
    haystack.includes("bp") ||
    haystack.includes("esso") ||
    haystack.includes("tango") ||
    haystack.includes("tinq") ||
    haystack.includes("total") ||
    haystack.includes("benzine") ||
    haystack.includes("diesel") ||
    haystack.includes("tank")
  ) {
    return "fuel";
  }
  if (
    haystack.includes("tabak") ||
    haystack.includes("sigaret") ||
    haystack.includes("sigaretten") ||
    haystack.includes("rook") ||
    haystack.includes("vape")
  ) {
    return "smoking";
  }

  return null;
}

function getCategoryDetailRecommendation(
  row: BudgetRecommendationRow,
  monthTempoSummary?: {
    utilization: number;
    projectedVariance: number;
  } | null,
) {
  if (!Number.isFinite(row.utilization)) {
    return "Stel eerst een maandbudget in om deze categorie goed te kunnen sturen.";
  }

  const remaining = row.monthlyBudget - row.monthlyActual;
  if (row.utilization > 1) {
    return `${fmt.format(Math.abs(remaining))} boven je maandbudget. Deze categorie vraagt nu het eerst aandacht.`;
  }

  if ((monthTempoSummary?.utilization || 0) >= 1.1) {
    return `${fmt.format(Math.abs(monthTempoSummary?.projectedVariance || 0))} boven budget als dit tempo zo doorgaat.`;
  }

  if (row.utilization <= 0.85 && row.monthlyActual > 0) {
    return "Ligt rustiger dan verwacht. Als dit tempo zo blijft, houd je hier ruimte over.";
  }

  if ((monthTempoSummary?.projectedVariance || 0) <= -5) {
    return "Bij huidig tempo blijf je binnen budget voor deze maand.";
  }

  return "Ligt op schema binnen je maandruimte.";
}

function getCategoryMonthTempoSummary(row: BudgetRecommendationRow) {
  const progress = Math.min(Math.max(row.monthProgress || 0, 0), 1);
  const projectedMonthActual =
    progress > 0 ? Math.round(row.monthlyActual / progress) : row.monthlyActual;
  const utilization =
    row.monthlyBudget > 0
      ? projectedMonthActual / row.monthlyBudget
      : row.monthlyActual > 0
        ? Number.POSITIVE_INFINITY
        : 0;
  const projectedVariance = Math.round(projectedMonthActual - row.monthlyBudget);
  const progressLabel = `${Math.round(progress * 100)}% van de maand`;

  let message = "Bij huidig tempo blijf je ongeveer op je maandbudget uitkomen.";
  if (!Number.isFinite(utilization)) {
    message = "Tempo verschijnt zodra er een maandbudget voor deze categorie is.";
  } else if (projectedVariance >= 5) {
    message = `Bij huidig tempo kom je uit op ${fmt.format(projectedMonthActual)}, dat is ${fmt.format(Math.abs(projectedVariance))} boven budget.`;
  } else if (projectedVariance <= -5) {
    message = `Bij huidig tempo kom je uit op ${fmt.format(projectedMonthActual)}, dus houd je ongeveer ${fmt.format(Math.abs(projectedVariance))} over.`;
  }

  return {
    progress,
    progressLabel,
    projectedMonthActual,
    utilization,
    projectedVariance,
    tone: getBudgetRiskTone(utilization),
    statusLabel: getBudgetRiskLabel(utilization),
    message,
  };
}

function getCurrentWeek(plan: BudgetPlanComputation | null) {
  if (!plan) return null;
  return plan.weeklyVariablePlan.find((week) => week.isCurrentWeek) || null;
}

function getHistoricalWeeks(plan: BudgetPlanComputation | null) {
  if (!plan) return [] as BudgetWeekPlanRow[];
  return [...plan.weeklyVariablePlan].sort((left, right) =>
    left.startDate > right.startDate ? 1 : -1,
  );
}

function getCategoryRows(plan: BudgetPlanComputation | null) {
  if (!plan) return [] as BudgetRecommendationRow[];
  return plan.recommendations
    .filter(
      (row) =>
        row.categoryKey !== "fixed_costs" &&
        row.categoryKey !== "subscriptions" &&
        row.categoryKey !== "savings_target" &&
        row.categoryKey !== "variable_costs",
    )
    .sort((left, right) => right.utilization - left.utilization);
}

function getActionRecommendation(plan: BudgetPlanComputation | null) {
  if (!plan) return null;
  return plan.coachReport.sections.actions[0] || null;
}

function getPositiveLine(plan: BudgetPlanComputation | null) {
  if (!plan) return null;
  return plan.coachReport.sections.strengths[0] || null;
}

function getBudgetMonthSummaryStatusLabel(
  snapshot: ReturnType<typeof getMonthVariableBudgetSnapshot>,
) {
  if (snapshot.state === "no_data") return "Nog geen data";
  if (snapshot.state === "no_budget") return "Nog geen variabel budget";
  if (snapshot.tone === "good") return "Op koers";
  if (snapshot.tone === "watch") return "Let op";
  return "Onder druk";
}

function getBudgetWeekRhythmStatusLabel(
  snapshot: ReturnType<typeof getWeekBudgetSnapshot>,
) {
  if (snapshot.state === "no_data") return "Nog geen weekdata";
  if (snapshot.tone === "good") return "Op koers";
  if (snapshot.tone === "watch") return "Let op";
  if (snapshot.tone === "critical") return "Boven tempo";
  return "Nog geen weekdata";
}

function buildBudgetMonthBreakdownItems(
  plan: BudgetPlanComputation | null,
): BudgetMonthBreakdownRow[] {
  if (!plan) return [];

  return [
    {
      key: "income",
      label: "Inkomend",
      description: "deze maand",
      amount: Math.max(Math.round(plan.flowSummary.expectedIncomeMonthly), 0),
      icon: "account-balance-wallet",
    },
    {
      key: "fixed_costs",
      label: "Vaste lasten",
      description: "vast gepland",
      amount: Math.max(Math.round(plan.flowSummary.fixedCostsBudget), 0),
      icon: "home",
    },
    {
      key: "subscriptions",
      label: "Abonnementen",
      description: "terugkerende kosten",
      amount: Math.max(Math.round(plan.flowSummary.subscriptionsBudget), 0),
      icon: "subscriptions",
    },
    {
      key: "savings",
      label: "Sparen",
      description: "doel deze maand",
      amount: Math.max(Math.round(plan.flowSummary.appliedSavingsTarget), 0),
      icon: "savings",
    },
    {
      key: "variable",
      label: "Variabele ruimte",
      description: "vrij te besteden",
      amount: Math.max(Math.round(plan.flowSummary.variableBudget), 0),
      icon: "shopping-bag",
    },
  ];
}

function getBudgetPressureIconName(categoryKey: BudgetCategoryKey) {
  if (categoryKey === "fixed_costs") return "home" as const;
  if (categoryKey === "subscriptions") return "subscriptions" as const;
  if (categoryKey === "savings_target") return "savings" as const;
  return getVariableCategoryIconName(categoryKey);
}

function buildBudgetPressureItems(
  plan: BudgetPlanComputation | null,
): BudgetPressureItem[] {
  if (!plan) return [];

  const severityWeight: Record<"critical" | "warning", number> = {
    critical: 2,
    warning: 1,
  };

  const seenCategory = new Set<BudgetCategoryKey>();
  const mapped = plan.warnings
    .filter(
      (warning) =>
        warning.severity === "critical" || warning.severity === "warning",
    )
    .sort((left, right) => {
      const severityDiff =
        severityWeight[right.severity] - severityWeight[left.severity];
      if (severityDiff !== 0) return severityDiff;
      return right.utilization - left.utilization;
    })
    .filter((warning) => {
      if (seenCategory.has(warning.categoryKey)) return false;
      seenCategory.add(warning.categoryKey);
      return true;
    })
    .slice(0, 4);

  return mapped.map((warning) => {
    const label = getBudgetCategoryDisplayLabel(warning.categoryKey);
    const title =
      warning.utilization >= 1
        ? `${label} boven tempo`
        : warning.severity === "critical"
          ? `${label} onder druk`
          : `${label} loopt op`;

    return {
      id: `${warning.categoryKey}:${warning.severity}:${warning.message}`,
      title,
      description: warning.message,
      severity: warning.severity === "critical" ? "critical" : "watch",
      icon: getBudgetPressureIconName(warning.categoryKey),
    };
  });
}

export default function BudgetScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    month?: string | string[];
    segment?: string | string[];
    focusToken?: string | string[];
  }>();
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();
  const budgetLoadInFlight = React.useRef(false);
  const budgetPlanRef = React.useRef<BudgetPlanComputation | null>(null);
  const lastHydratedDraftKeyRef = React.useRef<string | null>(null);
  const lastAppliedRouteRequestRef = React.useRef<string | null>(null);
  const fallbackMonthOption = React.useMemo(
    () => getMonthOptionByKey(getCurrentMonthKey())!,
    [],
  );

  const [segment, setSegment] = React.useState<SegmentKey>("new");
  const [selectedMonthKey, setSelectedMonthKey] = React.useState(
    getCurrentMonthKey(),
  );
  const [monthOptions, setMonthOptions] = React.useState<TransactionMonthOption[]>(
    [fallbackMonthOption],
  );
  const [monthOptionsLoaded, setMonthOptionsLoaded] = React.useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = React.useState(false);
  const [moneyViewScope, setMoneyViewScope] = React.useState<MoneyViewScope>(
    "personal",
  );
  const [availableScopeOptions, setAvailableScopeOptions] = React.useState<
    readonly MoneyViewScope[]
  >(["personal"]);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [savingManage, setSavingManage] = React.useState(false);
  const [recalculatingBudget, setRecalculatingBudget] = React.useState(false);
  const [budgetModeDraft, setBudgetModeDraft] =
    React.useState<BudgetPlanMode>("active_savings");
  const [budgetIncomeDraft, setBudgetIncomeDraft] =
    React.useState<BudgetIncomeInclusionSettings>(DEFAULT_INCLUDE_INCOME);
  const [forecastExpenseSourceDraft, setForecastExpenseSourceDraft] =
    React.useState<BudgetForecastExpenseSource>("trend");
  const [savingsTargetMonthlyDraft, setSavingsTargetMonthlyDraft] =
    React.useState(0);
  const [budgetDraftValues, setBudgetDraftValues] =
    React.useState<BudgetDraftValues>({});
  const [lockedVariableCategories, setLockedVariableCategories] = React.useState<
    BudgetCategoryKey[]
  >([]);
  const [selectedWeekNumber, setSelectedWeekNumber] = React.useState<
    number | null
  >(null);
  const [expandedWeekMainCategories, setExpandedWeekMainCategories] =
    React.useState<string[]>([]);
  const [expandedWeekSubcategories, setExpandedWeekSubcategories] =
    React.useState<string[]>([]);
  const [inlineTransactionsBySubcategory, setInlineTransactionsBySubcategory] =
    React.useState<Record<string, InlineWeekTransaction[]>>({});
  const [inlineLoadingSubcategories, setInlineLoadingSubcategories] =
    React.useState<string[]>([]);
  const [inlineSubcategoryErrors, setInlineSubcategoryErrors] = React.useState<
    Record<string, string>
  >({});
  const [categoryIdsByKey, setCategoryIdsByKey] = React.useState<
    Record<string, string[]>
  >({});
  const [categoryRecords, setCategoryRecords] = React.useState<CategoryRecord[]>(
    [],
  );
  const [expandedOutsideBudgetItems, setExpandedOutsideBudgetItems] =
    React.useState<string[]>([]);
  const [outsideBudgetTransactionsByItem, setOutsideBudgetTransactionsByItem] =
    React.useState<Record<string, InlineWeekTransaction[]>>({});
  const [outsideBudgetLoadingItems, setOutsideBudgetLoadingItems] =
    React.useState<string[]>([]);
  const [outsideBudgetItemErrors, setOutsideBudgetItemErrors] = React.useState<
    Record<string, string>
  >({});
  const [selectedMonthCategoryKey, setSelectedMonthCategoryKey] =
    React.useState<VariableBudgetCategoryKey | null>(null);
  const [categoryDetailTransactionsByKey, setCategoryDetailTransactionsByKey] =
    React.useState<Record<string, InlineWeekTransaction[]>>({});
  const [categoryDetailLoadingKeys, setCategoryDetailLoadingKeys] =
    React.useState<string[]>([]);
  const [categoryDetailErrors, setCategoryDetailErrors] = React.useState<
    Record<string, string>
  >({});
  const [
    monthCategoryUpdatingTransactionIds,
    setMonthCategoryUpdatingTransactionIds,
  ] = React.useState<string[]>([]);
  const [expandedWeekSummaryCategories, setExpandedWeekSummaryCategories] =
    React.useState<string[]>([]);
  const [weekSummaryTransactionsByCategory, setWeekSummaryTransactionsByCategory] =
    React.useState<Record<string, InlineWeekTransaction[]>>({});
  const [weekSummaryLoadingCategories, setWeekSummaryLoadingCategories] =
    React.useState<string[]>([]);
  const [weekSummaryCategoryErrors, setWeekSummaryCategoryErrors] = React.useState<
    Record<string, string>
  >({});
  const [monthSummaryModalOpen, setMonthSummaryModalOpen] = React.useState(false);
  const [assistantForecastSurface, setAssistantForecastSurface] =
    React.useState<ForecastSurfaceSummary | null>(null);
  const [annualReserveRules, setAnnualReserveRules] = React.useState<
    AnnualObligationReserveRule[]
  >([]);
  const [reserveRulesSheetOpen, setReserveRulesSheetOpen] = React.useState(false);
  const [incomeSourcesSheetOpen, setIncomeSourcesSheetOpen] =
    React.useState(false);
  const [budgetDistributionSheetOpen, setBudgetDistributionSheetOpen] =
    React.useState(false);
  const [reserveRuleAmountDrafts, setReserveRuleAmountDrafts] = React.useState<
    Record<string, string>
  >({});
  const [manageCategoryBudgetsOpen, setManageCategoryBudgetsOpen] =
    React.useState(false);
  const [expandedMonthSummaryCategories, setExpandedMonthSummaryCategories] =
    React.useState<string[]>([]);
  const [detailSection, setDetailSection] = React.useState<
    "fixed_costs" | "subscriptions" | null
  >(null);
  const [outsideBudgetOpen, setOutsideBudgetOpen] = React.useState(false);
  const [pendingTransactionDetailId, setPendingTransactionDetailId] =
    React.useState<string | null>(null);

  const selectedMonth = React.useMemo(
    () =>
      monthOptions.find((option) => option.key === selectedMonthKey) ||
      getMonthOptionByKey(selectedMonthKey) ||
      monthOptions[0] ||
      fallbackMonthOption,
    [fallbackMonthOption, monthOptions, selectedMonthKey],
  );
  const selectedMonthIndex = React.useMemo(
    () => monthOptions.findIndex((option) => option.key === selectedMonth?.key),
    [monthOptions, selectedMonth?.key],
  );
  const canGoToOlderMonth =
    selectedMonthIndex >= 0 && selectedMonthIndex < monthOptions.length - 1;
  const canGoToNewerMonth = selectedMonthIndex > 0;
  const requestedRouteMonthKey = React.useMemo(() => {
    const raw = Array.isArray(routeParams.month)
      ? routeParams.month[0]
      : routeParams.month;
    return getMonthOptionByKey(raw || null)?.key || null;
  }, [routeParams.month]);
  const requestedRouteSegment = React.useMemo(() => {
    const raw = Array.isArray(routeParams.segment)
      ? routeParams.segment[0]
      : routeParams.segment;
    if (raw === "manage_new") {
      return "manage" as SegmentKey;
    }
    if (
      raw === "new" ||
      raw === "month" ||
      raw === "manage"
    ) {
      return raw as SegmentKey;
    }
    return null;
  }, [routeParams.segment]);
  const requestedRouteFocusToken = React.useMemo(() => {
    const raw = Array.isArray(routeParams.focusToken)
      ? routeParams.focusToken[0]
      : routeParams.focusToken;
    return raw ? String(raw) : null;
  }, [routeParams.focusToken]);

  const loadMonthOptions = React.useCallback(async () => {
    try {
      const options = await listTransactionMonthOptions({
        includeFutureMonths: FUTURE_BUDGET_MONTH_COUNT,
      });
      setMonthOptions(options);
    } catch (error) {
      console.warn("[budget] month options error", error);
      setMonthOptions([fallbackMonthOption]);
    } finally {
      setMonthOptionsLoaded(true);
    }
  }, [fallbackMonthOption]);

  const loadBudget = React.useCallback(async (
    scopeOverride?: import("@/services/finance-scope").MoneyViewScope,
  ) => {
    if (budgetLoadInFlight.current) return;
    if (!selectedMonth) return;

    if (budgetPlanRef.current == null) {
      setLoading(true);
    }
    budgetLoadInFlight.current = true;
    try {
      const userId = await requireCurrentUserId();
      const [preference, bankAccounts] = await Promise.all([
        scopeOverride
          ? Promise.resolve({ scopeView: scopeOverride })
          : loadMoneyViewScopePreference(userId).catch(() => ({
              scopeView: "personal" as const,
            })),
        listBankAccountsForUser(userId).catch(() => []),
      ]);
      const availableScopes = resolveAvailableMoneyViewScopes(
        bankAccounts,
        preference.scopeView,
      );
      const resolvedScope =
        availableScopes.includes(preference.scopeView)
          ? preference.scopeView
          : availableScopes[0] || preference.scopeView;
      setAvailableScopeOptions(availableScopes);
      setMoneyViewScope(resolvedScope);
      const reserveRules = await listAnnualObligationReserveRules({
        userId,
        scopeView: resolvedScope,
        includePaused: true,
      }).catch(() => [] as AnnualObligationReserveRule[]);
      setAnnualReserveRules(reserveRules);
      setReserveRuleAmountDrafts(
        Object.fromEntries(
          reserveRules.map((rule) => [rule.id, String(Math.round(rule.monthlyAmount || 0))]),
        ),
      );
      const referenceDate =
        selectedMonth.isCurrentMonth
          ? new Date()
          : new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      if (!selectedMonth.isCurrentMonth) {
        referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
      }

      const surface = await loadBudgetPlanForSurface({
        referenceDate,
        planKey: "default",
        timelineReference: new Date(),
        moneyViewScope: resolvedScope,
      });
      setBudgetPlan(surface.plan);
      setAssistantForecastSurface(surface);
    } catch (error) {
      console.warn("[budget] load error", error);
      setBudgetPlan(null);
      setAssistantForecastSurface(null);
    } finally {
      budgetLoadInFlight.current = false;
      setLoading(false);
    }
  }, [selectedMonth]);

  const handleScopeChange = React.useCallback(
    async (scope: import("@/services/finance-scope").MoneyViewScope) => {
      setMoneyViewScope(scope);
      await upsertMoneyViewScopePreference(scope).catch((error) => {
        console.warn("[budget] scope preference save error", error);
      });
      await loadBudget(scope);
    },
    [loadBudget],
  );

  const handleReserveRuleStatusChange = React.useCallback(
    async (ruleId: string, nextActive: boolean) => {
      await setAnnualObligationReserveRuleStatus({
        id: ruleId,
        status: nextActive ? "active" : "paused",
      }).catch((error) => {
        console.warn("[budget] reserve rule status update error", error);
      });
      await markForecastDirty("budget_save").catch(() => null);
      await loadBudget(moneyViewScope);
    },
    [loadBudget, moneyViewScope],
  );

  const handleReserveRuleAmountSave = React.useCallback(
    async (rule: AnnualObligationReserveRule) => {
      const draft = String(reserveRuleAmountDrafts[rule.id] || "").replace(/[^0-9]/g, "");
      const monthlyAmount = draft ? Number.parseInt(draft, 10) : 0;
      await upsertAnnualObligationReserveRule({
        id: rule.id,
        label: rule.label,
        scopeView: rule.scopeView,
        source: rule.source,
        status: rule.status,
        semanticTag: rule.semanticTag,
        annualAmount: monthlyAmount * 12,
        monthlyAmount,
        fingerprint: rule.fingerprint,
      }).catch((error) => {
        console.warn("[budget] reserve rule amount save error", error);
      });
      await markForecastDirty("budget_save").catch(() => null);
      await loadBudget(moneyViewScope);
    },
    [loadBudget, moneyViewScope, reserveRuleAmountDrafts],
  );

  React.useEffect(() => {
    budgetPlanRef.current = budgetPlan;
  }, [budgetPlan]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadMonthOptions();
  }, [isFocused, loadMonthOptions]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadBudget();
  }, [isFocused, loadBudget]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadBudget();
  }, [backgroundStatus.lastCompletedAt, isFocused, loadBudget]);

  React.useEffect(() => {
    if (!monthOptionsLoaded || !monthOptions.length) return;
    if (monthOptions.some((option) => option.key === selectedMonthKey)) return;

    const currentMonthOption = monthOptions.find((option) => option.isCurrentMonth);
    setSelectedMonthKey((currentMonthOption || monthOptions[0]).key);
  }, [monthOptions, monthOptionsLoaded, selectedMonthKey]);

  React.useEffect(() => {
    const routeRequestKey = [
      requestedRouteFocusToken || "direct",
      requestedRouteMonthKey || "",
      requestedRouteSegment || "",
    ].join("|");
    if (routeRequestKey === lastAppliedRouteRequestRef.current) return;
    if (!requestedRouteMonthKey && !requestedRouteSegment) return;

    lastAppliedRouteRequestRef.current = routeRequestKey;
    if (requestedRouteMonthKey) {
      setSelectedMonthKey(requestedRouteMonthKey);
    }
    if (requestedRouteSegment) {
      setSegment(requestedRouteSegment);
    }
  }, [
    requestedRouteFocusToken,
    requestedRouteMonthKey,
    requestedRouteSegment,
  ]);

  React.useEffect(() => {
    if (!isFocused) return;

    let cancelled = false;
    void getTransactionCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategoryRecords(rows);
        const nextMap: Record<string, string[]> = {};
        for (const row of rows) {
          const key = String(row.key || "").toLowerCase().trim();
          if (!key) continue;
          nextMap[key] = [...(nextMap[key] || []), String(row.id)];
        }
        setCategoryIdsByKey(nextMap);
      })
      .catch((error) => {
        console.warn("[budget] categories load error", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  const categoryById = React.useMemo(
    () => buildCategoryRecordMap(categoryRecords),
    [categoryRecords],
  );
  const variableCategoryIdsByBucket = React.useMemo(() => {
    const next = new Map<VariableBudgetCategoryKey, Set<string>>();
    for (const key of VARIABLE_BUDGET_BREAKDOWN_KEYS) {
      next.set(key, new Set<string>());
    }

    for (const category of categoryRecords) {
      const bucket = resolveVariableCategoryKeyForCategoryRecord(
        category.id,
        categoryById,
      );
      if (!bucket) continue;
      next.get(bucket)?.add(category.id);
    }

    return next;
  }, [categoryById, categoryRecords]);

  React.useEffect(() => {
    if (!pendingTransactionDetailId) return;
    if (
      selectedWeekNumber != null ||
      outsideBudgetOpen ||
      selectedMonthCategoryKey != null
    )
      return;

    const task = InteractionManager.runAfterInteractions(() => {
      router.push({
        pathname: "/transactions/[id]",
        params: { id: pendingTransactionDetailId },
      });
      setPendingTransactionDetailId(null);
    });

    return () => {
      task.cancel();
    };
  }, [
    outsideBudgetOpen,
    pendingTransactionDetailId,
    router,
    selectedMonthCategoryKey,
    selectedWeekNumber,
  ]);

  const currentWeek = React.useMemo(() => getCurrentWeek(budgetPlan), [budgetPlan]);
  const historicalWeeks = React.useMemo(
    () => getHistoricalWeeks(budgetPlan),
    [budgetPlan],
  );
  const focusWeek = React.useMemo(() => {
    if (currentWeek) return currentWeek;
    if (!historicalWeeks.length) return null;
    return historicalWeeks[historicalWeeks.length - 1];
  }, [currentWeek, historicalWeeks]);
  const monthBudgetSnapshot = React.useMemo(
    () => getMonthVariableBudgetSnapshot(budgetPlan),
    [budgetPlan],
  );
  const completedMonthBaselineHelper = React.useMemo(() => {
    if (!budgetPlan?.completedMonthBaselineThrough) return null;
    return `Gebaseerd op afgeronde maanden t/m ${formatBudgetMonthYear(
      budgetPlan.completedMonthBaselineThrough,
    )}.`;
  }, [budgetPlan?.completedMonthBaselineThrough]);
  const monthlyRemaining = monthBudgetSnapshot.remaining;
  const categoryRows = React.useMemo(() => getCategoryRows(budgetPlan), [budgetPlan]);
  const actionRecommendation = React.useMemo(
    () => getActionRecommendation(budgetPlan),
    [budgetPlan],
  );
  const positiveLine = React.useMemo(() => getPositiveLine(budgetPlan), [budgetPlan]);
  const warningCount = budgetPlan?.warnings.length || 0;
  const criticalCount =
    budgetPlan?.warnings.filter((warning) => warning.severity === "critical")
      .length || 0;
  const focusWeekSnapshot = React.useMemo(
    () => getWeekBudgetSnapshot(focusWeek),
    [focusWeek],
  );
  const weekProgress = focusWeekSnapshot.progress;
  const monthSpent = monthBudgetSnapshot.spent;
  const outsideBudgetTransactionCount = React.useMemo(
    () =>
      budgetPlan?.outsideBudgetExpenses.items.reduce(
        (sum, item) => sum + item.transactionCount,
        0,
      ) || 0,
    [budgetPlan],
  );
  const monthProgress = monthBudgetSnapshot.progress;
  const monthRiskTone = monthBudgetSnapshot.tone;

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

  const editableBudgetRowByKey = React.useMemo(
    () =>
      new Map(editableBudgetRows.map((row) => [row.categoryKey, row] as const)),
    [editableBudgetRows],
  );

  const getEditableBudgetRowDefault = React.useCallback(
    (key: BudgetCategoryKey) =>
      normalizeBudgetAmount(
        editableBudgetRowByKey.get(key)?.monthlyBudget || 0,
      ),
    [editableBudgetRowByKey],
  );

  const getRelevantSavingsTargetForDraftMode = React.useCallback(
    (
      mode: BudgetPlanMode,
      nextSavingsTargetMonthly = savingsTargetMonthlyDraft,
    ) => {
      if (mode === "custom") {
        return normalizeBudgetAmount(nextSavingsTargetMonthly);
      }
      if (!budgetPlan) return 0;

      return normalizeBudgetAmount(
        mode === "active_savings"
          ? budgetPlan.automaticSavingsTargetPreview.activeSavings
          : budgetPlan.automaticSavingsTargetPreview.balanced,
      );
    },
    [budgetPlan, savingsTargetMonthlyDraft],
  );

  const computeAvailableVariableBudget = React.useCallback(
    (
      values: BudgetDraftValues,
      overrides?: {
        mode?: BudgetPlanMode;
        savingsTargetMonthly?: number;
        includeIncome?: BudgetIncomeInclusionSettings;
      },
    ) => {
      if (!budgetPlan) return 0;

      const mode = overrides?.mode ?? budgetModeDraft;
      const nextSavingsTargetMonthly =
        overrides?.savingsTargetMonthly ?? savingsTargetMonthlyDraft;
      const nextIncomeDraft = overrides?.includeIncome ?? budgetIncomeDraft;
      const fixedCostsBudget = parseBudgetAmountDraft(
        values.fixed_costs,
        getEditableBudgetRowDefault("fixed_costs"),
      );
      const subscriptionsBudget = parseBudgetAmountDraft(
        values.subscriptions,
        getEditableBudgetRowDefault("subscriptions"),
      );
      const incomePreview = getIncludedIncomePreview(
        budgetPlan,
        nextIncomeDraft,
      );

      return normalizeBudgetAmount(
        Math.max(
          incomePreview -
            fixedCostsBudget -
            subscriptionsBudget -
            getRelevantSavingsTargetForDraftMode(
              mode,
              nextSavingsTargetMonthly,
            ),
          0,
        ),
      );
    },
    [
      budgetModeDraft,
      budgetIncomeDraft,
      budgetPlan,
      getEditableBudgetRowDefault,
      getRelevantSavingsTargetForDraftMode,
      savingsTargetMonthlyDraft,
    ],
  );

  const includedIncomePreview = React.useMemo(
    () => getIncludedIncomePreview(budgetPlan, budgetIncomeDraft),
    [budgetIncomeDraft, budgetPlan],
  );

  const getTrendBudgetForCategory = React.useCallback(
    (key: BudgetCategoryKey) =>
      normalizeBudgetAmount(
        editableBudgetRowByKey.get(key)?.baselineMonthly ??
          getEditableBudgetRowDefault(key),
      ),
    [editableBudgetRowByKey, getEditableBudgetRowDefault],
  );

  const lockedVariableCategorySet = React.useMemo(
    () => new Set<BudgetCategoryKey>(lockedVariableCategories),
    [lockedVariableCategories],
  );

  const deriveVariableBreakdownDraftValues = React.useCallback(
    (
      totalVariableBudget: number,
      values: BudgetDraftValues,
      options?: {
        lockedKeys?: ReadonlySet<BudgetCategoryKey>;
      },
    ) => {
      const normalizedTotal = normalizeBudgetAmount(totalVariableBudget);
      const lockedKeys = options?.lockedKeys ?? lockedVariableCategorySet;
      const nextValues: BudgetDraftValues = {};

      let lockedTotal = 0;
      for (const key of VARIABLE_BUDGET_BREAKDOWN_KEYS) {
        if (!lockedKeys.has(key)) continue;
        const lockedValue =
          parseBudgetAmountInput(values[key] || "") ??
          getEditableBudgetRowDefault(key);
        lockedTotal += lockedValue;
        nextValues[key] = formatBudgetAmountDraft(lockedValue);
      }

      const unlockedKeys = VARIABLE_BUDGET_BREAKDOWN_KEYS.filter(
        (key) => !lockedKeys.has(key),
      );
      const unlockedBudget = Math.max(normalizedTotal - lockedTotal, 0);
      const currentBreakdown = unlockedKeys.map(
        (key) => parseBudgetAmountInput(values[key] || "") ?? 0,
      );
      const currentBreakdownTotal = currentBreakdown.reduce(
        (sum, value) => sum + value,
        0,
      );
      const fallbackBreakdown = unlockedKeys.map((key) =>
        getEditableBudgetRowDefault(key),
      );
      const fallbackBreakdownTotal = fallbackBreakdown.reduce(
        (sum, value) => sum + value,
        0,
      );
      const weights =
        currentBreakdownTotal > 0
          ? currentBreakdown
          : fallbackBreakdownTotal > 0
            ? fallbackBreakdown
            : unlockedKeys.map(() => 1);

      const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
      let allocated = 0;
      unlockedKeys.forEach((key, index) => {
        const isLast = index === unlockedKeys.length - 1;
        const value = isLast
          ? Math.max(unlockedBudget - allocated, 0)
          : Math.floor((unlockedBudget * weights[index]) / totalWeight);
        allocated += value;
        nextValues[key] = formatBudgetAmountDraft(value);
      });

      return nextValues;
    },
    [
      getEditableBudgetRowDefault,
      lockedVariableCategorySet,
    ],
  );

  const rebuildManagedVariableDraftValues = React.useCallback(
    (
      values: BudgetDraftValues,
      overrides?: {
        mode?: BudgetPlanMode;
        savingsTargetMonthly?: number;
        includeIncome?: BudgetIncomeInclusionSettings;
      },
    ) => {
      if (!budgetPlan) return values;

      const variableBudget = computeAvailableVariableBudget(values, overrides);
      return {
        ...values,
        variable_costs: formatBudgetAmountDraft(variableBudget),
        ...deriveVariableBreakdownDraftValues(variableBudget, values),
      };
    },
    [
      budgetPlan,
      computeAvailableVariableBudget,
      deriveVariableBreakdownDraftValues,
    ],
  );

  React.useEffect(() => {
    if (!budgetPlan || !editableBudgetRows.length) return;

    const hydrationKey = JSON.stringify({
      monthStart: budgetPlan.monthStart,
      referenceDate: budgetPlan.referenceDate,
      mode: budgetPlan.settings.mode,
      includeIncome: budgetPlan.settings.includeIncome,
      forecastExpenseSource: budgetPlan.settings.forecastExpenseSource,
      savingsTargetMonthly: budgetPlan.settings.savingsTargetMonthly,
      recommendedSavings: budgetPlan.recommendedSavings,
      rows: editableBudgetRows.map((row) => [
        row.categoryKey,
        row.monthlyBudget,
        row.overrideSource,
        row.baselineMonthly,
      ]),
    });
    if (lastHydratedDraftKeyRef.current === hydrationKey) return;

    const nextMode = budgetPlan.settings.mode;
    const nextIncomeDraft = {
      salary: budgetPlan.settings.includeIncome.salary,
      childBudget: budgetPlan.settings.includeIncome.childBudget,
      structuralOther: budgetPlan.settings.includeIncome.structuralOther,
      variable: budgetPlan.settings.includeIncome.variable,
    };
    const nextForecastExpenseSource =
      budgetPlan.settings.forecastExpenseSource;
    const nextSavingsTarget = normalizeBudgetAmount(
      budgetPlan.settings.savingsTargetMonthly > 0
        ? budgetPlan.settings.savingsTargetMonthly
        : budgetPlan.recommendedSavings,
    );

    const nextDraft: BudgetDraftValues = {};
    for (const row of editableBudgetRows) {
      nextDraft[row.categoryKey] = formatBudgetAmountDraft(row.monthlyBudget);
    }

    const inferredLocks = [
      ...resolveLockedVariableMainCategories(budgetPlan.recommendations),
    ];
    const inferredLockSet = new Set<BudgetCategoryKey>(inferredLocks);
    const initialVariableBudget = computeAvailableVariableBudget(nextDraft, {
      mode: nextMode,
      savingsTargetMonthly: nextSavingsTarget,
      includeIncome: nextIncomeDraft,
    });

    lastHydratedDraftKeyRef.current = hydrationKey;
    setBudgetModeDraft(nextMode);
    setBudgetIncomeDraft(nextIncomeDraft);
    setForecastExpenseSourceDraft(nextForecastExpenseSource);
    setSavingsTargetMonthlyDraft(nextSavingsTarget);
    setLockedVariableCategories(inferredLocks);
    setBudgetDraftValues({
      ...nextDraft,
      variable_costs: formatBudgetAmountDraft(initialVariableBudget),
      ...deriveVariableBreakdownDraftValues(initialVariableBudget, nextDraft, {
        lockedKeys: inferredLockSet,
      }),
    });
  }, [
    budgetPlan,
    computeAvailableVariableBudget,
    deriveVariableBreakdownDraftValues,
    editableBudgetRows,
  ]);

  const handleIncomeDraftToggle = React.useCallback(
    (key: keyof BudgetIncomeInclusionSettings) => {
      setBudgetIncomeDraft((current) => {
        const nextIncomeDraft = {
          ...current,
          [key]: !current[key],
        };

        setBudgetDraftValues((draftCurrent) =>
          rebuildManagedVariableDraftValues(draftCurrent, {
            includeIncome: nextIncomeDraft,
          }),
        );

        return nextIncomeDraft;
      });
    },
    [rebuildManagedVariableDraftValues],
  );

  const handleBudgetModeDraftChange = React.useCallback(
    (nextMode: BudgetPlanMode) => {
      setBudgetModeDraft(nextMode);
      setBudgetDraftValues((current) =>
        rebuildManagedVariableDraftValues(current, { mode: nextMode }),
      );
    },
    [rebuildManagedVariableDraftValues],
  );

  const handleSavingsTargetMonthlyDraftChange = React.useCallback(
    (nextValue: number) => {
      const normalizedValue = normalizeBudgetAmount(nextValue);
      setSavingsTargetMonthlyDraft(normalizedValue);

      if (budgetModeDraft !== "custom") return;

      setBudgetDraftValues((current) =>
        rebuildManagedVariableDraftValues(current, {
          mode: "custom",
          savingsTargetMonthly: normalizedValue,
        }),
      );
    },
    [budgetModeDraft, rebuildManagedVariableDraftValues],
  );

  const handleBudgetDraftValueChange = React.useCallback(
    (categoryKey: BudgetCategoryKey, text: string) => {
      const sanitizedValue = sanitizeBudgetAmountDraft(text);

      setBudgetDraftValues((current) => {
        const nextValues: BudgetDraftValues = {
          ...current,
          [categoryKey]: sanitizedValue,
        };

        if (categoryKey === "fixed_costs" || categoryKey === "subscriptions") {
          return rebuildManagedVariableDraftValues(nextValues);
        }

        if (categoryKey === "variable_costs") {
          return {
            ...nextValues,
            variable_costs: formatBudgetAmountDraft(
              computeAvailableVariableBudget(nextValues),
            ),
          };
        }

        return nextValues;
      });
    },
    [computeAvailableVariableBudget, rebuildManagedVariableDraftValues],
  );

  const handleBudgetDraftValueBlur = React.useCallback(
    (categoryKey: BudgetCategoryKey) => {
      setBudgetDraftValues((current) => {
        const nextValues: BudgetDraftValues = { ...current };

        if (categoryKey === "fixed_costs" || categoryKey === "subscriptions") {
          nextValues[categoryKey] = formatBudgetAmountDraft(
            parseBudgetAmountDraft(
              nextValues[categoryKey],
              getEditableBudgetRowDefault(categoryKey),
            ),
          );
          return rebuildManagedVariableDraftValues(nextValues);
        }

        nextValues[categoryKey] = formatBudgetAmountDraft(
          parseBudgetAmountDraft(
            nextValues[categoryKey],
            getEditableBudgetRowDefault(categoryKey),
          ),
        );
        return nextValues;
      });
    },
    [getEditableBudgetRowDefault, rebuildManagedVariableDraftValues],
  );

  const resetVariableCategoryToTrend = React.useCallback(
    (categoryKey: BudgetCategoryKey) => {
      if (!isVariableBreakdownKey(categoryKey)) return;

      const temporaryLockedKeys = new Set<BudgetCategoryKey>(
        lockedVariableCategories,
      );
      temporaryLockedKeys.add(categoryKey);

      setBudgetDraftValues((draftCurrent) => {
        const nextValues: BudgetDraftValues = {
          ...draftCurrent,
          [categoryKey]: formatBudgetAmountDraft(
            getTrendBudgetForCategory(categoryKey),
          ),
        };
        const availableVariable = computeAvailableVariableBudget(nextValues);
        return {
          ...nextValues,
          variable_costs: formatBudgetAmountDraft(availableVariable),
          ...deriveVariableBreakdownDraftValues(availableVariable, nextValues, {
            lockedKeys: temporaryLockedKeys,
          }),
        };
      });
    },
    [
      computeAvailableVariableBudget,
      deriveVariableBreakdownDraftValues,
      getTrendBudgetForCategory,
      lockedVariableCategories,
    ],
  );

  const toggleVariableCategoryLock = React.useCallback(
    (categoryKey: BudgetCategoryKey) => {
      if (!isVariableBreakdownKey(categoryKey)) return;

      setLockedVariableCategories((current) => {
        const alreadyLocked = current.includes(categoryKey);
        const nextLocked = alreadyLocked
          ? current.filter((key) => key !== categoryKey)
          : [...current, categoryKey];
        const nextLockedSet = new Set<BudgetCategoryKey>(nextLocked);

        setBudgetDraftValues((draftCurrent) => {
          const nextValues: BudgetDraftValues = { ...draftCurrent };
          const availableVariable = computeAvailableVariableBudget(nextValues);
          return {
            ...nextValues,
            variable_costs: formatBudgetAmountDraft(availableVariable),
            ...deriveVariableBreakdownDraftValues(
              availableVariable,
              nextValues,
              {
                lockedKeys: nextLockedSet,
              },
            ),
          };
        });

        return nextLocked;
      });
    },
    [
      computeAvailableVariableBudget,
      deriveVariableBreakdownDraftValues,
    ],
  );

  const autoManagedVariableBudget = budgetModeDraft !== "custom";

  const parseDraftBudgetValue = React.useCallback(
    (key: BudgetCategoryKey) =>
      parseBudgetAmountDraft(
        budgetDraftValues[key],
        getEditableBudgetRowDefault(key),
      ),
    [budgetDraftValues, getEditableBudgetRowDefault],
  );

  const variableBudgetDraftSummary = React.useMemo(() => {
    const available = computeAvailableVariableBudget(budgetDraftValues);
    const breakdownTotal = VARIABLE_BUDGET_BREAKDOWN_KEYS.reduce(
      (sum, key) => sum + parseDraftBudgetValue(key),
      0,
    );

    return {
      available,
      breakdownTotal,
      delta: available - breakdownTotal,
    };
  }, [
    budgetDraftValues,
    computeAvailableVariableBudget,
    parseDraftBudgetValue,
  ]);

  const variableAllocationFeedback = React.useMemo(() => {
    if (variableBudgetDraftSummary.delta === 0) {
      return {
        label: "Je verdeling klopt",
        tone: "good" as const,
      };
    }

    if (variableBudgetDraftSummary.delta > 0) {
      return {
        label: `Nog ${fmt.format(variableBudgetDraftSummary.delta)} te verdelen`,
        tone: "watch" as const,
      };
    }

    return {
      label: `${fmt.format(Math.abs(variableBudgetDraftSummary.delta))} boven je beschikbare ruimte`,
      tone: "critical" as const,
    };
  }, [variableBudgetDraftSummary.delta]);

  const draftBudgetAllocationSummary = React.useMemo(() => {
    const incomingBudget = includedIncomePreview;
    const fixedCosts = parseDraftBudgetValue("fixed_costs");
    const subscriptions = parseDraftBudgetValue("subscriptions");
    const variable = computeAvailableVariableBudget(budgetDraftValues);
    const savingsTarget = getRelevantSavingsTargetForDraftMode(
      budgetModeDraft,
      savingsTargetMonthlyDraft,
    );
    const allocatedTotal = normalizeBudgetAmount(
      fixedCosts + subscriptions + variable + savingsTarget,
    );
    const remaining = incomingBudget - allocatedTotal;

    return {
      incomingBudget,
      fixedCosts,
      subscriptions,
      variable,
      savingsTarget,
      allocatedTotal,
      remaining,
      isOverAllocated: remaining < 0,
    };
  }, [
    budgetModeDraft,
    budgetDraftValues,
    computeAvailableVariableBudget,
    getRelevantSavingsTargetForDraftMode,
    includedIncomePreview,
    parseDraftBudgetValue,
    savingsTargetMonthlyDraft,
  ]);

  const savingsSliderMax = React.useMemo(() => {
    const candidates = [
      500,
      sanitizeNonNegativeNumber(savingsTargetMonthlyDraft),
      sanitizeNonNegativeNumber(budgetPlan?.recommendedSavings || 0),
      sanitizeNonNegativeNumber(
        budgetPlan?.flowSummary.subtotalAfterSubscriptions || 0,
      ),
    ];
    return Math.max(
      500,
      roundToStepCeil(Math.max(...candidates), SAVINGS_SLIDER_STEP),
    );
  }, [
    budgetPlan?.flowSummary.subtotalAfterSubscriptions,
    budgetPlan?.recommendedSavings,
    savingsTargetMonthlyDraft,
  ]);

  const selectedModeTargetPreview = React.useMemo(() => {
    if (!budgetPlan || budgetModeDraft === "custom") return null;

    const isCurrentMode = budgetPlan.settings.mode === budgetModeDraft;
    const amount =
      budgetModeDraft === "active_savings"
        ? budgetPlan.automaticSavingsTargetPreview.activeSavings
        : budgetPlan.automaticSavingsTargetPreview.balanced;

    return {
      amount: sanitizeNonNegativeNumber(amount),
      isCurrentMode,
      meta: getAutomaticModePreviewMeta(budgetModeDraft, isCurrentMode),
    };
  }, [budgetModeDraft, budgetPlan]);

  const manageBudgetPreview = React.useMemo(() => {
    if (budgetModeDraft === "custom") {
      return {
        label: "Eigen spaardoel",
        amount: savingsTargetMonthlyDraft,
        meta: "Stel in hoeveel je deze maand wilt overhouden.",
      };
    }

    if (!selectedModeTargetPreview) {
      return {
        label: "Spaardoel deze maand",
        amount: 0,
        meta: getBudgetModeDescription(budgetModeDraft),
      };
    }

    return {
      label: selectedModeTargetPreview.isCurrentMode
        ? "Spaardoel deze maand"
        : "Verwacht spaardoel",
      amount: selectedModeTargetPreview.amount,
      meta: selectedModeTargetPreview.meta,
    };
  }, [
    budgetModeDraft,
    savingsTargetMonthlyDraft,
    selectedModeTargetPreview,
  ]);

  const manualCategoryBudgetCount = React.useMemo(() => {
    return editableBudgetRows.reduce((count, row) => {
      if (
        row.categoryKey === "variable_costs" ||
        row.categoryKey === "savings_target"
      ) {
        return count;
      }

      const draftValue = parseDraftBudgetValue(row.categoryKey);
      const baselineValue = normalizeBudgetAmount(row.baselineMonthly);
      return draftValue !== baselineValue ? count + 1 : count;
    }, 0);
  }, [editableBudgetRows, parseDraftBudgetValue]);

  const manageCategoryBudgetStatusLabel = React.useMemo(() => {
    if (variableAllocationFeedback.tone === "good") return "Klopt";
    if (variableAllocationFeedback.tone === "watch") return "Open";
    return "Let op";
  }, [variableAllocationFeedback.tone]);

  const categoryBudgetSummarySubtitle = React.useMemo(() => {
    const parts = [selectedMonth.label];
    if (manualCategoryBudgetCount > 0) {
      parts.push(`${manualCategoryBudgetCount} bijgestuurd`);
    } else {
      parts.push("volgt trend");
    }

    if (lockedVariableCategorySet.size > 0) {
      parts.push(`${lockedVariableCategorySet.size} vastgezet`);
    }

    return parts.join(" · ");
  }, [
    lockedVariableCategorySet,
    manualCategoryBudgetCount,
    selectedMonth.label,
  ]);

  const activeAnnualReserveRules = React.useMemo(
    () => annualReserveRules.filter((rule) => rule.status === "active"),
    [annualReserveRules],
  );

  const annualReservePreviewRules = React.useMemo(() => {
    const source = activeAnnualReserveRules.length
      ? activeAnnualReserveRules
      : annualReserveRules;
    return source.slice(0, 3);
  }, [activeAnnualReserveRules, annualReserveRules]);

  const annualReserveSheetSummary = buildAnnualReserveSheetSummary({
    reserveBreakdown: assistantForecastSurface?.reserveBreakdown || null,
    currentReservedBalanceAmount:
      assistantForecastSurface?.balances.currentReservedBalance.amount ?? null,
    annualRules: annualReserveRules,
  });

  const annualReserveInlineAmount = React.useMemo(
    () =>
      Math.max(
        Math.round(
          assistantForecastSurface?.reserve?.plannedReserveAllocationThisMonth ||
            annualReserveSheetSummary.annualActive ||
            0,
        ),
        0,
      ),
    [
      annualReserveSheetSummary.annualActive,
      assistantForecastSurface?.reserve?.plannedReserveAllocationThisMonth,
    ],
  );

  const budgetHeroCopy = React.useMemo(
    () => ({
      eyebrow: "Budget",
      title: "Grip op je budget",
      subtitle:
        "Zie in een oogopslag je weektempo, maandruimte en waar je kunt bijsturen.",
    }),
    [],
  );

  const resolveWeekSpendBreakdown = React.useCallback(
    (week: BudgetWeekPlanRow | null) => {
      if (!budgetPlan || !week) return null;
      return (
        budgetPlan.weeklySpendBreakdown.find(
          (item) =>
            item.weekNumber === week.weekNumber &&
            item.startDate === week.startDate &&
            item.endDateExclusive === week.endDateExclusive,
        ) ||
        budgetPlan.weeklySpendBreakdown.find(
          (item) => item.weekNumber === week.weekNumber,
        ) ||
        null
      );
    },
    [budgetPlan],
  );

  const selectedWeekDetail = React.useMemo(() => {
    if (!budgetPlan || selectedWeekNumber == null) return null;

    const weekRow = budgetPlan.weeklyVariablePlan.find(
      (week) => week.weekNumber === selectedWeekNumber,
    );
    const spendRow = resolveWeekSpendBreakdown(weekRow || null);

    if (!weekRow || !spendRow) return null;
    return {
      week: weekRow,
      spend: spendRow,
    };
  }, [budgetPlan, resolveWeekSpendBreakdown, selectedWeekNumber]);

  const selectedWeekVariableCategories = React.useMemo(() => {
    if (!selectedWeekDetail) return [];
    return selectedWeekDetail.spend.categories.filter(
      (category) => category.amount > 0,
    );
  }, [selectedWeekDetail]);

  const resolveWeekBudgetByMainCategory = React.useCallback(
    (week: BudgetWeekPlanRow | null) => {
      if (!budgetPlan || !week) return new Map<string, number>();

      const budgetRow =
        budgetPlan.weeklyBudgetBreakdown.find(
          (item) =>
            item.weekNumber === week.weekNumber &&
            item.startDate === week.startDate &&
            item.endDateExclusive === week.endDateExclusive,
        ) ||
        budgetPlan.weeklyBudgetBreakdown.find(
          (item) => item.weekNumber === week.weekNumber,
        );

      return new Map(
        (budgetRow?.categories || []).map((category) => [
          category.key,
          category.amount,
        ]),
      );
    },
    [budgetPlan],
  );

  const selectedWeekBudgetByMainCategory = React.useMemo(() => {
    if (!selectedWeekDetail) return new Map<string, number>();
    return resolveWeekBudgetByMainCategory(selectedWeekDetail.week);
  }, [resolveWeekBudgetByMainCategory, selectedWeekDetail]);
  const isWeekSummaryModal = selectedWeekDetail != null && segment === "new";
  const isMonthSummaryModal = monthSummaryModalOpen;
  const selectedWeekSummaryItems = React.useMemo((): BudgetWeekBreakdownRow[] => {
    if (!selectedWeekDetail) return [];

    return selectedWeekDetail.spend.categories
      .map((category) => {
        const totalBudget = selectedWeekBudgetByMainCategory.get(category.key) || 0;
        return {
          key: category.key,
          label: category.label,
          iconName: getVariableCategoryIconName(category.key),
          usedAmount: category.amount,
          totalBudget,
        };
      })
      .filter((item) => item.usedAmount > 0 || item.totalBudget > 0);
  }, [selectedWeekBudgetByMainCategory, selectedWeekDetail]);
  const selectedMonthSummaryItems = React.useMemo((): BudgetWeekBreakdownRow[] => {
    return categoryRows
      .map((row) => ({
        key: row.categoryKey,
        label: row.label,
        iconName: getVariableCategoryIconName(row.categoryKey),
        usedAmount: Math.max(row.monthlyActual, 0),
        totalBudget: Math.max(row.monthlyBudget, 0),
      }))
      .filter((item) => item.usedAmount > 0 || item.totalBudget > 0);
  }, [categoryRows]);
  const isSummaryBreakdownModalVisible = isWeekSummaryModal || isMonthSummaryModal;
  const summaryBreakdownModalTitle =
    isWeekSummaryModal && selectedWeekDetail
      ? formatBudgetWeekLabel(selectedWeekDetail.week)
      : "Deze maand";
  const summaryBreakdownModalPeriodLabel =
    isWeekSummaryModal && selectedWeekDetail
      ? formatWeekRangeLabel(selectedWeekDetail.week)
      : selectedMonth.label;
  const summaryBreakdownModalTotalSpent = isWeekSummaryModal
    ? Math.max(selectedWeekDetail?.week.actual || 0, 0)
    : Math.max(monthBudgetSnapshot.spent || 0, 0);
  const summaryBreakdownModalTotalBudget = isWeekSummaryModal
    ? Math.max(selectedWeekDetail?.week.budget || 0, 0)
    : Math.max(monthBudgetSnapshot.budget || 0, 0);
  const summaryBreakdownModalItems = isWeekSummaryModal
    ? selectedWeekSummaryItems
    : selectedMonthSummaryItems;
  const summaryBreakdownExpandedCategoryKeys = isWeekSummaryModal
    ? expandedWeekSummaryCategories
    : expandedMonthSummaryCategories;
  const summaryBreakdownTransactionsByCategory = isWeekSummaryModal
    ? weekSummaryTransactionsByCategory
    : categoryDetailTransactionsByKey;
  const summaryBreakdownLoadingCategoryKeys = isWeekSummaryModal
    ? weekSummaryLoadingCategories
    : categoryDetailLoadingKeys;
  const summaryBreakdownCategoryErrors = isWeekSummaryModal
    ? weekSummaryCategoryErrors
    : categoryDetailErrors;

  const detailItems = React.useMemo(() => {
    if (!budgetPlan || !detailSection) return [];
    return detailSection === "fixed_costs"
      ? budgetPlan.expenseDetails.fixedCosts
      : budgetPlan.expenseDetails.subscriptions;
  }, [budgetPlan, detailSection]);

  const detailExpectedAndActual = React.useMemo(() => {
    if (!budgetPlan || !detailSection) return null;

    if (detailSection === "fixed_costs") {
      return {
        label: "Vaste lasten",
        expected: budgetPlan.flowSummary.fixedCostsBudget,
        actual: Math.round(budgetPlan.monthToDateExpenses.fixedCosts),
      };
    }

    return {
      label: "Abonnementen",
      expected: budgetPlan.flowSummary.subscriptionsBudget,
      actual: Math.round(budgetPlan.monthToDateExpenses.subscriptions),
    };
  }, [budgetPlan, detailSection]);

  const monthStructureRows = React.useMemo(() => {
    if (!budgetPlan) return [];

    return [
      {
        key: "fixed_costs" as const,
        label: "Vaste lasten",
        helper: "Terugkerende vaste druk op je maandruimte",
        expected: budgetPlan.flowSummary.fixedCostsBudget,
        actual: Math.round(budgetPlan.monthToDateExpenses.fixedCosts),
        itemCount: budgetPlan.expenseDetails.fixedCosts.length,
      },
      {
        key: "subscriptions" as const,
        label: "Abonnementen",
        helper: "Doorlopende services en memberships",
        expected: budgetPlan.flowSummary.subscriptionsBudget,
        actual: Math.round(budgetPlan.monthToDateExpenses.subscriptions),
        itemCount: budgetPlan.expenseDetails.subscriptions.length,
      },
    ];
  }, [budgetPlan]);

  const selectedMonthCategory = React.useMemo(() => {
    if (!selectedMonthCategoryKey) return null;
    return (
      categoryRows.find((row) => row.categoryKey === selectedMonthCategoryKey) ||
      null
    );
  }, [categoryRows, selectedMonthCategoryKey]);

  const selectedMonthCategoryTempoSummary = React.useMemo(() => {
    if (!selectedMonthCategory) return null;
    return getCategoryMonthTempoSummary(selectedMonthCategory);
  }, [selectedMonthCategory]);

  const selectedMonthCategoryTransactions = React.useMemo(() => {
    if (!selectedMonthCategoryKey) return [] as InlineWeekTransaction[];
    return categoryDetailTransactionsByKey[selectedMonthCategoryKey] || [];
  }, [categoryDetailTransactionsByKey, selectedMonthCategoryKey]);

  const selectedMonthCategoryLoading = React.useMemo(
    () =>
      selectedMonthCategoryKey != null &&
      categoryDetailLoadingKeys.includes(selectedMonthCategoryKey),
    [categoryDetailLoadingKeys, selectedMonthCategoryKey],
  );

  const selectedMonthCategoryError = React.useMemo(() => {
    if (!selectedMonthCategoryKey) return null;
    return categoryDetailErrors[selectedMonthCategoryKey] || null;
  }, [categoryDetailErrors, selectedMonthCategoryKey]);

  const resolveCategoryIdsForSubcategory = React.useCallback(
    (subcategoryKey: string) => {
      const normalized = String(subcategoryKey || "").toLowerCase().trim();
      if (!normalized) return [] as string[];

      const ids = new Set<string>();
      for (const [key, values] of Object.entries(categoryIdsByKey)) {
        if (key === normalized || key.startsWith(`${normalized}_`)) {
          for (const id of values) ids.add(id);
        }
      }
      return [...ids];
    },
    [categoryIdsByKey],
  );

  const saveManageChanges = React.useCallback(async () => {
    if (!budgetPlan) return;

    setSavingManage(true);
    try {
      const nextCustomSavingsTarget =
        budgetModeDraft === "custom"
          ? normalizeBudgetAmount(savingsTargetMonthlyDraft)
          : budgetPlan.settings.savingsTargetMonthly;

      await upsertBudgetPlanSettings({
        planKey: "default",
        mode: budgetModeDraft,
        includeIncome: budgetIncomeDraft,
        forecastExpenseSource: forecastExpenseSourceDraft,
        applySavingsTargetToVariableBudget:
          budgetModeDraft === "custom" && nextCustomSavingsTarget > 0,
        savingsTargetMonthly: nextCustomSavingsTarget,
      });

      const updateInputs: {
        categoryKey: BudgetCategoryKey;
        monthlyBudget: number;
        lockTrend: boolean | null;
      }[] = [];

      for (const row of editableBudgetRows) {
        const rowIsVariableBreakdown = isVariableBreakdownKey(row.categoryKey);
        const shouldPersistRow =
          autoManagedVariableBudget && rowIsVariableBreakdown
            ? true
            : shouldPersistCategoryOnBudgetSave({
                categoryKey: row.categoryKey,
                autoManagedVariableBudget,
                lockedCategoryKeys: lockedVariableCategorySet,
              });
        if (!shouldPersistRow) continue;

        const rawValue = budgetDraftValues[row.categoryKey];
        const parsed = parseBudgetAmountInput(rawValue || "");
        if (parsed == null) continue;

        updateInputs.push({
          categoryKey: row.categoryKey,
          monthlyBudget: normalizeBudgetAmount(parsed),
          lockTrend: rowIsVariableBreakdown
            ? lockedVariableCategorySet.has(row.categoryKey)
            : null,
        });
      }

      await resetMonthlyBudgetValues({
        planKey: "default",
        monthStartIso: selectedMonth.startIso,
      });

      if (updateInputs.length) {
        await Promise.all(
          updateInputs.map((update) =>
            upsertMonthlyBudgetValue({
              planKey: "default",
              monthStartIso: selectedMonth.startIso,
              categoryKey: update.categoryKey,
              monthlyBudget: update.monthlyBudget,
              source: "manual",
              lockTrend: update.lockTrend,
            }),
          ),
        );
      }

      await markForecastDirty("budget_save").catch((error) => {
        console.warn("[budget] forecast dirty mark after save failed", error);
      });

      await loadBudget();
    } catch (error) {
      console.error("[budget] save error", error);
    } finally {
      setSavingManage(false);
    }
  }, [
    autoManagedVariableBudget,
    budgetDraftValues,
    forecastExpenseSourceDraft,
    budgetIncomeDraft,
    budgetModeDraft,
    budgetPlan,
    editableBudgetRows,
    loadBudget,
    savingsTargetMonthlyDraft,
    selectedMonth.startIso,
    lockedVariableCategorySet,
  ]);

  const applyLatestTrendBudgets = React.useCallback(async () => {
    setRecalculatingBudget(true);
    try {
      await resetMonthlyBudgetValues({
        planKey: "default",
        monthStartIso: selectedMonth.startIso,
      });

      const lockedSet = new Set<BudgetCategoryKey>(lockedVariableCategories);
      const lockUpdates = VARIABLE_BUDGET_BREAKDOWN_KEYS.map((key) =>
        upsertMonthlyBudgetValue({
          planKey: "default",
          monthStartIso: selectedMonth.startIso,
          categoryKey: key,
          monthlyBudget: getTrendBudgetForCategory(key),
          source: "manual",
          lockTrend: lockedSet.has(key),
        }),
      );

      if (lockUpdates.length) {
        await Promise.all(lockUpdates);
      }

      await markForecastDirty("budget_save").catch((error) => {
        console.warn("[budget] forecast dirty mark after recalculate failed", error);
      });

      await loadBudget();
    } catch (error) {
      console.error("[budget] recalculate error", error);
    } finally {
      setRecalculatingBudget(false);
    }
  }, [
    getTrendBudgetForCategory,
    loadBudget,
    selectedMonth.startIso,
    lockedVariableCategories,
  ]);

  const openWeekDetail = React.useCallback((weekNumber: number) => {
    setMonthSummaryModalOpen(false);
    setSelectedWeekNumber(weekNumber);
    setExpandedWeekMainCategories([]);
    setExpandedWeekSubcategories([]);
    setExpandedWeekSummaryCategories([]);
    setWeekSummaryTransactionsByCategory({});
    setWeekSummaryLoadingCategories([]);
    setWeekSummaryCategoryErrors({});
  }, []);

  const closeWeekDetail = React.useCallback(() => {
    setSelectedWeekNumber(null);
    setExpandedWeekMainCategories([]);
    setExpandedWeekSubcategories([]);
    setExpandedWeekSummaryCategories([]);
    setWeekSummaryTransactionsByCategory({});
    setWeekSummaryLoadingCategories([]);
    setWeekSummaryCategoryErrors({});
  }, []);

  const openMonthSummaryDetail = React.useCallback(() => {
    setSelectedWeekNumber(null);
    setMonthSummaryModalOpen(true);
    setExpandedMonthSummaryCategories([]);
  }, []);

  const closeMonthSummaryDetail = React.useCallback(() => {
    setMonthSummaryModalOpen(false);
    setExpandedMonthSummaryCategories([]);
  }, []);

  const closeOutsideBudget = React.useCallback(() => {
    setOutsideBudgetOpen(false);
  }, []);

  const openMonthCategoryDetail = React.useCallback(
    (categoryKey: VariableBudgetCategoryKey) => {
      setSelectedMonthCategoryKey(categoryKey);
    },
    [],
  );

  const closeMonthCategoryDetail = React.useCallback(() => {
    setSelectedMonthCategoryKey(null);
  }, []);

  const toggleWeekMainCategory = React.useCallback((categoryKey: string) => {
    setExpandedWeekMainCategories((current) => {
      if (current.includes(categoryKey)) {
        return current.filter((key) => key !== categoryKey);
      }
      return [...current, categoryKey];
    });
  }, []);

  const openInlineTransactionDetail = React.useCallback(
    (transactionId: string) => {
      if (!transactionId) return;
      setPendingTransactionDetailId(transactionId);
      closeWeekDetail();
      closeMonthSummaryDetail();
      closeOutsideBudget();
      closeMonthCategoryDetail();
    },
    [
      closeMonthCategoryDetail,
      closeMonthSummaryDetail,
      closeOutsideBudget,
      closeWeekDetail,
    ],
  );

  const fetchWeekSummaryCategoryTransactions = React.useCallback(
    async (categoryKey: string) => {
      if (!selectedWeekDetail) return;

      const categoryBucketKey = categoryKey as VariableBudgetCategoryKey;
      const categoryIdsForBucket =
        variableCategoryIdsByBucket.get(categoryBucketKey) || new Set<string>();

      setWeekSummaryCategoryErrors((current) => {
        const next = { ...current };
        delete next[categoryKey];
        return next;
      });
      setWeekSummaryLoadingCategories((current) => {
        if (current.includes(categoryKey)) return current;
        return [...current, categoryKey];
      });

      try {
        const userId = await requireCurrentUserId();
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id,date,amount,details,counterparty,budget_excluded,category_id_auto,category_id_user",
          )
          .eq("user_id", userId)
          .gte("date", selectedWeekDetail.week.startDate)
          .lt("date", selectedWeekDetail.week.endDateExclusive)
          .lt("amount", 0)
          .order("date", { ascending: false })
          .limit(300);

        if (error) throw error;

        const rows = ((data || []) as Record<string, unknown>[])
          .map((row) => ({
            id: String(row.id || ""),
            date: String(row.date || ""),
            title: extractTransactionTitle(String(row.details || "")),
            counterparty: row.counterparty ? String(row.counterparty) : null,
            amount: Number(row.amount || 0),
            budgetExcluded: Boolean(row.budget_excluded),
            category_id_auto: row.category_id_auto
              ? String(row.category_id_auto)
              : null,
            category_id_user: row.category_id_user
              ? String(row.category_id_user)
              : null,
          }))
          .filter((row) => {
            if (row.budgetExcluded) return false;
            const effectiveCategoryId = row.category_id_user || row.category_id_auto;
            if (effectiveCategoryId && categoryIdsForBucket.has(effectiveCategoryId)) {
              return true;
            }
            return (
              resolveVariableCategoryKeyForTransaction(row, categoryById) === categoryBucketKey
            );
          });

        setWeekSummaryTransactionsByCategory((current) => ({
          ...current,
          [categoryKey]: rows,
        }));
      } catch (error) {
        console.warn("[budget] weeksummary transacties laden mislukt", error);
        setWeekSummaryCategoryErrors((current) => ({
          ...current,
          [categoryKey]: "Kon transacties niet laden.",
        }));
      } finally {
        setWeekSummaryLoadingCategories((current) =>
          current.filter((item) => item !== categoryKey),
        );
      }
    },
    [categoryById, selectedWeekDetail, variableCategoryIdsByBucket],
  );

  const toggleWeekSummaryCategory = React.useCallback(
    (categoryKey: string) => {
      const isExpanded = expandedWeekSummaryCategories.includes(categoryKey);
      setExpandedWeekSummaryCategories((current) => {
        if (current.includes(categoryKey)) {
          return current.filter((key) => key !== categoryKey);
        }
        return [...current, categoryKey];
      });

      if (isExpanded) return;
      if (weekSummaryTransactionsByCategory[categoryKey]) return;
      if (weekSummaryLoadingCategories.includes(categoryKey)) return;
      void fetchWeekSummaryCategoryTransactions(categoryKey);
    },
    [
      expandedWeekSummaryCategories,
      fetchWeekSummaryCategoryTransactions,
      weekSummaryLoadingCategories,
      weekSummaryTransactionsByCategory,
    ],
  );

  const fetchInlineWeekSubcategoryTransactions = React.useCallback(
    async (
      cacheKey: string,
      weekStart: string,
      weekEndExclusive: string,
      subcategoryKey: string,
    ) => {
      setInlineSubcategoryErrors((current) => {
        const next = { ...current };
        delete next[cacheKey];
        return next;
      });
      setInlineLoadingSubcategories((current) => {
        if (current.includes(cacheKey)) return current;
        return [...current, cacheKey];
      });

      try {
        const userId = await requireCurrentUserId();
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id,date,amount,details,counterparty,category_id_auto,category_id_user,budget_excluded",
          )
          .eq("user_id", userId)
          .gte("date", weekStart)
          .lt("date", weekEndExclusive)
          .lt("amount", 0)
          .order("date", { ascending: false })
          .limit(200);

        if (error) throw error;

        const rows = ((data || []) as Record<string, unknown>[]).map((row) => ({
          id: String(row.id || ""),
          date: String(row.date || ""),
          details: String(row.details || ""),
          counterparty: row.counterparty ? String(row.counterparty) : null,
          amount: Number(row.amount || 0),
          category_id_auto: row.category_id_auto
            ? String(row.category_id_auto)
            : null,
          category_id_user: row.category_id_user
            ? String(row.category_id_user)
            : null,
          budget_excluded: Boolean(row.budget_excluded),
        }));

        const isCounterpartyFallback =
          subcategoryKey.startsWith("counterparty:");
        const filteredRows = isCounterpartyFallback
          ? rows.filter((row) => {
              const normalizedNeedle = subcategoryKey.replace(
                "counterparty:",
                "",
              );
              const candidate = normalizeLookupValue(
                row.counterparty || row.details || "Onbekend",
              );
              return candidate === normalizedNeedle;
            })
          : (() => {
              const categoryIds = new Set(
                resolveCategoryIdsForSubcategory(subcategoryKey),
              );
              if (!categoryIds.size) return [] as typeof rows;
              return rows.filter((row) =>
                categoryIds.has(
                  String(row.category_id_user || row.category_id_auto || ""),
                ),
              );
            })();

        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          filteredRows.map((row) => row.id),
        );

        setInlineTransactionsBySubcategory((current) => ({
          ...current,
          [cacheKey]: filteredRows.map((row) => ({
            id: row.id,
            date: row.date,
            title: extractTransactionTitle(row.details),
            counterparty: row.counterparty,
            subscriptionProfileName: subscriptionNames[row.id] || null,
            amount: row.amount,
            budgetExcluded: row.budget_excluded,
            category_id_auto: row.category_id_auto,
            category_id_user: row.category_id_user,
          })),
        }));
      } catch (error) {
        console.warn("[budget] inline transacties laden mislukt", error);
        setInlineSubcategoryErrors((current) => ({
          ...current,
          [cacheKey]: "Kon transacties niet laden.",
        }));
      } finally {
        setInlineLoadingSubcategories((current) =>
          current.filter((item) => item !== cacheKey),
        );
      }
    },
    [resolveCategoryIdsForSubcategory],
  );

  const toggleWeekSubcategoryInline = React.useCallback(
    (mainCategoryKey: string, subcategoryKey: string) => {
      if (!selectedWeekDetail) return;

      const cacheKey = getWeekSubcategoryCacheKey(
        selectedWeekDetail.week.weekNumber,
        mainCategoryKey,
        subcategoryKey,
      );
      const isExpanded = expandedWeekSubcategories.includes(cacheKey);

      setExpandedWeekSubcategories((current) => {
        if (current.includes(cacheKey)) {
          return current.filter((item) => item !== cacheKey);
        }
        return [...current, cacheKey];
      });

      if (isExpanded) return;
      if (inlineTransactionsBySubcategory[cacheKey]) return;
      if (inlineLoadingSubcategories.includes(cacheKey)) return;

      void fetchInlineWeekSubcategoryTransactions(
        cacheKey,
        selectedWeekDetail.week.startDate,
        selectedWeekDetail.week.endDateExclusive,
        subcategoryKey,
      );
    },
    [
      expandedWeekSubcategories,
      fetchInlineWeekSubcategoryTransactions,
      inlineLoadingSubcategories,
      inlineTransactionsBySubcategory,
      selectedWeekDetail,
    ],
  );

  const fetchOutsideBudgetItemTransactions = React.useCallback(
    async (item: BudgetOutsideExpenseItem) => {
      const cacheKey = item.groupKey;

      setOutsideBudgetItemErrors((current) => {
        const next = { ...current };
        delete next[cacheKey];
        return next;
      });
      setOutsideBudgetLoadingItems((current) => {
        if (current.includes(cacheKey)) return current;
        return [...current, cacheKey];
      });

      try {
        if (!item.transactionIds.length) {
          setOutsideBudgetTransactionsByItem((current) => ({
            ...current,
            [cacheKey]: [],
          }));
          return;
        }

        const userId = await requireCurrentUserId();
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id,date,amount,details,counterparty,budget_excluded,category_id_auto,category_id_user",
          )
          .eq("user_id", userId)
          .in("id", item.transactionIds)
          .order("date", { ascending: false });

        if (error) throw error;

        const rows = ((data || []) as Record<string, unknown>[]).map((row) => ({
          id: String(row.id || ""),
          date: String(row.date || ""),
          title: extractTransactionTitle(String(row.details || "")),
          counterparty: row.counterparty ? String(row.counterparty) : null,
          amount: Number(row.amount || 0),
          budgetExcluded: Boolean(row.budget_excluded),
          category_id_auto: row.category_id_auto
            ? String(row.category_id_auto)
            : null,
          category_id_user: row.category_id_user
            ? String(row.category_id_user)
            : null,
        }));

        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          rows.map((row) => row.id),
        );

        setOutsideBudgetTransactionsByItem((current) => ({
          ...current,
          [cacheKey]: rows.map((row) => ({
            ...row,
            subscriptionProfileName: subscriptionNames[row.id] || null,
          })),
        }));
      } catch (error) {
        console.warn("[budget] buiten-budget transacties laden mislukt", error);
        setOutsideBudgetItemErrors((current) => ({
          ...current,
          [cacheKey]: "Kon transacties niet laden.",
        }));
      } finally {
        setOutsideBudgetLoadingItems((current) =>
          current.filter((itemKey) => itemKey !== cacheKey),
        );
      }
    },
    [],
  );

  const toggleOutsideBudgetItem = React.useCallback(
    (item: BudgetOutsideExpenseItem) => {
      const cacheKey = item.groupKey;
      const isExpanded = expandedOutsideBudgetItems.includes(cacheKey);

      setExpandedOutsideBudgetItems((current) => {
        if (current.includes(cacheKey)) {
          return current.filter((itemKey) => itemKey !== cacheKey);
        }
        return [...current, cacheKey];
      });

      if (isExpanded) return;
      if (outsideBudgetTransactionsByItem[cacheKey]) return;
      if (outsideBudgetLoadingItems.includes(cacheKey)) return;

      void fetchOutsideBudgetItemTransactions(item);
    },
    [
      expandedOutsideBudgetItems,
      fetchOutsideBudgetItemTransactions,
      outsideBudgetLoadingItems,
      outsideBudgetTransactionsByItem,
    ],
  );

  const fetchCategoryDetailTransactions = React.useCallback(
    async (categoryKey: VariableBudgetCategoryKey) => {
      if (!categoryById.size) return;

      setCategoryDetailErrors((current) => {
        const next = { ...current };
        delete next[categoryKey];
        return next;
      });
      setCategoryDetailLoadingKeys((current) => {
        if (current.includes(categoryKey)) return current;
        return [...current, categoryKey];
      });

      try {
        const userId = await requireCurrentUserId();
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id,date,amount,details,counterparty,budget_excluded,category_id_auto,category_id_user",
          )
          .eq("user_id", userId)
          .gte("date", selectedMonth.startIso)
          .lt("date", selectedMonth.endIso)
          .lt("amount", 0)
          .order("date", { ascending: false })
          .limit(1000);

        if (error) throw error;

        const categoryIdsForBucket = variableCategoryIdsByBucket.get(categoryKey);
        const rows = ((data || []) as Record<string, unknown>[])
          .map((row) => ({
            id: String(row.id || ""),
            date: String(row.date || ""),
            title: extractTransactionTitle(String(row.details || "")),
            counterparty: row.counterparty ? String(row.counterparty) : null,
            amount: Number(row.amount || 0),
            budgetExcluded: Boolean(row.budget_excluded),
            category_id_auto: row.category_id_auto
              ? String(row.category_id_auto)
              : null,
            category_id_user: row.category_id_user
              ? String(row.category_id_user)
              : null,
          }))
          .filter((row) => {
            if (row.budgetExcluded) return false;
            const effectiveCategoryId = row.category_id_user || row.category_id_auto;
            if (
              effectiveCategoryId &&
              categoryIdsForBucket?.has(effectiveCategoryId)
            ) {
              return true;
            }

            return (
              resolveVariableCategoryKeyForTransaction(row, categoryById) ===
              categoryKey
            );
          });

        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          rows.map((row) => row.id),
        );

        setCategoryDetailTransactionsByKey((current) => ({
          ...current,
          [categoryKey]: rows.map((row) => ({
            ...row,
            subscriptionProfileName: subscriptionNames[row.id] || null,
          })),
        }));
      } catch (error) {
        console.warn("[budget] categorie-detail transacties laden mislukt", error);
        setCategoryDetailErrors((current) => ({
          ...current,
          [categoryKey]: "Kon transacties niet laden.",
        }));
      } finally {
        setCategoryDetailLoadingKeys((current) =>
          current.filter((key) => key !== categoryKey),
        );
      }
    },
    [
      categoryById,
      selectedMonth.endIso,
      selectedMonth.startIso,
      variableCategoryIdsByBucket,
    ],
  );

  React.useEffect(() => {
    if (!selectedMonthCategoryKey) return;
    if (!categoryById.size) return;
    if (categoryDetailTransactionsByKey[selectedMonthCategoryKey]) return;
    if (categoryDetailLoadingKeys.includes(selectedMonthCategoryKey)) return;

    void fetchCategoryDetailTransactions(selectedMonthCategoryKey);
  }, [
    categoryById,
    categoryDetailLoadingKeys,
    categoryDetailTransactionsByKey,
    fetchCategoryDetailTransactions,
    selectedMonthCategoryKey,
  ]);

  const toggleMonthCategoryTransactionBudgetExcluded = React.useCallback(
    async (
      categoryKey: VariableBudgetCategoryKey,
      transactionId: string,
      nextExcluded: boolean,
    ) => {
      if (monthCategoryUpdatingTransactionIds.includes(transactionId)) return;

      setMonthCategoryUpdatingTransactionIds((current) => [
        ...current,
        transactionId,
      ]);
      setCategoryDetailTransactionsByKey((current) => ({
        ...current,
        [categoryKey]: nextExcluded
          ? (current[categoryKey] || []).filter(
              (item) => item.id !== transactionId,
            )
          : (current[categoryKey] || []).map((item) =>
              item.id === transactionId
                ? { ...item, budgetExcluded: nextExcluded }
                : item,
            ),
      }));

      try {
        await setTransactionBudgetExcluded(transactionId, nextExcluded);
        await loadBudget();
      } catch (error) {
        console.warn("[budget] maand-transactie toggle error", error);
        setCategoryDetailTransactionsByKey((current) => ({
          ...current,
          [categoryKey]: (current[categoryKey] || []).map((item) =>
            item.id === transactionId
              ? { ...item, budgetExcluded: !nextExcluded }
              : item,
          ),
        }));
      } finally {
        setMonthCategoryUpdatingTransactionIds((current) =>
          current.filter((id) => id !== transactionId),
        );
      }
    },
    [loadBudget, monthCategoryUpdatingTransactionIds],
  );

  const toggleMonthSummaryTransactionBudgetExcluded = React.useCallback(
    (categoryKey: string, transactionId: string) => {
      const typedCategoryKey = categoryKey as VariableBudgetCategoryKey;
      const currentRows = categoryDetailTransactionsByKey[typedCategoryKey] || [];
      const currentRow = currentRows.find((item) => item.id === transactionId);
      const nextExcluded = !(currentRow?.budgetExcluded ?? false);

      void toggleMonthCategoryTransactionBudgetExcluded(
        typedCategoryKey,
        transactionId,
        nextExcluded,
      );
    },
    [categoryDetailTransactionsByKey, toggleMonthCategoryTransactionBudgetExcluded],
  );

  const toggleMonthSummaryCategory = React.useCallback(
    (categoryKey: string) => {
      const typedCategoryKey = categoryKey as VariableBudgetCategoryKey;
      const isExpanded = expandedMonthSummaryCategories.includes(categoryKey);

      setExpandedMonthSummaryCategories((current) => {
        if (current.includes(categoryKey)) {
          return current.filter((key) => key !== categoryKey);
        }
        return [...current, categoryKey];
      });

      if (isExpanded) return;
      if (categoryDetailTransactionsByKey[typedCategoryKey]) return;
      if (categoryDetailLoadingKeys.includes(typedCategoryKey)) return;
      void fetchCategoryDetailTransactions(typedCategoryKey);
    },
    [
      categoryDetailLoadingKeys,
      categoryDetailTransactionsByKey,
      expandedMonthSummaryCategories,
      fetchCategoryDetailTransactions,
    ],
  );

  React.useEffect(() => {
    setSelectedMonthCategoryKey(null);
    setCategoryDetailTransactionsByKey({});
    setCategoryDetailLoadingKeys([]);
    setCategoryDetailErrors({});
  }, [selectedMonth.startIso]);

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceTopBar
        shellStyle={styles.topBar}
        title="Budget"
        rightSlot={
          <FinanceHeaderActions
            screenId="budget"
            selectedPeriod={{
              key: selectedMonth.key,
              label: selectedMonth.label,
              startIso: selectedMonth.startIso,
              endIsoExclusive: selectedMonth.endIso,
            }}
            screenContext={{
              kind: "budget",
              monthLabel: selectedMonth.label,
              monthBudgetState: monthBudgetSnapshot.state,
              monthStatusLabel: monthBudgetSnapshot.label,
              monthRiskTone,
              remainingVariableBudget: monthlyRemaining,
              spentVariableBudget: monthSpent,
              totalVariableBudget: monthBudgetSnapshot.budget,
              weekStatusLabel: focusWeekSnapshot.label,
              weekRiskTone: focusWeekSnapshot.tone,
              weekRemainingBudget: focusWeekSnapshot.remaining,
              weekTempoDelta: focusWeekSnapshot.tempoDelta,
              upcomingCommittedExpenseTotal:
                assistantForecastSurface?.forecast?.upcomingCommittedExpenseTotal ?? null,
              expectedFixedCosts:
                assistantForecastSurface?.forecast?.expectedFixedCosts ?? null,
              expectedSubscriptions:
                assistantForecastSurface?.forecast?.expectedSubscriptions ?? null,
              forecastExpectedEndBalance:
                assistantForecastSurface?.balances.expectedEndOperationalBalance.amount ??
                null,
              forecastLowestExpectedBalance:
                assistantForecastSurface?.balances.lowestOperationalPointInMonth.amount ??
                null,
              hasForecastData: assistantForecastSurface != null,
            }}
          />
        }
      />

      {loading && !budgetPlan ? (
        <View style={styles.centered}>
          <ActivityIndicator color={FinColors.textSecondary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <FinanceHeroShell
            eyebrow={budgetHeroCopy.eyebrow}
            title={budgetHeroCopy.title}
            subtitle={budgetHeroCopy.subtitle}
          />

          <View style={styles.contentMax}>
            <FinanceMonthSelector
              label={selectedMonth.label}
              canGoToOlderMonth={canGoToOlderMonth}
              canGoToNewerMonth={canGoToNewerMonth}
              onPressLabel={() => setMonthPickerOpen(true)}
              onGoToOlderMonth={() => {
                if (!canGoToOlderMonth) return;
                const nextOption = monthOptions[selectedMonthIndex + 1];
                if (nextOption) setSelectedMonthKey(nextOption.key);
              }}
              onGoToNewerMonth={() => {
                if (!canGoToNewerMonth) return;
                const nextOption = monthOptions[selectedMonthIndex - 1];
                if (nextOption) setSelectedMonthKey(nextOption.key);
              }}
            />
            <View style={styles.scopeBlock}>
              {availableScopeOptions.length > 1 ? (
                <FinanceScopeSwitch
                  value={moneyViewScope}
                  options={availableScopeOptions}
                  onChange={(scope) => void handleScopeChange(scope)}
                />
              ) : null}
            </View>
            <View style={styles.segmentRow}>
              {SEGMENTS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.segmentChip,
                    segment === item.key && styles.segmentChipActive,
                  ]}
                  onPress={() => setSegment(item.key)}
                >
                  <Text
                    style={[
                      styles.segmentChipText,
                      segment === item.key && styles.segmentChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {assistantForecastSurface?.reserveBreakdown ? (
              <View style={styles.reserveSummaryCard}>
                <Text style={styles.reserveSummaryTitle}>Reserveringen deze maand</Text>
                <Text style={styles.reserveSummaryValue}>
                  {fmt.format(
                    assistantForecastSurface.reserveBreakdown
                      .plannedReserveAllocationThisMonth || 0,
                  )}
                </Text>
                <Text style={styles.reserveSummaryMeta}>
                  Jaarlijkse lasten:{" "}
                  {fmt.format(
                    assistantForecastSurface.reserveBreakdown
                      .annualObligationMonthlyTotal || 0,
                  )}{" "}
                  · Buffer:{" "}
                  {fmt.format(
                    assistantForecastSurface.reserveBreakdown
                      .savingsTargetMonthly || 0,
                  )}
                </Text>
                {assistantForecastSurface.confidence ? (
                  <Text style={styles.reserveSummaryConfidence}>
                    {assistantForecastSurface.confidence.currentReservedBalance.label}
                  </Text>
                ) : null}
                {assistantForecastSurface.explainability?.budgetHint ? (
                  <Text style={styles.reserveSummaryHint}>
                    {assistantForecastSurface.explainability.budgetHint}
                  </Text>
                ) : null}
                {assistantForecastSurface.safeToSpendUntilNextIncome != null ? (
                  <Text style={styles.reserveSummaryHint}>
                    {resolveSafetyContextCopy({
                      anchorLabel: assistantForecastSurface.nextIncomeLabelAnchor,
                      anchorDate: assistantForecastSurface.nextIncomeDateAnchor,
                      isEstimatedAnchorDate:
                        assistantForecastSurface.safeToSpendIsEstimatedAnchorDate,
                    }).fullLabel}
                    :{" "}
                    {fmt.format(assistantForecastSurface.safeToSpendUntilNextIncome)}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {segment === "new" ? (
              <SmartBudgetSetupEntryCard
                onStartSmart={() =>
                  router.push({
                    pathname: "/budget/setup",
                    params: { month: selectedMonth.key },
                  })
                }
                onStartManual={() =>
                  router.push({
                    pathname: "/budget/setup",
                    params: { month: selectedMonth.key, stage: "refine" },
                  })
                }
              />
            ) : null}
            <View style={styles.mainStack}>
              {segment === "new" ? (
                <>
                  <BudgetWeekRhythmCard
                    title="Deze week"
                    periodLabel={
                      focusWeek ? formatWeekRangeLabel(focusWeek) : "Nog geen weekdata"
                    }
                    status={getBudgetWeekRhythmStatusLabel(focusWeekSnapshot)}
                    remainingAmount={Math.max(focusWeekSnapshot.remaining || 0, 0)}
                    spentAmount={Math.max(focusWeekSnapshot.spent || 0, 0)}
                    targetAmount={Math.max(focusWeekSnapshot.budget || 0, 0)}
                    progress={weekProgress}
                    tone={focusWeekSnapshot.tone}
                    onPress={
                      focusWeek
                        ? () => openWeekDetail(focusWeek.weekNumber)
                        : undefined
                    }
                  />

                  <BudgetMonthSummaryCard
                    title="Deze maand"
                    status={getBudgetMonthSummaryStatusLabel(monthBudgetSnapshot)}
                    remainingAmount={Math.max(monthBudgetSnapshot.remaining || 0, 0)}
                    usedAmount={Math.max(monthBudgetSnapshot.spent || 0, 0)}
                    totalVariableAmount={Math.max(monthBudgetSnapshot.budget || 0, 0)}
                    tone={monthBudgetSnapshot.tone}
                    onPress={openMonthSummaryDetail}
                  />

                  {budgetPlan ? (
                    <BudgetMonthBreakdownCard
                      items={buildBudgetMonthBreakdownItems(budgetPlan)}
                    />
                  ) : null}

                  {budgetPlan ? (
                    <BudgetPressureList items={buildBudgetPressureItems(budgetPlan)} />
                  ) : null}
                </>
              ) : null}

              {segment === "month" ? (
                <>
                  <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>Nog vrij te besteden</Text>
                <Text style={styles.heroValue}>
                  {monthlyRemaining == null
                    ? "Nog geen data"
                    : fmt.format(Math.max(monthlyRemaining, 0))}
                </Text>
                <FinanceStatusChip
                  label={monthBudgetSnapshot.label}
                  tone={getRiskStatusTone(monthRiskTone)}
                />
                <Text style={styles.heroSupport}>
                  {monthSpent == null || !budgetPlan
                    ? "Maandsturing verschijnt zodra budgetdata beschikbaar is."
                    : getMonthVariableBudgetUsageText(monthBudgetSnapshot, fmt)}
                </Text>
                <FinanceBudgetProgressBar
                  progress={monthProgress}
                  tone={monthRiskTone}
                  style={styles.progressTrack}
                />
                <Text style={styles.heroMeta}>
                  {criticalCount > 0
                    ? `${criticalCount} kritieke risico's`
                    : warningCount > 0
                      ? `${warningCount} aandachtspunt${warningCount > 1 ? "en" : ""}`
                      : "Rustige maand tot nu toe"}
                </Text>
                {completedMonthBaselineHelper ? (
                  <Text style={styles.heroMetaSubtle}>
                    {completedMonthBaselineHelper}
                  </Text>
                ) : null}
                  </View>

                  <BudgetMonthActionCard
                    recommendation={
                      actionRecommendation || "Je ligt goed op schema. Houd dit ritme vast."
                    }
                    onOpenInsights={() => router.push("/insights")}
                    onOpenManage={() => setSegment("manage")}
                  />

                  {positiveLine ? (
                    <View style={styles.positiveCard}>
                      <AppIcon
                        name="wb-sunny"
                        size={18}
                        color={FinColors.warningText}
                      />
                      <Text style={styles.positiveText}>{positiveLine}</Text>
                    </View>
                  ) : null}

                  <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Maandstructuur</Text>
                  <Text style={styles.sectionHelper}>Vaste druk op je maandruimte</Text>
                </View>
                {monthStructureRows.map((row) => {
                  const delta = row.expected - row.actual;
                  const isOver = delta < 0;
                  return (
                    <Pressable
                      key={row.key}
                      style={styles.detailOverviewRow}
                      onPress={() => setDetailSection(row.key)}
                    >
                      <View style={styles.detailOverviewMain}>
                        <Text style={styles.detailOverviewLabel}>{row.label}</Text>
                        <Text style={styles.detailOverviewMeta}>
                          Budget {fmt.format(row.expected)} · {row.itemCount} post
                          {row.itemCount === 1 ? "" : "en"}
                        </Text>
                        <Text style={styles.detailOverviewSub}>{row.helper}</Text>
                      </View>
                      <View style={styles.detailOverviewRight}>
                        <Text style={styles.detailOverviewValue}>
                          {fmt.format(row.actual)}
                        </Text>
                        <Text
                          style={[
                            styles.detailOverviewDelta,
                            isOver
                              ? styles.detailOverviewDeltaCritical
                              : styles.detailOverviewDeltaPositive,
                          ]}
                        >
                          {isOver
                            ? `${fmt.format(Math.abs(delta))} erboven`
                            : `${fmt.format(delta)} ruimte`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                  </View>

                  <View style={styles.card}>
                <Text style={styles.sectionTitle}>Categorieoverzicht</Text>
                {categoryRows.map((row) => (
                  <Pressable
                    key={row.categoryKey}
                    style={styles.categoryListRow}
                    onPress={() =>
                      openMonthCategoryDetail(
                        row.categoryKey as VariableBudgetCategoryKey,
                      )
                    }
                    >
                    <View style={styles.categoryListMain}>
                      <View style={styles.categoryListIconBubble}>
                        <AppIcon
                          name={getVariableCategoryIconName(row.categoryKey)}
                          size={18}
                          color={FinColors.textPrimary}
                          variant="outlined"
                        />
                      </View>
                      <View style={styles.categoryMain}>
                        <Text style={styles.categoryLabel}>{row.label}</Text>
                        <Text style={styles.categoryMeta}>
                          Maandbudget {fmt.format(row.monthlyBudget)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryValue}>
                        {fmt.format(Math.max(row.monthlyBudget - row.monthlyActual, 0))}
                      </Text>
                      <Text
                        style={[
                          styles.categoryStatusText,
                          getRiskStyle(getBudgetRiskTone(row.utilization)).text,
                        ]}
                      >
                        {getBudgetRiskLabel(row.utilization)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                  </View>

                  <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Wekenoverzicht deze maand</Text>
                  <Text style={styles.sectionHelper}>Van week 1 tot nu</Text>
                </View>
                {historicalWeeks.map((week) => {
                  const weekRiskTone = getBudgetRiskTone(week.utilization);
                  const riskStyle = getRiskStyle(weekRiskTone);

                  return (
                    <Pressable
                      key={week.endDateExclusive}
                      style={[
                        styles.historyRow,
                        week.isCurrentWeek && styles.historyRowCurrent,
                      ]}
                      onPress={() => openWeekDetail(week.weekNumber)}
                    >
                      <View style={styles.historyHeaderRow}>
                        <View style={styles.historyLabelWrap}>
                          <View style={styles.historyLabelRow}>
                            <Text style={styles.historyLabel}>
                              {formatBudgetWeekLabel(week)}
                            </Text>
                            {week.isCurrentWeek ? (
                              <View style={styles.currentWeekChip}>
                                <Text style={styles.currentWeekChipText}>
                                  Deze week
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.historyMeta}>
                            {formatWeekRangeLabel(week)}
                          </Text>
                        </View>
                        <View style={[styles.statusChip, riskStyle.chip]}>
                          <Text style={[styles.statusChipText, riskStyle.text]}>
                            {getBudgetRiskLabel(week.utilization)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyValuesRow}>
                        <Text style={styles.historyValue}>
                          {fmt.format(week.actual)} van {fmt.format(week.budget)}
                        </Text>
                        <Text style={styles.historyDelta}>
                          {week.remaining >= 0
                            ? `${fmt.format(week.remaining)} over`
                            : `${fmt.format(Math.abs(week.remaining))} erboven`}
                        </Text>
                      </View>
                      <RiskProgressBar
                        progress={getBudgetRiskProgress(week.utilization)}
                        tone={weekRiskTone}
                        style={styles.progressTrack}
                      />
                    </Pressable>
                  );
                })}
                  </View>

                  <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Spaardoel</Text>
                  <Text style={styles.sectionHelper}>
                    {Math.round((budgetPlan?.savingsProgress.progressActual ?? 0) * 100)}% gehaald
                  </Text>
                </View>
                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Aanbevolen sparen</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(budgetPlan?.savingsProgress.recommendedSavings || 0)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Werkelijk verdiend</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(budgetPlan?.savingsProgress.earnedActual || 0)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Op schema verdiend</Text>
                    <Text style={styles.summaryValueMuted}>
                      {fmt.format(budgetPlan?.savingsProgress.earnedOnTrack || 0)}
                    </Text>
                  </View>
                </View>
                  </View>

                  {budgetPlan && budgetPlan.outsideBudgetExpenses.total > 0 ? (
                    <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.sectionTitle}>Buiten budget</Text>
                    <Pressable onPress={() => setOutsideBudgetOpen(true)}>
                      <Text style={styles.sectionLinkText}>Bekijk alles</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.supportText}>
                    Uitgaven die je bewust buiten je budget hebt gelaten.
                  </Text>
                  <Text style={styles.outsideBudgetTotalText}>
                    {fmt.format(budgetPlan.outsideBudgetExpenses.total)}
                  </Text>
                  <Text style={styles.outsideBudgetMetaText}>
                    {outsideBudgetTransactionCount} transactie
                    {outsideBudgetTransactionCount === 1 ? "" : "s"} uitgesloten
                  </Text>
                    </View>
                  ) : null}

                  {budgetPlan?.warnings.length ? (
                    <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Waarschuwingen</Text>
                  {budgetPlan.warnings.slice(0, 4).map((warning) => (
                    <View key={warning.message} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{warning.message}</Text>
                    </View>
                  ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              {segment === "manage" ? (
                <>
                  <FinanceSettingsGroup title="Route kiezen">
                    <View style={styles.manageGroupContent}>
                      <View style={styles.manageSection}>
                        <Text style={styles.manageSectionTitle}>
                          Slim met Budio staat voorop
                        </Text>
                        <Text style={styles.manageSectionDescription}>
                          Start met een voorstel van Budio. Handmatig instellen blijft beschikbaar als tweede route.
                        </Text>
                        <View style={styles.manageRouteActions}>
                          <FinanceButton
                            label="Slim met Budio"
                            onPress={() =>
                              router.push({
                                pathname: "/budget/setup",
                                params: { month: selectedMonth.key },
                              })
                            }
                            style={styles.manageRouteButton}
                          />
                          <FinanceButton
                            label="Handmatig"
                            variant="secondary"
                            onPress={() => setSegment("manage")}
                            style={styles.manageRouteButton}
                          />
                        </View>
                      </View>
                    </View>
                  </FinanceSettingsGroup>
                  <FinanceSettingsGroup title="Aanpak">
                    <View style={styles.manageGroupContent}>
                      <View style={styles.manageSection}>
                        <Text style={styles.manageSectionTitle}>Budgetmodus</Text>
                        <Text style={styles.manageSectionDescription}>
                          Kies hoe Budio je maandruimte en spaardoel voor deze maand opbouwt.
                        </Text>
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
                                onPress={() =>
                                  handleBudgetModeDraftChange(option.value)
                                }
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
                        <Text style={styles.manageCompactSupport}>
                          {getBudgetModeDescription(budgetModeDraft)}
                        </Text>
                        <View style={styles.managePreviewSurface}>
                          <View style={styles.managePreviewHeader}>
                            <View style={styles.managePreviewMain}>
                              <Text style={styles.managePreviewLabel}>
                                {manageBudgetPreview.label}
                              </Text>
                              <Text style={styles.managePreviewMeta}>
                                {manageBudgetPreview.meta}
                              </Text>
                            </View>
                            <Text style={styles.managePreviewValue}>
                              {fmt.format(manageBudgetPreview.amount)}
                            </Text>
                          </View>
                          {budgetModeDraft === "custom" ? (
                            <View style={styles.modeSliderWrap}>
                              <BudgetAmountSlider
                                value={savingsTargetMonthlyDraft}
                                min={0}
                                max={savingsSliderMax}
                                step={SAVINGS_SLIDER_STEP}
                                onChange={handleSavingsTargetMonthlyDraftChange}
                              />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </FinanceSettingsGroup>

                  <FinanceSettingsGroup title="Bronnen">
                    <View style={styles.manageGroupContent}>
                      <View style={styles.manageSection}>
                        <View style={styles.manageSectionHeaderRow}>
                          <View style={styles.manageSectionHeaderMain}>
                            <Text style={styles.manageSectionTitle}>
                              Inkomstenbasis
                            </Text>
                            <Text style={styles.manageSectionDescription}>
                              Kies welke vaste inkomsten Budio meeneemt in je maandplan.
                            </Text>
                          </View>
                          <View style={styles.manageMetricPill}>
                            <Text style={styles.manageMetricPillLabel}>
                              Meegeteld
                            </Text>
                            <Text style={styles.manageMetricPillValue}>
                              {fmt.format(includedIncomePreview)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.choiceWrap}>
                          {INCOME_SOURCE_OPTIONS.map((option) => {
                            const selected = budgetIncomeDraft[option.key];
                            return (
                              <Pressable
                                key={option.key}
                                style={[
                                  styles.choiceChip,
                                  selected && styles.choiceChipActive,
                                ]}
                                onPress={() => handleIncomeDraftToggle(option.key)}
                              >
                                <View style={styles.choiceChipInner}>
                                  <AppIcon
                                    name={
                                      selected
                                        ? "check-circle"
                                        : "radio-button-unchecked"
                                    }
                                    size={16}
                                    color={
                                      selected
                                        ? FinColors.textPrimary
                                        : FinColors.textMuted
                                    }
                                  />
                                  <Text
                                    style={[
                                      styles.choiceChipText,
                                      selected &&
                                        styles.choiceChipTextActive,
                                    ]}
                                  >
                                    {option.label}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.manageDivider} />

                      <View style={styles.manageSection}>
                        <Text style={styles.manageSectionTitle}>
                          Zo bouwt Budio je maandruimte op
                        </Text>
                        <Text style={styles.manageSectionDescription}>
                          Een compacte verdeling van wat binnenkomt, wat vastligt en wat overblijft.
                        </Text>
                        <View style={styles.summaryList}>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Inkomend budget</Text>
                            <Text style={styles.summaryValue}>
                              {fmt.format(
                                draftBudgetAllocationSummary.incomingBudget,
                              )}
                            </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Vaste lasten</Text>
                            <Text style={styles.summaryValueNegative}>
                              -{fmt.format(draftBudgetAllocationSummary.fixedCosts)}
                            </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Abonnementen</Text>
                            <Text style={styles.summaryValueNegative}>
                              -{fmt.format(
                                draftBudgetAllocationSummary.subscriptions,
                              )}
                            </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>
                              Variabele ruimte
                            </Text>
                            <Text style={styles.summaryValueNegative}>
                              -{fmt.format(draftBudgetAllocationSummary.variable)}
                            </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Sparen</Text>
                            <Text style={styles.summaryValueNegative}>
                              -{fmt.format(
                                draftBudgetAllocationSummary.savingsTarget,
                              )}
                            </Text>
                          </View>
                          <View style={styles.summaryDivider} />
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabelStrong}>
                              Resterende ruimte
                            </Text>
                            <Text
                              style={[
                                styles.summaryValueStrong,
                                draftBudgetAllocationSummary.isOverAllocated
                                  ? styles.summaryValueCritical
                                  : styles.summaryValuePositive,
                              ]}
                            >
                              {fmt.format(draftBudgetAllocationSummary.remaining)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.compactBreakdownText}>
                          Voorspelling volgt nu{" "}
                          {formatForecastExpenseSourceLabel(
                            forecastExpenseSourceDraft,
                          ).toLowerCase()}
                          . {getForecastExpenseSourceDescription(forecastExpenseSourceDraft)}
                        </Text>
                        {draftBudgetAllocationSummary.isOverAllocated ? (
                          <FinanceInlineCallout
                            iconName="warning-amber"
                            tone="highlight"
                            text="Je planning ligt boven je inkomend budget. Verlaag een categoriebedrag of je spaardoel."
                          />
                        ) : null}
                      </View>

                      <View style={styles.manageDivider} />

                      <View style={styles.manageSection}>
                        <FinanceSettingsRow
                          iconName="tune"
                          label="Categoriebudgetten"
                          subtitle={categoryBudgetSummarySubtitle}
                          onPress={() =>
                            setManageCategoryBudgetsOpen((current) => !current)
                          }
                          rightElement={
                            <View style={styles.manageDisclosureRight}>
                              <View
                                style={[
                                  styles.statusChip,
                                  getRiskStyle(variableAllocationFeedback.tone).chip,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusChipText,
                                    getRiskStyle(variableAllocationFeedback.tone)
                                      .text,
                                  ]}
                                >
                                  {manageCategoryBudgetStatusLabel}
                                </Text>
                              </View>
                              <AppIcon
                                name={
                                  manageCategoryBudgetsOpen
                                    ? "expand-more"
                                    : "chevron-right"
                                }
                                size={18}
                                color={FinColors.textSecondary}
                              />
                            </View>
                          }
                        />

                        {manageCategoryBudgetsOpen ? (
                          <View style={styles.manageExpandableContent}>
                            <View style={styles.manageExpandableHeader}>
                              <View style={styles.manageExpandableHeaderMain}>
                                <Text style={styles.sectionHelper}>
                                  {selectedMonth.label}
                                </Text>
                                {completedMonthBaselineHelper ? (
                                  <Text style={styles.compactBreakdownText}>
                                    {completedMonthBaselineHelper}
                                  </Text>
                                ) : null}
                                <Text style={styles.compactBreakdownText}>
                                  Deze bedragen gebruik je ook in Voorspelling
                                  als je daar Budgetplan kiest. Trend volgt je
                                  recente maandritme; Vast laat jouw bedrag
                                  staan bij herverdeling.
                                </Text>
                              </View>
                              <Pressable
                                style={styles.manageTertiaryAction}
                                onPress={() => void applyLatestTrendBudgets()}
                                disabled={recalculatingBudget || savingManage}
                              >
                                <Text style={styles.manageTertiaryActionText}>
                                  {recalculatingBudget
                                    ? "Trendbedragen verversen..."
                                    : "Herstel trendbedragen"}
                                </Text>
                              </Pressable>
                            </View>

                            {editableBudgetRows.map((row) => {
                              const rowLocked = lockedVariableCategorySet.has(
                                row.categoryKey,
                              );
                              const rowIsVariableBreakdown =
                                isVariableBreakdownKey(row.categoryKey);
                              const rowIsVariableTotal =
                                row.categoryKey === "variable_costs";
                              const rowIsSavingsTarget =
                                row.categoryKey === "savings_target";
                              const rowControlsDisabled =
                                savingManage || recalculatingBudget;
                              const inputDisabled =
                                rowIsVariableTotal || rowControlsDisabled;
                              const rowVisualDisabled =
                                rowIsVariableTotal || rowControlsDisabled;

                              if (rowIsSavingsTarget) {
                                return null;
                              }

                              if (rowIsVariableTotal) {
                                return (
                                  <View
                                    key={row.categoryKey}
                                    style={styles.variableBudgetSummaryCard}
                                  >
                                    <View
                                      style={styles.variableBudgetSummaryHeader}
                                    >
                                      <View
                                        style={
                                          styles.variableBudgetSummaryMain
                                        }
                                      >
                                        <Text style={styles.editLabel}>
                                          Variabele uitgaven
                                        </Text>
                                        <Text style={styles.editMeta}>
                                          Beschikbaar{" "}
                                          {fmt.format(
                                            variableBudgetDraftSummary.available,
                                          )}
                                        </Text>
                                      </View>
                                      <View
                                        style={styles.variableBudgetSummaryRight}
                                      >
                                        <Text
                                          style={
                                            styles.variableBudgetSummaryValueLabel
                                          }
                                        >
                                          Verdeeld nu
                                        </Text>
                                        <Text
                                          style={styles.variableBudgetSummaryValue}
                                        >
                                          {fmt.format(
                                            variableBudgetDraftSummary.breakdownTotal,
                                          )}
                                        </Text>
                                      </View>
                                    </View>
                                    <Text
                                      style={[
                                        styles.variableBudgetSummaryStatus,
                                        variableAllocationFeedback.tone ===
                                          "good" &&
                                          styles.variableBudgetSummaryStatusGood,
                                        variableAllocationFeedback.tone ===
                                          "watch" &&
                                          styles.variableBudgetSummaryStatusWatch,
                                        variableAllocationFeedback.tone ===
                                          "critical" &&
                                          styles.variableBudgetSummaryStatusCritical,
                                      ]}
                                    >
                                      {variableAllocationFeedback.label}
                                    </Text>
                                  </View>
                                );
                              }

                              return (
                                <View
                                  key={row.categoryKey}
                                  style={[
                                    styles.editRow,
                                    rowIsVariableBreakdown &&
                                      styles.editRowChild,
                                    rowVisualDisabled &&
                                      styles.editRowDisabled,
                                  ]}
                                >
                                  <View style={styles.editMain}>
                                    <Text
                                      style={[
                                        styles.editLabel,
                                        rowIsVariableBreakdown &&
                                          styles.editLabelChild,
                                      ]}
                                    >
                                      {rowIsVariableBreakdown
                                        ? `└ ${getBudgetCategoryDisplayLabel(
                                            row.categoryKey,
                                          )}`
                                        : getBudgetCategoryDisplayLabel(
                                            row.categoryKey,
                                          )}
                                    </Text>
                                    <Text style={styles.editMeta}>
                                      Trend{" "}
                                      {fmt.format(
                                        Math.round(row.baselineMonthly),
                                      )}{" "}
                                      · Uitgegeven {fmt.format(row.monthlyActual)}{" "}
                                      · Nu{" "}
                                      {formatBudgetSourceLabel(
                                        row.overrideSource,
                                      )}
                                    </Text>
                                  </View>
                                  <View style={styles.editControls}>
                                    {rowIsVariableBreakdown ? (
                                      <>
                                        <Pressable
                                          style={styles.editActionButton}
                                          onPress={() =>
                                            resetVariableCategoryToTrend(
                                              row.categoryKey,
                                            )
                                          }
                                          disabled={rowControlsDisabled}
                                        >
                                          <Text
                                            style={styles.editActionButtonText}
                                          >
                                            Trend
                                          </Text>
                                        </Pressable>
                                        <Pressable
                                          style={[
                                            styles.editActionButton,
                                            rowLocked &&
                                              styles.editActionButtonActive,
                                          ]}
                                          onPress={() =>
                                            toggleVariableCategoryLock(
                                              row.categoryKey,
                                            )
                                          }
                                          disabled={rowControlsDisabled}
                                        >
                                          <AppIcon
                                            name={
                                              rowLocked ? "lock" : "lock-open"
                                            }
                                            size={12}
                                            color={
                                              rowLocked
                                                ? FinColors.green
                                                : FinColors.textSecondary
                                            }
                                          />
                                          <Text
                                            style={[
                                              styles.editActionButtonText,
                                              rowLocked &&
                                                styles.editActionButtonTextActive,
                                            ]}
                                          >
                                            Vast
                                          </Text>
                                        </Pressable>
                                      </>
                                    ) : null}
                                    <TextInput
                                      value={
                                        budgetDraftValues[row.categoryKey] ??
                                        formatBudgetAmountDraft(
                                          row.monthlyBudget,
                                        )
                                      }
                                      onChangeText={(text) => {
                                        if (inputDisabled) return;
                                        handleBudgetDraftValueChange(
                                          row.categoryKey,
                                          text,
                                        );
                                      }}
                                      onBlur={() => {
                                        if (inputDisabled) return;
                                        handleBudgetDraftValueBlur(
                                          row.categoryKey,
                                        );
                                      }}
                                      editable={!inputDisabled}
                                      style={[
                                        styles.editInput,
                                        inputDisabled &&
                                          styles.editInputDisabled,
                                      ]}
                                      keyboardType="number-pad"
                                    />
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </FinanceSettingsGroup>

                  <FinanceSettingsGroup title="Reserves / jaarlijkse lasten">
                    <View style={styles.manageGroupContent}>
                      <View style={styles.manageSection}>
                        <FinanceSettingsRow
                          iconName="savings"
                          label="Wat Budio deze maand apart zet"
                          subtitle={
                            activeAnnualReserveRules.length
                              ? `${formatCountLabel(
                                  activeAnnualReserveRules.length,
                                  "actieve regel",
                                  "actieve regels",
                                )} voor piekmomenten`
                              : "Nog geen actieve jaarlijkse lasten gevonden"
                          }
                          value={fmt.format(annualReserveInlineAmount)}
                          onPress={() => setReserveRulesSheetOpen(true)}
                        />
                        <Text style={styles.manageCompactSupport}>
                          Jaarlijkse lasten zetten maandelijks geld opzij voor
                          terugkerende piekmomenten. Buffer kan daarnaast apart
                          gereserveerd blijven.
                        </Text>
                        {annualReservePreviewRules.length ? (
                          <View style={styles.managePreviewList}>
                            {annualReservePreviewRules.map((rule) => (
                              <View key={rule.id} style={styles.reserveRuleRow}>
                                <Text style={styles.reserveRuleLabel}>
                                  {rule.label}
                                </Text>
                                <Text style={styles.reserveRuleAmount}>
                                  {fmt.format(rule.monthlyAmount)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.supportText}>
                            Nog geen jaarlijkse reserveringen gevonden.
                          </Text>
                        )}
                      </View>
                    </View>
                  </FinanceSettingsGroup>

                  <View style={styles.actionCard}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => void saveManageChanges()}
                  disabled={savingManage || recalculatingBudget}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingManage ? "Opslaan..." : "Opslaan"}
                  </Text>
                </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}

      <FinanceMonthSelectorModal
        visible={monthPickerOpen}
        selectedKey={selectedMonth.key}
        onClose={() => setMonthPickerOpen(false)}
        onConfirm={setSelectedMonthKey}
        monthOptions={monthOptions}
      />

      <FinanceBottomSheetShell
        visible={incomeSourcesSheetOpen}
        title="Inkomend budget"
        subtitle="Kies welke inkomsten Budio meeneemt voor je maandruimte."
        onClose={() => setIncomeSourcesSheetOpen(false)}
      >
        <View style={styles.manageSheetContent}>
          <View style={styles.choiceWrap}>
            {INCOME_SOURCE_OPTIONS.map((option) => {
              const selected = budgetIncomeDraft[option.key];
              return (
                <Pressable
                  key={option.key}
                  style={[
                    styles.choiceChip,
                    selected && styles.choiceChipActive,
                  ]}
                  onPress={() => handleIncomeDraftToggle(option.key)}
                >
                  <View style={styles.choiceChipInner}>
                    <AppIcon
                      name={selected ? "check-circle" : "radio-button-unchecked"}
                      size={16}
                      color={selected ? FinColors.textPrimary : FinColors.textMuted}
                    />
                    <Text
                      style={[
                        styles.choiceChipText,
                        selected && styles.choiceChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={budgetDistributionSheetOpen}
        title="Budget verdeling"
        subtitle="Pas categoriebedragen aan voor deze maand."
        onClose={() => setBudgetDistributionSheetOpen(false)}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.manageSheetContent}
        >
          <View style={styles.manageExpandableHeader}>
            <View style={styles.manageExpandableHeaderMain}>
              <Text style={styles.sectionHelper}>{selectedMonth.label}</Text>
              {completedMonthBaselineHelper ? (
                <Text style={styles.compactBreakdownText}>
                  {completedMonthBaselineHelper}
                </Text>
              ) : null}
              <Text style={styles.compactBreakdownText}>
                Deze bedragen gebruik je ook in Voorspelling als je daar
                Budgetplan kiest.
              </Text>
            </View>
            <FinanceButton
              label={
                recalculatingBudget
                  ? "Trendbedragen verversen..."
                  : "Herstel trendbedragen"
              }
              variant="ghost"
              size="sm"
              style={styles.manageTertiaryAction}
              labelStyle={styles.manageTertiaryActionText}
              onPress={() => void applyLatestTrendBudgets()}
              disabled={recalculatingBudget || savingManage}
            />
          </View>

          {editableBudgetRows.map((row) => {
            const rowLocked = lockedVariableCategorySet.has(row.categoryKey);
            const rowIsVariableBreakdown = isVariableBreakdownKey(row.categoryKey);
            const rowIsVariableTotal = row.categoryKey === "variable_costs";
            const rowIsSavingsTarget = row.categoryKey === "savings_target";
            const rowControlsDisabled = savingManage || recalculatingBudget;
            const inputDisabled = rowIsVariableTotal || rowControlsDisabled;
            const rowVisualDisabled = rowIsVariableTotal || rowControlsDisabled;

            if (rowIsSavingsTarget) {
              return null;
            }

            if (rowIsVariableTotal) {
              return (
                <View
                  key={row.categoryKey}
                  style={styles.variableBudgetSummaryCard}
                >
                  <View style={styles.variableBudgetSummaryHeader}>
                    <View style={styles.variableBudgetSummaryMain}>
                      <Text style={styles.editLabel}>Variabele uitgaven</Text>
                      <Text style={styles.editMeta}>
                        Beschikbaar{" "}
                        {fmt.format(variableBudgetDraftSummary.available)}
                      </Text>
                    </View>
                    <View style={styles.variableBudgetSummaryRight}>
                      <Text style={styles.variableBudgetSummaryValueLabel}>
                        Verdeeld nu
                      </Text>
                      <Text style={styles.variableBudgetSummaryValue}>
                        {fmt.format(variableBudgetDraftSummary.breakdownTotal)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.variableBudgetSummaryStatus,
                      variableAllocationFeedback.tone === "good" &&
                        styles.variableBudgetSummaryStatusGood,
                      variableAllocationFeedback.tone === "watch" &&
                        styles.variableBudgetSummaryStatusWatch,
                      variableAllocationFeedback.tone === "critical" &&
                        styles.variableBudgetSummaryStatusCritical,
                    ]}
                  >
                    {variableAllocationFeedback.label}
                  </Text>
                </View>
              );
            }

            return (
              <View
                key={row.categoryKey}
                style={[
                  styles.editRow,
                  rowIsVariableBreakdown && styles.editRowChild,
                  rowVisualDisabled && styles.editRowDisabled,
                ]}
              >
                <View style={styles.editMain}>
                  <Text
                    style={[
                      styles.editLabel,
                      rowIsVariableBreakdown && styles.editLabelChild,
                    ]}
                  >
                    {rowIsVariableBreakdown
                      ? `└ ${getBudgetCategoryDisplayLabel(row.categoryKey)}`
                      : getBudgetCategoryDisplayLabel(row.categoryKey)}
                  </Text>
                  <Text style={styles.editMeta}>
                    Trend {fmt.format(Math.round(row.baselineMonthly))} ·
                    Uitgegeven {fmt.format(row.monthlyActual)} · Nu{" "}
                    {formatBudgetSourceLabel(row.overrideSource)}
                  </Text>
                </View>
                <View style={styles.editControls}>
                  {rowIsVariableBreakdown ? (
                    <>
                      <Pressable
                        style={styles.editActionButton}
                        onPress={() => resetVariableCategoryToTrend(row.categoryKey)}
                        disabled={rowControlsDisabled}
                      >
                        <Text style={styles.editActionButtonText}>Trend</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.editActionButton,
                          rowLocked && styles.editActionButtonActive,
                        ]}
                        onPress={() => toggleVariableCategoryLock(row.categoryKey)}
                        disabled={rowControlsDisabled}
                      >
                        <AppIcon
                          name={rowLocked ? "lock" : "lock-open"}
                          size={12}
                          color={
                            rowLocked ? FinColors.green : FinColors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.editActionButtonText,
                            rowLocked && styles.editActionButtonTextActive,
                          ]}
                        >
                          Vast
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                  <TextInput
                    value={
                      budgetDraftValues[row.categoryKey] ??
                      formatBudgetAmountDraft(row.monthlyBudget)
                    }
                    onChangeText={(text) => {
                      if (inputDisabled) return;
                      handleBudgetDraftValueChange(row.categoryKey, text);
                    }}
                    onBlur={() => {
                      if (inputDisabled) return;
                      handleBudgetDraftValueBlur(row.categoryKey);
                    }}
                    editable={!inputDisabled}
                    style={[
                      styles.editInput,
                      inputDisabled && styles.editInputDisabled,
                    ]}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={reserveRulesSheetOpen}
        title="Jaarlijkse lasten"
        subtitle="Zet maandelijks rustig geld opzij voor terugkerende piekmomenten."
        onClose={() => setReserveRulesSheetOpen(false)}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reserveRulesSheetContent}
        >
          <View style={styles.reserveRuleSheetSummaryCard}>
            <Text style={styles.reserveRuleSheetSummaryTitle}>Reservering nu</Text>
            <View style={styles.reserveRuleSheetSummaryGrid}>
              <View style={styles.reserveRuleSheetSummaryItem}>
                <Text style={styles.reserveRuleSheetSummaryLabel}>
                  Gereserveerd totaal
                </Text>
                <Text style={styles.reserveRuleSheetSummaryValue}>
                  {annualReserveSheetSummary.totalReserved == null
                    ? "Nog niet bekend"
                    : fmt.format(annualReserveSheetSummary.totalReserved)}
                </Text>
              </View>
              <View style={styles.reserveRuleSheetSummaryItem}>
                <Text style={styles.reserveRuleSheetSummaryLabel}>
                  Buffer gereserveerd
                </Text>
                <Text style={styles.reserveRuleSheetSummaryValue}>
                  {annualReserveSheetSummary.bufferReserved == null
                    ? "Nog niet bekend"
                    : fmt.format(annualReserveSheetSummary.bufferReserved)}
                </Text>
              </View>
              {annualReserveSheetSummary.reservedInAccounts != null &&
              annualReserveSheetSummary.reservedInAccounts > 0 ? (
                <View style={styles.reserveRuleSheetSummaryItem}>
                  <Text style={styles.reserveRuleSheetSummaryLabel}>
                    Op spaarrekening
                  </Text>
                  <Text style={styles.reserveRuleSheetSummaryValue}>
                    {fmt.format(annualReserveSheetSummary.reservedInAccounts)}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.reserveRuleSheetSummaryItem,
                  styles.reserveRuleSheetSummaryItemSeparated,
                ]}
              >
                <Text style={styles.reserveRuleSheetSummaryLabel}>
                  Jaarlijkse lasten actief
                </Text>
                <Text style={styles.reserveRuleSheetSummaryValue}>
                  {fmt.format(annualReserveSheetSummary.annualActive || 0)}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.reserveRuleSheetSummaryContext}>
            Je buffer kan al gereserveerd zijn zonder jaarlijkse lastenregels.
            Spaarrekening-saldo telt dan mee in het gereserveerde totaal.
          </Text>

          {annualReserveRules.length ? (
            annualReserveRules.map((rule) => {
              const isActive = rule.status === "active";
              return (
                <View key={rule.id} style={styles.reserveRuleSheetCard}>
                  <View style={styles.reserveRuleSheetHeader}>
                    <View style={styles.reserveRuleSheetMain}>
                      <Text style={styles.reserveRuleSheetTitle}>{rule.label}</Text>
                      <View style={styles.reserveRuleSheetAmountRow}>
                        <Text style={styles.reserveRuleSheetAmountValue}>
                          {fmt.format(rule.monthlyAmount)}/mnd
                        </Text>
                        <View style={styles.reserveRuleSheetSourceBadge}>
                          <Text style={styles.reserveRuleSheetSourceBadgeText}>
                            {rule.source === "inferred"
                              ? "Automatisch"
                              : "Handmatig"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.reserveRuleStatusChip,
                        isActive && styles.reserveRuleStatusChipActive,
                      ]}
                      onPress={() =>
                        void handleReserveRuleStatusChange(rule.id, !isActive)
                      }
                    >
                      <Text
                        style={[
                          styles.reserveRuleStatusChipText,
                          isActive && styles.reserveRuleStatusChipTextActive,
                        ]}
                      >
                        {isActive ? "Actief" : "Gepauzeerd"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.reserveRuleEditorRow}>
                    <View style={styles.reserveRuleInputWrap}>
                      <Text style={styles.reserveRuleInputLabel}>
                        Bedrag per maand
                      </Text>
                      <TextInput
                        value={reserveRuleAmountDrafts[rule.id] || ""}
                        onChangeText={(text) =>
                          setReserveRuleAmountDrafts((prev) => ({
                            ...prev,
                            [rule.id]: String(text || "").replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.reserveRuleInput}
                      />
                    </View>
                    <Pressable
                      style={styles.reserveRuleSaveButton}
                      onPress={() => void handleReserveRuleAmountSave(rule)}
                    >
                      <Text style={styles.reserveRuleSaveButtonText}>Bewaar</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.reserveRuleSheetCard}>
              <Text style={styles.supportText}>
                Nog geen jaarlijkse lasten gevonden.
              </Text>
            </View>
          )}
        </ScrollView>
      </FinanceBottomSheetShell>

      <Modal
        animationType="slide"
        transparent
        visible={detailSection != null}
        onRequestClose={() => setDetailSection(null)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderMain}>
                <Text style={styles.sheetTitle}>
                  {detailExpectedAndActual?.label || "Maandstructuur"}
                </Text>
                <Text style={styles.sheetSub}>
                  Actuele posten die deze maand onder deze vaste laag vallen
                </Text>
              </View>
              <Pressable
                style={styles.sheetCloseButton}
                onPress={() => setDetailSection(null)}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            {detailExpectedAndActual ? (
              <>
                <View style={styles.sheetSummaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Verwacht budget</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(detailExpectedAndActual.expected)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Actueel geboekt</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(detailExpectedAndActual.actual)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelStrong}>
                      {detailExpectedAndActual.actual >
                      detailExpectedAndActual.expected
                        ? "Boven budget"
                        : "Resterende ruimte"}
                    </Text>
                    <Text
                      style={[
                        styles.summaryValueStrong,
                        detailExpectedAndActual.actual >
                        detailExpectedAndActual.expected
                          ? styles.summaryValueCritical
                          : styles.summaryValuePositive,
                      ]}
                    >
                      {fmt.format(
                        Math.abs(
                          detailExpectedAndActual.expected -
                            detailExpectedAndActual.actual,
                        ),
                      )}
                    </Text>
                  </View>
                </View>

                {detailSection === "subscriptions" ? (
                  <View style={styles.detailSheetActionRow}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        setDetailSection(null);
                        router.push("/subscriptions");
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Beheer abonnementen
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollContent}
                >
                  {detailItems.length ? (
                    detailItems.map((item, index) => (
                      <View
                        key={`${item.label}-${index}`}
                        style={styles.detailListRow}
                      >
                        <View style={styles.detailListMain}>
                          <Text style={styles.detailListLabel}>{item.label}</Text>
                          <Text style={styles.detailListMeta}>
                            {item.transactionCount} transactie
                            {item.transactionCount === 1 ? "" : "s"} · laatst{" "}
                            {formatDetailDateLabel(item.lastTransactionDate)}
                          </Text>
                        </View>
                        <Text style={styles.detailListAmount}>
                          {fmt.format(item.amount)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.supportText}>
                      Nog geen posten gevonden voor deze sectie.
                    </Text>
                  )}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <BudgetWeekBreakdownModal
        visible={isSummaryBreakdownModalVisible}
        onClose={isWeekSummaryModal ? closeWeekDetail : closeMonthSummaryDetail}
        title={summaryBreakdownModalTitle}
        periodLabel={summaryBreakdownModalPeriodLabel}
        totalSpent={summaryBreakdownModalTotalSpent}
        totalBudget={summaryBreakdownModalTotalBudget}
        items={summaryBreakdownModalItems}
        expandedCategoryKeys={summaryBreakdownExpandedCategoryKeys}
        onToggleCategory={isWeekSummaryModal ? toggleWeekSummaryCategory : toggleMonthSummaryCategory}
        transactionsByCategory={summaryBreakdownTransactionsByCategory}
        loadingCategoryKeys={summaryBreakdownLoadingCategoryKeys}
        categoryErrors={summaryBreakdownCategoryErrors}
        categoryById={categoryById}
        onOpenTransaction={openInlineTransactionDetail}
        onExcludeTransaction={
          isMonthSummaryModal
            ? toggleMonthSummaryTransactionBudgetExcluded
            : undefined
        }
        updatingTransactionIds={
          isMonthSummaryModal ? monthCategoryUpdatingTransactionIds : []
        }
      />

      <Modal
        animationType="slide"
        transparent
        visible={selectedWeekDetail != null && !isWeekSummaryModal}
        onRequestClose={closeWeekDetail}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderMain}>
                <Text style={styles.sheetTitle}>
                  {selectedWeekDetail
                    ? formatBudgetWeekLabel(selectedWeekDetail.week)
                    : "Weekdetail"}
                </Text>
                {selectedWeekDetail ? (
                  <Text style={styles.sheetSub}>
                    {formatWeekRangeLabel(selectedWeekDetail.week)} · categorieen en transacties binnen je weekbudget
                  </Text>
                ) : null}
              </View>
              <Pressable
                style={styles.sheetCloseButton}
                onPress={closeWeekDetail}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            {selectedWeekDetail ? (
              <>
                <View style={styles.sheetSummaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Totaal uitgegeven</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(selectedWeekDetail.week.actual)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Weekbudget totaal</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(selectedWeekDetail.week.budget)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelStrong}>
                      {selectedWeekDetail.week.remaining < 0
                        ? "Overschrijding"
                        : "Resterend budget"}
                    </Text>
                    <Text
                      style={[
                        styles.summaryValueStrong,
                        selectedWeekDetail.week.remaining < 0
                          ? styles.summaryValueCritical
                          : styles.summaryValuePositive,
                      ]}
                    >
                      {selectedWeekDetail.week.remaining < 0
                        ? fmt.format(Math.abs(selectedWeekDetail.week.remaining))
                        : fmt.format(selectedWeekDetail.week.remaining)}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollContent}
                >
                  {selectedWeekVariableCategories.length ? (
                    selectedWeekVariableCategories.map((category) => {
                      const categoryWeekBudget =
                        selectedWeekBudgetByMainCategory.get(category.key) || 0;
                      const budgetUtilization =
                        categoryWeekBudget > 0
                          ? category.amount / categoryWeekBudget
                          : category.amount > 0
                            ? Number.POSITIVE_INFINITY
                            : 0;
                      const visibleSubcategories = category.subcategories.filter(
                        (subcategory) => subcategory.amount > 0,
                      );
                      const canExpand = visibleSubcategories.length > 0;
                      const isExpanded = expandedWeekMainCategories.includes(
                        category.key,
                      );

                      return (
                        <View key={category.key} style={styles.weekDetailBlock}>
                          <BudgetCategoryProgressRow
                            label={category.label}
                            iconName={getVariableCategoryIconName(category.key)}
                            utilization={budgetUtilization}
                            actual={category.amount}
                            budget={categoryWeekBudget}
                            showChevron={canExpand}
                            chevronExpanded={isExpanded}
                            onPress={
                              canExpand
                                ? () => toggleWeekMainCategory(category.key)
                                : undefined
                            }
                          />

                          {isExpanded ? (
                            <View style={styles.weekSubcategoryList}>
                              {visibleSubcategories.map((subcategory) => {
                                const cacheKey = getWeekSubcategoryCacheKey(
                                  selectedWeekDetail.week.weekNumber,
                                  category.key,
                                  subcategory.key,
                                );
                                const inlineTransactions =
                                  inlineTransactionsBySubcategory[cacheKey] || [];
                                const isInlineExpanded =
                                  expandedWeekSubcategories.includes(cacheKey);
                                const isInlineLoading =
                                  inlineLoadingSubcategories.includes(cacheKey);
                                const inlineError =
                                  inlineSubcategoryErrors[cacheKey] || null;

                                return (
                                  <View
                                    key={`${category.key}-${subcategory.key}`}
                                    style={styles.weekSubcategoryBlock}
                                  >
                                    <Pressable
                                      style={styles.weekSubcategoryRow}
                                      onPress={() =>
                                        toggleWeekSubcategoryInline(
                                          category.key,
                                          subcategory.key,
                                        )
                                      }
                                    >
                                      <View style={styles.weekSubcategoryLeft}>
                                        <View style={styles.weekSubcategoryDot} />
                                        <Text
                                          style={styles.weekSubcategoryLabel}
                                        >
                                          {subcategory.label}
                                        </Text>
                                      </View>
                                      <View
                                        style={styles.weekSubcategoryRight}
                                      >
                                        <Text
                                          style={styles.weekSubcategoryAmount}
                                        >
                                          {fmt.format(subcategory.amount)}
                                        </Text>
                                        <AppIcon
                                          name={
                                            isInlineExpanded
                                              ? "expand-more"
                                              : "chevron-right"
                                          }
                                          size={15}
                                          color={FinColors.textSecondary}
                                        />
                                      </View>
                                    </Pressable>

                                    {isInlineExpanded ? (
                                      <View
                                        style={styles.inlineTransactionsWrap}
                                      >
                                        {isInlineLoading ? (
                                          <View
                                            style={
                                              styles.inlineTransactionsLoadingRow
                                            }
                                          >
                                            <ActivityIndicator
                                              size="small"
                                              color={FinColors.textSecondary}
                                            />
                                            <Text
                                              style={
                                                styles.inlineTransactionsMeta
                                              }
                                            >
                                              Transacties laden...
                                            </Text>
                                          </View>
                                        ) : null}

                                        {!isInlineLoading && inlineError ? (
                                          <Text style={styles.inlineErrorText}>
                                            {inlineError}
                                          </Text>
                                        ) : null}

                                        {!isInlineLoading &&
                                        !inlineError &&
                                        !inlineTransactions.length ? (
                                          <Text
                                            style={
                                              styles.inlineTransactionsMeta
                                            }
                                          >
                                            Geen bijbehorende transacties
                                            gevonden.
                                          </Text>
                                        ) : null}

                                        {!isInlineLoading &&
                                        !inlineError &&
                                        inlineTransactions.length
                                          ? inlineTransactions.map((tx) => {
                                              return (
                                                <BudgetInlineTransactionRow
                                                  key={tx.id}
                                                  tx={tx}
                                                  categoryById={categoryById}
                                                  overlapLabel={getMonthOverlapLabel(
                                                    tx.date,
                                                    budgetPlan?.monthStart,
                                                  )}
                                                  onOpen={() =>
                                                    openInlineTransactionDetail(
                                                      tx.id,
                                                    )
                                                  }
                                                />
                                              );
                                            })
                                        : null}
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.supportText}>
                      Nog geen variabele uitgaven gevonden in deze week.
                    </Text>
                  )}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={selectedMonthCategory != null}
        onRequestClose={closeMonthCategoryDetail}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderMain}>
                <Text style={styles.sheetTitle}>Categorie-detail</Text>
                <Text style={styles.sheetSub}>
                  Stuur op maandruimte, maandtempo en transacties in deze categorie
                </Text>
              </View>
              <Pressable
                style={styles.sheetCloseButton}
                onPress={closeMonthCategoryDetail}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            {selectedMonthCategory ? (
              <>
                <View style={styles.sheetSummaryCard}>
                  <View style={styles.categoryDetailHeaderRow}>
                    <View style={styles.categoryDetailHeaderMain}>
                      <View style={styles.categoryDetailIconBubble}>
                        <AppIcon
                          name={getVariableCategoryIconName(
                            selectedMonthCategory.categoryKey,
                          )}
                          size={18}
                          color={FinColors.textPrimary}
                          variant="outlined"
                        />
                      </View>
                      <View style={styles.categoryDetailTitleWrap}>
                        <Text style={styles.categoryDetailTitle}>
                          {selectedMonthCategory.label}
                        </Text>
                        <Text style={styles.categoryDetailMeta}>
                          Maandbudget {fmt.format(selectedMonthCategory.monthlyBudget)}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusChip,
                        getRiskStyle(
                          getBudgetRiskTone(selectedMonthCategory.utilization),
                        ).chip,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          getRiskStyle(
                            getBudgetRiskTone(selectedMonthCategory.utilization),
                          ).text,
                        ]}
                      >
                        {getBudgetRiskLabel(selectedMonthCategory.utilization)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Gebruikt deze maand</Text>
                    <Text style={styles.summaryValue}>
                      {fmt.format(selectedMonthCategory.monthlyActual)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelStrong}>
                      {selectedMonthCategory.monthlyActual >
                      selectedMonthCategory.monthlyBudget
                        ? "Boven budget"
                        : "Nog vrij in categorie"}
                    </Text>
                    <Text
                      style={[
                        styles.summaryValueStrong,
                        selectedMonthCategory.monthlyActual >
                        selectedMonthCategory.monthlyBudget
                          ? styles.summaryValueCritical
                          : styles.summaryValuePositive,
                      ]}
                    >
                      {fmt.format(
                        Math.abs(
                          selectedMonthCategory.monthlyBudget -
                            selectedMonthCategory.monthlyActual,
                        ),
                      )}
                    </Text>
                  </View>
                  <Text style={styles.categoryDetailAdvice}>
                    {getCategoryDetailRecommendation(
                      selectedMonthCategory,
                      selectedMonthCategoryTempoSummary,
                    )}
                  </Text>
                </View>

                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollContent}
                >
                  {selectedMonthCategoryTempoSummary ? (
                    <View style={styles.categoryDetailWeekCard}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.sectionTitle}>Maandtempo</Text>
                        <View
                          style={[
                            styles.statusChip,
                            getRiskStyle(selectedMonthCategoryTempoSummary.tone).chip,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              getRiskStyle(selectedMonthCategoryTempoSummary.tone)
                                .text,
                            ]}
                          >
                            {selectedMonthCategoryTempoSummary.statusLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.supportText}>
                        {fmt.format(selectedMonthCategory.monthlyActual)} gebruikt ·
                        prognose{" "}
                        {fmt.format(
                          selectedMonthCategoryTempoSummary.projectedMonthActual,
                        )}
                      </Text>
                      <RiskProgressBar
                        progress={getBudgetRiskProgress(
                          selectedMonthCategoryTempoSummary.utilization,
                        )}
                        tone={selectedMonthCategoryTempoSummary.tone}
                        style={styles.progressTrack}
                      />
                      <Text style={styles.sectionHelper}>
                        {selectedMonthCategoryTempoSummary.progressLabel}
                      </Text>
                      <Text style={styles.supportText}>
                        {selectedMonthCategoryTempoSummary.message}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.categoryDetailTransactionsCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.sectionTitle}>Transacties deze maand</Text>
                      <Text style={styles.sectionHelper}>
                        {selectedMonthCategoryTransactions.length} transactie
                        {selectedMonthCategoryTransactions.length === 1 ? "" : "s"}{" "}
                        deze maand in {selectedMonthCategory.label.toLowerCase()}
                      </Text>
                    </View>

                    {selectedMonthCategoryLoading ? (
                      <View style={styles.inlineTransactionsLoadingRow}>
                        <ActivityIndicator
                          size="small"
                          color={FinColors.textSecondary}
                        />
                        <Text style={styles.inlineTransactionsMeta}>
                          Transacties laden...
                        </Text>
                      </View>
                    ) : null}

                    {!selectedMonthCategoryLoading && selectedMonthCategoryError ? (
                      <Text style={styles.inlineErrorText}>
                        {selectedMonthCategoryError}
                      </Text>
                    ) : null}

                    {!selectedMonthCategoryLoading &&
                    !selectedMonthCategoryError &&
                    !selectedMonthCategoryTransactions.length ? (
                      <Text style={styles.supportText}>
                        Nog geen transacties gevonden in deze categorie voor deze maand.
                      </Text>
                    ) : null}

                    {!selectedMonthCategoryLoading &&
                    !selectedMonthCategoryError &&
                    selectedMonthCategoryTransactions.length
                      ? selectedMonthCategoryTransactions.map((tx) => {
                          const isUpdating =
                            monthCategoryUpdatingTransactionIds.includes(tx.id);

                          return (
                            <BudgetInlineTransactionRow
                              key={tx.id}
                              tx={tx}
                              categoryById={categoryById}
                              onOpen={() => openInlineTransactionDetail(tx.id)}
                              onToggle={() =>
                                void toggleMonthCategoryTransactionBudgetExcluded(
                                  selectedMonthCategory.categoryKey as VariableBudgetCategoryKey,
                                  tx.id,
                                  !tx.budgetExcluded,
                                )
                              }
                              isUpdating={isUpdating}
                            />
                          );
                        })
                      : null}
                  </View>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={outsideBudgetOpen}
        onRequestClose={closeOutsideBudget}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderMain}>
                <Text style={styles.sheetTitle}>Buiten budget</Text>
                <Text style={styles.sheetSub}>
                  Alles wat bewust buiten budget, trend en forecast staat
                </Text>
              </View>
              <Pressable
                style={styles.sheetCloseButton}
                onPress={closeOutsideBudget}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            {budgetPlan ? (
              <>
                <View style={styles.sheetSummaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelStrong}>Totaal</Text>
                    <Text style={styles.summaryValueStrong}>
                      {fmt.format(budgetPlan.outsideBudgetExpenses.total)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Transacties</Text>
                    <Text style={styles.summaryValue}>
                      {outsideBudgetTransactionCount}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollContent}
                >
                  {budgetPlan.outsideBudgetExpenses.items.length ? (
                    budgetPlan.outsideBudgetExpenses.items.map((item) => {
                      const cacheKey = item.groupKey;
                      const transactions =
                        outsideBudgetTransactionsByItem[cacheKey] || [];
                      const isExpanded =
                        expandedOutsideBudgetItems.includes(cacheKey);
                      const isLoading =
                        outsideBudgetLoadingItems.includes(cacheKey);
                      const itemError =
                        outsideBudgetItemErrors[cacheKey] || null;

                      return (
                        <View key={item.groupKey} style={styles.outsideBudgetItemRow}>
                          <Pressable
                            style={styles.outsideBudgetItemHeader}
                            onPress={() => toggleOutsideBudgetItem(item)}
                          >
                            <View style={styles.categoryMain}>
                              <Text style={styles.categoryLabel}>{item.label}</Text>
                              <Text style={styles.categoryMeta}>
                                {item.categoryLabel}
                                {item.transactionCount > 0
                                  ? ` · ${item.transactionCount} transactie${item.transactionCount === 1 ? "" : "s"}`
                                  : ""}
                              </Text>
                            </View>
                            <View style={styles.outsideBudgetItemRight}>
                              <Text style={styles.categoryValue}>
                                {fmt.format(item.amount)}
                              </Text>
                              <AppIcon
                                name={
                                  isExpanded ? "expand-more" : "chevron-right"
                                }
                                size={16}
                                color={FinColors.textSecondary}
                              />
                            </View>
                          </Pressable>

                          {isExpanded ? (
                            <View style={styles.outsideBudgetTransactionsWrap}>
                              {isLoading ? (
                                <View style={styles.inlineTransactionsLoadingRow}>
                                  <ActivityIndicator
                                    size="small"
                                    color={FinColors.textSecondary}
                                  />
                                  <Text style={styles.inlineTransactionsMeta}>
                                    Transacties laden...
                                  </Text>
                                </View>
                              ) : null}

                              {!isLoading && itemError ? (
                                <Text style={styles.inlineErrorText}>
                                  {itemError}
                                </Text>
                              ) : null}

                              {!isLoading && !itemError && !transactions.length ? (
                                <Text style={styles.inlineTransactionsMeta}>
                                  Geen onderliggende transacties gevonden.
                                </Text>
                              ) : null}

                              {!isLoading && !itemError && transactions.length
                                ? transactions.map((tx) => {
                                    return (
                                      <BudgetInlineTransactionRow
                                        key={tx.id}
                                        tx={tx}
                                        categoryById={categoryById}
                                        onOpen={() =>
                                          openInlineTransactionDetail(tx.id)
                                        }
                                      />
                                    );
                                  })
                                : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.supportText}>
                      Er staan nog geen buiten-budget uitgaven in deze maand.
                    </Text>
                  )}
                </ScrollView>
              </>
            ) : null}
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
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  monthRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthBadge: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
  },
  monthBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
    textTransform: "capitalize",
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavButtonDisabled: {
    opacity: 0.45,
  },
  monthNavButtonText: {
    fontSize: 22,
    lineHeight: 22,
    color: FinColors.textPrimary,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  manageVariantRow: {
    flexDirection: "row",
    gap: 8,
  },
  manageVariantChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
  },
  manageVariantChipActive: {
    backgroundColor: FinColors.yellowSoft,
    borderColor: FinColors.yellow,
  },
  manageVariantChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  manageVariantChipTextActive: {
    color: FinColors.textPrimary,
  },
  scopeBlock: {
    gap: 8,
    marginTop: 10,
  },
  segmentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  segmentChipActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  segmentChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  segmentChipTextActive: {
    color: FinColors.textPrimary,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    paddingBottom: 128,
  },
  contentMax: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 32,
  },
  mainStack: {
    gap: MainPageSpacing.budgetComponents,
  },
  heroCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 22,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  heroValue: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  heroSupport: {
    marginTop: 10,
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  heroMeta: {
    marginTop: 10,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  heroMetaSubtle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  heroHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  inlineLinkButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingVertical: 6,
  },
  inlineLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgInput,
    overflow: "hidden",
    marginTop: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: FinColors.yellow,
    borderRadius: 999,
  },
  historyProgressFill: {
    backgroundColor: FinColors.textPrimary,
  },
  progressFillCritical: {
    backgroundColor: FinColors.red,
  },
  card: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  manageGroupContent: {
    paddingHorizontal: FinSpacing.x4,
    paddingVertical: FinSpacing.x4,
    gap: FinSpacing.x4,
  },
  manageSection: {
    gap: 12,
  },
  manageRouteActions: {
    flexDirection: "row",
    gap: 10,
  },
  manageRouteButton: {
    flex: 1,
  },
  manageDivider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
  },
  manageSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  manageSectionHeaderMain: {
    flex: 1,
    gap: 6,
  },
  manageSectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  manageSectionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  manageCompactSupport: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  manageMetricPill: {
    minWidth: 124,
    borderRadius: 18,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
    gap: 2,
  },
  manageMetricPillLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    color: FinColors.textMuted,
  },
  manageMetricPillValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  manageMetricPillValueSubtle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  managePreviewSurface: {
    borderRadius: 18,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 10,
  },
  managePreviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  managePreviewMain: {
    flex: 1,
    gap: 4,
  },
  managePreviewLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  managePreviewMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  managePreviewValue: {
    fontSize: 20,
    lineHeight: FinTypography["title-sm"].lineHeight,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  manageDisclosureRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manageExpandableContent: {
    marginTop: FinSpacing.x3,
    gap: 12,
  },
  manageExpandableHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  manageExpandableHeaderMain: {
    flex: 1,
    gap: 6,
  },
  manageTertiaryAction: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  manageTertiaryActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  managePreviewList: {
    gap: 2,
  },
  manageInfoList: {
    gap: 8,
  },
  manageInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingBottom: 8,
  },
  manageInfoMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manageInfoLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  manageInfoValue: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  manageInfoValueMuted: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  manageSecondaryAction: {
    marginTop: 4,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  manageSecondaryActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  manageSheetContent: {
    gap: 12,
    paddingBottom: 12,
  },
  actionCard: {
    gap: 10,
    paddingBottom: 8,
  },
  positiveCard: {
    backgroundColor: FinColors.warningBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  positiveText: {
    flex: 1,
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  sectionHelper: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  sectionLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  sectionActionButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.yellowSoft,
  },
  sectionActionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  reserveSummaryCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  reserveSummaryTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  reserveSummaryValue: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  reserveSummaryMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  reserveSummaryConfidence: {
    fontSize: 11,
    lineHeight: 14,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  reserveSummaryHint: {
    fontSize: 11,
    lineHeight: 15,
    color: FinColors.textMuted,
  },
  reserveRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    paddingVertical: 8,
  },
  reserveRuleLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  reserveRuleAmount: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  reserveRulesSheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
  reserveRuleSheetSummaryCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  reserveRuleSheetCard: {
    borderRadius: 16,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 12,
    gap: 10,
  },
  reserveRuleSheetSummaryTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  reserveRuleSheetSummaryGrid: {
    gap: 10,
  },
  reserveRuleSheetSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reserveRuleSheetSummaryItemSeparated: {
    borderTopWidth: 1,
    borderTopColor: "rgba(17,17,17,0.05)",
    paddingTop: 10,
    marginTop: 2,
  },
  reserveRuleSheetSummaryLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "500",
  },
  reserveRuleSheetSummaryValue: {
    fontSize: 18,
    lineHeight: 22,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  reserveRuleSheetSummaryContext: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
    paddingHorizontal: 4,
  },
  reserveRuleSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  reserveRuleSheetMain: {
    flex: 1,
    gap: 8,
  },
  reserveRuleSheetTitle: {
    fontSize: 15,
    lineHeight: 19,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  reserveRuleSheetAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  reserveRuleSheetAmountValue: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  reserveRuleSheetSourceBadge: {
    borderRadius: 8,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reserveRuleSheetSourceBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  reserveRuleStatusChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
    justifyContent: "center",
  },
  reserveRuleStatusChipActive: {
    backgroundColor: FinColors.yellowSoft,
    borderColor: FinColors.warningBorder,
  },
  reserveRuleStatusChipText: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  reserveRuleStatusChipTextActive: {
    color: FinColors.textPrimary,
  },
  reserveRuleEditorRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(17,17,17,0.05)",
    paddingTop: 10,
  },
  reserveRuleInputWrap: {
    flex: 1,
    gap: 6,
  },
  reserveRuleInputLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  reserveRuleInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  reserveRuleSaveButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
  },
  reserveRuleSaveButtonText: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  categoryListMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  categoryListIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryMain: {
    flex: 1,
    minWidth: 0,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  categoryMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  categoryRight: {
    alignItems: "flex-end",
  },
  categoryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  categoryStatusText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  historyRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  historyRowCurrent: {
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  historyLabelWrap: {
    flex: 1,
  },
  historyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  historyLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  currentWeekChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: FinColors.yellowSoft,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  currentWeekChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  historyMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  historyValuesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 12,
  },
  historyValue: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  historyDelta: {
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  summaryLabelStrong: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  summaryValueMuted: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textMuted,
  },
  summaryValueStrong: {
    fontSize: 14,
    fontWeight: "800",
  },
  summaryValueNegative: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  summaryValuePositive: {
    color: FinColors.green,
  },
  summaryValueCritical: {
    color: FinColors.red,
  },
  compactBreakdownText: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
  },
  outsideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  outsidePreviewRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  outsideBudgetTotalText: {
    fontSize: 24,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  outsideBudgetMetaText: {
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FinColors.yellow,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textPrimary,
  },
  supportText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  statusChipGood: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  statusChipWatch: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  statusChipCritical: {
    backgroundColor: FinColors.redBg,
    borderColor: FinColors.red,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusChipTextGood: {
    color: FinColors.green,
  },
  statusChipTextWatch: {
    color: FinColors.warningText,
  },
  statusChipTextCritical: {
    color: FinColors.red,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flex: 1,
  },
  primaryButtonText: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flex: 1,
  },
  secondaryButtonText: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modeButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
  },
  modeButtonActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modeButtonTextActive: {
    color: FinColors.textPrimary,
  },
  modeDescriptionCard: {
    borderRadius: 24,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
    gap: 8,
    elevation: 1,
  },
  modeDescriptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modeDescriptionText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  modePreviewCard: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
    gap: 4,
  },
  modePreviewLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  modePreviewValue: {
    fontSize: 20,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modePreviewMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textMuted,
  },
  modeSliderWrap: {
    marginTop: 8,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  incomePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
    gap: 12,
  },
  incomePreviewLabel: {
    fontSize: 13,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  incomePreviewValue: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  choiceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgInput,
  },
  choiceChipActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  choiceChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  choiceChipTextActive: {
    color: FinColors.textPrimary,
  },
  warningInlineText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.red,
    fontWeight: "600",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  editRowChild: {
    paddingLeft: 8,
  },
  editRowDisabled: {
    opacity: 0.7,
  },
  editMain: {
    flex: 1,
    gap: 4,
  },
  variableBudgetSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 14,
    gap: 8,
  },
  variableBudgetSummaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  variableBudgetSummaryMain: {
    flex: 1,
    gap: 4,
  },
  variableBudgetSummaryRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  variableBudgetSummaryValueLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    color: FinColors.textMuted,
  },
  variableBudgetSummaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  variableBudgetSummaryStatus: {
    fontSize: 13,
    fontWeight: "700",
  },
  variableBudgetSummaryStatusGood: {
    color: FinColors.green,
  },
  variableBudgetSummaryStatusWatch: {
    color: FinColors.warningText,
  },
  variableBudgetSummaryStatusCritical: {
    color: FinColors.red,
  },
  editControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  editLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  editLabelChild: {
    fontWeight: "600",
  },
  editMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  editInput: {
    width: 84,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 12,
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  editInputDisabled: {
    backgroundColor: FinColors.bgElevated,
    color: FinColors.textMuted,
  },
  readOnlyValue: {
    width: 92,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgElevated,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  readOnlyValueText: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  editActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  editActionButtonActive: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  editActionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  editActionButtonTextActive: {
    color: FinColors.green,
  },
  detailOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  detailOverviewMain: {
    flex: 1,
  },
  detailOverviewLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  detailOverviewMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  detailOverviewSub: {
    marginTop: 3,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  detailOverviewRight: {
    alignItems: "flex-end",
  },
  detailOverviewValue: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  detailOverviewDelta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  detailOverviewDeltaPositive: {
    color: FinColors.green,
  },
  detailOverviewDeltaCritical: {
    color: FinColors.red,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: FinColors.overlayBackdrop,
  },
  sheetCard: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetHeaderMain: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  sheetSub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSummaryCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
    gap: 10,
  },
  sheetScroll: {
    marginTop: 16,
  },
  sheetScrollContent: {
    paddingBottom: 12,
    gap: 12,
  },
  categoryDetailHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryDetailHeaderMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryDetailIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryDetailTitleWrap: {
    flex: 1,
  },
  categoryDetailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  categoryDetailMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  categoryDetailAdvice: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  categoryDetailWeekCard: {
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
    gap: 10,
  },
  categoryDetailTransactionsCard: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
    gap: 12,
  },
  detailSheetActionRow: {
    marginTop: 14,
  },
  detailListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  detailListMain: {
    flex: 1,
  },
  detailListLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  detailListMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  detailListAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  weekDetailBlock: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 14,
  },
  weekSubcategoryList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    gap: 10,
  },
  weekSubcategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  weekSubcategoryBlock: {
    gap: 10,
  },
  weekSubcategoryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weekSubcategoryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weekSubcategoryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: FinColors.yellow,
  },
  weekSubcategoryLabel: {
    flex: 1,
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  weekSubcategoryAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  inlineTransactionsWrap: {
    marginLeft: 17,
    borderLeftWidth: 1,
    borderLeftColor: FinColors.borderSubtle,
    paddingLeft: 12,
    gap: 10,
  },
  inlineTransactionsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineTransactionsMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textMuted,
  },
  inlineErrorText: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.red,
  },
  inlineTransactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  inlineTransactionMainPressable: {
    flex: 1,
  },
  inlineTransactionLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineTransactionContent: {
    flex: 1,
    minWidth: 0,
  },
  inlineTransactionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  inlineTransactionCategory: {
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  inlineTransactionCategoryRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  inlineOverlapChip: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  inlineOverlapChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  inlineTransactionRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  inlineTransactionAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
    minWidth: 74,
    textAlign: "right",
  },
  inlineExcludeToggle: {
    minWidth: 0,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  inlineExcludeToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  inlineExcludeToggleActive: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  inlineExcludeToggleText: {
    fontSize: 10,
    fontWeight: "700",
    color: FinColors.textPrimary,
    textAlign: "center",
  },
  inlineExcludeToggleTextActive: {
    color: FinColors.warningText,
  },
  outsideBudgetTransactionsWrap: {
    marginLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: FinColors.borderSubtle,
    paddingLeft: 12,
    gap: 10,
  },
  outsideBudgetItemRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 14,
    gap: 10,
  },
  outsideBudgetItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  outsideBudgetItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
