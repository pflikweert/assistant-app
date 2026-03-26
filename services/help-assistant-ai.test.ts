/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  postOpenAIChatCompletionMock,
  postHelpAssistantSpendingAdviceCompletionMock,
  resolveUnifiedFinancialAdviceContextMock,
} = vi.hoisted(() => ({
  postOpenAIChatCompletionMock: vi.fn(),
  postHelpAssistantSpendingAdviceCompletionMock: vi.fn(),
  resolveUnifiedFinancialAdviceContextMock: vi.fn(),
}));

vi.mock("./openai-proxy", () => ({
  postOpenAIChatCompletion: postOpenAIChatCompletionMock,
  postHelpAssistantSpendingAdviceCompletion:
    postHelpAssistantSpendingAdviceCompletionMock,
}));

vi.mock("./help-assistant-financial-context", () => ({
  resolveUnifiedFinancialAdviceContext: resolveUnifiedFinancialAdviceContextMock,
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        OPENAI_MODEL: "gpt-4.1-mini",
      },
    },
  },
}));

import {
  parseSpendingAdviceSchema,
  requestHelpAssistantReply,
} from "./help-assistant-ai";
import { buildHelpAssistantContext } from "./help-assistant-context";

function createThreadWithUserMessage(text: string) {
  return {
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        status: "ready" as const,
        text,
        createdAtIso: "2026-03-01T12:00:00.000Z",
        metadata: {
          source: "composer" as const,
          intent: "general_help" as const,
          target: "general_help" as const,
          routeName: "/budget",
          screenId: "budget" as const,
          screenTitle: "Budget",
          periodLabel: "maart 2026",
          platform: "ios",
          issueDraftCandidate: false,
          spendingAdviceCandidate: true,
        },
      },
    ],
    pendingIssueDraftIds: [],
    pendingSpendingAdviceIds: [],
  };
}

describe("help-assistant-ai spending advice", () => {
  beforeEach(() => {
    postOpenAIChatCompletionMock.mockReset();
    postHelpAssistantSpendingAdviceCompletionMock.mockReset();
    resolveUnifiedFinancialAdviceContextMock.mockReset();
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValue({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      budget: {
        remainingVariableBudget: 200,
        spentVariableBudget: 700,
        totalVariableBudget: 900,
        monthStatusLabel: "LET OP",
        monthRiskTone: "watch",
        weekRemainingBudget: 55,
        weekStatusLabel: "Op koers",
        weekRiskTone: "good",
        weekTempoDelta: -10,
      },
      planning: {
        upcomingCommittedExpenseTotal: 450,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 800,
        expectedSubscriptions: 120,
        remainingPlannedExpenseTotal: 500,
        remainingVariableExpenseEstimate: 180,
      },
      forecastCurrentMonth: {
        hasData: true,
        expectedEndBalance: 300,
        lowestExpectedBalance: 80,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: 240,
        forecastReferenceDate: "2026-03-20",
      },
      forecastNextMonth: {
        hasData: true,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: 260,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: "2026-03-20",
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 45000,
        hasBudgetSignals: true,
        hasPlanningSignals: true,
        hasForecastSignals: true,
        confidence: "high",
        dataGaps: [],
      },
    });
  });

  it("parses spending schema from direct JSON and fenced JSON", () => {
    const direct = parseSpendingAdviceSchema(
      '{"conclusion":"ja","why":"omdat","risk":"let op","nextStep":"check budget"}',
    );
    const fenced = parseSpendingAdviceSchema(
      '```json\n{"conclusion":"nee","why":"te krap","risk":"hoog risico","nextStep":"stel uit"}\n```',
    );

    expect(direct?.conclusion).toBe("ja");
    expect(fenced?.conclusion).toBe("nee");
  });

  it("uses safe fallback pattern when spending response is malformed", async () => {
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Geen JSON schema output" } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "budget",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "budget",
        remainingVariableBudget: 200,
        hasForecastData: true,
      },
    });

    const result = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "Kan ik nog 40 euro uitgeven deze maand?",
      ),
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.answerText).toContain("1. Conclusie:");
    expect(result.answerText).toContain("2. Waarom:");
    expect(result.answerText).toContain("3. Risico of nuance:");
    expect(result.answerText).toContain("4. Slimmer alternatief of vervolgstap:");
    expect(result.answerText.toLowerCase()).toContain(
      "op basis van wat ik nu zie",
    );
    expect(resolveUnifiedFinancialAdviceContextMock).toHaveBeenCalledTimes(1);
  });

  it("keeps non-spending questions on regular proxy path", async () => {
    postOpenAIChatCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-2",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Hier is je schermuitleg." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "transactions",
        activeFilterCount: 2,
      },
    });

    const result = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("Leg dit scherm uit"),
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).not.toHaveBeenCalled();
    expect(resolveUnifiedFinancialAdviceContextMock).not.toHaveBeenCalled();
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.answerText).toBe("Hier is je schermuitleg.");
  });

  it("uses context-based data gaps instead of model-invented data gaps", async () => {
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-3",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  conclusion: "Voorzichtig positief",
                  why: "Op basis van je huidige budgetregels",
                  risk: "Controleer begin volgende maand opnieuw",
                  nextStep: "Check Budget",
                  confidence: "hoog",
                  dataGaps: ["variabele_budgetruimte_ontbreekt"],
                }),
              },
            },
          ],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "dashboard",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "budget",
        monthLabel: "maart 2026",
        remainingVariableBudget: -120,
        totalVariableBudget: 900,
        spentVariableBudget: 1020,
        expectedFixedCosts: 800,
        expectedSubscriptions: 140,
        hasForecastData: false,
      },
    });

    const result = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "Hoeveel ruimte heb ik nog om uit te geven vanuit mijn budget?",
      ),
    });

    expect(result.answerText).not.toContain("variabele_budgetruimte_ontbreekt");
    expect(result.answerText).not.toContain(
      "Er ontbreken nog enkele signalen in de huidige context.",
    );
  });
});
