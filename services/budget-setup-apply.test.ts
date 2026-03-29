import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentUserIdMock,
  markForecastDirtyMock,
  upsertBudgetPlanSettingsMock,
  resetMonthlyBudgetValuesMock,
  upsertMonthlyBudgetValueMock,
} = vi.hoisted(() => ({
  requireCurrentUserIdMock: vi.fn(),
  markForecastDirtyMock: vi.fn(),
  upsertBudgetPlanSettingsMock: vi.fn(),
  resetMonthlyBudgetValuesMock: vi.fn(),
  upsertMonthlyBudgetValueMock: vi.fn(),
}));

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/forecast-refresh", () => ({
  markForecastDirty: markForecastDirtyMock,
}));

vi.mock("@/services/budget-plan-repository", () => ({
  upsertBudgetPlanSettings: upsertBudgetPlanSettingsMock,
  resetMonthlyBudgetValues: resetMonthlyBudgetValuesMock,
  upsertMonthlyBudgetValue: upsertMonthlyBudgetValueMock,
}));

let applyBudgetSetupProposal: typeof import("./budget-setup-apply").applyBudgetSetupProposal;
let resetReplayCache: typeof import("./budget-setup-apply").__resetBudgetSetupApplyReplayCacheForTests;

function buildValidProposal() {
  return {
    proposalId: "proposal-1",
    selectedMode: "bespaarmodus",
    planMeaning: {
      monthFeel: "haalbaar",
      strictness: "streng",
      primaryReason: "Reserve en vaste lasten eerst beschermen.",
    },
    safetyImpact: {
      variableRoomMonthly: 900,
      reserveProtectionLevel: "hoog",
      biggestAttentionPoint: "Houd variabele uitgaven strak.",
    },
    nextBestStep: {
      title: "Beperk variabele uitgaven tijdelijk",
      why: "Zo houd je genoeg marge tot het einde van de maand.",
      dominantConstraint: "overspending_tempo",
    },
    coachActions: [
      {
        actionKey: "rebalance_now",
        label: "Opnieuw verdelen",
        rationale: "Laat Budio opnieuw verdelen.",
      },
      {
        actionKey: "protect_savings",
        label: "Bescherm sparen meer",
        rationale: "Verhoog je reserve.",
      },
    ],
    rationale: ["x"],
    expectedIncomeTotal: 3200,
    protectedAmounts: {
      fixedCosts: 1200,
      subscriptions: 80,
      reserves: 150,
      annualized: 65,
    },
    reserveAdvice: {
      monthlyReserveTarget: 200,
      reason: "y",
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
        why: "Trend",
      },
      {
        id: "fuel-main",
        label: "Vervoer en brandstof",
        type: "main",
        source: "trend",
        suggestedAmount: 150,
        why: "Trend",
      },
      {
        id: "smoking-sub",
        label: "Roken",
        type: "sub",
        source: "trend",
        suggestedAmount: 50,
        why: "Trend",
      },
      {
        id: "other-main",
        label: "Overige variabele uitgaven",
        type: "main",
        source: "trend",
        suggestedAmount: 350,
        why: "Trend",
      },
      {
        id: "buffer-focus",
        label: "Reservebescherming",
        type: "sub",
        source: "forecast",
        suggestedAmount: 250,
        why: "Forecast",
      },
    ],
    adjustmentNotes: [],
    needsReviewFlags: [],
    confidence: {
      score: 0.75,
      level: "middel",
      reasons: ["z"],
    },
    userSummary: "Samenvatting",
    applyPayload: {
      planSettings: {
        strategy: "bespaarmodus",
        includeIncome: {
          salary: true,
          childBudget: true,
          structuralOther: false,
          variable: false,
        },
        savingsTargetMonthly: 250,
        applySavingsTargetToVariableBudget: true,
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

describe("budget-setup-apply", () => {
  beforeEach(async () => {
    const imported = await import("./budget-setup-apply");
    applyBudgetSetupProposal = imported.applyBudgetSetupProposal;
    resetReplayCache = imported.__resetBudgetSetupApplyReplayCacheForTests;
    resetReplayCache();
    requireCurrentUserIdMock.mockReset();
    markForecastDirtyMock.mockReset();
    upsertBudgetPlanSettingsMock.mockReset();
    resetMonthlyBudgetValuesMock.mockReset();
    upsertMonthlyBudgetValueMock.mockReset();

    requireCurrentUserIdMock.mockResolvedValue("user-123");
    markForecastDirtyMock.mockResolvedValue({ ok: true });
    upsertBudgetPlanSettingsMock.mockResolvedValue({});
    resetMonthlyBudgetValuesMock.mockResolvedValue(undefined);
    upsertMonthlyBudgetValueMock.mockResolvedValue({});
  });

  it("past een geldig voorstel toe via bestaande repository-flow", async () => {
    const result = await applyBudgetSetupProposal({
      proposal: buildValidProposal(),
      monthStartIso: "2026-03-01",
      planKey: "default",
    });

    expect(result.applied).toBe(true);
    expect(result.idempotentReplay).toBe(false);
    expect(upsertBudgetPlanSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "active_savings",
        planKey: "default",
        savingsTargetMonthly: 250,
      }),
    );
    expect(resetMonthlyBudgetValuesMock).toHaveBeenCalledWith({
      planKey: "default",
      monthStartIso: "2026-03-01",
    });
    expect(upsertMonthlyBudgetValueMock).toHaveBeenCalledTimes(5);
    expect(markForecastDirtyMock).toHaveBeenCalledWith("budget_save", {
      userId: "user-123",
    });
  });

  it("is idempotent voor identieke apply-call", async () => {
    const input = {
      proposal: buildValidProposal(),
      monthStartIso: "2026-03-01",
      planKey: "default",
      idempotencyKey: "same-key",
    } as const;
    const first = await applyBudgetSetupProposal(input);
    const second = await applyBudgetSetupProposal(input);

    expect(first.idempotentReplay).toBe(false);
    expect(second.idempotentReplay).toBe(true);
    expect(upsertBudgetPlanSettingsMock).toHaveBeenCalledTimes(1);
    expect(resetMonthlyBudgetValuesMock).toHaveBeenCalledTimes(1);
    expect(upsertMonthlyBudgetValueMock).toHaveBeenCalledTimes(5);
    expect(markForecastDirtyMock).toHaveBeenCalledTimes(1);
  });

  it("weigert ongeldige voorstellen", async () => {
    await expect(
      applyBudgetSetupProposal({
        proposal: {
          proposalId: "bad",
          selectedMode: "standaard",
          variableBudgetPool: 900,
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
            monthlyVariableBudgets: [],
          },
        } as never,
        monthStartIso: "2026-03-01",
      }),
    ).rejects.toThrow(/ongeldig/i);
  });
});
