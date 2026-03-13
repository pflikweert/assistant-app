import { BudgetAmountSlider } from "@/components/budget-amount-slider";
import { BudgetCategoryProgressRow } from "@/components/budget-category-progress-row";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { generateBudgetCoachReport } from "@/services/budget-coach";
import { computeBudgetPlan } from "@/services/budget-plan";
import {
    resetMonthlyBudgetValues,
    upsertBudgetPlanSettings,
    upsertMonthlyBudgetValue,
} from "@/services/budget-plan-repository";
import {
    getTransactionCategories,
    setTransactionBudgetExcluded,
} from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import { recomputeCurrentMonthCashflowForecast } from "@/services/forecasting";
import { supabase } from "@/services/supabase";
import type {
    BudgetCategoryKey,
    BudgetIncomeInclusionSettings,
    BudgetPlanComputation,
    BudgetPlanMode,
} from "@/types/categorization";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
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
  { key: "structuralOther", label: "Overige structurele inkomsten" },
  { key: "variable", label: "Variabele/eenmalige inkomsten" },
];

const VARIABLE_BUDGET_BREAKDOWN_KEYS: BudgetCategoryKey[] = [
  "groceries",
  "fuel",
  "smoking",
  "other",
];
const SAVINGS_SLIDER_STEP = 25;

function roundToStepCeil(value: number, step: number) {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
}

function sanitizeNonNegativeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getBudgetCategoryDisplayLabel(categoryKey: BudgetCategoryKey) {
  if (categoryKey === "fixed_costs") return "Vaste lasten";
  if (categoryKey === "subscriptions") return "Abonnementen";
  if (categoryKey === "variable_costs") return "Variabele uitgaven (totaal)";
  if (categoryKey === "groceries") return "Boodschappen";
  if (categoryKey === "fuel") return "Brandstof";
  if (categoryKey === "smoking") return "Roken";
  if (categoryKey === "other") return "Overig";
  return "Spaardoel";
}

function isVariableBreakdownKey(categoryKey: BudgetCategoryKey) {
  return VARIABLE_BUDGET_BREAKDOWN_KEYS.includes(categoryKey);
}

function isVariableBudgetCategory(categoryKey: BudgetCategoryKey) {
  return categoryKey === "variable_costs" || isVariableBreakdownKey(categoryKey);
}

type InlineWeekTransaction = {
  id: string;
  date: string;
  title: string;
  counterparty: string | null;
  amount: number;
  budgetExcluded: boolean;
};

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

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentUtcMonthStartIso(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
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
  return "Aangepast";
}

function getBudgetModeDescription(mode: BudgetPlanMode) {
  if (mode === "active_savings") {
    return "Kiest automatisch een ambitieus spaardoel op basis van historische inkomsten, uitgaven en AI-inzicht.";
  }
  if (mode === "balanced") {
    return "Kiest automatisch een rustiger spaardoel met meer ruimte voor variabele uitgaven en tegenvallers.";
  }
  return "Je kiest zelf hoeveel je aan het einde van de maand wilt overhouden. De slider werkt in stappen van 25 euro.";
}

function formatSavingsTargetSourceLabel(
  source: BudgetPlanComputation["savingsTargetSource"],
  usedOpenAI: boolean,
) {
  if (source === "manual_custom") {
    return "Handmatig ingesteld in budgetbeheer.";
  }
  if (source === "automatic_active") {
    return usedOpenAI
      ? "Automatisch gekozen op basis van historie en OpenAI-inzicht."
      : "Automatisch gekozen op basis van historie en maandtempo.";
  }
  return usedOpenAI
    ? "Gebalanceerd doel op basis van historie en OpenAI-inzicht."
    : "Gebalanceerd doel op basis van historie en maandtempo.";
}

function formatAppliedSavingsLabel(
  source: BudgetPlanComputation["savingsTargetSource"],
) {
  if (source === "manual_custom") return "Handmatig spaardoel";
  return "Automatisch spaardoel";
}

function getAutomaticModePreviewMeta(
  mode: Exclude<BudgetPlanMode, "custom">,
  isCurrentMode: boolean,
) {
  if (isCurrentMode) {
    return mode === "active_savings"
      ? "Dit is het automatische spaardoel dat nu voor deze maand wordt gebruikt."
      : "Dit is het gebalanceerde automatische spaardoel dat nu voor deze maand wordt gebruikt.";
  }

  return mode === "active_savings"
    ? "Verwachte maandtarget voor Actief sparen. Na opslaan wordt dit doel opnieuw op basis van historie, tempo en AI berekend."
    : "Verwachte maandtarget voor Gebalanceerd. Na opslaan wordt dit doel opnieuw op basis van historie, tempo en AI berekend.";
}

function getVariableCategoryIconName(categoryKey: string) {
  if (categoryKey === "groceries") return "shopping-basket";
  if (categoryKey === "fuel") return "local-gas-station";
  if (categoryKey === "smoking") return "smoking-rooms";
  return "payments";
}

function formatShortDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatWeekEndDateLabel(endDateExclusive: string) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) {
    return formatShortDateLabel(endDateExclusive);
  }
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const endIso = endDate.toISOString().slice(0, 10);
  return formatShortDateLabel(endIso);
}

function formatRemainingDaysInWeekLabel(
  endDateExclusive: string,
  now = new Date(),
) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) return null;

  const utcToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayDiff = Math.ceil(
    (endDate.getTime() - utcToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  const remainingDays = Math.max(0, Math.min(7, dayDiff));
  const dayLabel = remainingDays === 1 ? "dag" : "dagen";
  return `${remainingDays} ${dayLabel} resterend`;
}

function formatWeekOverlapLabel(week: {
  crossesMonthBoundary: boolean;
  daysInPreviousMonth: number;
  daysInNextMonth: number;
}) {
  if (!week.crossesMonthBoundary) return null;

  const formatDays = (days: number) => `${days} dag${days === 1 ? "" : "en"}`;
  const parts: string[] = [];

  if (week.daysInPreviousMonth > 0) {
    parts.push(`${formatDays(week.daysInPreviousMonth)} vorige maand`);
  }
  if (week.daysInNextMonth > 0) {
    parts.push(`${formatDays(week.daysInNextMonth)} volgende maand`);
  }

  return parts.length ? parts.join(" · ") : null;
}

function buildWeekCompositionSegments(week: {
  crossesMonthBoundary: boolean;
  daysInCurrentMonth: number;
  daysInPreviousMonth: number;
  daysInNextMonth: number;
}) {
  if (!week.crossesMonthBoundary) return [];

  const segments = [
    {
      key: "previous",
      label: "vorige",
      days: week.daysInPreviousMonth,
      color: FinColors.textMuted,
    },
    {
      key: "current",
      label: "deze",
      days: week.daysInCurrentMonth,
      color: FinColors.green,
    },
    {
      key: "next",
      label: "volgende",
      days: week.daysInNextMonth,
      color: FinColors.textSecondary,
    },
  ] as const;

  return segments.filter((segment) => segment.days > 0);
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
  const router = useRouter();
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [budgetCoachLoading, setBudgetCoachLoading] = React.useState(false);
  const [budgetEditOpen, setBudgetEditOpen] = React.useState(false);
  const [savingBudgetEdit, setSavingBudgetEdit] = React.useState(false);
  const [recalculatingBudget, setRecalculatingBudget] = React.useState(false);
  const [budgetModeDraft, setBudgetModeDraft] =
    React.useState<BudgetPlanMode>("active_savings");
  const [budgetIncomeDraft, setBudgetIncomeDraft] =
    React.useState<BudgetIncomeInclusionSettings>(DEFAULT_INCLUDE_INCOME);
  const [savingsTargetMonthlyDraft, setSavingsTargetMonthlyDraft] =
    React.useState(0);
  const [budgetDraftValues, setBudgetDraftValues] = React.useState<
    Partial<Record<BudgetCategoryKey, string>>
  >({});
  const [detailSection, setDetailSection] = React.useState<
    "fixed_costs" | "subscriptions" | null
  >(null);
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
  const [inlineUpdatingTransactionIds, setInlineUpdatingTransactionIds] =
    React.useState<string[]>([]);
  const [categoryIdsByKey, setCategoryIdsByKey] = React.useState<
    Record<string, string[]>
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

  const planningSummary = React.useMemo(() => {
    if (!budgetPlan) return null;
    return budgetPlan.flowSummary;
  }, [budgetPlan]);

  const weeklyVariableRows = React.useMemo(() => {
    if (!budgetPlan) return [];
    return budgetPlan.weeklyVariablePlan;
  }, [budgetPlan]);

  const isCurrentMonthView = React.useMemo(() => {
    if (!budgetPlan) return false;
    return budgetPlan.monthStart === getCurrentUtcMonthStartIso();
  }, [budgetPlan]);

  const weeklyBudgetContext = React.useMemo(() => {
    if (!budgetPlan) return null;
    const monthVariableBudget = Math.round(budgetPlan.flowSummary.variableBudget);
    const visibleWeeksBudget = weeklyVariableRows.reduce(
      (sum, row) => sum + row.budget,
      0,
    );
    const delta = visibleWeeksBudget - monthVariableBudget;
    const overlapWeekCount = weeklyVariableRows.filter(
      (row) => row.crossesMonthBoundary,
    ).length;

    return {
      monthVariableBudget,
      visibleWeeksBudget,
      delta,
      overlapWeekCount,
    };
  }, [budgetPlan, weeklyVariableRows]);

  const detailItems = React.useMemo(() => {
    if (!budgetPlan || !detailSection) return [];
    if (detailSection === "fixed_costs") {
      return budgetPlan.expenseDetails.fixedCosts;
    }
    return budgetPlan.expenseDetails.subscriptions;
  }, [budgetPlan, detailSection]);

  const detailExpectedAndActual = React.useMemo(() => {
    if (!budgetPlan || !detailSection) {
      return { expected: 0, actual: 0 };
    }
    if (detailSection === "fixed_costs") {
      return {
        expected: budgetPlan.flowSummary.fixedCostsBudget,
        actual: Math.round(budgetPlan.monthToDateExpenses.fixedCosts),
      };
    }

    return {
      expected: budgetPlan.flowSummary.subscriptionsBudget,
      actual: Math.round(budgetPlan.monthToDateExpenses.subscriptions),
    };
  }, [budgetPlan, detailSection]);

  const savingsMotivation = React.useMemo(() => {
    if (!budgetPlan) return null;
    const pct = Math.round(budgetPlan.savingsProgress.progressActual * 100);
    const remaining =
      budgetPlan.savingsProgress.recommendedSavings -
      budgetPlan.savingsProgress.earnedActual;

    if (remaining <= 0) {
      return {
        percentage: pct,
        message: "Spaardoel behaald deze maand.",
      };
    }

    return {
      percentage: pct,
      message: `${fmt.format(Math.round(remaining))} nog nodig voor je spaardoel.`,
    };
  }, [budgetPlan]);

  const selectedWeekDetail = React.useMemo(() => {
    if (!budgetPlan || selectedWeekNumber == null) return null;

    const weekRow = budgetPlan.weeklyVariablePlan.find(
      (week) => week.weekNumber === selectedWeekNumber,
    );

    const spendRow = weekRow
      ? budgetPlan.weeklySpendBreakdown.find(
          (week) =>
            week.weekNumber === selectedWeekNumber &&
            week.startDate === weekRow.startDate &&
            week.endDateExclusive === weekRow.endDateExclusive,
        )
      : null;

    const fallbackSpendRow =
      spendRow ||
      budgetPlan.weeklySpendBreakdown.find(
        (week) => week.weekNumber === selectedWeekNumber,
      );

    if (!weekRow || !fallbackSpendRow) return null;

    return {
      week: weekRow,
      spend: fallbackSpendRow,
    };
  }, [budgetPlan, selectedWeekNumber]);

  const selectedWeekVariableCategories = React.useMemo(() => {
    if (!selectedWeekDetail) return [];
    return selectedWeekDetail.spend.categories.filter(
      (category) => category.amount > 0,
    );
  }, [selectedWeekDetail]);

  const variableMonthlyBudgetByMainCategory = React.useMemo(() => {
    if (!budgetPlan) return new Map<string, number>();
    const recommendationByKey = new Map(
      budgetPlan.recommendations.map((row) => [row.categoryKey, row]),
    );

    return new Map<string, number>([
      ["groceries", recommendationByKey.get("groceries")?.monthlyBudget || 0],
      ["fuel", recommendationByKey.get("fuel")?.monthlyBudget || 0],
      ["smoking", recommendationByKey.get("smoking")?.monthlyBudget || 0],
      ["other", recommendationByKey.get("other")?.monthlyBudget || 0],
    ]);
  }, [budgetPlan]);

  const selectedWeekBudgetByMainCategory = React.useMemo(() => {
    if (!selectedWeekDetail) return new Map<string, number>();

    const totalMonthlyVariableBudget = [
      ...variableMonthlyBudgetByMainCategory.values(),
    ].reduce((sum, value) => sum + value, 0);

    const rows = [...variableMonthlyBudgetByMainCategory.entries()].map(
      ([key, monthlyBudget]) => {
        const weekBudget =
          totalMonthlyVariableBudget > 0
            ? Math.round(
                selectedWeekDetail.week.budget *
                  (monthlyBudget / totalMonthlyVariableBudget),
              )
            : 0;
        return [key, weekBudget] as const;
      },
    );

    return new Map<string, number>(rows);
  }, [selectedWeekDetail, variableMonthlyBudgetByMainCategory]);

  const resolveCategoryIdsForSubcategory = React.useCallback(
    (subcategoryKey: string) => {
      const normalized = String(subcategoryKey || "")
        .toLowerCase()
        .trim();
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

  const autoManagedVariableBudget = budgetModeDraft !== "custom";

  const variableBudgetBreakdownRows = React.useMemo(() => {
    return VARIABLE_BUDGET_BREAKDOWN_KEYS.map((key) => ({
      key,
      label: getBudgetCategoryDisplayLabel(key),
      amount: variableMonthlyBudgetByMainCategory.get(key) || 0,
    }));
  }, [variableMonthlyBudgetByMainCategory]);

  const variableBudgetDraftSummary = React.useMemo(() => {
    if (!editableBudgetRows.length) {
      return {
        total: 0,
        breakdownTotal: 0,
        delta: 0,
      };
    }

    const parseDraftValue = (key: BudgetCategoryKey) => {
      const rawValue = budgetDraftValues[key];
      const parsed = parseBudgetAmountInput(rawValue || "");
      if (parsed != null) return Math.round(parsed);
      return editableBudgetRows.find((row) => row.categoryKey === key)?.monthlyBudget || 0;
    };

    const total = parseDraftValue("variable_costs");
    const breakdownTotal = VARIABLE_BUDGET_BREAKDOWN_KEYS.reduce(
      (sum, key) => sum + parseDraftValue(key),
      0,
    );

    return {
      total,
      breakdownTotal,
      delta: total - breakdownTotal,
    };
  }, [budgetDraftValues, editableBudgetRows]);

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
    const coreMonthToDateExpenses =
      budgetPlan.monthToDateExpenses.fixedCosts +
      budgetPlan.monthToDateExpenses.subscriptions +
      budgetPlan.monthToDateExpenses.variableCosts;
    return budgetPlan.monthlyBudgetTotal - coreMonthToDateExpenses;
  }, [budgetPlan]);

  const budgetProgress = React.useMemo(() => {
    if (!budgetPlan || budgetPlan.monthlyBudgetTotal <= 0) return 0;
    const coreMonthToDateExpenses =
      budgetPlan.monthToDateExpenses.fixedCosts +
      budgetPlan.monthToDateExpenses.subscriptions +
      budgetPlan.monthToDateExpenses.variableCosts;
    return Math.min(
      1,
      Math.max(0, coreMonthToDateExpenses / budgetPlan.monthlyBudgetTotal),
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
      const referenceDate =
        monthOffset === 0
          ? new Date()
          : new Date(`${selectedMonth.endIso}T12:00:00.000Z`);
      if (monthOffset !== 0) {
        referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
      }
      const computed = await computeBudgetPlan(
        referenceDate,
        "default",
        new Date(),
      );
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
  }, [budgetSchemaMissing, monthOffset, selectedMonth.endIso]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadBudgetPlan();
  }, [isFocused, loadBudgetPlan]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadBudgetPlan();
  }, [backgroundStatus.lastCompletedAt, isFocused, loadBudgetPlan]);

  React.useEffect(() => {
    if (!isFocused) return;

    let cancelled = false;
    void (async () => {
      try {
        const categories = await getTransactionCategories();
        if (cancelled) return;

        const nextByKey: Record<string, string[]> = {};
        for (const category of categories) {
          const key = String(category.key || "")
            .toLowerCase()
            .trim();
          if (!key) continue;
          if (!nextByKey[key]) {
            nextByKey[key] = [];
          }
          nextByKey[key].push(category.id);
        }
        setCategoryIdsByKey(nextByKey);
      } catch (error) {
        console.warn("[budget] categorie-index laden mislukt", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  const openBudgetEdit = React.useCallback(() => {
    if (!budgetPlan) return;

    setBudgetModeDraft(budgetPlan.settings.mode);
    setBudgetIncomeDraft({
      salary: budgetPlan.settings.includeIncome.salary,
      childBudget: budgetPlan.settings.includeIncome.childBudget,
      structuralOther: budgetPlan.settings.includeIncome.structuralOther,
      variable: budgetPlan.settings.includeIncome.variable,
    });
    setSavingsTargetMonthlyDraft(
      sanitizeNonNegativeNumber(
        budgetPlan.settings.savingsTargetMonthly > 0
          ? budgetPlan.settings.savingsTargetMonthly
          : budgetPlan.recommendedSavings,
      ),
    );

    const nextDraft: Partial<Record<BudgetCategoryKey, string>> = {};
    for (const row of budgetPlan.recommendations) {
      nextDraft[row.categoryKey] = row.monthlyBudget.toFixed(0);
    }

    setBudgetDraftValues(nextDraft);
    setBudgetEditOpen(true);
  }, [budgetPlan]);

  const saveBudgetEdit = React.useCallback(async () => {
    if (!budgetPlan) return;

    setSavingBudgetEdit(true);
    setBudgetEditOpen(false);
    try {
      const nextCustomSavingsTarget =
        budgetModeDraft === "custom"
          ? Math.round(sanitizeNonNegativeNumber(savingsTargetMonthlyDraft))
          : budgetPlan.settings.savingsTargetMonthly;

      await upsertBudgetPlanSettings({
        planKey: "default",
        mode: budgetModeDraft,
        includeIncome: budgetIncomeDraft,
        applySavingsTargetToVariableBudget:
          budgetModeDraft === "custom" && nextCustomSavingsTarget > 0,
        savingsTargetMonthly: nextCustomSavingsTarget,
      });

      const updates: Promise<unknown>[] = [];
      for (const row of editableBudgetRows) {
        if (autoManagedVariableBudget && isVariableBudgetCategory(row.categoryKey)) {
          continue;
        }

        const rawValue = budgetDraftValues[row.categoryKey];
        const parsed = parseBudgetAmountInput(rawValue || "");
        if (parsed == null) continue;

        updates.push(
          upsertMonthlyBudgetValue({
            planKey: "default",
            monthStartIso: selectedMonth.startIso,
            categoryKey: row.categoryKey,
            monthlyBudget: Math.round(parsed),
            source: "manual",
          }),
        );
      }

      if (updates.length) {
        await Promise.all(updates);
      }

      if (monthOffset === 0) {
        await recomputeCurrentMonthCashflowForecast(new Date()).catch(
          (error) => {
            console.warn(
              "[budget] forecast recompute after save failed",
              error,
            );
          },
        );
      }

      await loadBudgetPlan();
    } catch (error) {
      console.error("[budget] save error", error);
    } finally {
      setSavingBudgetEdit(false);
    }
  }, [
    budgetDraftValues,
    budgetIncomeDraft,
    budgetModeDraft,
    budgetPlan,
    editableBudgetRows,
    autoManagedVariableBudget,
    loadBudgetPlan,
    monthOffset,
    savingsTargetMonthlyDraft,
    selectedMonth.startIso,
  ]);

  const recalculateExpectedCosts = React.useCallback(async () => {
    setRecalculatingBudget(true);
    try {
      await resetMonthlyBudgetValues({
        planKey: "default",
        monthStartIso: selectedMonth.startIso,
      });

      if (monthOffset === 0) {
        await recomputeCurrentMonthCashflowForecast(new Date()).catch(
          (error) => {
            console.warn(
              "[budget] forecast recompute after recalculate failed",
              error,
            );
          },
        );
      }

      setBudgetDraftValues({});
      await loadBudgetPlan();
    } catch (error) {
      console.error("[budget] recalculate expected costs error", error);
    } finally {
      setRecalculatingBudget(false);
    }
  }, [loadBudgetPlan, monthOffset, selectedMonth.startIso]);

  const openDetailTransactions = React.useCallback(() => {
    if (!detailSection) return;
    router.push({
      pathname: "/transactions",
      params: {
        analysisCategory: detailSection,
        monthStart: selectedMonth.startIso,
        monthEndExclusive: selectedMonth.endIso,
      },
    });
    setDetailSection(null);
  }, [detailSection, router, selectedMonth.endIso, selectedMonth.startIso]);

  const openInlineTransactionDetail = React.useCallback(
    (transactionId: string) => {
      if (!transactionId) return;
      router.push({
        pathname: "/transaction-detail",
        params: { id: transactionId },
      });
    },
    [router],
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
        let query = supabase
          .from("transactions")
          .select(
            "id,date,amount,details,counterparty,category_id_auto,category_id_user,budget_excluded",
          )
          .gte("date", weekStart)
          .lt("date", weekEndExclusive)
          .lt("amount", 0)
          .eq("analysis_main_group", "expense")
          .eq("analysis_category", "variable_costs")
          .order("date", { ascending: false });

        const isCounterpartyFallback =
          subcategoryKey.startsWith("counterparty:");
        let filteredRows: {
          id: string;
          date: string;
          details: string;
          counterparty: string | null;
          amount: number;
          budget_excluded: boolean;
        }[] = [];

        if (isCounterpartyFallback) {
          const normalizedNeedle = subcategoryKey.replace("counterparty:", "");
          const { data, error } = await query.limit(200);
          if (error) throw error;

          filteredRows = ((data || []) as any[])
            .filter((row) => {
              const candidate = normalizeLookupValue(
                String(row.counterparty || row.details || "Onbekend"),
              );
              return candidate === normalizedNeedle;
            })
            .map((row) => ({
              id: String(row.id),
              date: String(row.date || ""),
              details: String(row.details || ""),
              counterparty: row.counterparty ? String(row.counterparty) : null,
              amount: Number(row.amount) || 0,
              budget_excluded: Boolean(row.budget_excluded),
            }));
        } else {
          const categoryIds = resolveCategoryIdsForSubcategory(subcategoryKey);
          if (!categoryIds.length) {
            setInlineTransactionsBySubcategory((current) => ({
              ...current,
              [cacheKey]: [],
            }));
            return;
          }

          const idCsv = categoryIds.join(",");
          const { data, error } = await query
            .or(`category_id_user.in.(${idCsv}),category_id_auto.in.(${idCsv})`)
            .limit(200);
          if (error) throw error;

          filteredRows = ((data || []) as any[]).map((row) => ({
            id: String(row.id),
            date: String(row.date || ""),
            details: String(row.details || ""),
            counterparty: row.counterparty ? String(row.counterparty) : null,
            amount: Number(row.amount) || 0,
            budget_excluded: Boolean(row.budget_excluded),
          }));
        }

        setInlineTransactionsBySubcategory((current) => ({
          ...current,
          [cacheKey]: filteredRows.map((row) => ({
            id: row.id,
            date: row.date,
            title: extractTransactionTitle(row.details),
            counterparty: row.counterparty,
            amount: row.amount,
            budgetExcluded: row.budget_excluded,
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

  const toggleInlineTransactionBudgetExcluded = React.useCallback(
    async (cacheKey: string, transactionId: string, nextExcluded: boolean) => {
      if (inlineUpdatingTransactionIds.includes(transactionId)) return;

      setInlineUpdatingTransactionIds((current) => [...current, transactionId]);
      setInlineTransactionsBySubcategory((current) => ({
        ...current,
        [cacheKey]: (current[cacheKey] || []).map((item) =>
          item.id === transactionId
            ? { ...item, budgetExcluded: nextExcluded }
            : item,
        ),
      }));

      try {
        await setTransactionBudgetExcluded(transactionId, nextExcluded);
        if (monthOffset === 0) {
          await recomputeCurrentMonthCashflowForecast(new Date()).catch(
            (error) => {
              console.warn(
                "[budget] forecast recompute after budget exclusion failed",
                error,
              );
            },
          );
        }
        await loadBudgetPlan();
      } catch (error) {
        console.warn("[budget] budget exclusion toggle error", error);
        setInlineTransactionsBySubcategory((current) => ({
          ...current,
          [cacheKey]: (current[cacheKey] || []).map((item) =>
            item.id === transactionId
              ? { ...item, budgetExcluded: !nextExcluded }
              : item,
          ),
        }));
      } finally {
        setInlineUpdatingTransactionIds((current) =>
          current.filter((id) => id !== transactionId),
        );
      }
    },
    [inlineUpdatingTransactionIds, loadBudgetPlan, monthOffset],
  );

  const openWeekDetail = React.useCallback((weekNumber: number) => {
    setSelectedWeekNumber(weekNumber);
    setExpandedWeekMainCategories([]);
    setExpandedWeekSubcategories([]);
  }, []);

  const closeWeekDetail = React.useCallback(() => {
    setSelectedWeekNumber(null);
    setExpandedWeekMainCategories([]);
    setExpandedWeekSubcategories([]);
  }, []);

  const toggleWeekMainCategory = React.useCallback((categoryKey: string) => {
    setExpandedWeekMainCategories((current) => {
      if (current.includes(categoryKey)) {
        return current.filter((key) => key !== categoryKey);
      }
      return [...current, categoryKey];
    });
  }, []);

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
            {planningSummary ? (
              <View style={styles.planningCard}>
                <Text style={styles.cardTitle}>Maandplanning</Text>
                <Text style={styles.planningMainLabel}>
                  Totaal inkomend budget
                </Text>
                <Text style={styles.planningMainAmount}>
                  {fmt.format(planningSummary.expectedIncomeMonthly)}
                </Text>
                <Text style={styles.planningSecondaryText}>
                  {planningSummary.actualIncomeMonthToDate <= 0
                    ? "Nog te ontvangen deze maand. We plannen met je verwachte inkomsten."
                    : `Reeds ontvangen: ${fmt.format(planningSummary.actualIncomeMonthToDate)}`}
                </Text>

                <Pressable
                  style={styles.planningStepRow}
                  onPress={() => setDetailSection("fixed_costs")}
                >
                  <View style={styles.planningStepLabelWrap}>
                    <Text style={styles.planningStepLabel}>- Vaste lasten</Text>
                    <MaterialIcons
                      name="open-in-new"
                      size={14}
                      color={FinColors.textSecondary}
                    />
                  </View>
                  <Text style={styles.planningStepValueNegative}>
                    {fmt.format(-planningSummary.fixedCostsBudget)}
                  </Text>
                </Pressable>

                <View style={styles.planningSubtotalRow}>
                  <Text style={styles.planningSubtotalLabel}>
                    Subtotaal na vaste lasten
                  </Text>
                  <Text style={styles.planningSubtotalValue}>
                    {fmt.format(planningSummary.subtotalAfterFixed)}
                  </Text>
                </View>

                <Pressable
                  style={styles.planningStepRow}
                  onPress={() => setDetailSection("subscriptions")}
                >
                  <View style={styles.planningStepLabelWrap}>
                    <Text style={styles.planningStepLabel}>- Abonnementen</Text>
                    <MaterialIcons
                      name="open-in-new"
                      size={14}
                      color={FinColors.textSecondary}
                    />
                  </View>
                  <Text style={styles.planningStepValueNegative}>
                    {fmt.format(-planningSummary.subscriptionsBudget)}
                  </Text>
                </Pressable>

                <View style={styles.planningSubscriptionCtaRow}>
                  <Text style={styles.planningSubscriptionCtaText}>
                    Werk je abonnementen en PSP-koppelingen bij.
                  </Text>
                  <Pressable
                    style={styles.planningSubscriptionCtaButton}
                    onPress={() => router.push("/subscriptions")}
                  >
                    <Text style={styles.planningSubscriptionCtaButtonText}>
                      Beheer abonnementen
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.planningSubtotalRow}>
                  <Text style={styles.planningSubtotalLabel}>
                    Subtotaal na abonnementen
                  </Text>
                  <Text style={styles.planningSubtotalValue}>
                    {fmt.format(planningSummary.subtotalAfterSubscriptions)}
                  </Text>
                </View>

                <View style={styles.variableMonthlyRow}>
                  <Text style={styles.variableMonthlyLabel}>
                    Variabele uitgaven (maandtotaal)
                  </Text>
                  <Text style={styles.variableMonthlyValue}>
                    {fmt.format(planningSummary.variableBudget)}
                  </Text>
                </View>

                {planningSummary.appliedSavingsTarget > 0 ? (
                  <View style={styles.variableSavingsRow}>
                    <Text style={styles.variableSavingsLabel}>
                      {formatAppliedSavingsLabel(
                        budgetPlan.flowSummary.savingsTargetSource,
                      )}
                    </Text>
                    <Text style={styles.variableSavingsValue}>
                      {fmt.format(planningSummary.appliedSavingsTarget)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.variableBreakdownCard}>
                  <Text style={styles.variableBreakdownTitle}>
                    Onderverdeling van het maandtotaal
                  </Text>
                  <Text style={styles.variableBreakdownHint}>
                    Boodschappen, brandstof, roken en overig vormen samen het totale variabele maandbudget.
                  </Text>
                  {variableBudgetBreakdownRows.map((row) => (
                    <View key={row.key} style={styles.variableBreakdownRow}>
                      <Text style={styles.variableBreakdownLabel}>{row.label}</Text>
                      <Text style={styles.variableBreakdownValue}>
                        {fmt.format(row.amount)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.variableBreakdownDivider} />
                  <View style={styles.variableBreakdownRow}>
                    <Text style={styles.variableBreakdownTotalLabel}>Som onderverdeling</Text>
                    <Text style={styles.variableBreakdownTotalValue}>
                      {fmt.format(planningSummary.variableSubcategoriesBudgetTotal)}
                    </Text>
                  </View>
                </View>

                <View style={styles.inlineHelpRow}>
                  <MaterialIcons
                    name="info-outline"
                    size={14}
                    color={FinColors.textSecondary}
                  />
                  <Text style={styles.inlineHelpText}>
                    Weekbudgetten worden daggewogen verdeeld. Herverdeling gebeurt alleen als een week boven budget uitkomt.
                  </Text>
                </View>

                {weeklyBudgetContext ? (
                  <View style={styles.weekExplainerCard}>
                    <Text style={styles.weekExplainerTitle}>
                      Waarom wijkt de weeksom soms af?
                    </Text>
                    <Text style={styles.weekExplainerText}>
                      Overlapweken nemen dagen mee uit vorige of volgende maand.
                      Het dagbudget van die maand telt dan mee in het weekbudget.
                    </Text>
                    <View style={styles.weekExplainerRow}>
                      <Text style={styles.weekExplainerLabel}>Variabel maandbudget</Text>
                      <Text style={styles.weekExplainerValue}>
                        {fmt.format(weeklyBudgetContext.monthVariableBudget)}
                      </Text>
                    </View>
                    <View style={styles.weekExplainerRow}>
                      <Text style={styles.weekExplainerLabel}>Som zichtbare weekbudgetten</Text>
                      <Text style={styles.weekExplainerValue}>
                        {fmt.format(weeklyBudgetContext.visibleWeeksBudget)}
                      </Text>
                    </View>
                    <View style={styles.weekExplainerRow}>
                      <Text style={styles.weekExplainerLabel}>Verschil door overlap</Text>
                      <Text
                        style={[
                          styles.weekExplainerValue,
                          weeklyBudgetContext.delta === 0
                            ? styles.weekExplainerValueNeutral
                            : styles.weekExplainerValueEmphasis,
                        ]}
                      >
                        {fmt.format(weeklyBudgetContext.delta)}
                      </Text>
                    </View>
                    <Text style={styles.weekExplainerMeta}>
                      {weeklyBudgetContext.overlapWeekCount} overlapweek(en) in deze maandweergave.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.weekRowsWrap}>
                  {weeklyVariableRows.map((week) => {
                    const cappedProgress = Number.isFinite(week.utilization)
                      ? Math.min(Math.max(week.utilization, 0), 1)
                      : 1;
                    const isOverrun = week.remaining < 0;
                    const showCurrentWeekState =
                      isCurrentMonthView && week.isCurrentWeek;
                    const weekEndLabel = formatWeekEndDateLabel(
                      week.endDateExclusive,
                    );
                    const overlapLabel = formatWeekOverlapLabel(week);
                    const remainingDaysLabel = showCurrentWeekState
                      ? formatRemainingDaysInWeekLabel(week.endDateExclusive)
                      : null;
                    const compositionSegments = buildWeekCompositionSegments(week);
                    return (
                      <Pressable
                        key={week.weekNumber}
                        style={[
                          styles.weekRowCard,
                          showCurrentWeekState && styles.weekRowCardCurrent,
                        ]}
                        onPress={() => openWeekDetail(week.weekNumber)}
                      >
                        <View style={styles.weekRowHeader}>
                          <View style={styles.weekHeaderLeft}>
                            <Text style={styles.weekRowTitle}>
                              {week.label}
                            </Text>
                            {showCurrentWeekState ? (
                              <View style={styles.weekCurrentBadge}>
                                <Text style={styles.weekCurrentBadgeText}>
                                  Huidige week
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.weekHeaderRight}>
                            <MaterialIcons
                              name="chevron-right"
                              size={14}
                              color={FinColors.textSecondary}
                            />
                          </View>
                        </View>

                        <View style={styles.weekDateRow}>
                          <Text style={styles.weekDateText}>
                            Start {formatShortDateLabel(week.startDate)}
                          </Text>
                          <Text style={styles.weekDateText}>
                            Eind {weekEndLabel}
                          </Text>
                        </View>

                        {remainingDaysLabel ? (
                          <Text style={styles.weekRemainingDaysText}>
                            {remainingDaysLabel}
                          </Text>
                        ) : null}

                        {overlapLabel ? (
                          <Text style={styles.weekOverlapText}>{overlapLabel}</Text>
                        ) : null}

                        {compositionSegments.length ? (
                          <View style={styles.weekCompositionRow}>
                            {compositionSegments.map((segment) => (
                              <View
                                key={`${week.weekNumber}-${segment.key}`}
                                style={styles.weekCompositionPill}
                              >
                                <View
                                  style={[
                                    styles.weekCompositionDot,
                                    { backgroundColor: segment.color },
                                  ]}
                                />
                                <Text style={styles.weekCompositionText}>
                                  {segment.days}d {segment.label} maand
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <View style={styles.weekAmountRow}>
                          <Text style={styles.weekAmountMeta}>
                            {fmt.format(week.actual)} van{" "}
                            {fmt.format(week.budget)}
                          </Text>
                          <Text
                            style={[
                              styles.weekPercentageText,
                              week.utilization >= 1 &&
                                styles.weekRemainingCritical,
                            ]}
                          >
                            {formatUtilization(week.utilization)} gebruikt
                          </Text>
                        </View>

                        <View style={styles.weekProgressTrack}>
                          <View
                            style={[
                              styles.weekProgressFill,
                              { width: `${Math.round(cappedProgress * 100)}%` },
                              week.utilization >= 1 &&
                                styles.weekProgressFillWarning,
                            ]}
                          />
                        </View>

                        <View style={styles.weekStatusRow}>
                          <View style={styles.weekStatusLeft}>
                            {isOverrun ? (
                              <MaterialIcons
                                name="warning-amber"
                                size={14}
                                color={FinColors.red}
                              />
                            ) : null}
                            <Text
                              style={[
                                styles.weekRemainingText,
                                isOverrun
                                  ? styles.weekRemainingCritical
                                  : styles.weekRemainingPositive,
                              ]}
                            >
                              {isOverrun
                                ? `Overschrijding ${fmt.format(Math.abs(week.remaining))}`
                                : `Resterend ${fmt.format(week.remaining)}`}
                            </Text>
                          </View>
                          {week.wasRebalanced ? (
                            <Text style={styles.weekRebalancedText}>
                              Herverdeeld
                            </Text>
                          ) : null}
                        </View>

                        {isOverrun ? (
                          <Text style={styles.weekWarningText}>
                            Week over budget; resterende weekbudgetten zijn
                            opnieuw verdeeld.
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {budgetPlan.outsideBudgetExpenses.total > 0 ? (
                  <View style={styles.outsideBudgetCard}>
                    <Text style={styles.outsideBudgetTitle}>
                      Overige uitgaven buiten budget
                    </Text>
                    <Text style={styles.outsideBudgetAmount}>
                      {fmt.format(budgetPlan.outsideBudgetExpenses.total)}
                    </Text>
                    <Text style={styles.outsideBudgetMeta}>
                      Deze uitgaven zijn uitgesloten van budget, trend en
                      forecast.
                    </Text>

                    <View style={styles.outsideBudgetBreakdownWrap}>
                      {budgetPlan.outsideBudgetExpenses.variableCosts > 0 ? (
                        <View style={styles.outsideBudgetBreakdownRow}>
                          <Text style={styles.outsideBudgetBreakdownLabel}>
                            Variabel
                          </Text>
                          <Text style={styles.outsideBudgetBreakdownValue}>
                            {fmt.format(
                              budgetPlan.outsideBudgetExpenses.variableCosts,
                            )}
                          </Text>
                        </View>
                      ) : null}
                      {budgetPlan.outsideBudgetExpenses.fixedCosts > 0 ? (
                        <View style={styles.outsideBudgetBreakdownRow}>
                          <Text style={styles.outsideBudgetBreakdownLabel}>
                            Vaste lasten
                          </Text>
                          <Text style={styles.outsideBudgetBreakdownValue}>
                            {fmt.format(
                              budgetPlan.outsideBudgetExpenses.fixedCosts,
                            )}
                          </Text>
                        </View>
                      ) : null}
                      {budgetPlan.outsideBudgetExpenses.subscriptions > 0 ? (
                        <View style={styles.outsideBudgetBreakdownRow}>
                          <Text style={styles.outsideBudgetBreakdownLabel}>
                            Abonnementen
                          </Text>
                          <Text style={styles.outsideBudgetBreakdownValue}>
                            {fmt.format(
                              budgetPlan.outsideBudgetExpenses.subscriptions,
                            )}
                          </Text>
                        </View>
                      ) : null}
                      {budgetPlan.outsideBudgetExpenses.savingsTransfer > 0 ? (
                        <View style={styles.outsideBudgetBreakdownRow}>
                          <Text style={styles.outsideBudgetBreakdownLabel}>
                            Sparen
                          </Text>
                          <Text style={styles.outsideBudgetBreakdownValue}>
                            {fmt.format(
                              budgetPlan.outsideBudgetExpenses.savingsTransfer,
                            )}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {budgetPlan.outsideBudgetExpenses.items
                      .slice(0, 4)
                      .map((item) => (
                        <View
                          key={`${item.categoryLabel}-${item.label}`}
                          style={styles.outsideBudgetItemRow}
                        >
                          <View style={styles.outsideBudgetItemMain}>
                            <Text style={styles.outsideBudgetItemLabel}>
                              {item.label}
                            </Text>
                            <Text style={styles.outsideBudgetItemMeta}>
                              {item.categoryLabel} · {item.transactionCount}x
                            </Text>
                          </View>
                          <Text style={styles.outsideBudgetItemAmount}>
                            {fmt.format(item.amount)}
                          </Text>
                        </View>
                      ))}
                  </View>
                ) : null}

                <View style={styles.savingsCard}>
                  <Text style={styles.savingsTitle}>Spaardoel</Text>
                  <Text style={styles.savingsMetaText}>
                    {formatSavingsTargetSourceLabel(
                      budgetPlan.savingsTargetSource,
                      budgetPlan.usedOpenAISavingsTarget,
                    )}
                  </Text>
                  <View style={styles.savingsRow}>
                    <Text style={styles.savingsLabel}>Aanbevolen sparen</Text>
                    <Text style={styles.savingsValue}>
                      {fmt.format(
                        budgetPlan.savingsProgress.recommendedSavings,
                      )}
                    </Text>
                  </View>
                  <View style={styles.savingsRow}>
                    <Text style={styles.savingsLabel}>Werkelijk verdiend</Text>
                    <Text style={styles.savingsValue}>
                      {fmt.format(budgetPlan.savingsProgress.earnedActual)}
                    </Text>
                  </View>
                  <View style={styles.savingsRow}>
                    <Text style={styles.savingsLabel}>Op schema verdiend</Text>
                    <Text style={styles.savingsValueMuted}>
                      {fmt.format(budgetPlan.savingsProgress.earnedOnTrack)}
                    </Text>
                  </View>

                  {savingsMotivation ? (
                    <Text style={styles.savingsProgressLabel}>
                      {savingsMotivation.percentage}% bereikt ·{" "}
                      {savingsMotivation.message}
                    </Text>
                  ) : null}

                  <View style={styles.savingsProgressTrack}>
                    <View
                      style={[
                        styles.savingsProgressFillTrack,
                        {
                          width: `${Math.round(
                            Math.min(
                              Math.max(
                                budgetPlan.savingsProgress.progressOnTrack,
                                0,
                              ),
                              1,
                            ) * 100,
                          )}%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.savingsProgressFillActual,
                        {
                          width: `${Math.round(
                            Math.min(
                              Math.max(
                                budgetPlan.savingsProgress.progressActual,
                                0,
                              ),
                              1,
                            ) * 100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.savingsHelpText}>
                    Donkere balk = werkelijk, lichte balk = schema.
                  </Text>
                </View>
              </View>
            ) : null}

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
        animationType="fade"
        transparent
        visible={selectedWeekDetail != null && isFocused}
        onRequestClose={closeWeekDetail}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {selectedWeekDetail
                  ? `${selectedWeekDetail.week.label} variabele uitgaven`
                  : "Variabele uitgaven"}
              </Text>
              <Pressable
                style={styles.modalIconCloseButton}
                onPress={closeWeekDetail}
              >
                <MaterialIcons
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            {selectedWeekDetail ? (
              <Text style={styles.modalSub}>
                Alleen variabele uitgaven · Start{" "}
                {formatShortDateLabel(selectedWeekDetail.week.startDate)} · Eind{" "}
                {formatWeekEndDateLabel(
                  selectedWeekDetail.week.endDateExclusive,
                )}
                {selectedWeekDetail.week.crossesMonthBoundary
                  ? ` · ${formatWeekOverlapLabel(selectedWeekDetail.week)}`
                  : ""}
                {isCurrentMonthView && selectedWeekDetail.week.isCurrentWeek
                  ? " · Huidige week"
                  : ""}
              </Text>
            ) : null}

            {selectedWeekDetail ? (
              <View style={styles.weekDetailSummaryCard}>
                <Text style={styles.weekDetailSummaryLabel}>Weekoverzicht</Text>
                <View style={styles.weekDetailSummaryRow}>
                  <Text style={styles.weekDetailSummaryRowLabel}>
                    Totaal uitgegeven
                  </Text>
                  <Text style={styles.weekDetailSummaryRowValue}>
                    {fmt.format(selectedWeekDetail.week.actual)}
                  </Text>
                </View>
                <View style={styles.weekDetailSummaryRow}>
                  <Text style={styles.weekDetailSummaryRowLabel}>
                    Gereserveerd weekbudget
                  </Text>
                  <Text style={styles.weekDetailSummaryRowValue}>
                    {fmt.format(selectedWeekDetail.week.budget)}
                  </Text>
                </View>
                <View style={styles.weekDetailSummaryRow}>
                  <Text style={styles.weekDetailSummaryRowLabel}>
                    {selectedWeekDetail.week.remaining < 0
                      ? "Overschrijding"
                      : "Resterend budget"}
                  </Text>
                  <Text
                    style={[
                      styles.weekDetailSummaryRowValue,
                      selectedWeekDetail.week.remaining < 0 &&
                        styles.weekDetailSummaryRowValueCritical,
                    ]}
                  >
                    {selectedWeekDetail.week.remaining < 0
                      ? fmt.format(Math.abs(selectedWeekDetail.week.remaining))
                      : fmt.format(selectedWeekDetail.week.remaining)}
                  </Text>
                </View>
              </View>
            ) : null}

            <ScrollView style={styles.detailList}>
              {selectedWeekDetail && selectedWeekVariableCategories.length ? (
                selectedWeekVariableCategories.map((category) => {
                  const categoryWeekBudget =
                    selectedWeekBudgetByMainCategory.get(category.key) || 0;
                  const budgetUtilization =
                    categoryWeekBudget > 0
                      ? category.amount / categoryWeekBudget
                      : category.amount > 0
                        ? Number.POSITIVE_INFINITY
                        : 0;
                  const canExpand = category.subcategories.length > 0;
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

                      {isExpanded
                        ? category.subcategories
                            .filter((subcategory) => subcategory.amount > 0)
                            .map((subcategory) => {
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
                                  style={styles.weekDetailSubcategoryBlock}
                                >
                                  <Pressable
                                    style={styles.weekDetailSubcategoryRow}
                                    onPress={() =>
                                      toggleWeekSubcategoryInline(
                                        category.key,
                                        subcategory.key,
                                      )
                                    }
                                  >
                                    <View
                                      style={styles.weekDetailSubcategoryLeft}
                                    >
                                      <View
                                        style={styles.weekDetailSubcategoryDot}
                                      />
                                      <Text
                                        style={
                                          styles.weekDetailSubcategoryLabel
                                        }
                                      >
                                        {subcategory.label}
                                      </Text>
                                    </View>
                                    <View
                                      style={styles.weekDetailSubcategoryRight}
                                    >
                                      <Text
                                        style={
                                          styles.weekDetailSubcategoryAmount
                                        }
                                      >
                                        {fmt.format(subcategory.amount)}
                                      </Text>
                                      <MaterialIcons
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
                                    <View style={styles.inlineTransactionsWrap}>
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
                                        <Text style={styles.weekWarningText}>
                                          {inlineError}
                                        </Text>
                                      ) : null}

                                      {!isInlineLoading &&
                                      !inlineError &&
                                      !inlineTransactions.length ? (
                                        <Text
                                          style={styles.inlineTransactionsMeta}
                                        >
                                          Geen bijbehorende transacties
                                          gevonden.
                                        </Text>
                                      ) : null}

                                      {!isInlineLoading &&
                                      !inlineError &&
                                      inlineTransactions.length
                                        ? inlineTransactions.map((tx) => {
                                            const isUpdating =
                                              inlineUpdatingTransactionIds.includes(
                                                tx.id,
                                              );

                                            return (
                                              <View
                                                key={tx.id}
                                                style={
                                                  styles.inlineTransactionRow
                                                }
                                              >
                                                <Pressable
                                                  style={
                                                    styles.inlineTransactionMainPressable
                                                  }
                                                  onPress={() =>
                                                    openInlineTransactionDetail(
                                                      tx.id,
                                                    )
                                                  }
                                                >
                                                  <Text
                                                    style={
                                                      styles.inlineTransactionTitle
                                                    }
                                                  >
                                                    {tx.title}
                                                  </Text>
                                                  <Text
                                                    style={
                                                      styles.inlineTransactionsMeta
                                                    }
                                                  >
                                                    {tx.date}
                                                    {tx.counterparty
                                                      ? ` · ${tx.counterparty}`
                                                      : ""}
                                                  </Text>
                                                </Pressable>
                                                <View
                                                  style={
                                                    styles.inlineTransactionRight
                                                  }
                                                >
                                                  <Text
                                                    style={
                                                      styles.inlineTransactionAmount
                                                    }
                                                  >
                                                    {fmt.format(
                                                      Math.abs(tx.amount),
                                                    )}
                                                  </Text>
                                                  <Pressable
                                                    style={[
                                                      styles.inlineExcludeToggle,
                                                      tx.budgetExcluded &&
                                                        styles.inlineExcludeToggleActive,
                                                    ]}
                                                    onPress={() =>
                                                      void toggleInlineTransactionBudgetExcluded(
                                                        cacheKey,
                                                        tx.id,
                                                        !tx.budgetExcluded,
                                                      )
                                                    }
                                                    disabled={isUpdating}
                                                  >
                                                    <Text
                                                      style={[
                                                        styles.inlineExcludeToggleText,
                                                        tx.budgetExcluded &&
                                                          styles.inlineExcludeToggleTextActive,
                                                      ]}
                                                    >
                                                      {tx.budgetExcluded
                                                        ? "Binnen budget opnemen"
                                                        : "Uitsluiten"}
                                                    </Text>
                                                  </Pressable>
                                                </View>
                                              </View>
                                            );
                                          })
                                        : null}
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })
                        : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyStateText}>
                  Nog geen variabele uitgaven gevonden in deze week.
                </Text>
              )}
            </ScrollView>
            <Text style={styles.weekDetailFootnote}>
              Tik op een subcategorie om alleen de bijbehorende transacties
              inline te tonen.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={detailSection != null}
        onRequestClose={() => setDetailSection(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {detailSection === "fixed_costs"
                  ? "Vaste lasten details"
                  : "Abonnementen details"}
              </Text>
              <Pressable
                style={styles.modalIconCloseButton}
                onPress={() => setDetailSection(null)}
              >
                <MaterialIcons
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Verwacht {fmt.format(detailExpectedAndActual.expected)} · Actueel{" "}
              {fmt.format(detailExpectedAndActual.actual)}
            </Text>

            <Pressable
              style={styles.openTransactionsButton}
              onPress={openDetailTransactions}
            >
              <MaterialIcons
                name="open-in-new"
                size={14}
                color={FinColors.textPrimary}
              />
              <Text style={styles.openTransactionsButtonText}>
                Open transacties
              </Text>
            </Pressable>

            <View style={styles.inlineHelpRow}>
              <MaterialIcons
                name="info-outline"
                size={14}
                color={FinColors.textSecondary}
              />
              <Text style={styles.inlineHelpText}>
                Dit is de lijst met actuele posten in deze maand.
              </Text>
            </View>

            <ScrollView style={styles.detailList}>
              {detailItems.length ? (
                detailItems.map((item, index) => (
                  <View
                    key={`${item.label}-${index}`}
                    style={styles.detailListRow}
                  >
                    <View style={styles.detailListMain}>
                      <Text style={styles.detailListLabel}>{item.label}</Text>
                      <Text style={styles.detailListMeta}>
                        {item.transactionCount}x · laatst{" "}
                        {item.lastTransactionDate
                          ? formatShortDateLabel(item.lastTransactionDate)
                          : "onbekend"}
                      </Text>
                    </View>
                    <Text style={styles.detailListAmount}>
                      {fmt.format(item.amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyStateText}>
                  Nog geen posten gevonden voor deze sectie.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator
            >
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

              <View style={styles.modeDescriptionCard}>
                <Text style={styles.modeDescriptionTitle}>
                  {formatBudgetModeLabel(budgetModeDraft)}
                </Text>
                <Text style={styles.modeDescriptionText}>
                  {getBudgetModeDescription(budgetModeDraft)}
                </Text>
                {selectedModeTargetPreview ? (
                  <View style={styles.modeTargetPreviewCard}>
                    <Text style={styles.modeTargetPreviewLabel}>
                      {selectedModeTargetPreview.isCurrentMode
                        ? "Spaardoel deze maand"
                        : "Verwacht spaardoel deze maand"}
                    </Text>
                    <Text style={styles.modeTargetPreviewValue}>
                      {fmt.format(selectedModeTargetPreview.amount)}
                    </Text>
                    <Text style={styles.modeTargetPreviewMeta}>
                      {selectedModeTargetPreview.meta}
                    </Text>
                  </View>
                ) : null}
              </View>

              {budgetModeDraft === "custom" ? (
                <>
                  <Text style={styles.modalSectionTitle}>Eigen spaardoel</Text>
                  <Text style={styles.modalHintText}>
                    Stel in hoeveel je aan het einde van deze maand wilt overhouden.
                  </Text>
                  <BudgetAmountSlider
                    value={savingsTargetMonthlyDraft}
                    min={0}
                    max={savingsSliderMax}
                    step={SAVINGS_SLIDER_STEP}
                    onChange={setSavingsTargetMonthlyDraft}
                  />
                </>
              ) : null}

              <Text style={styles.modalSectionTitle}>Inkomstenbasis</Text>
              <Text style={styles.modalHintText}>
                Selecteer welke inkomsten meetellen voor budget en cashflow
                voorspelling.
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

              <View style={styles.categoryEditorCard}>
                <Text style={styles.modalSectionTitle}>
                  Maandbudget per categorie
                </Text>
                <Text style={styles.modalHintText}>
                  Verwachte kosten worden opnieuw opgebouwd vanuit de mediaan van de laatste afgeronde maanden. Je kunt hieronder per maand bijsturen.
                </Text>
                {autoManagedVariableBudget ? (
                  <Text style={styles.modalAutoManagedHint}>
                    Variabele uitgaven worden in deze modus automatisch bepaald door het spaardoel. Alleen vaste lasten en abonnementen pas je hier handmatig aan.
                  </Text>
                ) : null}
                <Pressable
                  style={styles.recalculateButton}
                  onPress={() => {
                    void recalculateExpectedCosts();
                  }}
                  disabled={savingBudgetEdit || recalculatingBudget}
                >
                  <Text style={styles.recalculateButtonText}>
                    {recalculatingBudget
                      ? "Herberekenen..."
                      : "Verwachte kosten herberekenen"}
                  </Text>
                </Pressable>
                <View style={styles.editList}>
                  {editableBudgetRows.map((row) => {
                    const inputDisabled =
                      autoManagedVariableBudget &&
                      isVariableBudgetCategory(row.categoryKey);

                    return (
                      <View
                        key={row.categoryKey}
                        style={[
                          styles.editRow,
                          row.categoryKey === "variable_costs" && styles.editRowPrimary,
                          isVariableBreakdownKey(row.categoryKey) && styles.editRowChild,
                          inputDisabled && styles.editRowDisabled,
                        ]}
                      >
                        <View style={styles.editRowMain}>
                          <Text
                            style={[
                              styles.editRowLabel,
                              row.categoryKey === "variable_costs" && styles.editRowLabelPrimary,
                              isVariableBreakdownKey(row.categoryKey) && styles.editRowLabelChild,
                            ]}
                          >
                            {isVariableBreakdownKey(row.categoryKey)
                              ? `└ ${getBudgetCategoryDisplayLabel(row.categoryKey)}`
                              : getBudgetCategoryDisplayLabel(row.categoryKey)}
                          </Text>
                          <Text style={styles.editRowMeta}>
                            Richtwaarde: {fmt.format(Math.round(row.baselineMonthly))} · Actueel: {fmt.format(row.monthlyActual)}
                            {inputDisabled ? " · automatisch" : ""}
                          </Text>
                        </View>
                        <TextInput
                          value={
                            budgetDraftValues[row.categoryKey] ??
                            row.monthlyBudget.toFixed(0)
                          }
                          onChangeText={(text) => {
                            if (inputDisabled) return;
                            setBudgetDraftValues((current) => ({
                              ...current,
                              [row.categoryKey]: text,
                            }));
                          }}
                          editable={!inputDisabled}
                          style={[
                            styles.editInput,
                            inputDisabled && styles.editInputDisabled,
                          ]}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    );
                  })}
                </View>

                <View style={styles.variableDraftSummaryCard}>
                  <Text style={styles.variableDraftSummaryTitle}>
                    Controle variabele uitgaven
                  </Text>
                  <View style={styles.variableDraftSummaryRow}>
                    <Text style={styles.variableDraftSummaryLabel}>
                      Totaal variabele uitgaven
                    </Text>
                    <Text style={styles.variableDraftSummaryValue}>
                      {fmt.format(variableBudgetDraftSummary.total)}
                    </Text>
                  </View>
                  <View style={styles.variableDraftSummaryRow}>
                    <Text style={styles.variableDraftSummaryLabel}>
                      Som onderverdeling
                    </Text>
                    <Text style={styles.variableDraftSummaryValue}>
                      {fmt.format(variableBudgetDraftSummary.breakdownTotal)}
                    </Text>
                  </View>
                  <View style={styles.variableDraftSummaryRow}>
                    <Text style={styles.variableDraftSummaryLabel}>Verschil</Text>
                    <Text
                      style={[
                        styles.variableDraftSummaryValue,
                        variableBudgetDraftSummary.delta === 0
                          ? styles.variableDraftSummaryValueOk
                          : styles.variableDraftSummaryValueWarning,
                      ]}
                    >
                      {fmt.format(variableBudgetDraftSummary.delta)}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => setBudgetEditOpen(false)}
                disabled={savingBudgetEdit || recalculatingBudget}
              >
                <Text style={styles.modalCancelText}>Annuleren</Text>
              </Pressable>
              <Pressable
                style={[styles.modalActionButton, styles.modalSaveButton]}
                onPress={() => {
                  void saveBudgetEdit();
                }}
                disabled={savingBudgetEdit || recalculatingBudget}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
  },
  monthNavButtonDisabled: {
    opacity: 0.35,
  },
  monthNavButtonText: {
    fontSize: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
    lineHeight: 20,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  planningCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 16,
    gap: 10,
  },
  planningMainLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  planningMainAmount: {
    fontSize: 30,
    color: FinColors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  planningSecondaryText: {
    fontSize: 12,
    color: FinColors.textSecondary,
    lineHeight: 18,
  },
  planningStepRow: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  planningStepLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  planningStepLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  planningStepValueNegative: {
    fontSize: 13,
    color: FinColors.red,
    fontWeight: "700",
  },
  planningSubscriptionCtaRow: {
    marginTop: -2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  planningSubscriptionCtaText: {
    fontSize: 12,
    color: FinColors.textSecondary,
    lineHeight: 17,
  },
  planningSubscriptionCtaButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  planningSubscriptionCtaButtonText: {
    color: FinColors.green,
    fontSize: 12,
    fontWeight: "700",
  },
  planningSubtotalRow: {
    marginTop: -2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planningSubtotalLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  planningSubtotalValue: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableMonthlyRow: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  variableMonthlyLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableMonthlyValue: {
    fontSize: 15,
    color: FinColors.green,
    fontWeight: "800",
  },
  variableSavingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  variableSavingsLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  variableSavingsValue: {
    fontSize: 12,
    color: FinColors.green,
    fontWeight: "700",
  },
  variableBreakdownCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 8,
  },
  variableBreakdownTitle: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableBreakdownHint: {
    fontSize: 11,
    color: FinColors.textMuted,
    lineHeight: 16,
  },
  variableBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  variableBreakdownLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  variableBreakdownValue: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableBreakdownDivider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
  },
  variableBreakdownTotalLabel: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableBreakdownTotalValue: {
    fontSize: 12,
    color: FinColors.green,
    fontWeight: "800",
  },
  inlineHelpRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  inlineHelpText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: FinColors.textMuted,
  },
  weekExplainerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 6,
  },
  weekExplainerTitle: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  weekExplainerText: {
    fontSize: 11,
    color: FinColors.textSecondary,
    lineHeight: 16,
  },
  weekExplainerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weekExplainerLabel: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekExplainerValue: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  weekExplainerValueNeutral: {
    color: FinColors.textMuted,
  },
  weekExplainerValueEmphasis: {
    color: FinColors.green,
  },
  weekExplainerMeta: {
    fontSize: 11,
    color: FinColors.textMuted,
    lineHeight: 15,
  },
  weekRowsWrap: {
    marginTop: 6,
    gap: 8,
  },
  outsideBudgetCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.red,
    backgroundColor: FinColors.redBg,
    padding: 12,
    gap: 8,
  },
  outsideBudgetTitle: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  outsideBudgetAmount: {
    fontSize: 18,
    color: FinColors.red,
    fontWeight: "800",
  },
  outsideBudgetMeta: {
    fontSize: 11,
    color: FinColors.textSecondary,
    lineHeight: 16,
  },
  outsideBudgetBreakdownWrap: {
    gap: 4,
  },
  outsideBudgetBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outsideBudgetBreakdownLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  outsideBudgetBreakdownValue: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  outsideBudgetItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 8,
  },
  outsideBudgetItemMain: {
    flex: 1,
  },
  outsideBudgetItemLabel: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  outsideBudgetItemMeta: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  outsideBudgetItemAmount: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  weekRowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  weekRowCardCurrent: {
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  weekRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  weekRowTitle: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  weekCurrentBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  weekCurrentBadgeText: {
    fontSize: 10,
    color: FinColors.green,
    fontWeight: "700",
  },
  weekDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weekDateText: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekRemainingDaysText: {
    fontSize: 11,
    color: FinColors.green,
    fontWeight: "700",
  },
  weekOverlapText: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  weekCompositionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  weekCompositionPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  weekCompositionDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  weekCompositionText: {
    fontSize: 10,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekRowRange: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  weekAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekAmountMeta: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekPercentageText: {
    fontSize: 11,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  weekProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#2b2b2b",
    overflow: "hidden",
  },
  weekProgressFill: {
    height: "100%",
    backgroundColor: FinColors.green,
  },
  weekProgressFillWarning: {
    backgroundColor: FinColors.red,
  },
  weekStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weekRemainingText: {
    fontSize: 11,
    fontWeight: "700",
  },
  weekRemainingPositive: {
    color: FinColors.green,
  },
  weekRemainingCritical: {
    color: FinColors.red,
  },
  weekRebalancedText: {
    fontSize: 10,
    fontWeight: "700",
    color: FinColors.textPrimary,
    backgroundColor: "#2d3f2f",
    borderWidth: 1,
    borderColor: "#497b53",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  weekWarningText: {
    fontSize: 11,
    color: FinColors.red,
    lineHeight: 16,
  },
  savingsCard: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 8,
  },
  savingsTitle: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  savingsMetaText: {
    fontSize: 11,
    color: FinColors.textMuted,
    lineHeight: 16,
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savingsLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  savingsValue: {
    fontSize: 12,
    color: FinColors.green,
    fontWeight: "700",
  },
  savingsValueMuted: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  savingsProgressTrack: {
    marginTop: 4,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#2b2b2b",
    overflow: "hidden",
    position: "relative",
  },
  savingsProgressFillTrack: {
    height: "100%",
    backgroundColor: "#3d6b4d",
    position: "absolute",
    left: 0,
    top: 0,
  },
  savingsProgressFillActual: {
    height: "100%",
    backgroundColor: FinColors.green,
    position: "absolute",
    left: 0,
    top: 0,
  },
  savingsHelpText: {
    fontSize: 11,
    color: FinColors.textMuted,
  },
  savingsProgressLabel: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textSecondary,
    lineHeight: 16,
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
    backgroundColor: "#3a3423",
    borderColor: "#d9b95b",
  },
  warningPillWarning: {
    backgroundColor: "#3f2d1f",
    borderColor: "#f5a55a",
  },
  warningPillCritical: {
    backgroundColor: "#3e2222",
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
    maxHeight: "92%",
    borderRadius: 16,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 16,
  },
  modalBodyScroll: {
    marginTop: 10,
  },
  modalBodyContent: {
    paddingBottom: 8,
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
  openTransactionsButton: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  openTransactionsButtonText: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
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
  modeDescriptionCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 6,
  },
  modeDescriptionTitle: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  modeDescriptionText: {
    fontSize: 12,
    color: FinColors.textSecondary,
    lineHeight: 18,
  },
  modeTargetPreviewCard: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 3,
  },
  modeTargetPreviewLabel: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "700",
  },
  modeTargetPreviewValue: {
    fontSize: 19,
    color: FinColors.green,
    fontWeight: "800",
  },
  modeTargetPreviewMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: FinColors.textSecondary,
  },
  modalHintText: {
    marginTop: -2,
    marginBottom: 8,
    color: FinColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  modalAutoManagedHint: {
    marginTop: -2,
    marginBottom: 10,
    color: FinColors.green,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  incomeOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryEditorCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
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
    marginTop: 8,
  },
  detailList: {
    marginTop: 10,
    maxHeight: 260,
  },
  weekDetailSummaryCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  weekDetailSummaryLabel: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  weekDetailSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  weekDetailSummaryRowLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  weekDetailSummaryRowValue: {
    fontSize: 14,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  weekDetailSummaryRowValueCritical: {
    color: FinColors.red,
  },
  detailListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  detailListMain: {
    flex: 1,
  },
  detailListLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  detailListMeta: {
    marginTop: 2,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  detailListAmount: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  weekDetailBlock: {
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingVertical: 10,
  },
  weekDetailSubcategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 8,
    paddingLeft: 14,
  },
  weekDetailSubcategoryBlock: {
    marginTop: 6,
  },
  weekDetailSubcategoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  weekDetailSubcategoryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  weekDetailSubcategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: FinColors.textMuted,
  },
  weekDetailSubcategoryLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  weekDetailSubcategoryAmount: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  inlineTransactionsWrap: {
    marginTop: 6,
    marginLeft: 18,
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: FinColors.borderSubtle,
    paddingLeft: 10,
  },
  inlineTransactionsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  inlineTransactionsMeta: {
    fontSize: 11,
    color: FinColors.textMuted,
  },
  inlineTransactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    paddingBottom: 6,
  },
  inlineTransactionMain: {
    flex: 1,
  },
  inlineTransactionMainPressable: {
    flex: 1,
    paddingVertical: 2,
  },
  inlineTransactionTitle: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  inlineTransactionRight: {
    alignItems: "flex-end",
    gap: 5,
  },
  inlineTransactionAmount: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  inlineExcludeToggle: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineExcludeToggleActive: {
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  inlineExcludeToggleText: {
    fontSize: 11,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  inlineExcludeToggleTextActive: {
    color: FinColors.green,
  },
  weekDetailFootnote: {
    marginTop: 10,
    fontSize: 11,
    color: FinColors.textMuted,
    lineHeight: 16,
  },
  recalculateButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recalculateButtonText: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
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
  editRowPrimary: {
    marginTop: 4,
    paddingTop: 12,
  },
  editRowChild: {
    paddingLeft: 12,
  },
  editRowDisabled: {
    opacity: 0.72,
  },
  editRowMain: {
    flex: 1,
  },
  editRowLabel: {
    fontSize: 13,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  editRowLabelPrimary: {
    color: FinColors.green,
  },
  editRowLabelChild: {
    color: FinColors.textSecondary,
    fontWeight: "600",
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
  editInputDisabled: {
    backgroundColor: FinColors.bgCard,
    color: FinColors.textMuted,
  },
  variableDraftSummaryCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 8,
  },
  variableDraftSummaryTitle: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableDraftSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  variableDraftSummaryLabel: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  variableDraftSummaryValue: {
    fontSize: 12,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  variableDraftSummaryValueOk: {
    color: FinColors.green,
  },
  variableDraftSummaryValueWarning: {
    color: FinColors.red,
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
