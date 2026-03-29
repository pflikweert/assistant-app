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
        "rationale",
        "expectedIncomeTotal",
        "protectedAmounts",
        "reserveAdvice",
        "variableBudgetPool",
        "suggestedCategories",
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

  const normalized: BudgetSetupProposal = {
    proposalId,
    selectedMode: selectedMode as BudgetSetupStrategy,
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
