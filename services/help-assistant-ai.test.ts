/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  postOpenAIChatCompletionMock,
  postHelpAssistantSpendingAdviceCompletionMock,
  resolveUnifiedFinancialAdviceContextMock,
  resolveSafeCategoryBreakdownInRangeMock,
  resolveSafeMerchantAggregatesInRangeMock,
  resolveSafeCategoryCatalogScopesMock,
} = vi.hoisted(() => ({
  postOpenAIChatCompletionMock: vi.fn(),
  postHelpAssistantSpendingAdviceCompletionMock: vi.fn(),
  resolveUnifiedFinancialAdviceContextMock: vi.fn(),
  resolveSafeCategoryBreakdownInRangeMock: vi.fn(),
  resolveSafeMerchantAggregatesInRangeMock: vi.fn(),
  resolveSafeCategoryCatalogScopesMock: vi.fn(),
}));

vi.mock("./openai-proxy", () => ({
  postOpenAIChatCompletion: postOpenAIChatCompletionMock,
  postHelpAssistantSpendingAdviceCompletion:
    postHelpAssistantSpendingAdviceCompletionMock,
}));

vi.mock("./help-assistant-financial-context", () => ({
  resolveUnifiedFinancialAdviceContext: resolveUnifiedFinancialAdviceContextMock,
  resolveSafeCategoryBreakdownInRange: resolveSafeCategoryBreakdownInRangeMock,
  resolveSafeMerchantAggregatesInRange: resolveSafeMerchantAggregatesInRangeMock,
  resolveSafeCategoryCatalogScopes: resolveSafeCategoryCatalogScopesMock,
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        OPENAI_MODEL: "gpt-5.4-nano",
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
        model: "gpt-5.4-nano",
        choices: [{ message: { content: JSON.stringify(content) } }],
      }),
  };
}

function createPlannerDecisionResponse(
  partial: Partial<{
    route:
      | "issue_intake"
      | "spending_advice"
      | "general"
      | "transactions_insight"
      | "category_insight"
      | "screen_explanation";
    mode:
      | "general_help"
      | "issue_intake"
      | "space_summary"
      | "spending_decision"
      | "transaction_lookup"
      | "category_summary"
      | "screen_help";
    insightsFlow:
      | "general_reasoning"
      | "spending_overview"
      | "category_summary"
      | "transaction_facts"
      | "screen_context"
      | "issue_intake"
      | "none";
    confidence: "low" | "medium" | "high";
    needsClarification: boolean;
    continueActiveFlow: boolean;
    activeFlowInfluence: "none" | "low" | "medium" | "high";
    requires: {
      monthBudget: boolean;
      cashflowSafety: boolean;
      expectedEndBalance: boolean;
      categorySummary: boolean;
      transactionFacts: boolean;
      screenExplanation: boolean;
    };
    dataRequests: {
      monthScope: "current" | "previous" | "specified" | "none";
      categoryScope: string;
      merchantScope: string;
      transactionQuestionType:
        | "merchant_total"
        | "merchant_frequency"
        | "category_places"
        | "category_total"
        | "none";
    };
    useScreenContext: boolean;
  }>,
  id: string,
) {
  return createJsonResponse(
    {
      route: "general",
      mode: "general_help",
      insightsFlow: "general_reasoning",
      confidence: "medium",
      needsClarification: false,
      continueActiveFlow: false,
      activeFlowInfluence: "none",
      requires: {
        monthBudget: false,
        cashflowSafety: false,
        expectedEndBalance: false,
        categorySummary: false,
        transactionFacts: false,
        screenExplanation: false,
      },
      dataRequests: {
        monthScope: "none",
        categoryScope: "none",
        merchantScope: "none",
        transactionQuestionType: "none",
      },
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
    resolveSafeCategoryBreakdownInRangeMock.mockReset();
    resolveSafeMerchantAggregatesInRangeMock.mockReset();
    resolveSafeCategoryCatalogScopesMock.mockReset();
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
    resolveSafeCategoryBreakdownInRangeMock.mockResolvedValue({
      total: 0,
      transactionCount: 0,
      categories: [],
    });
    resolveSafeMerchantAggregatesInRangeMock.mockResolvedValue([]);
    resolveSafeCategoryCatalogScopesMock.mockResolvedValue([
      { slug: "groceries", label: "Boodschappen", source: "catalog" },
      { slug: "fuel", label: "Brandstof", source: "catalog" },
      { slug: "auto_transport", label: "Auto & Transport", source: "catalog" },
      { slug: "car_insurance", label: "Autoverzekering", source: "catalog" },
      { slug: "car_wash", label: "Autowassen", source: "catalog" },
    ]);
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

  it("routes category spend questions to category insight instead of spending advice", async () => {
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
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-category-spend",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: "Je hebt deze maand € 240 aan boodschappen uitgegeven.",
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

    expect(postHelpAssistantSpendingAdviceCompletionMock).not.toHaveBeenCalled();
    expect(resolveUnifiedFinancialAdviceContextMock).toHaveBeenCalledTimes(1);
    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const finalMeta = postOpenAIChatCompletionMock.mock.calls[1]?.[1];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Planner-route: category_insight");
    expect(systemText).toContain("Insights-flow: category_summary");
    expect(systemText).toContain("scopedCategoryTotal: €");
    expect(finalMeta?.useCase).toBe("help_category_insight");
    expect(result.answerText).toContain("€ 240");
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
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          continueActiveFlow: false,
          activeFlowInfluence: "low",
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
    expect(joined).not.toContain("Weekbudget resterend");
    expect(joined).toContain('"weekContext":false');
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
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          continueActiveFlow: false,
          activeFlowInfluence: "low",
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
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(2);
    expect(systemText).toContain("Je bent de Budio Assistent voor chat-first idee- en issue-intake.");
    expect(systemText).not.toContain("Je bent de Budio AI Buddy voor bestedingsruimte-vragen.");
  });

  it("allows route switch from active issue flow to spending advice on clear intent shift", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "general",
          mode: "general_help",
          confidence: "medium",
          needsClarification: false,
          continueActiveFlow: true,
          activeFlowInfluence: "high",
          useScreenContext: false,
        },
        "planner-shift-1",
      ),
    );
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-shift-1",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  conclusion: "Dat kan waarschijnlijk nog, maar blijf voorzichtig.",
                  why: "Je maandruimte en cashflow hebben nog beperkte marge.",
                  risk: "Extra uitgaven later kunnen je ruimte snel verkleinen.",
                  nextStep: "Kies een lager bedrag als je nog onzeker bent.",
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
      thread: createThreadWithUserMessage("Kan ik nog 40 euro uitgeven deze maand?"),
      activeFlow: {
        route: "issue_intake",
        mode: "issue_intake",
        status: "collecting",
      },
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).toHaveBeenCalledTimes(1);
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(1);
  });

  it("continues active issue flow on short clarification replies", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "general",
          mode: "general_help",
          confidence: "medium",
          needsClarification: false,
          continueActiveFlow: false,
          activeFlowInfluence: "low",
        },
        "planner-cont-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-cont-1",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  meta: {
                    route: "issue_intake",
                    type: "issue",
                    subtype: "issue",
                    confidence: "medium",
                    state: "collecting",
                    needsClarification: true,
                    context: {
                      screenId: "budget",
                      screenTitle: "Budget",
                      routeName: "/budget",
                      platform: "web",
                      periodLabel: "maart 2026",
                    },
                  },
                  answerText: "Waar zie je dit het vaakst terug?",
                  summary: "Budget loopt niet gelijk",
                  featureArea: "Budget",
                  userNeed: "De gebruiker ziet afwijking",
                  proposedChange: "Beter inzicht in oorzaak",
                  isReadyForSubmission: false,
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
        remainingVariableBudget: 120,
        hasForecastData: true,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("vooral bij boodschappen"),
      activeFlow: {
        route: "issue_intake",
        mode: "issue_intake",
        status: "collecting",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = JSON.stringify(
      (finalRequest?.messages || [])
        .filter((message: { role?: string }) => message.role === "system")
        .map((message: { content?: string }) => String(message.content || "")),
    );
    expect(systemText).toContain(
      "Je bent de Budio Assistent voor chat-first idee- en issue-intake.",
    );
    expect(systemText).not.toContain(
      "Je bent de Budio AI Buddy voor bestedingsruimte-vragen.",
    );
  });

  it("routes transactions_insight through general final channel with limitation prompt", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: true,
          continueActiveFlow: false,
          activeFlowInfluence: "none",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          useScreenContext: false,
        },
        "planner-tx-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-tx-1",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content:
                  "Ik zie nog geen concrete transactiedetails in deze context. Over welke datum of tegenpartij gaat het?",
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
        activeFilterCount: 1,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("Welke transacties vallen het meest op?"),
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).not.toHaveBeenCalled();
    expect(resolveUnifiedFinancialAdviceContextMock).toHaveBeenCalledTimes(1);
    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const finalMeta = postOpenAIChatCompletionMock.mock.calls[1]?.[1];
    const systemText = JSON.stringify(
      (finalRequest?.messages || [])
        .filter((message: { role?: string }) => message.role === "system")
        .map((message: { content?: string }) => String(message.content || "")),
    );
    expect(systemText).toContain("Planner-route: transactions_insight");
    expect(systemText).toContain("Routehint: geef alleen transactiefeiten");
    expect(finalMeta?.useCase).toBe("help_transactions_insight");
  });

  it("hydrates categorySummary conditioneel via dataRequests zonder transactionFacts", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "groceries",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-category-data-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-category-data-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "insights",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "insights",
        monthLabel: "maart 2026",
        hasForecastData: true,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "Wat heb ik in boodschappen uitgegeven deze maand?",
      ),
    });

    expect(resolveUnifiedFinancialAdviceContextMock).toHaveBeenCalledTimes(1);
    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = JSON.stringify(
      (finalRequest?.messages || [])
        .filter((message: { role?: string }) => message.role === "system")
        .map((message: { content?: string }) => String(message.content || "")),
    );
    expect(systemText).toContain("Truth-safe categorySummary:");
    expect(systemText).toContain("categoryScope: groceries");
    expect(systemText).not.toContain("Truth-safe transactionFacts:");
  });

  it("normaliseert placeholder categoryScope 'slug' naar turn-inferred categorie", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "slug",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-category-placeholder-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-category-placeholder-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "insights",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "insights",
        monthLabel: "maart 2026",
        hasForecastData: true,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "Hoeveel heb ik aan boodschappen uitgegeven deze maand?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("categoryScope: groceries");
    expect(systemText).toContain('"category":"groceries"');
    expect(systemText).not.toContain(
      "categorie_scope_niet_gevonden_in_geaggregeerde_data",
    );
  });

  it("matcht categoryScope tegen categoryKey/label als category.key geen semantische slug is", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      currentBalance: { balance: 1000, date: "2026-03-20" },
      spending: {
        currentMonthTotal: 300,
        currentWeekTotal: 80,
        currentMonthBreakdown: {
          total: 300,
          transactionCount: 4,
          categories: [
            {
              key: "cat_123_uuid",
              categoryId: "cat_123_uuid",
              categoryKey: "groceries_household",
              label: "Boodschappen & huishouden",
              amount: 300,
              transactionCount: 4,
              subcategories: [
                {
                  key: "leaf_1",
                  categoryId: "leaf_1",
                  categoryKey: "supermarket",
                  label: "Supermarkt",
                  amount: 300,
                  transactionCount: 4,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 80,
          transactionCount: 1,
          categories: [],
        },
      },
      budget: {
        remainingVariableBudget: 100,
        spentVariableBudget: 300,
        totalVariableBudget: 400,
        monthStatusLabel: "LET OP",
        monthRiskTone: "watch",
        weekRemainingBudget: 20,
        weekStatusLabel: "Op koers",
        weekRiskTone: "good",
        weekTempoDelta: 0,
      },
      trend: {
        monthStatusLabel: "LET OP",
        monthRiskTone: "watch",
        weekStatusLabel: "Op koers",
        weekRiskTone: "good",
        weekTempoDelta: 0,
        monthProgress: 0.6,
      },
      budgetPlan: {
        monthlyBudgetTotal: 1000,
        weeklyBudgetTotal: 250,
        fixedCostsBudget: 400,
        subscriptionsBudget: 100,
        variableBudget: 500,
        variableSubcategoriesBudgetTotal: 500,
        appliedSavingsTarget: 0,
        currentWeekBudget: 120,
        currentWeekActual: 80,
        currentWeekRemaining: 40,
        subtotalAfterFixed: 600,
        subtotalAfterSubscriptions: 500,
        variableCategoryBudgets: [],
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: true,
        expectedEndBalance: 700,
        lowestExpectedBalance: 600,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: 0,
        forecastReferenceDate: "2026-03-20",
      },
      forecastNextMonth: {
        hasData: true,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: 700,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: "2026-03-20",
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 10,
          variableBudgetTotal: 500,
          variableSpent: 300,
          variableRemaining: 200,
          monthBudgetStatus: "watch",
          monthBudgetStatusLabel: "LET OP",
          weekBudgetRemaining: 20,
          weekBudgetStatus: "on_track",
          weekTempoSignal: "on_tempo",
        },
        cashflowSafety: {
          currentBalance: 1000,
          extraSpaceUntilNextIncome: 300,
          extraSpaceLabel: "Extra ruimte tot salaris",
          nextIncomeDate: "2026-03-28",
          nextIncomeAmount: 1000,
          nextIncomeAmountMeta: {
            isAvailable: true,
            isCanonical: true,
            isDerived: false,
            isFallback: false,
            source: "income_source",
            dataGapReason: null,
          },
          daysUntilNextIncome: 8,
          expectedEndBalance: 700,
          lowestProjectedBalance: 600,
          knownUpcomingFixedCosts: 0,
          expectedFixedAndSubscriptions: 0,
          forecastReliability: "medium",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          budgetPressure: "medium",
          cashSafety: "medium",
          purchaseFlexibility: "medium",
          shortReason: "",
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

    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "groceries",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-category-key-match-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-category-key-match-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
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
        "hoeveel heb ik aan boodschappen uitgegeven deze maand?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Truth-safe categorySummary:");
    expect(systemText).toContain('"category":"groceries_household"');
    expect(systemText).not.toContain(
      "categorie_scope_niet_gevonden_in_geaggregeerde_data",
    );
  });

  it("leidt autoscope via de globale categoriecatalogus af naar auto_transport", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-auto-unknown-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-auto-unknown-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Kun je dat specificeren?" } }],
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
        "hoeveel heb ik aan mijn auto uitgegeven deze maand?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("categoryScope=auto_transport");
    expect(systemText).toContain("availableCategoryScopes");
    expect(systemText).toContain('"slug":"auto_transport"');
    expect(systemText).toContain('"slug":"fuel"');
  });

  it("overschrijft een verkeerde concrete planner-scope bij een sterke parent-labelmatch zoals roken", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      spending: {
        currentMonthTotal: 438,
        currentWeekTotal: 120,
        currentMonthBreakdown: {
          total: 438,
          transactionCount: 8,
          categories: [
            {
              key: "smoking",
              categoryKey: "smoking",
              label: "Roken",
              amount: 438,
              transactionCount: 8,
              subcategories: [
                {
                  key: "smoking_cigarettes",
                  categoryKey: "smoking_cigarettes",
                  label: "Sigaretten",
                  amount: 375,
                  transactionCount: 6,
                },
                {
                  key: "smoking_tobacco",
                  categoryKey: "smoking_tobacco",
                  label: "Tabak",
                  amount: 63,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 120,
          transactionCount: 2,
          categories: [],
        },
      },
      budgetPlan: {
        monthlyBudgetTotal: 0,
        weeklyBudgetTotal: 0,
        fixedCostsBudget: 0,
        subscriptionsBudget: 0,
        variableBudget: 0,
        variableSubcategoriesBudgetTotal: 0,
        appliedSavingsTarget: 0,
        currentWeekBudget: 0,
        currentWeekActual: 0,
        currentWeekRemaining: 0,
        subtotalAfterFixed: 0,
        subtotalAfterSubscriptions: 0,
        variableCategoryBudgets: [],
      },
      budget: {
        remainingVariableBudget: 0,
        spentVariableBudget: 0,
        totalVariableBudget: 0,
        monthStatusLabel: null,
        monthRiskTone: null,
        weekRemainingBudget: 0,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: false,
        expectedEndBalance: null,
        lowestExpectedBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: null,
        forecastReferenceDate: null,
      },
      forecastNextMonth: {
        hasData: false,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: null,
      },
      currentBalance: {
        balance: null,
        date: null,
      },
      trend: {
        monthStatusLabel: null,
        monthRiskTone: null,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
        monthProgress: 0,
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 0,
          variableBudgetTotal: null,
          variableSpent: null,
          variableRemaining: null,
          monthBudgetStatus: "unknown",
          monthBudgetStatusLabel: null,
          weekBudgetRemaining: null,
          weekBudgetStatus: "unknown",
          weekTempoSignal: "unknown",
        },
        cashflowSafety: {
          currentBalance: null,
          extraSpaceUntilNextIncome: null,
          extraSpaceLabel: "",
          nextIncomeDate: null,
          nextIncomeAmount: null,
          nextIncomeAmountMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "eval",
            dataGapReason: "nvt",
          },
          daysUntilNextIncome: null,
          expectedEndBalance: null,
          lowestProjectedBalance: null,
          knownUpcomingFixedCosts: null,
          expectedFixedAndSubscriptions: null,
          forecastReliability: "low",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          confidence: "low",
          guidance: [],
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 0,
        hasBudgetSignals: false,
        hasPlanningSignals: false,
        hasForecastSignals: false,
        hasBalanceSignals: false,
        hasSpendingSignals: true,
        hasCategorySignals: true,
        confidence: "medium",
        dataGaps: [],
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      { slug: "smoking", label: "Roken", source: "catalog" },
      { slug: "smoking_cigarettes", label: "Roken > Sigaretten", source: "catalog" },
      { slug: "smoking_tobacco", label: "Roken > Tabak", source: "catalog" },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "smoking_cigarettes",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-smoking-parent-match-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-smoking-parent-match-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Antwoord klaar." } }],
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
      thread: createThreadWithUserMessage("hoeveel heb ik deze maand aan roken uitgegeven?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("categoryScope=smoking");
    expect(systemText).toContain('"category":"smoking"');
  });

  it("overschrijft een verkeerde concrete planner-scope bij een sterke full-labelmatch zoals boodschappen en huishouden", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      spending: {
        currentMonthTotal: 282,
        currentWeekTotal: 90,
        currentMonthBreakdown: {
          total: 282,
          transactionCount: 6,
          categories: [
            {
              key: "groceries_household",
              categoryKey: "groceries_household",
              label: "Boodschappen & huishouden",
              amount: 282,
              transactionCount: 6,
              subcategories: [
                {
                  key: "groceries_household_supermarket",
                  categoryKey: "groceries_household_supermarket",
                  label: "Supermarkt",
                  amount: 240,
                  transactionCount: 5,
                },
                {
                  key: "groceries_household_household_items",
                  categoryKey: "groceries_household_household_items",
                  label: "Huishoudelijke artikelen",
                  amount: 42,
                  transactionCount: 1,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 90,
          transactionCount: 2,
          categories: [],
        },
      },
      budgetPlan: {
        monthlyBudgetTotal: 0,
        weeklyBudgetTotal: 0,
        fixedCostsBudget: 0,
        subscriptionsBudget: 0,
        variableBudget: 0,
        variableSubcategoriesBudgetTotal: 0,
        appliedSavingsTarget: 0,
        currentWeekBudget: 0,
        currentWeekActual: 0,
        currentWeekRemaining: 0,
        subtotalAfterFixed: 0,
        subtotalAfterSubscriptions: 0,
        variableCategoryBudgets: [],
      },
      budget: {
        remainingVariableBudget: 0,
        spentVariableBudget: 0,
        totalVariableBudget: 0,
        monthStatusLabel: null,
        monthRiskTone: null,
        weekRemainingBudget: 0,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: false,
        expectedEndBalance: null,
        lowestExpectedBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: null,
        forecastReferenceDate: null,
      },
      forecastNextMonth: {
        hasData: false,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: null,
      },
      currentBalance: {
        balance: null,
        date: null,
      },
      trend: {
        monthStatusLabel: null,
        monthRiskTone: null,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
        monthProgress: 0,
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 0,
          variableBudgetTotal: null,
          variableSpent: null,
          variableRemaining: null,
          monthBudgetStatus: "unknown",
          monthBudgetStatusLabel: null,
          weekBudgetRemaining: null,
          weekBudgetStatus: "unknown",
          weekTempoSignal: "unknown",
        },
        cashflowSafety: {
          currentBalance: null,
          extraSpaceUntilNextIncome: null,
          extraSpaceLabel: "",
          nextIncomeDate: null,
          nextIncomeAmount: null,
          nextIncomeAmountMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "eval",
            dataGapReason: "nvt",
          },
          daysUntilNextIncome: null,
          expectedEndBalance: null,
          lowestProjectedBalance: null,
          knownUpcomingFixedCosts: null,
          expectedFixedAndSubscriptions: null,
          forecastReliability: "low",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          confidence: "low",
          guidance: [],
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 0,
        hasBudgetSignals: false,
        hasPlanningSignals: false,
        hasForecastSignals: false,
        hasBalanceSignals: false,
        hasSpendingSignals: true,
        hasCategorySignals: true,
        confidence: "medium",
        dataGaps: [],
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      { slug: "groceries_household", label: "Boodschappen & huishouden", source: "catalog" },
      { slug: "shopping_goods", label: "Aankopen & spullen", source: "catalog" },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "shopping_goods",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-groceries-household-full-label-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-groceries-household-full-label-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Antwoord klaar." } }],
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
        "hoeveel heb ik deze maand aan boodschappen & huishouden uitgegeven?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("categoryScope=groceries_household");
    expect(systemText).toContain('"category":"groceries_household"');
    expect(systemText).not.toContain('"category":"shopping_goods"');
  });

  it("promoveert transaction category-total vragen naar category_insight zodat ze niet in transactionFacts vastlopen", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      currentBalance: { balance: null, date: null },
      spending: {
        currentMonthTotal: 438,
        currentWeekTotal: 120,
        currentMonthBreakdown: {
          total: 438,
          transactionCount: 8,
          categories: [
            {
              key: "smoking",
              categoryKey: "smoking",
              label: "Roken",
              amount: 438,
              transactionCount: 8,
              subcategories: [
                {
                  key: "smoking_cigarettes",
                  categoryKey: "smoking_cigarettes",
                  label: "Sigaretten",
                  amount: 375,
                  transactionCount: 6,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 120,
          transactionCount: 2,
          categories: [],
        },
      },
      budget: {
        remainingVariableBudget: 0,
        spentVariableBudget: 0,
        totalVariableBudget: 0,
        monthStatusLabel: null,
        monthRiskTone: null,
        weekRemainingBudget: 0,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
      },
      trend: {
        monthStatusLabel: null,
        monthRiskTone: null,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
        monthProgress: 0,
      },
      budgetPlan: {
        monthlyBudgetTotal: 0,
        weeklyBudgetTotal: 0,
        fixedCostsBudget: 0,
        subscriptionsBudget: 0,
        variableBudget: 0,
        variableSubcategoriesBudgetTotal: 0,
        appliedSavingsTarget: 0,
        currentWeekBudget: 0,
        currentWeekActual: 0,
        currentWeekRemaining: 0,
        subtotalAfterFixed: 0,
        subtotalAfterSubscriptions: 0,
        variableCategoryBudgets: [],
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: false,
        expectedEndBalance: null,
        lowestExpectedBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: null,
        forecastReferenceDate: null,
      },
      forecastNextMonth: {
        hasData: false,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: null,
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 0,
          variableBudgetTotal: null,
          variableSpent: null,
          variableRemaining: null,
          monthBudgetStatus: "unknown",
          monthBudgetStatusLabel: null,
          weekBudgetRemaining: null,
          weekBudgetStatus: "unknown",
          weekTempoSignal: "unknown",
        },
        cashflowSafety: {
          currentBalance: null,
          extraSpaceUntilNextIncome: null,
          extraSpaceLabel: "",
          nextIncomeDate: null,
          nextIncomeAmount: null,
          nextIncomeAmountMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "eval",
            dataGapReason: "nvt",
          },
          daysUntilNextIncome: null,
          expectedEndBalance: null,
          lowestProjectedBalance: null,
          knownUpcomingFixedCosts: null,
          expectedFixedAndSubscriptions: null,
          forecastReliability: "low",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          confidence: "low",
          guidance: [],
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 0,
        hasBudgetSignals: false,
        hasPlanningSignals: false,
        hasForecastSignals: false,
        hasBalanceSignals: false,
        hasSpendingSignals: true,
        hasCategorySignals: true,
        confidence: "medium",
        dataGaps: [],
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      { slug: "smoking", label: "Roken", source: "catalog" },
      { slug: "smoking_cigarettes", label: "Roken > Sigaretten", source: "catalog" },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "smoking_cigarettes",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-transaction-category-total-promote-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-transaction-category-total-promote-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Antwoord klaar." } }],
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
      thread: createThreadWithUserMessage("wat ben ik kwijt aan roken?"),
    });

    expect(postOpenAIChatCompletionMock.mock.calls[1]?.[1]?.useCase).toBe(
      "help_category_insight",
    );
    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Kanaal: category_insight");
    expect(systemText).toContain("scopedCategoryTotal");
  });

  it("corrigeert merchant-total plannerfouten naar category_insight bij een sterke categorie-match zonder merchant-framing", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-02",
        label: "februari 2026",
        startIso: "2026-02-01",
        endIsoExclusive: "2026-03-01",
        referenceDateIso: "2026-02-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      currentBalance: { balance: null, date: null },
      spending: {
        currentMonthTotal: 435,
        currentWeekTotal: 120,
        currentMonthBreakdown: {
          total: 435,
          transactionCount: 14,
          categories: [
            {
              key: "smoking",
              categoryKey: "smoking",
              label: "Roken",
              amount: 435,
              transactionCount: 14,
              subcategories: [
                {
                  key: "smoking_cigarettes",
                  categoryKey: "smoking_cigarettes",
                  label: "Sigaretten",
                  amount: 60,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 120,
          transactionCount: 2,
          categories: [],
        },
      },
      budget: {
        remainingVariableBudget: 0,
        spentVariableBudget: 0,
        totalVariableBudget: 0,
        monthStatusLabel: null,
        monthRiskTone: null,
        weekRemainingBudget: 0,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
      },
      trend: {
        monthStatusLabel: null,
        monthRiskTone: null,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
        monthProgress: 0,
      },
      budgetPlan: {
        monthlyBudgetTotal: 0,
        weeklyBudgetTotal: 0,
        fixedCostsBudget: 0,
        subscriptionsBudget: 0,
        variableBudget: 0,
        variableSubcategoriesBudgetTotal: 0,
        appliedSavingsTarget: 0,
        currentWeekBudget: 0,
        currentWeekActual: 0,
        currentWeekRemaining: 0,
        subtotalAfterFixed: 0,
        subtotalAfterSubscriptions: 0,
        variableCategoryBudgets: [],
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: false,
        expectedEndBalance: null,
        lowestExpectedBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: null,
        forecastReferenceDate: null,
      },
      forecastNextMonth: {
        hasData: false,
        monthKey: "2026-03",
        monthLabel: "maart 2026",
        expectedEndBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: null,
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "februari 2026",
          daysRemainingInMonth: 0,
          variableBudgetTotal: null,
          variableSpent: null,
          variableRemaining: null,
          monthBudgetStatus: "unknown",
          monthBudgetStatusLabel: null,
          weekBudgetRemaining: null,
          weekBudgetStatus: "unknown",
          weekTempoSignal: "unknown",
        },
        cashflowSafety: {
          currentBalance: null,
          extraSpaceUntilNextIncome: null,
          extraSpaceLabel: "",
          nextIncomeDate: null,
          nextIncomeAmount: null,
          nextIncomeAmountMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "eval",
            dataGapReason: "nvt",
          },
          daysUntilNextIncome: null,
          expectedEndBalance: null,
          lowestProjectedBalance: null,
          knownUpcomingFixedCosts: null,
          expectedFixedAndSubscriptions: null,
          forecastReliability: "low",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          confidence: "low",
          guidance: [],
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-02-20T12:00:00.000Z",
        cacheTtlMs: 0,
        hasBudgetSignals: false,
        hasPlanningSignals: false,
        hasForecastSignals: false,
        hasBalanceSignals: false,
        hasSpendingSignals: true,
        hasCategorySignals: true,
        confidence: "medium",
        dataGaps: [],
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      { slug: "smoking", label: "Roken", source: "catalog" },
      { slug: "smoking_cigarettes", label: "Roken > Sigaretten", source: "catalog" },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "previous",
            categoryScope: "none",
            merchantScope: "roken",
            transactionQuestionType: "merchant_total",
          },
          useScreenContext: false,
        },
        "planner-smoking-merchant-misroute-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-smoking-merchant-misroute-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Antwoord klaar." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "insights",
      selectedPeriod: { label: "februari 2026" },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("wat ging er vorige maand naar roken?"),
    });

    expect(postOpenAIChatCompletionMock.mock.calls[1]?.[1]?.useCase).toBe(
      "help_category_insight",
    );
    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Planner-route: category_insight");
    expect(systemText).toContain("categoryScope=smoking");
    expect(systemText).not.toContain("merchantScope=roken");
  });

  it("kiest de fallbackplanner als een niet-expliciete merchant-lookup eigenlijk een categorie blijkt", async () => {
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      {
        slug: "housing_central_heating_rental",
        label: "Wonen > CV installatie huur",
        source: "catalog",
      },
    ]);
    resolveSafeCategoryBreakdownInRangeMock.mockResolvedValueOnce({
      total: 540,
      transactionCount: 4,
      categories: [
        {
          key: "housing",
          categoryId: "cat-housing",
          categoryKey: "housing",
          label: "Wonen",
          amount: 540,
          transactionCount: 4,
          subcategories: [
            {
              key: "housing_central_heating_rental",
              categoryId: "cat-housing-cv-rental",
              categoryKey: "housing_central_heating_rental",
              label: "CV installatie huur",
              amount: 66,
              transactionCount: 1,
            },
          ],
        },
      ],
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "unknown",
            merchantScope: "cv_installatie_huur",
            transactionQuestionType: "merchant_total",
          },
          useScreenContext: false,
        },
        "planner-cv-rental-misroute-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-cv-rental-misroute-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Antwoord klaar." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "insights",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage("wat heb ik uitgegeven aan cv installatie huur?"),
    });

    expect(postOpenAIChatCompletionMock.mock.calls[1]?.[1]?.useCase).toBe(
      "help_category_insight",
    );
    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Planner-route: category_insight");
    expect(systemText).toContain("categoryScope=housing_central_heating_rental");
    expect(systemText).not.toContain("merchantScope=cv_installatie_huur");
  });

  it("forceert truth-safe merchant lookup feiten in het eindantwoord als hydration ze al heeft", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      currentBalance: { balance: null, date: null },
      spending: {
        currentMonthTotal: 438,
        currentWeekTotal: 120,
        currentMonthBreakdown: {
          total: 438,
          transactionCount: 8,
          categories: [],
        },
        currentWeekBreakdown: {
          total: 120,
          transactionCount: 2,
          categories: [],
        },
      },
      budget: {
        remainingVariableBudget: 0,
        spentVariableBudget: 0,
        totalVariableBudget: 0,
        monthStatusLabel: null,
        monthRiskTone: null,
        weekRemainingBudget: 0,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
      },
      trend: {
        monthStatusLabel: null,
        monthRiskTone: null,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
        monthProgress: 0,
      },
      budgetPlan: {
        monthlyBudgetTotal: 0,
        weeklyBudgetTotal: 0,
        fixedCostsBudget: 0,
        subscriptionsBudget: 0,
        variableBudget: 0,
        variableSubcategoriesBudgetTotal: 0,
        appliedSavingsTarget: 0,
        currentWeekBudget: 0,
        currentWeekActual: 0,
        currentWeekRemaining: 0,
        subtotalAfterFixed: 0,
        subtotalAfterSubscriptions: 0,
        variableCategoryBudgets: [],
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: false,
        expectedEndBalance: null,
        lowestExpectedBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: null,
        forecastReferenceDate: null,
      },
      forecastNextMonth: {
        hasData: false,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: null,
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 0,
          variableBudgetTotal: null,
          variableSpent: null,
          variableRemaining: null,
          monthBudgetStatus: "unknown",
          monthBudgetStatusLabel: null,
          weekBudgetRemaining: null,
          weekBudgetStatus: "unknown",
          weekTempoSignal: "unknown",
        },
        cashflowSafety: {
          currentBalance: null,
          extraSpaceUntilNextIncome: null,
          extraSpaceLabel: "",
          nextIncomeDate: null,
          nextIncomeAmount: null,
          nextIncomeAmountMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "eval",
            dataGapReason: "nvt",
          },
          daysUntilNextIncome: null,
          expectedEndBalance: null,
          lowestProjectedBalance: null,
          knownUpcomingFixedCosts: null,
          expectedFixedAndSubscriptions: null,
          forecastReliability: "low",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          confidence: "low",
          guidance: [],
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 0,
        hasBudgetSignals: false,
        hasPlanningSignals: false,
        hasForecastSignals: false,
        hasBalanceSignals: false,
        hasSpendingSignals: true,
        hasCategorySignals: false,
        confidence: "medium",
        dataGaps: [],
      },
    });
    resolveSafeMerchantAggregatesInRangeMock.mockResolvedValueOnce([
      {
        merchantKey: "jumbo_odink",
        merchantLabel: "JUMBO ODINK",
        total: 92,
        transactionCount: 3,
      },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "jumbo_odink",
            transactionQuestionType: "merchant_total",
          },
          useScreenContext: false,
        },
        "planner-merchant-total-force-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-merchant-total-force-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Ik zie hier wel wat transacties." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
    });

    const response = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("hoeveel gaf ik deze maand uit bij JUMBO ODINK?"),
    });

    expect(response.answerText).toContain("JUMBO ODINK");
    expect(response.answerText).toContain("€ 92");
  });

  it("matcht merchant totals ook als de planner underscores gebruikt en aggregates spaties hebben", async () => {
    resolveSafeMerchantAggregatesInRangeMock.mockResolvedValueOnce([
      {
        merchantKey: "tabaksp wittesteijn",
        merchantLabel: "Tabaksp. Wittesteijn",
        total: 375,
        transactionCount: 13,
      },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "tabaksp_wittesteijn",
            transactionQuestionType: "merchant_total",
          },
          useScreenContext: false,
        },
        "planner-merchant-space-key-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-merchant-space-key-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Ik zie hier wel wat transacties." } }],
        }),
    });

    const response = await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "transactions",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage(
        "hoeveel gaf ik deze maand uit bij Tabaksp. Wittesteijn?",
      ),
    });

    expect(response.answerText).toBe(
      "In maart 2026 heb je € 375 uitgegeven bij Tabaksp. Wittesteijn.",
    );
  });

  it("matcht merchant frequentie truth-safe ook bij genormaliseerde merchant-keys", async () => {
    resolveSafeMerchantAggregatesInRangeMock.mockResolvedValueOnce([
      {
        merchantKey: "paypal europe s a r l et cie s c a",
        merchantLabel: "PayPal Europe S.a.r.l. et Cie S.C.A",
        total: 83.14,
        transactionCount: 10,
      },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "paypal_europe_s_a_r_l_et_cie_s_c_a",
            transactionQuestionType: "merchant_frequency",
          },
          useScreenContext: false,
        },
        "planner-merchant-frequency-space-key-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-merchant-frequency-space-key-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Nog onduidelijk." } }],
        }),
    });

    const response = await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "transactions",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage(
        "hoe vaak betaal ik bij PayPal Europe S.a.r.l. et Cie S.C.A deze maand?",
      ),
    });

    expect(response.answerText).toBe(
      "In maart 2026 heb je 10 betalingen gedaan bij PayPal Europe S.a.r.l. et Cie S.C.A.",
    );
  });

  it("negeert synthetische parent-als-subcategorie entries zodat parent totals truth-safe blijven", async () => {
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      period: {
        key: "2026-03",
        label: "maart 2026",
        startIso: "2026-03-01",
        endIsoExclusive: "2026-04-01",
        referenceDateIso: "2026-03-20T12:00:00.000Z",
        usedFallbackPeriod: false,
      },
      currentBalance: { balance: null, date: null },
      spending: {
        currentMonthTotal: 438,
        currentWeekTotal: 120,
        currentMonthBreakdown: {
          total: 438,
          transactionCount: 15,
          categories: [
            {
              key: "smoking",
              categoryKey: "smoking",
              label: "Roken",
              amount: 438,
              transactionCount: 15,
              subcategories: [
                {
                  key: "smoking",
                  categoryKey: "smoking",
                  label: "Roken",
                  amount: 375,
                  transactionCount: 13,
                },
                {
                  key: "smoking_cigarettes",
                  categoryKey: "smoking_cigarettes",
                  label: "Sigaretten",
                  amount: 63,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
        currentWeekBreakdown: {
          total: 120,
          transactionCount: 2,
          categories: [],
        },
      },
      budget: {
        remainingVariableBudget: 0,
        spentVariableBudget: 0,
        totalVariableBudget: 0,
        monthStatusLabel: null,
        monthRiskTone: null,
        weekRemainingBudget: 0,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
      },
      trend: {
        monthStatusLabel: null,
        monthRiskTone: null,
        weekStatusLabel: null,
        weekRiskTone: null,
        weekTempoDelta: 0,
        monthProgress: 0,
      },
      budgetPlan: {
        monthlyBudgetTotal: 0,
        weeklyBudgetTotal: 0,
        fixedCostsBudget: 0,
        subscriptionsBudget: 0,
        variableBudget: 0,
        variableSubcategoriesBudgetTotal: 0,
        appliedSavingsTarget: 0,
        currentWeekBudget: 0,
        currentWeekActual: 0,
        currentWeekRemaining: 0,
        subtotalAfterFixed: 0,
        subtotalAfterSubscriptions: 0,
        variableCategoryBudgets: [],
      },
      planning: {
        upcomingCommittedExpenseTotal: 0,
        upcomingCommittedIncomeTotal: 0,
        expectedFixedCosts: 0,
        expectedSubscriptions: 0,
        remainingPlannedExpenseTotal: 0,
        remainingVariableExpenseEstimate: 0,
      },
      forecastCurrentMonth: {
        hasData: false,
        expectedEndBalance: null,
        lowestExpectedBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        remainingMonthNetTotal: null,
        forecastReferenceDate: null,
      },
      forecastNextMonth: {
        hasData: false,
        monthKey: "2026-04",
        monthLabel: "april 2026",
        expectedEndBalance: null,
        riskFlag: "none",
        cashRiskFlag: "none",
        forecastReferenceDate: null,
      },
      spendingAdvice: {
        monthBudget: {
          monthLabel: "maart 2026",
          daysRemainingInMonth: 0,
          variableBudgetTotal: null,
          variableSpent: null,
          variableRemaining: null,
          monthBudgetStatus: "unknown",
          monthBudgetStatusLabel: null,
          weekBudgetRemaining: null,
          weekBudgetStatus: "unknown",
          weekTempoSignal: "unknown",
        },
        cashflowSafety: {
          currentBalance: null,
          extraSpaceUntilNextIncome: null,
          extraSpaceLabel: "",
          nextIncomeDate: null,
          nextIncomeAmount: null,
          nextIncomeAmountMeta: {
            isAvailable: false,
            isCanonical: false,
            isDerived: false,
            isFallback: false,
            source: "eval",
            dataGapReason: "nvt",
          },
          daysUntilNextIncome: null,
          expectedEndBalance: null,
          lowestProjectedBalance: null,
          knownUpcomingFixedCosts: null,
          expectedFixedAndSubscriptions: null,
          forecastReliability: "low",
        },
        categoryStatus: null,
        assistantAdviceSignals: {
          confidence: "low",
          guidance: [],
        },
      },
      quality: {
        cacheHit: false,
        fetchedAtIso: "2026-03-20T12:00:00.000Z",
        cacheTtlMs: 0,
        hasBudgetSignals: false,
        hasPlanningSignals: false,
        hasForecastSignals: false,
        hasBalanceSignals: false,
        hasSpendingSignals: true,
        hasCategorySignals: true,
        confidence: "medium",
        dataGaps: [],
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      { slug: "smoking", label: "Roken", source: "catalog" },
      { slug: "smoking_cigarettes", label: "Roken > Sigaretten", source: "catalog" },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "smoking",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-smoking-parent-total-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-smoking-parent-total-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "In maart 2026 heb je €375 uitgegeven aan de categorie Roken." } }],
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

    const response = await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("hoeveel heb ik deze maand aan roken uitgegeven?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- scopedCategoryGranularity: category");
    expect(systemText).toContain("- scopedCategoryTotal: € 438");
    expect(systemText).not.toContain("\"label\":\"Roken\",\"total\":\"€ 375\"");
    expect(response.answerText).toContain("€ 438");
  });

  it("continueert actieve category flow op korte scope-refinement replies", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "general",
          mode: "general_help",
          confidence: "medium",
          continueActiveFlow: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "none",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-category-followup-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-category-followup-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
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
      thread: createThreadWithUserMessage("brandstof?"),
      activeFlow: {
        route: "category_insight",
        mode: "category_summary",
        status: "collecting",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Planner-route: category_insight");
    expect(systemText).toContain("categoryScope=fuel");
  });

  it("leidt brandstof-vraag af via beschikbare categoriecatalogus zonder hardcoded boodschappenlogica", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-fuel-catalog-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-fuel-catalog-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
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
      thread: createThreadWithUserMessage("brandstof?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("- categoryScope: fuel");
    expect(systemText).toContain("Truth-safe categorySummary:");
  });

  it("zet category_total vragen om naar expliciete scopedCategoryTotal facts", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "auto_transport",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-auto-total-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-auto-total-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
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
        "hoeveel heb ik aan mijn auto uitgegeven deze maand?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("scopedCategoryTotal:");
    expect(systemText).toContain("Als `scopedCategoryTotal` beschikbaar is");
  });

  it("markeert vorige maand als niet-volledig-gehydrateerd zonder foutieve maandclaims", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "none",
            categoryScope: "fuel",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-prev-month-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-prev-month-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Samenvatting klaar." } }],
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
      thread: createThreadWithUserMessage("hoeveel aan brandstof vorige maand?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("- monthScope: previous");
    expect(systemText).toContain("month_scope_niet_volledig_gehydrateerd");
  });

  it("houdt jaar/trend vragen truth-safe beperkt zonder verplichte verduidelijkingsprompt", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "none",
            categoryScope: "unknown",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-year-trend-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-year-trend-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Kun je specifieker zijn?" } }],
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
      thread: createThreadWithUserMessage("wat is de trend dit jaar voor auto?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("jaar_scope_nog_niet_volledig_gehydrateerd");
    expect(
      systemText.includes("jaar_scope_nog_niet_volledig_gehydrateerd") ||
        systemText.includes("trend_scope_nog_niet_volledig_gehydrateerd"),
    ).toBe(true);
  });

  it("houdt budgetvragen op spending pad met maandbudget-context", async () => {
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
            categorySummary: false,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "none",
          },
          useScreenContext: false,
        },
        "planner-budget-status-1",
      ),
    );
    postHelpAssistantSpendingAdviceCompletionMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-budget-status-1",
          model: "gpt-4.1-mini",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  conclusion: "Je zit nog binnen je budget.",
                  why: "Je maandruimte is nog positief.",
                  risk: "Houd je uitgavenritme in de gaten.",
                  nextStep: "Check je grote uitgaven vooruit.",
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
      thread: createThreadWithUserMessage("ben ik over budget deze maand?"),
    });

    expect(postHelpAssistantSpendingAdviceCompletionMock).toHaveBeenCalledTimes(1);
    const spendingRequest =
      postHelpAssistantSpendingAdviceCompletionMock.mock.calls[0]?.[0]
        ?.openAIRequest;
    const systemText = (spendingRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Spending-context:");
    expect(systemText).toContain("Maandbudget:");
  });

  it("normaliseert ongeldige dataRequests veilig en houdt specified maand truth-safe", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "medium",
          needsClarification: false,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "specified",
            categoryScope: "??",
            merchantScope: "JUMBO BV",
            transactionQuestionType: "merchant_total",
          },
          useScreenContext: false,
        },
        "planner-invalid-datareq-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-invalid-datareq-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Ik heb aanvullende details nodig." } }],
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
      thread: createThreadWithUserMessage("Hoeveel gaf ik uit bij Jumbo?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("monthScope=current");
    expect(systemText).toContain("merchantScope=jumbo_bv");
    expect(systemText).toContain("Planner vraagt verduidelijking");
    expect(systemText).toContain("Hydration-beperkingen:");
    expect(systemText).toContain(
      "merchant_match_onvoldoende_zeker",
    );
  });

  it("houdt transactionFacts privacy-safe en geeft alleen aggregaatbehoefte door", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "jumbo",
            transactionQuestionType: "merchant_frequency",
          },
          useScreenContext: false,
        },
        "planner-tx-privacy-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-tx-privacy-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Ik kan dit beperkt samenvatten." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "transactions",
        activeFilterCount: 1,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage(
        "Hoe vaak betaal ik bij Jumbo deze maand?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");
    expect(systemText).toContain("Truth-safe transactionFacts:");
    expect(systemText).toContain('"merchantScope":"jumbo"');
    expect(systemText).toContain('"answerability":"partial"');
    expect(systemText).toContain(
      "merchant_match_onvoldoende_zeker",
    );
    expect(systemText).not.toContain("transactionId");
  });

  it("geeft merchant total truth-safe door als geaggregeerde merchantdata beschikbaar is", async () => {
    resolveSafeMerchantAggregatesInRangeMock.mockResolvedValueOnce([
      {
        merchantKey: "jumbo",
        merchantLabel: "Jumbo",
        total: 135,
        transactionCount: 4,
      },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "transactions_insight",
          mode: "transaction_lookup",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: false,
            transactionFacts: true,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "jumbo",
            transactionQuestionType: "merchant_total",
          },
          useScreenContext: false,
        },
        "planner-merchant-answerable-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-merchant-answerable-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Je hebt € 135 bij Jumbo uitgegeven." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "transactions",
        activeFilterCount: 1,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("Hoeveel gaf ik uit bij Jumbo deze maand?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain('"merchantTotal":"€ 135"');
    expect(systemText).toContain('"merchantTransactionCount":4');
    expect(systemText).toContain('"answerability":"answerable"');
  });

  it("geeft category trend truth-safe door met vergelijking naar vorige maand", async () => {
    resolveSafeCategoryBreakdownInRangeMock.mockResolvedValueOnce({
      total: 120,
      transactionCount: 2,
      categories: [
        {
          key: "groceries",
          categoryId: "cat-groceries",
          categoryKey: "groceries",
          label: "Boodschappen",
          amount: 120,
          transactionCount: 2,
          subcategories: [],
        },
      ],
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: true,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "groceries",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-trend-answerable-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-trend-answerable-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Trend samenvatting." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "dashboard",
      selectedPeriod: { key: "2026-03", label: "maart 2026" },
      screenContext: {
        kind: "budget",
        monthLabel: "maart 2026",
        hasForecastData: true,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("wat is de trend voor boodschappen?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("previousScopedCategoryTotal: € 120");
    expect(systemText).toContain("trendDirection: up");
    expect(systemText).toContain("trend_scope_beperkt_tot_maandvergelijking");
  });

  it("geeft jaar-totalen truth-safe door voor category_insight", async () => {
    resolveSafeCategoryBreakdownInRangeMock.mockResolvedValueOnce({
      total: 680,
      transactionCount: 14,
      categories: [
        {
          key: "groceries",
          categoryId: "cat-groceries",
          categoryKey: "groceries",
          label: "Boodschappen",
          amount: 680,
          transactionCount: 14,
          subcategories: [],
        },
      ],
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          needsClarification: true,
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "groceries",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-year-answerable-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-year-answerable-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Jaar samenvatting." } }],
        }),
    });

    const context = buildHelpAssistantContext({
      screenId: "dashboard",
      selectedPeriod: { key: "2026-03", label: "maart 2026" },
      screenContext: {
        kind: "budget",
        monthLabel: "maart 2026",
        hasForecastData: true,
      },
    });

    await requestHelpAssistantReply({
      context,
      thread: createThreadWithUserMessage("hoeveel heb ik dit jaar aan boodschappen uitgegeven?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("yearToDateCategoryTotal: € 680");
    expect(systemText).toContain(
      "jaar_scope_beperkt_tot_jaartotaal_tot_geselecteerde_maand",
    );
  });

  it("geeft generieke activeFlow terug voor vervolgturns buiten issue-intake", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "auto_transport",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-active-flow-category-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-active-flow-category-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Je hebt € 444 uitgegeven." } }],
        }),
    });

    const result = await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage(
        "hoeveel heb ik aan mijn auto uitgegeven deze maand?",
      ),
    });

    expect(result.activeFlow).toEqual({
      route: "category_insight",
      mode: "category_summary",
      status: "active",
      anchorMessageId: "user-1",
      reason: "assistant_last_routed_turn",
    });
  });

  it("geeft voor subcategorie-scope het subcategoriebedrag door en niet het parent-totaal", async () => {
    const baseContext = await resolveUnifiedFinancialAdviceContextMock();
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      ...baseContext,
      spending: {
        ...baseContext.spending,
        currentMonthBreakdown: {
          total: 1264,
          transactionCount: 18,
          categories: [
            ...baseContext.spending.currentMonthBreakdown.categories,
            {
              key: "auto_transport",
              categoryKey: "auto_transport",
              label: "Auto & Transport",
              amount: 444,
              transactionCount: 5,
              subcategories: [
                {
                  key: "fuel",
                  categoryKey: "fuel",
                  label: "Brandstof",
                  amount: 120,
                  transactionCount: 2,
                },
                {
                  key: "car_insurance",
                  categoryKey: "car_insurance",
                  label: "Autoverzekering",
                  amount: 210,
                  transactionCount: 1,
                },
                {
                  key: "car_wash",
                  categoryKey: "car_wash",
                  label: "Autowassen",
                  amount: 30,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
      },
      budgetPlan: {
        ...baseContext.budgetPlan,
        variableCategoryBudgets: [
          ...baseContext.budgetPlan.variableCategoryBudgets,
          {
            categoryKey: "auto_transport",
            label: "Auto & Transport",
            monthlyBudget: 450,
            monthlyActual: 444,
            utilization: 0.99,
          },
        ],
      },
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "fuel",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-subcategory-fuel-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-subcategory-fuel-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Brandstofsamenvatting." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage("brandstof?"),
      activeFlow: {
        route: "category_insight",
        mode: "category_summary",
        status: "active",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- scopedCategoryLabel: Brandstof");
    expect(systemText).toContain("- scopedCategoryTotal: € 120");
    expect(systemText).not.toContain("- scopedCategoryTotal: € 444");
  });

  it("leidt subcategorie-labels zoals Autoverzekering naar een eigen scoped totaal", async () => {
    const baseContext = await resolveUnifiedFinancialAdviceContextMock();
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      ...baseContext,
      spending: {
        ...baseContext.spending,
        currentMonthBreakdown: {
          total: 1264,
          transactionCount: 18,
          categories: [
            ...baseContext.spending.currentMonthBreakdown.categories,
            {
              key: "auto_transport",
              categoryKey: "auto_transport",
              label: "Auto & Transport",
              amount: 444,
              transactionCount: 5,
              subcategories: [
                {
                  key: "fuel",
                  categoryKey: "fuel",
                  label: "Brandstof",
                  amount: 120,
                  transactionCount: 2,
                },
                {
                  key: "car_insurance",
                  categoryKey: "car_insurance",
                  label: "Autoverzekering",
                  amount: 210,
                  transactionCount: 1,
                },
                {
                  key: "car_wash",
                  categoryKey: "car_wash",
                  label: "Autowassen",
                  amount: 30,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
      },
      budgetPlan: {
        ...baseContext.budgetPlan,
        variableCategoryBudgets: [
          ...baseContext.budgetPlan.variableCategoryBudgets,
          {
            categoryKey: "auto_transport",
            label: "Auto & Transport",
            monthlyBudget: 450,
            monthlyActual: 444,
            utilization: 0.99,
          },
        ],
      },
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-subcategory-insurance-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-subcategory-insurance-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Autoverzekering samenvatting." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage("wat heb ik uitgegeven aan Autoverzekering"),
      activeFlow: {
        route: "category_insight",
        mode: "category_summary",
        status: "active",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- categoryScope: car_insurance");
    expect(systemText).toContain("- scopedCategoryLabel: Autoverzekering");
    expect(systemText).toContain("- scopedCategoryTotal: € 210");
  });

  it("houdt categorieen uit de globale catalogus beschikbaar ook zonder huidige maandboekingen", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-catalog-category-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-catalog-category-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Beperkte samenvatting." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage("wat heb ik uitgegeven aan Autoverzekering"),
      activeFlow: {
        route: "category_insight",
        mode: "category_summary",
        status: "active",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- categoryScope: car_insurance");
    expect(systemText).toContain("categorie_scope_niet_gevonden_in_geaggregeerde_data");
    expect(systemText).toContain('"label":"Autoverzekering"');
  });

  it("geeft bij onderverdeling binnen een hoofdcategorie expliciet de subcategorie-breakdown door", async () => {
    const baseContext = await resolveUnifiedFinancialAdviceContextMock();
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      ...baseContext,
      spending: {
        ...baseContext.spending,
        currentMonthBreakdown: {
          total: 1264,
          transactionCount: 18,
          categories: [
            ...baseContext.spending.currentMonthBreakdown.categories,
            {
              key: "auto_transport",
              categoryKey: "auto_transport",
              label: "Auto & Transport",
              amount: 444,
              transactionCount: 5,
              subcategories: [
                {
                  key: "fuel",
                  categoryKey: "fuel",
                  label: "Brandstof",
                  amount: 231,
                  transactionCount: 2,
                },
                {
                  key: "car_insurance",
                  categoryKey: "car_insurance",
                  label: "Autoverzekering",
                  amount: 183,
                  transactionCount: 1,
                },
                {
                  key: "car_wash",
                  categoryKey: "car_wash",
                  label: "Autowassen",
                  amount: 30,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
      },
      budgetPlan: {
        ...baseContext.budgetPlan,
        variableCategoryBudgets: [
          ...baseContext.budgetPlan.variableCategoryBudgets,
          {
            categoryKey: "auto_transport",
            label: "Auto & Transport",
            monthlyBudget: 450,
            monthlyActual: 444,
            utilization: 0.99,
          },
        ],
      },
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "auto_transport",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-auto-breakdown-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-auto-breakdown-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Onderverdeling." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage(
        "wat is de onderverdeling van de uitgaven binnen auto?",
      ),
      activeFlow: {
        route: "category_insight",
        mode: "category_summary",
        status: "active",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- scopedCategoryLabel: Auto & Transport");
    expect(systemText).toContain("- scopedCategoryTotal: € 444");
    expect(systemText).toContain("subcategoryBreakdown");
    expect(systemText).toContain('"label":"Brandstof"');
    expect(systemText).toContain('"label":"Autoverzekering"');
    expect(systemText).toContain('"label":"Autowassen"');
  });

  it("kiest bij dubbele autoverzekering-labels de subcategorie uit de actuele auto-flow", async () => {
    const baseContext = await resolveUnifiedFinancialAdviceContextMock();
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      ...baseContext,
      spending: {
        ...baseContext.spending,
        currentMonthBreakdown: {
          total: 444,
          transactionCount: 5,
          categories: [
            {
              key: "auto_transport",
              categoryKey: "auto_transport",
              label: "Auto & Transport",
              amount: 444,
              transactionCount: 5,
              subcategories: [
                {
                  key: "auto_transport_fuel",
                  categoryKey: "auto_transport_fuel",
                  label: "Brandstof",
                  amount: 231,
                  transactionCount: 2,
                },
                {
                  key: "auto_transport_car_insurance",
                  categoryKey: "auto_transport_car_insurance",
                  label: "Autoverzekering",
                  amount: 201,
                  transactionCount: 1,
                },
                {
                  key: "auto_transport_car_wash",
                  categoryKey: "auto_transport_car_wash",
                  label: "Autowassen",
                  amount: 12,
                  transactionCount: 2,
                },
              ],
            },
          ],
        },
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      {
        slug: "insurance_auto",
        label: "Verzekeringen > Autoverzekering",
        source: "catalog",
        kind: "expense",
      },
      {
        slug: "auto_transport_car_insurance",
        label: "Auto & Transport > Autoverzekering",
        source: "catalog",
        kind: "expense",
      },
      {
        slug: "auto_transport",
        label: "Auto & Transport",
        source: "catalog",
        kind: "expense",
      },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-duplicate-insurance-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-duplicate-insurance-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Autoverzekering detail." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage("wat heb ik uitgegeven aan Autoverzekering"),
      activeFlow: {
        route: "category_insight",
        mode: "category_summary",
        status: "active",
      },
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- categoryScope: auto_transport_car_insurance");
    expect(systemText).toContain("- scopedCategoryLabel: Autoverzekering");
    expect(systemText).toContain("- scopedCategoryTotal: € 201");
  });

  it("hydrateert income-categorieen truth-safe voor jaar- en gemiddelde-vragen", async () => {
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      {
        slug: "income_child_budget",
        label: "Toeslagen > Kindgebonden budget",
        source: "catalog",
        kind: "income",
      },
    ]);
    resolveSafeCategoryBreakdownInRangeMock
      .mockResolvedValueOnce({
        total: 868,
        transactionCount: 1,
        categories: [
          {
            key: "income_benefits",
            categoryKey: "income_benefits",
            label: "Toeslagen",
            amount: 868,
            transactionCount: 1,
            subcategories: [
              {
                key: "income_child_budget",
                categoryKey: "income_child_budget",
                label: "Kindgebonden budget",
                amount: 868,
                transactionCount: 1,
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        total: 2604,
        transactionCount: 3,
        categories: [
          {
            key: "income_benefits",
            categoryKey: "income_benefits",
            label: "Toeslagen",
            amount: 2604,
            transactionCount: 3,
            subcategories: [
              {
                key: "income_child_budget",
                categoryKey: "income_child_budget",
                label: "Kindgebonden budget",
                amount: 2604,
                transactionCount: 3,
              },
            ],
          },
        ],
      });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-income-child-budget-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-income-child-budget-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Kindgebonden budget detail." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage(
        "wat is mijn gemiddelde kindgebonden budget dit jaar, of per maand?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- categoryDirection: income");
    expect(systemText).toContain("- categoryScope: income_child_budget");
    expect(systemText).toContain("- scopedCategoryTotal: € 868");
    expect(systemText).toContain("- yearToDateCategoryTotal: € 2.604");
    expect(systemText).toContain("- averagePerMonthTotal: € 868");
  });

  it("geeft een vergelijking met dezelfde maand vorig jaar door als die beschikbaar is", async () => {
    const baseContext = await resolveUnifiedFinancialAdviceContextMock();
    resolveUnifiedFinancialAdviceContextMock.mockResolvedValueOnce({
      ...baseContext,
      spending: {
        ...baseContext.spending,
        currentMonthBreakdown: {
          total: 444,
          transactionCount: 5,
          categories: [
            {
              key: "auto_transport",
              categoryKey: "auto_transport",
              label: "Auto & Transport",
              amount: 444,
              transactionCount: 5,
              subcategories: [
                {
                  key: "auto_transport_car_insurance",
                  categoryKey: "auto_transport_car_insurance",
                  label: "Autoverzekering",
                  amount: 201,
                  transactionCount: 1,
                },
              ],
            },
          ],
        },
      },
    });
    resolveSafeCategoryCatalogScopesMock.mockResolvedValueOnce([
      {
        slug: "auto_transport_car_insurance",
        label: "Auto & Transport > Autoverzekering",
        source: "catalog",
        kind: "expense",
      },
    ]);
    resolveSafeCategoryBreakdownInRangeMock.mockResolvedValueOnce({
      total: 182,
      transactionCount: 1,
      categories: [
        {
          key: "auto_transport",
          categoryKey: "auto_transport",
          label: "Auto & Transport",
          amount: 182,
          transactionCount: 1,
          subcategories: [
            {
              key: "auto_transport_car_insurance",
              categoryKey: "auto_transport_car_insurance",
              label: "Autoverzekering",
              amount: 182,
              transactionCount: 1,
            },
          ],
        },
      ],
    });
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "category_insight",
          mode: "category_summary",
          confidence: "high",
          requires: {
            monthBudget: false,
            cashflowSafety: false,
            expectedEndBalance: false,
            categorySummary: true,
            transactionFacts: false,
            screenExplanation: false,
          },
          dataRequests: {
            monthScope: "current",
            categoryScope: "none",
            merchantScope: "none",
            transactionQuestionType: "category_total",
          },
          useScreenContext: false,
        },
        "planner-last-year-comparison-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-last-year-comparison-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Vergelijking." } }],
        }),
    });

    await requestHelpAssistantReply({
      context: buildHelpAssistantContext({
        screenId: "dashboard",
        selectedPeriod: { key: "2026-03", label: "maart 2026" },
      }),
      thread: createThreadWithUserMessage(
        "is mijn autoverzekering duurder geworden dan vorig jaar?",
      ),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("- scopedCategoryTotal: € 201");
    expect(systemText).toContain("- comparisonReferenceTotal: € 182");
    expect(systemText).toContain("- comparisonDirection: up");
  });

  it("laat insightsFlow niet als tweede router werken", async () => {
    postOpenAIChatCompletionMock.mockResolvedValueOnce(
      createPlannerDecisionResponse(
        {
          route: "general",
          mode: "general_help",
          insightsFlow: "category_summary",
          confidence: "high",
          useScreenContext: false,
        },
        "planner-no-second-router-1",
      ),
    );
    postOpenAIChatCompletionMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "chatcmpl-no-second-router-1",
          model: "gpt-4.1-mini",
          choices: [{ message: { content: "Algemene hulp." } }],
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
      thread: createThreadWithUserMessage("kun je mij hiermee helpen?"),
    });

    const finalRequest = postOpenAIChatCompletionMock.mock.calls[1]?.[0];
    const finalMeta = postOpenAIChatCompletionMock.mock.calls[1]?.[1];
    const systemText = (finalRequest?.messages || [])
      .filter((message: { role?: string }) => message.role === "system")
      .map((message: { content?: string }) => String(message.content || ""))
      .join("\n");

    expect(systemText).toContain("Kanaal: general_help");
    expect(systemText).not.toContain("Kanaal: category_insight");
    expect(finalMeta?.useCase).toBe("help_general");
  });
});
