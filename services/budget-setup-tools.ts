import { getBudgetCategoryDisplayLabel } from "@/services/budget-week-attention";
import { loadBudgetPlanForSurface } from "@/services/budget-plan-surface";
import type { BudgetPlanComputation } from "@/types/categorization";
import {
  type BudgetSetupProposal,
  type BudgetSetupStrategy,
  VARIABLE_CATEGORY_KEYS,
  type VariableCategoryKey,
} from "./budget-setup-proposal-schema";

export type BudgetSetupBaseContext = {
  month: {
    monthStartIso: string;
    referenceDateIso: string;
    monthProgress: number;
  };
  scope: {
    moneyViewScope: "personal" | "household";
  };
  incomeSnapshot: {
    expectedIncomeTotal: number;
    actualIncomeMonthToDate: number;
    includeIncome: {
      salary: boolean;
      childBudget: boolean;
      structuralOther: boolean;
      variable: boolean;
    };
  };
  fixedAndSubscriptionsSnapshot: {
    fixedCosts: number;
    subscriptions: number;
    fixedRatioOfIncome: number | null;
  };
  reservesSnapshot: {
    reserveMonthlyTarget: number;
    annualObligationMonthlyTotal: number;
    source: string;
  };
  existingBudgetSnapshot: {
    mode: string;
    savingsTargetMonthly: number;
    applySavingsTargetToVariableBudget: boolean;
  };
  variableTrendSnapshot: {
    categoryKey: VariableCategoryKey;
    label: string;
    monthlyTrendAmount: number;
    monthToDateAmount: number;
  }[];
  budgetMotorContext: {
    recommendedSavings: number;
    savingsPotential: number;
    variableBudgetPool: number;
  };
  forecastSafetyContext: {
    safeToSpendUntilNextIncome: number | null;
    knownUpcomingFixedCostsUntilAnchor: number | null;
    knownUpcomingSubscriptionsUntilAnchor: number | null;
    safeToSpendConfidence: string;
    cashRiskFlag: string;
    deficitRiskFlag: string;
  };
  confidenceContext: {
    trendDataMonths: 1 | 2 | 3;
    hasThinTrendData: boolean;
    needsReviewFlags: string[];
  };
};

export type BudgetSetupToolContextInput = {
  referenceDate: Date;
  monthStartIso: string;
  planKey?: string;
  moneyViewScope?: "personal" | "household";
  userId?: string;
};

export type BudgetSetupToolContext = {
  base: BudgetSetupBaseContext;
  plan: BudgetPlanComputation;
};

function asNonNegativeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return fallback;
  return Math.round(parsed);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeMonthStartIso(value: string) {
  const trimmed = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid monthStartIso: ${value}`);
  }
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function buildBaseContextFromPlanSurface(params: {
  monthStartIso: string;
  plan: BudgetPlanComputation;
  safeToSpendUntilNextIncome: number | null;
  knownUpcomingFixedCostsUntilAnchor: number | null;
  knownUpcomingSubscriptionsUntilAnchor: number | null;
  safeToSpendConfidence: string | null;
  scopeView: string;
  reserveMonthlyTarget: number;
  annualObligationMonthlyTotal: number;
  reserveSource: string;
  cashRiskFlag: string;
  deficitRiskFlag: string;
}): BudgetSetupBaseContext {
  const {
    monthStartIso,
    plan,
    safeToSpendUntilNextIncome,
    knownUpcomingFixedCostsUntilAnchor,
    knownUpcomingSubscriptionsUntilAnchor,
    safeToSpendConfidence,
    scopeView,
    reserveMonthlyTarget,
    annualObligationMonthlyTotal,
    reserveSource,
    cashRiskFlag,
    deficitRiskFlag,
  } = params;

  const variableTrendSnapshot = VARIABLE_CATEGORY_KEYS.map((categoryKey) => {
    const recommendation = plan.recommendations.find(
      (row) => row.categoryKey === categoryKey,
    );
    return {
      categoryKey,
      label: getBudgetCategoryDisplayLabel(categoryKey),
      monthlyTrendAmount: asNonNegativeNumber(recommendation?.baselineMonthly, 0),
      monthToDateAmount: asNonNegativeNumber(recommendation?.monthlyActual, 0),
    };
  });
  const trendValues = variableTrendSnapshot.map((row) => row.monthlyTrendAmount);
  const trendPopulatedCount = trendValues.filter((value) => value > 0).length;
  const fixedCosts = asNonNegativeNumber(plan.flowSummary.fixedCostsBudget, 0);
  const subscriptions = asNonNegativeNumber(
    plan.flowSummary.subscriptionsBudget,
    0,
  );
  const expectedIncomeTotal = asNonNegativeNumber(
    plan.flowSummary.expectedIncomeMonthly,
    0,
  );
  const fixedRatioOfIncome =
    expectedIncomeTotal > 0
      ? Number(((fixedCosts + subscriptions) / expectedIncomeTotal).toFixed(3))
      : null;
  const needsReviewFlags: string[] = [];
  if (trendPopulatedCount <= 1) needsReviewFlags.push("thin_trend_data");
  if (fixedRatioOfIncome != null && fixedRatioOfIncome > 0.7) {
    needsReviewFlags.push("high_fixed_ratio");
  }
  if (safeToSpendUntilNextIncome != null && safeToSpendUntilNextIncome < 0) {
    needsReviewFlags.push("low_buffer");
  }

  return {
    month: {
      monthStartIso,
      referenceDateIso: plan.referenceDate,
      monthProgress: Number(plan.monthProgress.toFixed(3)),
    },
    scope: {
      moneyViewScope: scopeView === "household" ? "household" : "personal",
    },
    incomeSnapshot: {
      expectedIncomeTotal,
      actualIncomeMonthToDate: asNonNegativeNumber(
        plan.flowSummary.actualIncomeMonthToDate,
        0,
      ),
      includeIncome: {
        ...plan.settings.includeIncome,
      },
    },
    fixedAndSubscriptionsSnapshot: {
      fixedCosts,
      subscriptions,
      fixedRatioOfIncome,
    },
    reservesSnapshot: {
      reserveMonthlyTarget: asNonNegativeNumber(reserveMonthlyTarget, 0),
      annualObligationMonthlyTotal: asNonNegativeNumber(
        annualObligationMonthlyTotal,
        0,
      ),
      source: reserveSource,
    },
    existingBudgetSnapshot: {
      mode: plan.settings.mode,
      savingsTargetMonthly: asNonNegativeNumber(plan.settings.savingsTargetMonthly),
      applySavingsTargetToVariableBudget: Boolean(
        plan.settings.applySavingsTargetToVariableBudget,
      ),
    },
    variableTrendSnapshot,
    budgetMotorContext: {
      recommendedSavings: asNonNegativeNumber(plan.recommendedSavings),
      savingsPotential: asNonNegativeNumber(plan.savingsPotential),
      variableBudgetPool: asNonNegativeNumber(plan.flowSummary.variableBudget),
    },
    forecastSafetyContext: {
      safeToSpendUntilNextIncome:
        safeToSpendUntilNextIncome == null
          ? null
          : asNonNegativeNumber(Math.max(safeToSpendUntilNextIncome, 0)),
      knownUpcomingFixedCostsUntilAnchor:
        knownUpcomingFixedCostsUntilAnchor == null
          ? null
          : asNonNegativeNumber(knownUpcomingFixedCostsUntilAnchor),
      knownUpcomingSubscriptionsUntilAnchor:
        knownUpcomingSubscriptionsUntilAnchor == null
          ? null
          : asNonNegativeNumber(knownUpcomingSubscriptionsUntilAnchor),
      safeToSpendConfidence: safeToSpendConfidence || "INDICATIVE",
      cashRiskFlag,
      deficitRiskFlag,
    },
    confidenceContext: {
      trendDataMonths: trendPopulatedCount >= 3 ? 3 : trendPopulatedCount === 2 ? 2 : 1,
      hasThinTrendData: trendPopulatedCount <= 1,
      needsReviewFlags,
    },
  };
}

function allocateByWeights(params: {
  total: number;
  weights: Record<VariableCategoryKey, number>;
}) {
  const total = Math.max(0, Math.round(params.total));
  const raw = VARIABLE_CATEGORY_KEYS.map((categoryKey) => ({
    categoryKey,
    amount: Math.floor(total * Math.max(0, params.weights[categoryKey] || 0)),
  }));
  let remainder = total - sum(raw.map((row) => row.amount));
  let cursor = 0;
  while (remainder > 0) {
    raw[cursor % raw.length].amount += 1;
    remainder -= 1;
    cursor += 1;
  }
  return raw;
}

function resolveStrategyPoolFactor(strategy: BudgetSetupStrategy) {
  if (strategy === "balans") return 0.92;
  if (strategy === "bespaarmodus") return 0.82;
  return 1;
}

function buildWeightsFromTrend(base: BudgetSetupBaseContext) {
  const fallback: Record<VariableCategoryKey, number> = {
    groceries: 0.45,
    fuel: 0.2,
    smoking: 0.1,
    other: 0.25,
  };
  const totalTrend = sum(base.variableTrendSnapshot.map((row) => row.monthlyTrendAmount));
  if (totalTrend <= 0) return fallback;

  const byCategory = new Map(
    base.variableTrendSnapshot.map((row) => [row.categoryKey, row.monthlyTrendAmount]),
  );
  return {
    groceries: (byCategory.get("groceries") || 0) / totalTrend || fallback.groceries,
    fuel: (byCategory.get("fuel") || 0) / totalTrend || fallback.fuel,
    smoking: (byCategory.get("smoking") || 0) / totalTrend || fallback.smoking,
    other: (byCategory.get("other") || 0) / totalTrend || fallback.other,
  } satisfies Record<VariableCategoryKey, number>;
}

function buildDeterministicProposal(params: {
  base: BudgetSetupBaseContext;
  selectedMode: BudgetSetupStrategy;
}): BudgetSetupProposal {
  const { base, selectedMode } = params;
  const weights = buildWeightsFromTrend(base);
  const factor = resolveStrategyPoolFactor(selectedMode);
  const basePool = asNonNegativeNumber(base.budgetMotorContext.variableBudgetPool, 0);
  const variableBudgetPool = Math.max(
    0,
    Math.round(basePool * factor),
  );
  const categories = allocateByWeights({
    total: variableBudgetPool,
    weights,
  });
  const reserveTargetSuggestion =
    selectedMode === "bespaarmodus"
      ? Math.max(
          base.reservesSnapshot.reserveMonthlyTarget,
          Math.round(base.budgetMotorContext.recommendedSavings * 1.15),
        )
      : selectedMode === "balans"
        ? Math.max(
            base.reservesSnapshot.reserveMonthlyTarget,
            Math.round(base.budgetMotorContext.recommendedSavings * 1.05),
          )
        : Math.max(
            base.reservesSnapshot.reserveMonthlyTarget,
            base.budgetMotorContext.recommendedSavings,
          );
  const confidenceScore = base.confidenceContext.hasThinTrendData ? 0.58 : 0.76;
  const confidenceLevel: "hoog" | "middel" | "laag" =
    confidenceScore >= 0.8 ? "hoog" : confidenceScore >= 0.6 ? "middel" : "laag";

  return {
    proposalId: `fallback-${Date.now()}`,
    selectedMode,
    rationale: [
      "Voorstel start vanuit je bestaande budgetmotor en recente uitgaventrend.",
      "Vaste lasten, abonnementen en reserves worden eerst beschermd.",
      "Variabele ruimte wordt daarna verdeeld over de belangrijkste categorieën.",
    ],
    expectedIncomeTotal: base.incomeSnapshot.expectedIncomeTotal,
    protectedAmounts: {
      fixedCosts: base.fixedAndSubscriptionsSnapshot.fixedCosts,
      subscriptions: base.fixedAndSubscriptionsSnapshot.subscriptions,
      reserves: base.reservesSnapshot.reserveMonthlyTarget,
      annualized: base.reservesSnapshot.annualObligationMonthlyTotal,
    },
    reserveAdvice: {
      monthlyReserveTarget: reserveTargetSuggestion,
      reason: "Afgeleid uit huidig spaardoel, reservecontext en gekozen strategie.",
    },
    variableBudgetPool,
    suggestedCategories: categories.map((row) => ({
      categoryKey: row.categoryKey,
      suggestedAmount: row.amount,
      basedOnTrend: true,
      trendWindowMonths: base.confidenceContext.trendDataMonths,
      note: null,
    })),
    adjustmentNotes: [
      selectedMode === "bespaarmodus"
        ? "Bespaarmodus verlaagt de variabele ruimte en beschermt extra reserve."
        : selectedMode === "balans"
          ? "Balans houdt extra reserve aan en verdeelt de resterende ruimte rustiger."
          : "Standaard houdt de verdeling dicht bij je recente patroon.",
    ],
    needsReviewFlags: base.confidenceContext.needsReviewFlags.filter(
      (flag): flag is BudgetSetupProposal["needsReviewFlags"][number] =>
        flag === "income_uncertain" ||
        flag === "high_fixed_ratio" ||
        flag === "low_buffer" ||
        flag === "missing_subscription_signal" ||
        flag === "thin_trend_data",
    ),
    confidence: {
      score: confidenceScore,
      level: confidenceLevel,
      reasons: base.confidenceContext.hasThinTrendData
        ? ["Beperkte trendhistorie, voorstel vraagt extra review."]
        : ["Trend en budgetcontext zijn voldoende stabiel voor een voorstel."],
    },
    userSummary:
      "Budio heeft een voorstel gemaakt met beschermde vaste lasten en een rustige verdeling van je variabele ruimte.",
    applyPayload: {
      planSettings: {
        strategy: selectedMode,
        includeIncome: {
          ...base.incomeSnapshot.includeIncome,
        },
        savingsTargetMonthly: reserveTargetSuggestion,
        applySavingsTargetToVariableBudget:
          selectedMode === "balans" || selectedMode === "bespaarmodus",
      },
      monthlyVariableBudgets: categories.map((row) => ({
        categoryKey: row.categoryKey,
        amount: row.amount,
      })),
    },
  };
}

export async function getBudgetSetupToolContext(
  input: BudgetSetupToolContextInput,
): Promise<BudgetSetupToolContext> {
  const monthStartIso = normalizeMonthStartIso(input.monthStartIso);
  const surface = await loadBudgetPlanForSurface({
    referenceDate: input.referenceDate,
    planKey: input.planKey || "default",
    moneyViewScope: input.moneyViewScope,
    userId: input.userId,
  });
  const base = buildBaseContextFromPlanSurface({
    monthStartIso,
    plan: surface.plan,
    safeToSpendUntilNextIncome: surface.safeToSpendUntilNextIncome,
    knownUpcomingFixedCostsUntilAnchor: surface.knownUpcomingFixedCostsUntilAnchor,
    knownUpcomingSubscriptionsUntilAnchor:
      surface.knownUpcomingSubscriptionsUntilAnchor,
    safeToSpendConfidence: surface.safeToSpendConfidenceScore || null,
    scopeView: surface.scopeView,
    reserveMonthlyTarget: surface.reserveBreakdown?.savingsTargetMonthly || 0,
    annualObligationMonthlyTotal:
      surface.reserveBreakdown?.annualObligationMonthlyTotal || 0,
    reserveSource: surface.reserveBreakdown?.source || "unavailable",
    cashRiskFlag: surface.forecast?.cashRiskFlag || "none",
    deficitRiskFlag: surface.forecast?.riskFlag || "none",
  });
  return {
    base,
    plan: surface.plan,
  };
}

export type BudgetSetupToolCallName =
  | "getBudgetSetupBaseContext"
  | "getIncomeBudgetContext"
  | "getFixedCostsAndReservesContext"
  | "getVariableCategoryTrendContext"
  | "getBudgetStrategyContext"
  | "getForecastSafetyContext"
  | "getExistingBudgetPlanContext"
  | "previewBudgetAllocation";

type ToolDefinition = {
  type: "function";
  function: {
    name: BudgetSetupToolCallName;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export function getBudgetSetupToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "getBudgetSetupBaseContext",
        description:
          "Compacte basiscontext voor budgetvoorstel van actieve maand.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getIncomeBudgetContext",
        description: "Inkomen en income-inclusion context.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getFixedCostsAndReservesContext",
        description: "Vaste lasten, abonnementen en reservecontext.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getVariableCategoryTrendContext",
        description: "Variabele categorieën met trendsummary.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getBudgetStrategyContext",
        description:
          "Semantiek van strategieën standaard, balans, bespaarmodus, handmatig.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getForecastSafetyContext",
        description: "Forecast en safety context voor aankomende periode.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getExistingBudgetPlanContext",
        description: "Bestaande budgetinstellingen en mode.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "previewBudgetAllocation",
        description:
          "Genereer een deterministic previewallocatie voor een strategie.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            strategy: {
              type: "string",
              enum: ["standaard", "balans", "bespaarmodus", "handmatig"],
            },
          },
          required: ["strategy"],
        },
      },
    },
  ];
}

export type BudgetSetupToolExecutor = {
  context: BudgetSetupToolContext;
  execute: (
    tool: BudgetSetupToolCallName,
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

export function createBudgetSetupToolExecutor(
  context: BudgetSetupToolContext,
): BudgetSetupToolExecutor {
  return {
    context,
    async execute(tool, args) {
      const base = context.base;
      if (tool === "getBudgetSetupBaseContext") {
        return base as unknown as Record<string, unknown>;
      }
      if (tool === "getIncomeBudgetContext") {
        return {
          incomeSnapshot: base.incomeSnapshot,
          budgetMotorContext: {
            expectedIncomeTotal: base.incomeSnapshot.expectedIncomeTotal,
            recommendedSavings: base.budgetMotorContext.recommendedSavings,
          },
        };
      }
      if (tool === "getFixedCostsAndReservesContext") {
        return {
          fixedAndSubscriptionsSnapshot: base.fixedAndSubscriptionsSnapshot,
          reservesSnapshot: base.reservesSnapshot,
        };
      }
      if (tool === "getVariableCategoryTrendContext") {
        return {
          variableTrendSnapshot: base.variableTrendSnapshot,
          confidenceContext: base.confidenceContext,
        };
      }
      if (tool === "getBudgetStrategyContext") {
        return {
          strategies: {
            standaard:
              "Redelijk en stabiel, dicht bij huidig patroon met normale variabele ruimte.",
            balans:
              "Meer bescherming voor reserve en buffer met iets conservatievere variabele ruimte.",
            bespaarmodus:
              "Scherper op variabele inkrimping en hogere reservebescherming.",
            handmatig:
              "Gebruiker beslist; AI geeft alleen assistieve suggesties op verzoek.",
          },
        };
      }
      if (tool === "getForecastSafetyContext") {
        return {
          forecastSafetyContext: base.forecastSafetyContext,
        };
      }
      if (tool === "getExistingBudgetPlanContext") {
        return {
          existingBudgetSnapshot: base.existingBudgetSnapshot,
        };
      }
      if (tool === "previewBudgetAllocation") {
        const strategy =
          String(args.strategy || "").trim().toLowerCase() || "standaard";
        const selectedMode: BudgetSetupStrategy =
          strategy === "balans"
            ? "balans"
            : strategy === "bespaarmodus"
              ? "bespaarmodus"
              : strategy === "handmatig"
                ? "handmatig"
                : "standaard";
        return {
          preview: buildDeterministicProposal({
            base,
            selectedMode,
          }),
        } as unknown as Record<string, unknown>;
      }

      throw new Error(`Onbekende budget setup tool: ${tool}`);
    },
  };
}

export function buildBudgetSetupFallbackProposal(input: {
  context: BudgetSetupToolContext;
  selectedMode?: BudgetSetupStrategy;
}) {
  return buildDeterministicProposal({
    base: input.context.base,
    selectedMode: input.selectedMode || "standaard",
  });
}
