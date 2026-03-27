import { Platform } from "react-native";

export type HelpAssistantScreenId =
  | "dashboard"
  | "transactions"
  | "budget"
  | "insights"
  | "import";

export type HelpAssistantPeriodContext = {
  key?: string;
  label: string;
  startIso?: string;
  endIsoExclusive?: string;
};

export type HelpAssistantContext = {
  screenId: HelpAssistantScreenId;
  routeName: string;
  screenTitle: string;
  selectedPeriod: HelpAssistantPeriodContext | null;
  screenContext: HelpAssistantScreenContextData | null;
  platform: string;
};

export type SpendingAdviceContext = {
  screenId: HelpAssistantScreenId;
  screenTitle: string;
  periodLabel: string;
  platform: string;
  requestedAmount: number | null;
  budget: {
    remainingVariableBudget: number | null;
    totalVariableBudget: number | null;
    spentVariableBudget: number | null;
    weekRemainingBudget: number | null;
    weekTempoDelta: number | null;
  };
  planning: {
    upcomingCommittedExpenseTotal: number | null;
    expectedFixedCosts: number | null;
    expectedSubscriptions: number | null;
    remainingPlannedExpenseTotal: number | null;
    remainingVariableExpenseEstimate: number | null;
  };
  forecast: {
    hasForecastData: boolean;
    expectedEndBalance: number | null;
    lowestExpectedBalance: number | null;
    remainingMonthExpectedEndBalance: number | null;
    remainingMonthNetTotal: number | null;
  };
  dataQuality: {
    hasBudgetSignals: boolean;
    hasPlanningSignals: boolean;
    hasForecastSignals: boolean;
    dataGaps: string[];
  };
};

export type HelpAssistantBudgetScreenContext = {
  kind: "budget";
  monthLabel?: string;
  monthBudgetState?: "no_data" | "no_budget" | "within_budget" | "over_budget";
  monthStatusLabel?: string;
  monthRiskTone?: "good" | "watch" | "critical" | null;
  remainingVariableBudget?: number | null;
  spentVariableBudget?: number | null;
  totalVariableBudget?: number | null;
  weekStatusLabel?: string;
  weekRiskTone?: "good" | "watch" | "critical" | "neutral" | null;
  weekRemainingBudget?: number | null;
  weekTempoDelta?: number | null;
  upcomingCommittedExpenseTotal?: number | null;
  expectedFixedCosts?: number | null;
  expectedSubscriptions?: number | null;
  forecastExpectedEndBalance?: number | null;
  forecastLowestExpectedBalance?: number | null;
  hasForecastData?: boolean;
};

export type HelpAssistantTransactionsScreenContext = {
  kind: "transactions";
  activeMonthLabel?: string;
  activeFilterCount?: number;
  hasSearchQuery?: boolean;
  hasMonthFilter?: boolean;
};

export type HelpAssistantImportScreenContext = {
  kind: "import";
  sourceLabel?: string;
  totalTransactions?: number;
  periodLabel?: string;
  stage?: "idle" | "preparing" | "writing" | "completed" | "error";
  progressMessage?: string;
};

export type HelpAssistantInsightsScreenContext = {
  kind: "insights";
  monthLabel?: string;
  statusLabel?: "Op schema" | "Let op" | "Krap" | "Neutraal";
  remainingPlannedExpenseTotal?: number | null;
  remainingVariableExpenseEstimate?: number | null;
  remainingMonthNetTotal?: number | null;
  remainingMonthExpectedEndBalance?: number | null;
  hasForecastData?: boolean;
};

export type HelpAssistantScreenContextData =
  | HelpAssistantBudgetScreenContext
  | HelpAssistantTransactionsScreenContext
  | HelpAssistantImportScreenContext
  | HelpAssistantInsightsScreenContext;

type HelpAssistantScreenDefinition = {
  title: string;
  defaultRouteName: string;
};

const SCREEN_DEFINITIONS: Record<
  HelpAssistantScreenId,
  HelpAssistantScreenDefinition
> = {
  dashboard: {
    title: "Dashboard",
    defaultRouteName: "/",
  },
  transactions: {
    title: "Transacties",
    defaultRouteName: "/transactions",
  },
  budget: {
    title: "Budget",
    defaultRouteName: "/budget",
  },
  insights: {
    title: "Inzichten",
    defaultRouteName: "/insights",
  },
  import: {
    title: "Importeren",
    defaultRouteName: "/import-control",
  },
};

export type BuildHelpAssistantContextInput = {
  screenId: HelpAssistantScreenId;
  routeName?: string | null;
  selectedPeriod?: HelpAssistantPeriodContext | null;
  screenContext?: HelpAssistantScreenContextData | null;
};

export type HelpAssistantUserProfile = {
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    full_name?: string | null;
  } | null;
} | null | undefined;

function normalizeRouteName(value: string | null | undefined, fallback: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  if (normalized === "/index") return "/";
  return normalized;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeScreenContext(
  screenId: HelpAssistantScreenId,
  value: HelpAssistantScreenContextData | null | undefined,
): HelpAssistantScreenContextData | null {
  if (!value) return null;

  if ((screenId === "budget" || screenId === "dashboard") && value.kind === "budget") {
    return {
      kind: "budget",
      monthLabel: value.monthLabel || undefined,
      monthBudgetState: value.monthBudgetState || undefined,
      monthStatusLabel: value.monthStatusLabel || undefined,
      monthRiskTone: value.monthRiskTone || null,
      remainingVariableBudget: toFiniteNumber(value.remainingVariableBudget),
      spentVariableBudget: toFiniteNumber(value.spentVariableBudget),
      totalVariableBudget: toFiniteNumber(value.totalVariableBudget),
      weekStatusLabel: value.weekStatusLabel || undefined,
      weekRiskTone: value.weekRiskTone || null,
      weekRemainingBudget: toFiniteNumber(value.weekRemainingBudget),
      weekTempoDelta: toFiniteNumber(value.weekTempoDelta),
      upcomingCommittedExpenseTotal: toFiniteNumber(
        value.upcomingCommittedExpenseTotal,
      ),
      expectedFixedCosts: toFiniteNumber(value.expectedFixedCosts),
      expectedSubscriptions: toFiniteNumber(value.expectedSubscriptions),
      forecastExpectedEndBalance: toFiniteNumber(
        value.forecastExpectedEndBalance,
      ),
      forecastLowestExpectedBalance: toFiniteNumber(
        value.forecastLowestExpectedBalance,
      ),
      hasForecastData: Boolean(value.hasForecastData),
    };
  }

  if (screenId === "transactions" && value.kind === "transactions") {
    return {
      kind: "transactions",
      activeMonthLabel: value.activeMonthLabel || undefined,
      activeFilterCount: Math.max(0, Math.round(Number(value.activeFilterCount || 0))),
      hasSearchQuery: Boolean(value.hasSearchQuery),
      hasMonthFilter: Boolean(value.hasMonthFilter),
    };
  }

  if (screenId === "import" && value.kind === "import") {
    return {
      kind: "import",
      sourceLabel: value.sourceLabel || undefined,
      totalTransactions: toFiniteNumber(value.totalTransactions) || undefined,
      periodLabel: value.periodLabel || undefined,
      stage: value.stage || undefined,
      progressMessage: value.progressMessage || undefined,
    };
  }

  if (screenId === "insights" && value.kind === "insights") {
    return {
      kind: "insights",
      monthLabel: value.monthLabel || undefined,
      statusLabel: value.statusLabel || undefined,
      remainingPlannedExpenseTotal: toFiniteNumber(
        value.remainingPlannedExpenseTotal,
      ),
      remainingVariableExpenseEstimate: toFiniteNumber(
        value.remainingVariableExpenseEstimate,
      ),
      remainingMonthNetTotal: toFiniteNumber(value.remainingMonthNetTotal),
      remainingMonthExpectedEndBalance: toFiniteNumber(
        value.remainingMonthExpectedEndBalance,
      ),
      hasForecastData: Boolean(value.hasForecastData),
    };
  }

  return null;
}

function normalizeDisplayName(value: string | null | undefined) {
  return String(value || "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveHelpAssistantDisplayName(user: HelpAssistantUserProfile) {
  const metadataName = normalizeDisplayName(user?.user_metadata?.full_name)
    || normalizeDisplayName(user?.user_metadata?.name);
  if (metadataName) return metadataName;

  const localPart = String(user?.email || "").split("@")[0] || "";
  const normalizedLocalPart = normalizeDisplayName(localPart);
  if (normalizedLocalPart) return normalizedLocalPart;

  return "";
}

export function resolveHelpAssistantFirstName(user: HelpAssistantUserProfile) {
  const displayName = resolveHelpAssistantDisplayName(user);
  if (!displayName) return "";
  return displayName.split(" ").filter(Boolean)[0] || "";
}

export function buildHelpAssistantContext({
  screenId,
  routeName,
  selectedPeriod,
  screenContext,
}: BuildHelpAssistantContextInput): HelpAssistantContext {
  const definition = SCREEN_DEFINITIONS[screenId];
  const normalizedRouteName = normalizeRouteName(
    routeName,
    definition.defaultRouteName,
  );

  return {
    screenId,
    routeName: normalizedRouteName,
    screenTitle: definition.title,
    selectedPeriod: selectedPeriod || null,
    screenContext: sanitizeScreenContext(screenId, screenContext),
    platform: Platform.OS,
  };
}

export function formatHelpAssistantContextChipLabel(
  context: HelpAssistantContext,
) {
  if (!context.selectedPeriod?.label) return context.screenTitle;
  return `${context.screenTitle} · ${context.selectedPeriod.label}`;
}

export function buildHelpAssistantScreenContextLines(
  context: HelpAssistantContext,
) {
  const details = context.screenContext;
  if (!details) return [] as string[];

  if (details.kind === "budget") {
    const fixedAndSubscriptions =
      details.expectedFixedCosts != null || details.expectedSubscriptions != null
        ? (details.expectedFixedCosts || 0) + (details.expectedSubscriptions || 0)
        : null;

    return [
      details.monthLabel ? `Budget maand: ${details.monthLabel}` : "",
      details.monthBudgetState ? `Budget staat: ${details.monthBudgetState}` : "",
      details.monthStatusLabel ? `Budget status: ${details.monthStatusLabel}` : "",
      details.monthRiskTone ? `Tempo-signaal: ${details.monthRiskTone}` : "",
      details.remainingVariableBudget != null
        ? `Resterend variabel budget: ${Math.round(details.remainingVariableBudget)} EUR`
        : "",
      details.spentVariableBudget != null
        ? `Al uitgegeven variabel: ${Math.round(details.spentVariableBudget)} EUR`
        : "",
      details.totalVariableBudget != null
        ? `Totaal variabel budget: ${Math.round(details.totalVariableBudget)} EUR`
        : "",
      details.weekStatusLabel ? `Weekbudget status: ${details.weekStatusLabel}` : "",
      details.weekRiskTone ? `Weektempo-signaal: ${details.weekRiskTone}` : "",
      details.weekRemainingBudget != null
        ? `Weekbudget resterend: ${Math.round(details.weekRemainingBudget)} EUR`
        : "",
      details.weekTempoDelta != null
        ? `Week tempo-afwijking: ${Math.round(details.weekTempoDelta)} EUR`
        : "",
      details.upcomingCommittedExpenseTotal != null
        ? `Komende vaste lasten (forecast): ${Math.round(details.upcomingCommittedExpenseTotal)} EUR`
        : "",
      fixedAndSubscriptions != null
        ? `Verwachte vaste lasten + abonnementen: ${Math.round(fixedAndSubscriptions)} EUR`
        : "",
      details.forecastExpectedEndBalance != null
        ? `Forecast operationele stand: ${Math.round(details.forecastExpectedEndBalance)} EUR`
        : "",
      details.forecastLowestExpectedBalance != null
        ? `Laagste operationele punt: ${Math.round(details.forecastLowestExpectedBalance)} EUR`
        : "",
      details.hasForecastData
        ? "Forecast betrouwbaarheid: gebaseerd op huidige bekende data."
        : "Forecast betrouwbaarheid: onvolledig, geef antwoord voorzichtig.",
    ].filter(Boolean);
  }

  if (details.kind === "transactions") {
    return [
      details.activeMonthLabel
        ? `Actieve transactiemaand: ${details.activeMonthLabel}`
        : "",
      details.activeFilterCount != null
        ? `Aantal actieve filters: ${details.activeFilterCount}`
        : "",
      details.hasSearchQuery ? "Zoekfilter actief: ja" : "",
      details.hasMonthFilter ? "Maandfilter actief: ja" : "Maandfilter actief: nee",
      "Bestedingsruimte-data: beperkt op dit scherm, verwijs zo nodig naar Budget/Inzichten.",
    ].filter(Boolean);
  }

  if (details.kind === "import") {
    return [
      details.sourceLabel ? `Import bron: ${details.sourceLabel}` : "",
      details.totalTransactions != null
        ? `Import transacties: ${details.totalTransactions}`
        : "",
      details.periodLabel ? `Import periode: ${details.periodLabel}` : "",
      details.stage ? `Import fase: ${details.stage}` : "",
      details.progressMessage ? `Import voortgang: ${details.progressMessage}` : "",
      "Financiele bestedingsruimte: niet af te leiden uit importstatus alleen.",
    ].filter(Boolean);
  }

  if (details.kind === "insights") {
    return [
      details.monthLabel ? `Inzichten maand: ${details.monthLabel}` : "",
      details.statusLabel ? `Inzichten status: ${details.statusLabel}` : "",
      details.remainingPlannedExpenseTotal != null
        ? `Nog geplande lasten: ${Math.round(details.remainingPlannedExpenseTotal)} EUR`
        : "",
      details.remainingVariableExpenseEstimate != null
        ? `Nog variabele uitgaven (schatting): ${Math.round(details.remainingVariableExpenseEstimate)} EUR`
        : "",
      details.remainingMonthNetTotal != null
        ? `Resterende maand netto: ${Math.round(details.remainingMonthNetTotal)} EUR`
        : "",
      details.remainingMonthExpectedEndBalance != null
        ? `Verwachte operationele stand maand: ${Math.round(details.remainingMonthExpectedEndBalance)} EUR`
        : "",
      details.hasForecastData
        ? "Forecast betrouwbaarheid: gebaseerd op huidige bekende data."
        : "Forecast betrouwbaarheid: onvolledig, geef antwoord voorzichtig.",
    ].filter(Boolean);
  }

  return [] as string[];
}

export function buildSpendingAdviceContext(input: {
  context: HelpAssistantContext;
  requestedAmount?: number | null;
}): SpendingAdviceContext {
  const { context, requestedAmount } = input;
  const details = context.screenContext;
  const periodLabel = context.selectedPeriod?.label || "niet geselecteerd";

  const base: SpendingAdviceContext = {
    screenId: context.screenId,
    screenTitle: context.screenTitle,
    periodLabel,
    platform: context.platform,
    requestedAmount: requestedAmount ?? null,
    budget: {
      remainingVariableBudget: null,
      totalVariableBudget: null,
      spentVariableBudget: null,
      weekRemainingBudget: null,
      weekTempoDelta: null,
    },
    planning: {
      upcomingCommittedExpenseTotal: null,
      expectedFixedCosts: null,
      expectedSubscriptions: null,
      remainingPlannedExpenseTotal: null,
      remainingVariableExpenseEstimate: null,
    },
    forecast: {
      hasForecastData: false,
      expectedEndBalance: null,
      lowestExpectedBalance: null,
      remainingMonthExpectedEndBalance: null,
      remainingMonthNetTotal: null,
    },
    dataQuality: {
      hasBudgetSignals: false,
      hasPlanningSignals: false,
      hasForecastSignals: false,
      dataGaps: [],
    },
  };

  if (!details) {
    base.dataQuality.dataGaps.push("schermcontext_ontbreekt");
    return base;
  }

  if (details.kind === "budget") {
    base.budget.remainingVariableBudget = details.remainingVariableBudget ?? null;
    base.budget.totalVariableBudget = details.totalVariableBudget ?? null;
    base.budget.spentVariableBudget = details.spentVariableBudget ?? null;
    base.budget.weekRemainingBudget = details.weekRemainingBudget ?? null;
    base.budget.weekTempoDelta = details.weekTempoDelta ?? null;

    base.planning.upcomingCommittedExpenseTotal =
      details.upcomingCommittedExpenseTotal ?? null;
    base.planning.expectedFixedCosts = details.expectedFixedCosts ?? null;
    base.planning.expectedSubscriptions = details.expectedSubscriptions ?? null;

    base.forecast.hasForecastData = Boolean(details.hasForecastData);
    base.forecast.expectedEndBalance = details.forecastExpectedEndBalance ?? null;
    base.forecast.lowestExpectedBalance = details.forecastLowestExpectedBalance ?? null;
  }

  if (details.kind === "insights") {
    base.planning.remainingPlannedExpenseTotal =
      details.remainingPlannedExpenseTotal ?? null;
    base.planning.remainingVariableExpenseEstimate =
      details.remainingVariableExpenseEstimate ?? null;

    base.forecast.hasForecastData = Boolean(details.hasForecastData);
    base.forecast.remainingMonthExpectedEndBalance =
      details.remainingMonthExpectedEndBalance ?? null;
    base.forecast.remainingMonthNetTotal = details.remainingMonthNetTotal ?? null;
  }

  if (details.kind === "transactions" || details.kind === "import") {
    base.dataQuality.dataGaps.push("budget_signal_niet_beschikbaar_op_dit_scherm");
  }

  base.dataQuality.hasBudgetSignals =
    base.budget.remainingVariableBudget != null ||
    base.budget.totalVariableBudget != null ||
    base.budget.spentVariableBudget != null ||
    base.budget.weekRemainingBudget != null;

  base.dataQuality.hasPlanningSignals =
    base.planning.upcomingCommittedExpenseTotal != null ||
    base.planning.expectedFixedCosts != null ||
    base.planning.expectedSubscriptions != null ||
    base.planning.remainingPlannedExpenseTotal != null ||
    base.planning.remainingVariableExpenseEstimate != null;

  base.dataQuality.hasForecastSignals =
    (base.forecast.hasForecastData &&
      (base.forecast.expectedEndBalance != null ||
        base.forecast.lowestExpectedBalance != null ||
        base.forecast.remainingMonthExpectedEndBalance != null ||
        base.forecast.remainingMonthNetTotal != null)) ||
    false;

  const shouldFlagMissingVariableBudgetSpace =
    !base.dataQuality.hasBudgetSignals &&
    (context.screenId === "budget" || context.screenId === "dashboard");

  if (shouldFlagMissingVariableBudgetSpace) {
    base.dataQuality.dataGaps.push("variabele_budgetruimte_ontbreekt");
  }
  if (!base.dataQuality.hasPlanningSignals) {
    base.dataQuality.dataGaps.push("planning_signalen_beperkt");
  }
  if (!base.dataQuality.hasForecastSignals) {
    base.dataQuality.dataGaps.push("forecast_signalen_beperkt");
  }

  return base;
}
