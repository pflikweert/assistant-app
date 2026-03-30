import { describe, expect, it } from "vitest";
import {
  validateBudgetSetupProposal,
} from "./budget-setup-proposal-schema";

function buildValidProposal() {
  return {
    proposalId: "proposal-abc",
    selectedMode: "standaard",
    planMeaning: {
      monthFeel: "haalbaar",
      strictness: "normaal",
      primaryReason: "Eerst vaste lasten en reserve beschermen.",
    },
    safetyImpact: {
      variableRoomMonthly: 900,
      reserveProtectionLevel: "middel",
      biggestAttentionPoint: "Houd je variabele tempo in de gaten.",
    },
    nextBestStep: {
      title: "Gebruik dit voorstel als basis",
      why: "Zo stuur je rustig bij met minimale handmatige stappen.",
      dominantConstraint: "stability",
    },
    coachActions: [
      {
        actionKey: "rebalance_now",
        label: "Opnieuw verdelen",
        rationale: "Laat Budio opnieuw verdelen.",
      },
      {
        actionKey: "make_tighter",
        label: "Maak iets zuiniger",
        rationale: "Houd meer marge over.",
      },
    ],
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
    suggestedCategoriesV2: [
      {
        id: "groceries-main",
        label: "Boodschappen",
        type: "main",
        source: "trend",
        suggestedAmount: 350,
        why: "Gebaseerd op trend.",
      },
      {
        id: "fuel-main",
        label: "Vervoer en brandstof",
        type: "main",
        source: "trend",
        suggestedAmount: 150,
        why: "Gebaseerd op trend.",
      },
      {
        id: "smoking-sub",
        label: "Roken",
        type: "sub",
        source: "trend",
        suggestedAmount: 50,
        why: "Gebaseerd op trend.",
      },
      {
        id: "other-main",
        label: "Overige variabele uitgaven",
        type: "main",
        source: "trend",
        suggestedAmount: 350,
        why: "Gebaseerd op trend.",
      },
      {
        id: "buffer-focus",
        label: "Reservebescherming",
        type: "sub",
        source: "forecast",
        suggestedAmount: 180,
        why: "Gebaseerd op forecast.",
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
    expect(result.normalized?.suggestedCategoriesV2).toHaveLength(5);
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

  it("blijft backwards-compatible als v2-betekenisvelden ontbreken", () => {
    const payload = buildValidProposal();
    const {
      planMeaning: _planMeaning,
      safetyImpact: _safetyImpact,
      nextBestStep: _nextBestStep,
      coachActions: _coachActions,
      suggestedCategoriesV2: _suggestedCategoriesV2,
      ...legacyLike
    } = payload;
    const result = validateBudgetSetupProposal(legacyLike);
    expect(result.ok).toBe(true);
    expect(result.normalized?.planMeaning.monthFeel).toBeDefined();
    expect(result.normalized?.nextBestStep.title.length).toBeGreaterThan(3);
    expect((result.normalized?.suggestedCategoriesV2 || []).length).toBeGreaterThanOrEqual(5);
  });
});
