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

function createJsonResponse(content: unknown, id: string) {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        id,
        model: "gpt-4.1-mini",
        choices: [{ message: { content: JSON.stringify(content) } }],
      }),
  };
}

function createPlannerDecisionResponse(
  partial: Partial<{
    route: "issue_intake" | "spending_advice" | "general";
    mode: "general_help" | "issue_intake" | "space_summary" | "spending_decision";
    confidence: "low" | "medium" | "high";
    needsClarification: boolean;
    requires: {
      monthBudget: boolean;
      cashflowSafety: boolean;
      expectedEndBalance: boolean;
      categoryStatus: boolean;
      weekContext: boolean;
      screenExplanation: boolean;
    };
    categoryHint: "groceries" | "fuel" | "housing" | "none";
    useScreenContext: boolean;
  }>,
  id: string,
) {
  return createJsonResponse(
    {
      route: "general",
      mode: "general_help",
      confidence: "medium",
      needsClarification: false,
      requires: {
        monthBudget: false,
        cashflowSafety: false,
        expectedEndBalance: false,
        categoryStatus: false,
        weekContext: false,
        screenExplanation: false,
      },
      categoryHint: "none",
      useScreenContext: false,
      ...partial,
    },
    id,
  );
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
      surfaceSemantics: {
        remainingMonthlyBudget: 200,
        expectedEndOperationalBalance: 300,
        freeToSpendNow: 1292.84,
        safeToSpendUntilNextIncome: 1690.95,
        nextIncomeDateAnchor: "2026-03-28",
        nextIncomeAmountAnchor: 2400,
        nextIncomeAmountAnchorMeta: {
          isAvailable: true,
          isCanonical: true,
          isDerived: false,
          isFallback: false,
          source: "income_source",
          dataGapReason: null,
        },
        knownUpcomingFixedCostsUntilAnchor: 320,
        knownUpcomingSubscriptionsUntilAnchor: 45,
        safeToSpendConfidenceScore: "MEDIUM",
        safeToSpendLabel: "Extra ruimte tot salaris",
        safeToSpendSubtitle: "Tot je salaris",
        statusLabel: "Let op voor maart",
        statusTone: "critical",
      },
      currentBalance: {
        balance: 1400,
        date: "2026-03-20",
      },
      spending: {
        currentMonthTotal: 820,
        currentWeekTotal: 210,
        currentMonthBreakdown: {
          total: 820,
          transactionCount: 12,
          categories: [
            {
              key: "housing",
              label: "Wonen",
              amount: 420,
              transactionCount: 3,
              subcategories: [
                {
                  key: "rent",
                  label: "Huur",
                  amount: 420,
                  transactionCount: 3,
                },
              ],
            },
            {
              key: "groceries",
              label: "Boodschappen",
              amount: 240,
              transactionCount: 5,
              subcategories: [
                {
                  key: "supermarket",
                  label: "Supermarkt",
                  amount: 240,
                  transactionCount: 5,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 210,
          transactionCount: 4,
          categories: [
            {
              key: "groceries",
              label: "Boodschappen",
              amount: 120,
              transactionCount: 2,
              subcategories: [
                {
                  key: "supermarket",
                  label: "Supermarkt",
                  amount: 120,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
      },
      trend: {
        monthStatusLabel: "LET OP",
        monthRiskTone: "watch",
        weekStatusLabel: "Op koers",
        weekRiskTone: "good",
        weekTempoDelta: -10,
        monthProgress: 0.6,
      },
      budgetPlan: {
        monthlyBudgetTotal: 2000,
        weeklyBudgetTotal: 500,
        fixedCostsBudget: 900,
        subscriptionsBudget: 120,
        variableBudget: 900,
        variableSubcategoriesBudgetTotal: 900,
        appliedSavingsTarget: 250,
        currentWeekBudget: 200,
        currentWeekActual: 120,
        currentWeekRemaining: 80,
        subtotalAfterFixed: 1100,
        subtotalAfterSubscriptions: 980,
        variableCategoryBudgets: [
          {
            categoryKey: "groceries",
            label: "Boodschappen",
            monthlyBudget: 300,
            monthlyActual: 240,
            utilization: 0.8,
          },
          {
            categoryKey: "fuel",
            label: "Brandstof",
            monthlyBudget: 140,
            monthlyActual: 0,
            utilization: 0,
          },
        ],
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 12,
          variableBudgetTotal: 900,
          variableSpent: 700,
          variableRemaining: 200,
          monthBudgetStatus: "watch",
          monthBudgetStatusLabel: "LET OP",
          weekBudgetRemaining: 55,
          weekBudgetStatus: "on_track",
          weekTempoSignal: "under_tempo",
        },
        cashflowSafety: {
          currentBalance: 1400,
          extraSpaceUntilNextIncome: 1690.95,
          extraSpaceLabel: "Extra ruimte tot salaris",
          nextIncomeDate: "2026-03-28",
          nextIncomeAmount: 2400,
          nextIncomeAmountMeta: {
            isAvailable: true,
            isCanonical: true,
            isDerived: false,
            isFallback: false,
            source: "income_source",
            dataGapReason: null,
          },
          daysUntilNextIncome: 8,
          expectedEndBalance: 300,
          lowestProjectedBalance: 80,
          knownUpcomingFixedCosts: 365,
          expectedFixedAndSubscriptions: 920,
          forecastReliability: "medium",
        },
        categoryStatus: {
          categoryKey: "groceries",
          categoryLabel: "Boodschappen",
          spentCurrentMonth: 240,
          budgetCurrentMonth: 300,
          remaining: 60,
          status: "watch",
          budgetAvailability: "canonical",
          budgetSourceType: "plan_recommendation_category",
          budgetMeta: {
            isAvailable: true,
            isCanonical: true,
            isDerived: false,
            isFallback: false,
            source: "budget_plan_recommendation_category",
            dataGapReason: null,
          },
          projectedEndOfMonth: null,
          projectedEndOfMonthMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "category_projection",
            dataGapReason: "projected_end_of_month_not_available",
          },
          avgLast3Months: null,
          avgLast3MonthsMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "category_average",
            dataGapReason: "avg_last_3_months_not_available",
          },
        },
        assistantAdviceSignals: {
          budgetPressure: "medium",
          cashSafety: "medium",
          purchaseFlexibility: "medium",
          shortReason:
            "Het kan waarschijnlijk wel, maar deze keuze maakt je maand krapper.",
          recommendedTone: "neutral",
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 45000,
        hasBudgetSignals: true,
        hasPlanningSignals: true,
        hasForecastSignals: true,
        hasBalanceSignals: true,
        hasSpendingSignals: true,
        hasCategorySignals: true,
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
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "spending_advice",
          confidence: "high",
          type: "spending_advice",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "spending_advice",
            subtype: "general",
            confidence: "high",
            context: {
              screenId: "budget",
              screenTitle: "Budget",
              routeName: "/budget",
              platform: "ios",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-1",
      ),
    );
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

    const openAIRequest =
      postHelpAssistantSpendingAdviceCompletionMock.mock.calls[0]?.[0]
        ?.openAIRequest;
    const promptText = JSON.stringify(openAIRequest?.messages || []);
    const systemPromptText = JSON.stringify(
      (openAIRequest?.messages || [])
        .filter((message: { role?: string }) => message.role === "system")
        .map((message: { content?: string }) => String(message.content || "")),
    );
    expect(
      (openAIRequest?.messages || []).filter(
        (message: { role?: string }) => message.role === "system",
      ),
    ).toHaveLength(3);
    expect(systemPromptText).toContain(
      "Je bent de Budio AI Buddy voor bestedingsruimte-vragen.",
    );
    expect(systemPromptText).toContain(
      "Begin je conclusie altijd vanuit maandruimte en verwacht eindsaldo",
    );
    expect(systemPromptText).toContain("Gedragsregel: geef hetzelfde financiële oordeel");
    expect(systemPromptText).not.toContain("Schermspecifieke context");
    expect(promptText).toContain("Assistant-ready bestedingscontext");
    expect(promptText).toContain("SpendingAdvice truth-safe payload JSON");
    expect(promptText).toContain("Resterend budget maart 2026");
    expect(promptText).toContain("Verwacht eindsaldo");
    expect(promptText).toContain("Extra ruimte tot salaris");
    expect(promptText).toContain("Aankoopimpact");
    expect(promptText).not.toContain("Categoriecontext");
    expect(promptText).toContain("requiredBlocks");
    expect(promptText).toContain("categoryStatus\\\":false");
    expect(promptText.indexOf("Maandbudget:")).toBeGreaterThan(-1);
    expect(promptText.indexOf("Cashflow safety:")).toBeGreaterThan(-1);
    expect(promptText.indexOf("Maandbudget:")).toBeLessThan(
      promptText.indexOf("Cashflow safety:"),
    );
    expect(promptText).not.toContain("Weekbudget resterend");
    expect(promptText).not.toContain("Categoriebudget deze maand");
    expect(promptText).not.toContain("Schermspecifieke context");
    expect(promptText).not.toContain("Veilig te besteden tot volgende inkomen");
  });

  it("keeps spending fallback text screen-independent", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "spending_advice",
          confidence: "high",
          type: "spending_advice",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "spending_advice",
            subtype: "general",
            confidence: "high",
            context: {
              screenId: "budget",
              screenTitle: "Budget",
              routeName: "/budget",
              platform: "ios",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-screen-a",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "spending_advice",
          confidence: "high",
          type: "spending_advice",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "spending_advice",
            subtype: "general",
            confidence: "high",
            context: {
              screenId: "transactions",
              screenTitle: "Transactions",
              routeName: "/transactions",
              platform: "ios",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-screen-b",
      ),
    );
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-screen-indep",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Geen JSON schema output" } }],
        }),
    });

    const budgetContext = buildHelpAssistantContext({
      screenId: "budget",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "budget",
        remainingVariableBudget: 200,
        hasForecastData: true,
      },
    });
    const transactionsContext = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "transactions",
        activeFilterCount: 0,
      },
    });

    const budgetResult = await requestHelpAssistantReply({
      context: budgetContext,
      thread: createThreadWithUserMessage("Kan ik nog 40 euro uitgeven?"),
    });
    const transactionsResult = await requestHelpAssistantReply({
      context: transactionsContext,
      thread: createThreadWithUserMessage("Kan ik nog 40 euro uitgeven?"),
    });

    expect(budgetResult.answerText).toBe(transactionsResult.answerText);
    expect(budgetResult.answerText).not.toContain("Open Budget of Inzichten");
    expect(budgetResult.answerText).toContain(
      "maandruimte en extra ruimte tot je volgende inkomsten",
    );
  });

  it("keeps non-spending questions on regular proxy path", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "general",
          confidence: "high",
          type: "general",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "general",
            subtype: "general",
            confidence: "high",
            context: {
              screenId: "transactions",
              screenTitle: "Transactions",
              routeName: "/transactions",
              platform: "web",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-2",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      {
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "chatcmpl-2",
            model: "gpt-4.1-mini",
            choices: [{ message: { content: "Hier is je schermuitleg." } }],
          }),
      },
    );

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
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.answerText).toBe("Hier is je schermuitleg.");
  });

  it("keeps budget mismatch questions on regular proxy path", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "general",
          confidence: "high",
          type: "general",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "general",
            subtype: "general",
            confidence: "high",
            context: {
              screenId: "budget",
              screenTitle: "Budget",
              routeName: "/budget",
              platform: "web",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-2b",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      {
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "chatcmpl-2b",
            model: "gpt-4.1-mini",
            choices: [
              {
                message: {
                  content:
                    "Laten we samen stap voor stap je budget controleren.",
                },
              },
            ],
          }),
      },
    );

    const context = buildHelpAssistantContext({
      screenId: "budget",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "budget",
        remainingVariableBudget: 120,
        hasForecastData: true,
      },
    });

    const result = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("Waarom klopt mijn budget niet?"),
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).not.toHaveBeenCalled();
    expect(resolveUnifiedFinancialAdviceContextMock).not.toHaveBeenCalled();
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.answerText).toContain("budget");
  });

  it("routes category spend questions to spending advice even when the router is generic", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "general",
          confidence: "medium",
          type: "general",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "general",
            subtype: "general",
            confidence: "medium",
            context: {
              screenId: "budget",
              screenTitle: "Budget",
              routeName: "/budget",
              platform: "web",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-category-spend",
      ),
    );
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-category-spend",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  conclusion: "Je hebt deze maand € 240 aan boodschappen uitgegeven.",
                  why: "De uitgavenverdeling laat boodschappen als aparte categorie zien.",
                  risk: "Als dit tempo doorloopt, blijft er minder ruimte over voor de rest van de maand.",
                  nextStep: "Kijk of je dit bedrag wilt vergelijken met je budget of met vorige maand.",
                  confidence: "high",
                }),
              },
            },
          ],
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
        "Hoeveel heb ik deze maand aan boodschappen uitgegeven?",
      ),
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).toHaveBeenCalledTimes(1);
    expect(resolveUnifiedFinancialAdviceContextMock).toHaveBeenCalledTimes(1);
    expect(result.answerText).toContain("€ 240");
    expect(result.answerText).toContain("boodschappen");
  });

  it("parses issue intake JSON with type and context metadata", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "issue_intake",
          confidence: "high",
          type: "idea",
          subtype: "idea",
          needsClarification: false,
          meta: {
            route: "issue_intake",
            type: "idea",
            subtype: "idea",
            confidence: "high",
            context: {
              screenId: "dashboard",
              screenTitle: "Dashboard",
              routeName: "/dashboard",
              platform: "web",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-issue-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-issue-1",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  meta: {
                    route: "issue_intake",
                    type: "idea",
                    subtype: "idea",
                    confidence: "high",
                    state: "ready_to_review",
                    needsClarification: false,
                    context: {
                      screenId: "dashboard",
                      screenTitle: "Dashboard",
                      routeName: "/dashboard",
                      platform: "web",
                      periodLabel: "maart 2026",
                    },
                  },
                  answerText:
                    "Wat zou je graag willen toevoegen of veranderen op het dashboard?",
                  summary: "Grafiek voor dashboard",
                  featureArea: "Dashboard",
                  userNeed: "Je wilt grafieken zien op het dashboard",
                  proposedChange: "een grafiek laat de forecast zien",
                  isReadyForSubmission: true,
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
        hasForecastData: true,
      },
    });

    const result = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "ik zou mijn budget van de hele maand in een grafiek willen zien",
      ),
    });

    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(result.issueIntake?.meta.type).toBe("idea");
    expect(result.issueIntake?.meta.context.screenId).toBe("dashboard");
    expect(result.issueIntake?.summary).toContain("Grafiek");
    expect(result.answerText).toBe(
      "Wat zou je graag willen toevoegen of veranderen op het dashboard?",
    );
    expect(result.answerText).not.toContain("geef dit door");
  });

  it("uses context-based data gaps instead of model-invented data gaps", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          route: "spending_advice",
          confidence: "high",
          type: "spending_advice",
          subtype: "general",
          needsClarification: false,
          meta: {
            type: "spending_advice",
            subtype: "general",
            confidence: "high",
            context: {
              screenId: "dashboard",
              screenTitle: "Dashboard",
              routeName: "/dashboard",
              platform: "web",
              periodLabel: "maart 2026",
            },
          },
        },
        "router-3",
      ),
    );
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

  it("uses planner spending mode with truth-safe payload and without general prompt leakage", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "spending_advice",
          mode: "space_summary",
          confidence: "high",
          requires: {
            monthBudget: true,
            cashflowSafety: true,
            expectedEndBalance: false,
            categoryStatus: true,
            weekContext: true,
            screenExplanation: false,
          },
          categoryHint: "groceries",
          useScreenContext: false,
        },
        "planner-spending-1",
      ),
    );
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-spending-mode",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  conclusion: "Je hebt nog wat ruimte, maar houd het rustig.",
                  why: "Maandruimte en cashflow zijn nu redelijk stabiel.",
                  risk: "Bij dit tempo wordt de rest van de maand krapper.",
                  nextStep: "Controleer je boodschappen aan het einde van de week.",
                }),
              },
            },
          ],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "transactions",
        activeFilterCount: 0,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("Heb ik nog ruimte voor boodschappen?"),
    });

    const spendingRequest =
      postHelpAssistantSpendingAdviceCompletionMock.mock.calls[0]?.[0]
        ?.openAIRequest;
    const systemMessages = (spendingRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""));
    const joined = systemMessages.join("\n");

    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(1);
    expect(systemMessages).toHaveLength(3);
    expect(joined).toContain("Je bent de Budio AI Buddy voor bestedingsruimte-vragen.");
    expect(joined).toContain("Vraagtype: ruimtevraag");
    expect(joined).toContain("SpendingAdvice truth-safe payload JSON");
    expect(joined).toContain("Categoriecontext:");
    expect(joined).toContain("Weekbudget resterend");
    expect(joined.indexOf("Maandbudget:")).toBeLessThan(
      joined.indexOf("Weekbudget resterend"),
    );
    expect(joined).not.toContain(
      "Je bent de Budio Assistent in een Nederlandse consumenten-app",
    );
    expect(joined).not.toContain("Schermspecifieke context");
  });

  it("keeps tanken-vraag month-first with week as aanvullende context and no screen leakage", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "spending_advice",
          mode: "spending_decision",
          confidence: "high",
          requires: {
            monthBudget: true,
            cashflowSafety: false,
            expectedEndBalance: true,
            categoryStatus: true,
            weekContext: true,
            screenExplanation: false,
          },
          categoryHint: "fuel",
          useScreenContext: false,
        },
        "planner-fuel-1",
      ),
    );
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-fuel",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  conclusion: "Tanken kan waarschijnlijk nog, maar houd je maandruimte in de gaten.",
                  why: "Je maandruimte en cashflow geven nog beperkte speling.",
                  risk: "Bij extra uitgaven later deze maand kan je ruimte snel krimpen.",
                  nextStep: "Kies een lager bedrag of stel extra uitgaven uit.",
                }),
              },
            },
          ],
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

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("Kan ik nog tanken deze week?"),
    });

    const spendingRequest =
      postHelpAssistantSpendingAdviceCompletionMock.mock.calls[
        postHelpAssistantSpendingAdviceCompletionMock.mock.calls.length - 1
      ]?.[0]?.openAIRequest;
    const systemMessages = (spendingRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""));
    const joined = systemMessages.join("\n");
    const lastMessage = (spendingRequest?.messages || [])[
      (spendingRequest?.messages || []).length - 1
    ];

    expect(systemMessages).toHaveLength(3);
    expect(joined).toContain("Spending-context:");
    expect(joined).toContain("SpendingAdvice truth-safe payload JSON");
    expect(joined).toContain("Maandbudget:");
    expect(joined).toContain("Weekbudget resterend");
    expect(joined.indexOf("Maandbudget:")).toBeLessThan(
      joined.indexOf("Weekbudget resterend"),
    );
    expect(joined).toContain('"expectedEndBalance":true');
    expect(joined).toContain('"cashflowSafety":true');
    expect(joined).not.toContain(
      "Je bent de Budio Assistent in een Nederlandse consumenten-app",
    );
    expect(joined).not.toContain("Schermspecifieke context");
    expect(lastMessage?.role).toBe("user");
    expect(String(lastMessage?.content || "")).toContain(
      "Kan ik nog tanken deze week?",
    );
  });

  it("uses planner issue_intake mode and keeps spending prompts out of the final call", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "issue_intake",
          mode: "issue_intake",
          confidence: "high",
          useScreenContext: true,
        },
        "planner-issue-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-issue-mode",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  meta: {
                    route: "issue_intake",
                    type: "idea",
                    subtype: "idea",
                    confidence: "high",
                    state: "ready_to_review",
                    needsClarification: false,
                    context: {
                      screenId: "dashboard",
                      screenTitle: "Dashboard",
                      routeName: "/dashboard",
                      platform: "web",
                      periodLabel: "maart 2026",
                    },
                  },
                  answerText:
                    "Wat zou je graag willen toevoegen of veranderen op het dashboard?",
                  summary: "Grafiek voor dashboard",
                  featureArea: "Dashboard",
                  userNeed: "Je wilt grafieken zien op het dashboard",
                  proposedChange: "een grafiek laat de forecast zien",
                  isReadyForSubmission: true,
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
        hasForecastData: true,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "ik zou mijn budget van de hele maand in een grafiek willen zien",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = JSON.stringify(
      (finalRequest?.messages || [])
        .filter((message: { role?: string }) => message.role === "system")
        .map((message: { content?: string }) => String(message.content || "")),
    );
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(systemText).toContain("Je bent de Budio Assistent voor chat-first idee- en issue-intake.");
    expect(systemText).not.toContain("Je bent de Budio AI Buddy voor bestedingsruimte-vragen.");
  });
});
