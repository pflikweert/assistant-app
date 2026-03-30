import type { BudgetIncomeInclusionSettings } from "@/types/categorization";

export type BudgetSetupStrategy =
  | "standaard"
  | "balans"
  | "bespaarmodus"
  | "handmatig";

export const BUDGET_SETUP_STRATEGIES: BudgetSetupStrategy[] = [
  "standaard",
  "balans",
  "bespaarmodus",
  "handmatig",
];

export const VARIABLE_CATEGORY_KEYS = [
  "groceries",
  "fuel",
  "smoking",
  "other",
] as const;

export type VariableCategoryKey = (typeof VARIABLE_CATEGORY_KEYS)[number];

export const BUDGET_SETUP_NEEDS_REVIEW_FLAGS = [
  "income_uncertain",
  "high_fixed_ratio",
  "low_buffer",
  "missing_subscription_signal",
  "thin_trend_data",
] as const;

export type BudgetSetupNeedsReviewFlag =
  (typeof BUDGET_SETUP_NEEDS_REVIEW_FLAGS)[number];

export type BudgetSetupSuggestedCategory = {
  categoryKey: VariableCategoryKey;
  suggestedAmount: number;
  basedOnTrend: boolean;
  trendWindowMonths: 1 | 2 | 3 | null;
  note?: string | null;
};

export type BudgetSetupSuggestedCategoryV2 = {
  id: string;
  label: string;
  type: "main" | "sub";
  source: "trend" | "forecast" | "mixed";
  suggestedAmount: number;
  why: string;
};

export type BudgetSetupPlanMeaning = {
  monthFeel: "krap" | "haalbaar" | "ruim";
  strictness: "licht" | "normaal" | "streng";
  primaryReason: string;
};

export type BudgetSetupSafetyImpact = {
  variableRoomMonthly: number;
  reserveProtectionLevel: "laag" | "middel" | "hoog";
  biggestAttentionPoint: string;
};

export type BudgetSetupNextBestStep = {
  title: string;
  why: string;
  dominantConstraint:
    | "cash_survival"
    | "upcoming_obligation"
    | "buffer_protection"
    | "overspending_tempo"
    | "stability";
};

export type BudgetSetupCoachAction = {
  actionKey:
    | "rebalance_now"
    | "make_roomier"
    | "make_tighter"
    | "protect_savings";
  label: string;
  rationale: string;
};

export type BudgetSetupProposalApplyPayload = {
  planSettings: {
    strategy: BudgetSetupStrategy;
    includeIncome: BudgetIncomeInclusionSettings;
    savingsTargetMonthly: number | null;
    applySavingsTargetToVariableBudget: boolean;
  };
  monthlyVariableBudgets: {
    categoryKey: VariableCategoryKey;
    amount: number;
  }[];
};

export type BudgetSetupProposal = {
  proposalId: string;
  selectedMode: BudgetSetupStrategy;
  planMeaning: BudgetSetupPlanMeaning;
  safetyImpact: BudgetSetupSafetyImpact;
  nextBestStep: BudgetSetupNextBestStep;
  coachActions: BudgetSetupCoachAction[];
  rationale: string[];
  expectedIncomeTotal: number;
  protectedAmounts: {
    fixedCosts: number;
    subscriptions: number;
    reserves: number;
    annualized: number;
  };
  reserveAdvice: {
    monthlyReserveTarget: number;
    reason: string;
  };
  variableBudgetPool: number;
  suggestedCategories: BudgetSetupSuggestedCategory[];
  suggestedCategoriesV2: BudgetSetupSuggestedCategoryV2[];
  adjustmentNotes: string[];
  needsReviewFlags: BudgetSetupNeedsReviewFlag[];
  confidence: {
    score: number;
    level: "hoog" | "middel" | "laag";
    reasons: string[];
  };
  userSummary: string;
  applyPayload: BudgetSetupProposalApplyPayload;
};

export type BudgetSetupProposalValidationResult = {
  ok: boolean;
  issues: string[];
  normalized: BudgetSetupProposal | null;
};

function asFiniteNonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.round(parsed);
}

function asStringArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function asStrategy(value: unknown): BudgetSetupStrategy | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "standaard") return "standaard";
  if (normalized === "balans") return "balans";
  if (normalized === "bespaarmodus") return "bespaarmodus";
  if (normalized === "handmatig") return "handmatig";
  return null;
}

function asVariableCategoryKey(value: unknown): VariableCategoryKey | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "groceries") return "groceries";
  if (normalized === "fuel") return "fuel";
  if (normalized === "smoking") return "smoking";
  if (normalized === "other") return "other";
  return null;
}

function asReviewFlag(value: unknown): BudgetSetupNeedsReviewFlag | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "income_uncertain") return "income_uncertain";
  if (normalized === "high_fixed_ratio") return "high_fixed_ratio";
  if (normalized === "low_buffer") return "low_buffer";
  if (normalized === "missing_subscription_signal") {
    return "missing_subscription_signal";
  }
  if (normalized === "thin_trend_data") return "thin_trend_data";
  return null;
}

function asMonthFeel(value: unknown): BudgetSetupPlanMeaning["monthFeel"] | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "krap") return "krap";
  if (normalized === "haalbaar") return "haalbaar";
  if (normalized === "ruim") return "ruim";
  return null;
}

function asStrictness(value: unknown): BudgetSetupPlanMeaning["strictness"] | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "licht") return "licht";
  if (normalized === "normaal") return "normaal";
  if (normalized === "streng") return "streng";
  return null;
}

function asReserveProtectionLevel(
  value: unknown,
): BudgetSetupSafetyImpact["reserveProtectionLevel"] | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "laag") return "laag";
  if (normalized === "middel") return "middel";
  if (normalized === "hoog") return "hoog";
  return null;
}

function asDominantConstraint(
  value: unknown,
): BudgetSetupNextBestStep["dominantConstraint"] | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "cash_survival") return "cash_survival";
  if (normalized === "upcoming_obligation") return "upcoming_obligation";
  if (normalized === "buffer_protection") return "buffer_protection";
  if (normalized === "overspending_tempo") return "overspending_tempo";
  if (normalized === "stability") return "stability";
  return null;
}

function asCoachActionKey(
  value: unknown,
): BudgetSetupCoachAction["actionKey"] | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "rebalance_now") return "rebalance_now";
  if (normalized === "make_roomier") return "make_roomier";
  if (normalized === "make_tighter") return "make_tighter";
  if (normalized === "protect_savings") return "protect_savings";
  return null;
}

export function buildBudgetSetupProposalJsonSchema() {
  return {
    name: "budget_setup_proposal_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        proposalId: { type: "string" },
        selectedMode: {
          type: "string",
          enum: BUDGET_SETUP_STRATEGIES,
        },
        planMeaning: {
          type: "object",
          additionalProperties: false,
          properties: {
            monthFeel: { type: "string", enum: ["krap", "haalbaar", "ruim"] },
            strictness: { type: "string", enum: ["licht", "normaal", "streng"] },
            primaryReason: { type: "string" },
          },
          required: ["monthFeel", "strictness", "primaryReason"],
        },
        safetyImpact: {
          type: "object",
          additionalProperties: false,
          properties: {
            variableRoomMonthly: { type: "number" },
            reserveProtectionLevel: { type: "string", enum: ["laag", "middel", "hoog"] },
            biggestAttentionPoint: { type: "string" },
          },
          required: [
            "variableRoomMonthly",
            "reserveProtectionLevel",
            "biggestAttentionPoint",
          ],
        },
        nextBestStep: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            why: { type: "string" },
            dominantConstraint: {
              type: "string",
              enum: [
                "cash_survival",
                "upcoming_obligation",
                "buffer_protection",
                "overspending_tempo",
                "stability",
              ],
            },
          },
          required: ["title", "why", "dominantConstraint"],
        },
        coachActions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              actionKey: {
                type: "string",
                enum: [
                  "rebalance_now",
                  "make_roomier",
                  "make_tighter",
                  "protect_savings",
                ],
              },
              label: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["actionKey", "label", "rationale"],
          },
        },
        rationale: {
          type: "array",
          items: { type: "string" },
        },
        expectedIncomeTotal: { type: "number" },
        protectedAmounts: {
          type: "object",
          additionalProperties: false,
          properties: {
            fixedCosts: { type: "number" },
            subscriptions: { type: "number" },
            reserves: { type: "number" },
            annualized: { type: "number" },
          },
          required: ["fixedCosts", "subscriptions", "reserves", "annualized"],
        },
        reserveAdvice: {
          type: "object",
          additionalProperties: false,
          properties: {
            monthlyReserveTarget: { type: "number" },
            reason: { type: "string" },
          },
          required: ["monthlyReserveTarget", "reason"],
        },
        variableBudgetPool: { type: "number" },
        suggestedCategories: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              categoryKey: { type: "string", enum: VARIABLE_CATEGORY_KEYS },
              suggestedAmount: { type: "number" },
              basedOnTrend: { type: "boolean" },
              trendWindowMonths: {
                anyOf: [
                  { type: "integer", enum: [1, 2, 3] },
                  { type: "null" },
                ],
              },
              note: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
            },
            required: [
              "categoryKey",
              "suggestedAmount",
              "basedOnTrend",
              "trendWindowMonths",
              "note",
            ],
          },
        },
        suggestedCategoriesV2: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: ["main", "sub"] },
              source: { type: "string", enum: ["trend", "forecast", "mixed"] },
              suggestedAmount: { type: "number" },
              why: { type: "string" },
            },
            required: [
              "id",
              "label",
              "type",
              "source",
              "suggestedAmount",
              "why",
            ],
          },
        },
        adjustmentNotes: {
          type: "array",
          items: { type: "string" },
        },
        needsReviewFlags: {
          type: "array",
          items: {
            type: "string",
            enum: BUDGET_SETUP_NEEDS_REVIEW_FLAGS,
          },
        },
        confidence: {
          type: "object",
          additionalProperties: false,
          properties: {
            score: { type: "number" },
            level: { type: "string", enum: ["hoog", "middel", "laag"] },
            reasons: { type: "array", items: { type: "string" } },
          },
          required: ["score", "level", "reasons"],
        },
        userSummary: { type: "string" },
        applyPayload: {
          type: "object",
          additionalProperties: false,
          properties: {
            planSettings: {
              type: "object",
              additionalProperties: false,
              properties: {
                strategy: { type: "string", enum: BUDGET_SETUP_STRATEGIES },
                includeIncome: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    salary: { type: "boolean" },
                    childBudget: { type: "boolean" },
                    structuralOther: { type: "boolean" },
                    variable: { type: "boolean" },
                  },
                  required: [
                    "salary",
                    "childBudget",
                    "structuralOther",
                    "variable",
                  ],
                },
                savingsTargetMonthly: {
                  anyOf: [{ type: "number" }, { type: "null" }],
                },
                applySavingsTargetToVariableBudget: { type: "boolean" },
              },
              required: [
                "strategy",
                "includeIncome",
                "savingsTargetMonthly",
                "applySavingsTargetToVariableBudget",
              ],
            },
            monthlyVariableBudgets: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  categoryKey: {
                    type: "string",
                    enum: VARIABLE_CATEGORY_KEYS,
                  },
                  amount: { type: "number" },
                },
                required: ["categoryKey", "amount"],
              },
            },
          },
          required: ["planSettings", "monthlyVariableBudgets"],
        },
      },
      required: [
        "proposalId",
        "selectedMode",
        "planMeaning",
        "safetyImpact",
        "nextBestStep",
        "coachActions",
        "rationale",
        "expectedIncomeTotal",
        "protectedAmounts",
        "reserveAdvice",
        "variableBudgetPool",
        "suggestedCategories",
        "suggestedCategoriesV2",
        "adjustmentNotes",
        "needsReviewFlags",
        "confidence",
        "userSummary",
        "applyPayload",
      ],
    },
  };
}

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function validateBudgetSetupProposal(
  input: unknown,
): BudgetSetupProposalValidationResult {
  const issues: string[] = [];
  const root =
    typeof input === "string" ? parseJsonObject(input) : (input as Record<string, unknown> | null);
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return {
      ok: false,
      issues: ["Ongeldig voorstel: payload is geen object."],
      normalized: null,
    };
  }

  const selectedMode = asStrategy(root.selectedMode);
  if (!selectedMode) issues.push("selectedMode ontbreekt of is ongeldig.");

  const proposalId = String(root.proposalId || "").trim();
  if (!proposalId) issues.push("proposalId ontbreekt.");

  const planMeaningRoot = root.planMeaning as Record<string, unknown> | undefined;
  const monthFeel = asMonthFeel(planMeaningRoot?.monthFeel);
  const strictness = asStrictness(planMeaningRoot?.strictness);
  const primaryReason = String(planMeaningRoot?.primaryReason || "").trim();
  const hasPlanMeaning =
    planMeaningRoot &&
    Object.keys(planMeaningRoot).length > 0;
  if (hasPlanMeaning && (!monthFeel || !strictness || !primaryReason)) {
    issues.push("planMeaning is onvolledig of ongeldig.");
  }

  const safetyImpactRoot = root.safetyImpact as Record<string, unknown> | undefined;
  const variableRoomMonthly = asFiniteNonNegativeNumber(
    safetyImpactRoot?.variableRoomMonthly,
  );
  const reserveProtectionLevel = asReserveProtectionLevel(
    safetyImpactRoot?.reserveProtectionLevel,
  );
  const biggestAttentionPoint = String(
    safetyImpactRoot?.biggestAttentionPoint || "",
  ).trim();
  const hasSafetyImpact =
    safetyImpactRoot &&
    Object.keys(safetyImpactRoot).length > 0;
  if (
    hasSafetyImpact &&
    (variableRoomMonthly == null ||
      !reserveProtectionLevel ||
      !biggestAttentionPoint)
  ) {
    issues.push("safetyImpact is onvolledig of ongeldig.");
  }

  const nextBestStepRoot = root.nextBestStep as Record<string, unknown> | undefined;
  const nextBestStepTitle = String(nextBestStepRoot?.title || "").trim();
  const nextBestStepWhy = String(nextBestStepRoot?.why || "").trim();
  const dominantConstraint = asDominantConstraint(nextBestStepRoot?.dominantConstraint);
  const hasNextBestStep =
    nextBestStepRoot &&
    Object.keys(nextBestStepRoot).length > 0;
  if (
    hasNextBestStep &&
    (!nextBestStepTitle || !nextBestStepWhy || !dominantConstraint)
  ) {
    issues.push("nextBestStep is onvolledig of ongeldig.");
  }

  const coachActionsRaw = Array.isArray(root.coachActions) ? root.coachActions : [];
  const coachActions: BudgetSetupCoachAction[] = [];
  for (const action of coachActionsRaw.slice(0, 4)) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      issues.push("coachActions bevat een ongeldig item.");
      continue;
    }
    const typed = action as Record<string, unknown>;
    const actionKey = asCoachActionKey(typed.actionKey);
    const label = String(typed.label || "").trim();
    const rationale = String(typed.rationale || "").trim();
    if (!actionKey || !label || !rationale) continue;
    coachActions.push({ actionKey, label, rationale });
  }

  const expectedIncomeTotal = asFiniteNonNegativeNumber(root.expectedIncomeTotal);
  if (expectedIncomeTotal == null) {
    issues.push("expectedIncomeTotal moet een niet-negatief bedrag zijn.");
  }
  const variableBudgetPool = asFiniteNonNegativeNumber(root.variableBudgetPool);
  if (variableBudgetPool == null) {
    issues.push("variableBudgetPool moet een niet-negatief bedrag zijn.");
  }

  const protectedAmounts = root.protectedAmounts as
    | Record<string, unknown>
    | undefined;
  const fixedCosts = asFiniteNonNegativeNumber(protectedAmounts?.fixedCosts);
  const subscriptions = asFiniteNonNegativeNumber(
    protectedAmounts?.subscriptions,
  );
  const reserves = asFiniteNonNegativeNumber(protectedAmounts?.reserves);
  const annualized = asFiniteNonNegativeNumber(protectedAmounts?.annualized);
  if (
    fixedCosts == null ||
    subscriptions == null ||
    reserves == null ||
    annualized == null
  ) {
    issues.push("protectedAmounts is onvolledig of ongeldig.");
  }

  const reserveAdvice = root.reserveAdvice as Record<string, unknown> | undefined;
  const monthlyReserveTarget = asFiniteNonNegativeNumber(
    reserveAdvice?.monthlyReserveTarget,
  );
  const reserveReason = String(reserveAdvice?.reason || "").trim();
  if (monthlyReserveTarget == null || !reserveReason) {
    issues.push("reserveAdvice is onvolledig of ongeldig.");
  }

  const suggestedCategoriesRaw = Array.isArray(root.suggestedCategories)
    ? root.suggestedCategories
    : [];
  const suggestedCategories: BudgetSetupSuggestedCategory[] = [];
  for (const item of suggestedCategoriesRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push("suggestedCategories bevat een ongeldig item.");
      continue;
    }
    const typed = item as Record<string, unknown>;
    const categoryKey = asVariableCategoryKey(typed.categoryKey);
    const suggestedAmount = asFiniteNonNegativeNumber(typed.suggestedAmount);
    const basedOnTrend = Boolean(typed.basedOnTrend);
    const trendWindowMonthsRaw = typed.trendWindowMonths;
    const trendWindowMonths =
      trendWindowMonthsRaw == null
        ? null
        : trendWindowMonthsRaw === 1 ||
            trendWindowMonthsRaw === 2 ||
            trendWindowMonthsRaw === 3
          ? trendWindowMonthsRaw
          : null;
    if (!categoryKey || suggestedAmount == null) {
      issues.push("suggestedCategories bevat een ongeldig category/amount item.");
      continue;
    }
    suggestedCategories.push({
      categoryKey,
      suggestedAmount,
      basedOnTrend,
      trendWindowMonths,
      note: typed.note == null ? null : String(typed.note || "").trim() || null,
    });
  }

  const suggestedCategoriesV2Raw = Array.isArray(root.suggestedCategoriesV2)
    ? root.suggestedCategoriesV2
    : [];
  const suggestedCategoriesV2: BudgetSetupSuggestedCategoryV2[] = [];
  for (const item of suggestedCategoriesV2Raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push("suggestedCategoriesV2 bevat een ongeldig item.");
      continue;
    }
    const typed = item as Record<string, unknown>;
    const id = String(typed.id || "").trim();
    const label = String(typed.label || "").trim();
    const type = typed.type === "main" || typed.type === "sub" ? typed.type : null;
    const source =
      typed.source === "trend" || typed.source === "forecast" || typed.source === "mixed"
        ? typed.source
        : null;
    const suggestedAmount = asFiniteNonNegativeNumber(typed.suggestedAmount);
    const why = String(typed.why || "").trim();
    if (!id || !label || !type || !source || suggestedAmount == null || !why) continue;
    suggestedCategoriesV2.push({
      id,
      label,
      type,
      source,
      suggestedAmount,
      why,
    });
  }

  const reviewFlags = Array.isArray(root.needsReviewFlags)
    ? root.needsReviewFlags
        .map(asReviewFlag)
        .filter((value): value is BudgetSetupNeedsReviewFlag => value != null)
    : [];

  const confidenceRoot = root.confidence as Record<string, unknown> | undefined;
  const confidenceScoreRaw = Number(confidenceRoot?.score);
  const confidenceLevel = String(confidenceRoot?.level || "").trim();
  const confidenceScore = Number.isFinite(confidenceScoreRaw)
    ? Math.max(0, Math.min(1, confidenceScoreRaw))
    : null;
  if (
    confidenceScore == null ||
    !["hoog", "middel", "laag"].includes(confidenceLevel)
  ) {
    issues.push("confidence is ongeldig.");
  }

  const applyPayloadRoot = root.applyPayload as Record<string, unknown> | undefined;
  const planSettingsRoot = applyPayloadRoot?.planSettings as
    | Record<string, unknown>
    | undefined;
  const applyStrategy = asStrategy(planSettingsRoot?.strategy);
  const includeIncomeRoot = planSettingsRoot?.includeIncome as
    | Record<string, unknown>
    | undefined;
  const includeIncome: BudgetIncomeInclusionSettings = {
    salary: Boolean(includeIncomeRoot?.salary),
    childBudget: Boolean(includeIncomeRoot?.childBudget),
    structuralOther: Boolean(includeIncomeRoot?.structuralOther),
    variable: Boolean(includeIncomeRoot?.variable),
  };
  const savingsTargetRaw = planSettingsRoot?.savingsTargetMonthly;
  const savingsTargetMonthly =
    savingsTargetRaw == null ? null : asFiniteNonNegativeNumber(savingsTargetRaw);
  const applySavingsTargetToVariableBudget = Boolean(
    planSettingsRoot?.applySavingsTargetToVariableBudget,
  );

  const monthlyVariableBudgetsRaw = Array.isArray(
    applyPayloadRoot?.monthlyVariableBudgets,
  )
    ? (applyPayloadRoot?.monthlyVariableBudgets as unknown[])
    : [];
  const monthlyVariableBudgets: BudgetSetupProposalApplyPayload["monthlyVariableBudgets"] = [];
  for (const row of monthlyVariableBudgetsRaw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      issues.push("applyPayload.monthlyVariableBudgets bevat een ongeldig item.");
      continue;
    }
    const typed = row as Record<string, unknown>;
    const categoryKey = asVariableCategoryKey(typed.categoryKey);
    const amount = asFiniteNonNegativeNumber(typed.amount);
    if (!categoryKey || amount == null) {
      issues.push("applyPayload.monthlyVariableBudgets bevat een ongeldig category/amount item.");
      continue;
    }
    monthlyVariableBudgets.push({ categoryKey, amount });
  }
  if (!applyStrategy) {
    issues.push("applyPayload.planSettings.strategy ontbreekt of is ongeldig.");
  }

  const byCategory = new Map<VariableCategoryKey, number>();
  for (const row of monthlyVariableBudgets) {
    byCategory.set(row.categoryKey, row.amount);
  }
  const normalizedBudgets = VARIABLE_CATEGORY_KEYS.map((categoryKey) => ({
    categoryKey,
    amount: byCategory.get(categoryKey) || 0,
  }));

  const budgetsTotal = normalizedBudgets.reduce((sum, row) => sum + row.amount, 0);
  if (variableBudgetPool != null && Math.abs(budgetsTotal - variableBudgetPool) > 3) {
    issues.push(
      `Som van monthlyVariableBudgets (${budgetsTotal}) sluit niet aan op variableBudgetPool (${variableBudgetPool}).`,
    );
  }
  if (selectedMode === "handmatig" && monthlyVariableBudgetsRaw.length === 0) {
    issues.push("Handmatig voorstel zonder budgetregels is niet toepasbaar.");
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      normalized: null,
    };
  }

  const fallbackSuggestedCategoriesV2 = suggestedCategories.map((item, index) => ({
    id: `${item.categoryKey}-${index}`,
    label:
      item.categoryKey === "groceries"
        ? "Boodschappen"
        : item.categoryKey === "fuel"
          ? "Vervoer en brandstof"
          : item.categoryKey === "smoking"
            ? "Roken"
            : "Overige variabele uitgaven",
    type: "main" as const,
    source: item.basedOnTrend ? ("trend" as const) : ("mixed" as const),
    suggestedAmount: item.suggestedAmount,
    why:
      item.note ||
      "Afgeleid uit je recente uitgaventrend en maandcontext.",
  }));
  while (fallbackSuggestedCategoriesV2.length < 5) {
    fallbackSuggestedCategoriesV2.push({
      id: `fallback-${fallbackSuggestedCategoriesV2.length + 1}`,
      label:
        fallbackSuggestedCategoriesV2.length === 4
          ? "Reservebescherming"
          : "Maandruimte",
      type: "sub",
      source: fallbackSuggestedCategoriesV2.length === 4 ? "forecast" : "mixed",
      suggestedAmount:
        fallbackSuggestedCategoriesV2.length === 4
          ? monthlyReserveTarget || 0
          : variableBudgetPool || 0,
      why:
        fallbackSuggestedCategoriesV2.length === 4
          ? "Gebaseerd op je reserve- en forecastcontext."
          : "Samenvattende focuspost op basis van dit voorstel.",
    });
  }

  const normalized: BudgetSetupProposal = {
    proposalId,
    selectedMode: selectedMode as BudgetSetupStrategy,
    planMeaning: {
      monthFeel: (monthFeel || "haalbaar") as BudgetSetupPlanMeaning["monthFeel"],
      strictness: (strictness || "normaal") as BudgetSetupPlanMeaning["strictness"],
      primaryReason: primaryReason || "Budio houdt eerst ruimte voor vaste verplichtingen.",
    },
    safetyImpact: {
      variableRoomMonthly: variableRoomMonthly ?? (variableBudgetPool || 0),
      reserveProtectionLevel:
        (reserveProtectionLevel || "middel") as BudgetSetupSafetyImpact["reserveProtectionLevel"],
      biggestAttentionPoint:
        biggestAttentionPoint || "Houd je variabele uitgaven rustig in de gaten.",
    },
    nextBestStep: {
      title: nextBestStepTitle || "Controleer je variabele ruimte",
      why: nextBestStepWhy || "Zo houd je overzicht vóór je toepast.",
      dominantConstraint:
        (dominantConstraint || "stability") as BudgetSetupNextBestStep["dominantConstraint"],
    },
    coachActions:
      coachActions.length > 0
        ? coachActions
        : [
            {
              actionKey: "rebalance_now",
              label: "Opnieuw verdelen",
              rationale: "Laat Budio de verdeling opnieuw berekenen.",
            },
            {
              actionKey: "make_tighter",
              label: "Maak iets zuiniger",
              rationale: "Verklein je variabele ruimte voor extra zekerheid.",
            },
          ],
    rationale: asStringArray(root.rationale, 4),
    expectedIncomeTotal: expectedIncomeTotal as number,
    protectedAmounts: {
      fixedCosts: fixedCosts as number,
      subscriptions: subscriptions as number,
      reserves: reserves as number,
      annualized: annualized as number,
    },
    reserveAdvice: {
      monthlyReserveTarget: monthlyReserveTarget as number,
      reason: reserveReason,
    },
    variableBudgetPool: variableBudgetPool as number,
    suggestedCategories,
    suggestedCategoriesV2:
      suggestedCategoriesV2.length >= 5
        ? suggestedCategoriesV2.slice(0, 8)
        : fallbackSuggestedCategoriesV2.slice(0, 8),
    adjustmentNotes: asStringArray(root.adjustmentNotes, 8),
    needsReviewFlags: reviewFlags,
    confidence: {
      score: confidenceScore as number,
      level: confidenceLevel as "hoog" | "middel" | "laag",
      reasons: asStringArray(confidenceRoot?.reasons, 6),
    },
    userSummary: String(root.userSummary || "").trim(),
    applyPayload: {
      planSettings: {
        strategy: applyStrategy as BudgetSetupStrategy,
        includeIncome,
        savingsTargetMonthly,
        applySavingsTargetToVariableBudget,
      },
      monthlyVariableBudgets: normalizedBudgets,
    },
  };

  if (!normalized.userSummary) {
    normalized.userSummary =
      "Budio heeft een voorstel klaargezet op basis van je recente patroon.";
  }

  return {
    ok: true,
    issues: [],
    normalized,
  };
}
