import { describe, expect, it } from "vitest";
import {
  validateBudgetSetupProposal,
} from "./budget-setup-proposal-schema";

function buildValidProposal() {
  return {
    proposalId: "proposal-abc",
    selectedMode: "standaard",
    rationale: ["x"],
    expectedIncomeTotal: 3200,
    protectedAmounts: {
      fixedCosts: 1200,
      subscriptions: 80,
      reserves: 150,
      annualized: 70,
    },
    reserveAdvice: {
      monthlyReserveTarget: 180,
      reason: "Stabiliteit",
    },
    variableBudgetPool: 900,
    suggestedCategories: [
      {
        categoryKey: "groceries",
        suggestedAmount: 350,
        basedOnTrend: true,
        trendWindowMonths: 3,
        note: null,
      },
      {
        categoryKey: "fuel",
        suggestedAmount: 150,
        basedOnTrend: true,
        trendWindowMonths: 3,
        note: null,
      },
      {
        categoryKey: "smoking",
        suggestedAmount: 50,
        basedOnTrend: true,
        trendWindowMonths: 3,
        note: null,
      },
      {
        categoryKey: "other",
        suggestedAmount: 350,
        basedOnTrend: true,
        trendWindowMonths: 3,
        note: null,
      },
    ],
    adjustmentNotes: [],
    needsReviewFlags: ["thin_trend_data"],
    confidence: {
      score: 0.68,
      level: "middel",
      reasons: ["Beperkte trend"],
    },
    userSummary: "Samenvatting",
    applyPayload: {
      planSettings: {
        strategy: "standaard",
        includeIncome: {
          salary: true,
          childBudget: true,
          structuralOther: false,
          variable: false,
        },
        savingsTargetMonthly: null,
        applySavingsTargetToVariableBudget: false,
      },
      monthlyVariableBudgets: [
        { categoryKey: "groceries", amount: 350 },
        { categoryKey: "fuel", amount: 150 },
        { categoryKey: "smoking", amount: 50 },
        { categoryKey: "other", amount: 350 },
      ],
    },
  } as const;
}

describe("budget-setup-proposal-schema", () => {
  it("valideert en normaliseert een geldig voorstel", () => {
    const result = validateBudgetSetupProposal(buildValidProposal());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.normalized?.applyPayload.monthlyVariableBudgets).toHaveLength(4);
  });

  it("geeft fout bij mismatch tussen variableBudgetPool en som van categorieen", () => {
    const payload = buildValidProposal();
    const result = validateBudgetSetupProposal({
      ...payload,
      variableBudgetPool: 1200,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/sluit niet aan/i);
  });

  it("kan fenced json strings parsen", () => {
    const payload = buildValidProposal();
    const result = validateBudgetSetupProposal(
      `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
    );
    expect(result.ok).toBe(true);
  });
});

