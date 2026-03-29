import type {
  HelpAssistantMessage,
  HelpAssistantThreadState,
} from "./help-assistant-chat";
import { classifyHelpAssistantIntent } from "./help-assistant-intent";
import type { HelpAssistantContext } from "./help-assistant-context";
import {
  resolveSafeCategoryCatalogScopes,
  resolveUnifiedFinancialAdviceContext,
  type UnifiedFinancialAdviceContext,
} from "./help-assistant-financial-context";
import {
  classifySpendingQuestionType,
  parseRequestedAmountFromQuestion,
} from "./help-assistant-spending-advice";
import {
  postHelpAssistantSpendingAdviceCompletion,
  postOpenAIChatCompletion,
} from "./openai-proxy";
import {
  buildFinalPromptSetup,
  buildSafeSpendingFallback,
  formatSpendingAdvicePatternFromSchema,
  parseFinalAnswerText,
  parseIssueIntakeResponse,
  parseSpendingAdviceSchema,
  toProxyFallback,
} from "./help-assistant-final-prompts";
import {
  buildAvailableCategoryScopes,
  buildContextForRequestedMonthScope,
  buildHydrationResult,
  shouldPrimeFinancialCatalog,
} from "./help-assistant-hydration";
import {
  buildSafePlannerFallback,
  classifyHelpAssistantPlanWithOpenAI,
} from "./help-assistant-planner";
import {
  isIssueLikeIntent,
  looksLikeExplicitMerchantLookup,
  normalizeActiveFlowDescriptor,
  normalizeRoutingDecision,
} from "./help-assistant-route-normalization";
import {
  DEFAULT_MODEL,
  detectRequestedTimeScope,
  getLatestUserMessage,
  hasRepeatedUserQuestion,
  logHelpAssistantDebug,
  normalizeQuestionText,
  pickThreadMessagesForModel,
  resolveContextMonthKey,
  toOpenAIRole,
  type ChatCompletionResponse,
  type HelpAssistantHydrationResult,
  type HelpAssistantActiveFlowDescriptor,
  type HelpAssistantIssueDraftResponse,
  type HelpAssistantPlannerDecision,
  type SpendingAdviceResponseSchema,
} from "./help-assistant-orchestration-shared";

export type { HelpAssistantActiveFlowDescriptor, SpendingAdviceResponseSchema };
export { parseSpendingAdviceSchema };

export type HelpAssistantAIRequest = {
  context: HelpAssistantContext;
  thread: HelpAssistantThreadState;
  userMessageId?: string;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
  activeFlow?: HelpAssistantActiveFlowDescriptor | null;
  issueFlowActive?: boolean;
};

export type HelpAssistantAIResponse = {
  answerText: string;
  model: string;
  responseId: string | null;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
  issueIntake?: HelpAssistantIssueDraftResponse | null;
  activeFlow?: HelpAssistantActiveFlowDescriptor | null;
  debug?: Record<string, unknown>;
};

function buildResponseActiveFlow(input: {
  route: HelpAssistantPlannerDecision["route"];
  mode: HelpAssistantPlannerDecision["mode"];
  latestUserMessageId: string | null;
}) {
  if (input.route === "general") return null;
  return {
    route: input.route,
    mode: input.mode,
    status: "active",
    anchorMessageId: input.latestUserMessageId,
    reason: "assistant_last_routed_turn",
  } satisfies HelpAssistantActiveFlowDescriptor;
}

function shouldIncludeAssistantDebug() {
  return (
    String(process.env.RUN_LIVE_HELP_ASSISTANT_EVAL || "") === "1" ||
    String(process.env.EXPO_PUBLIC_HELP_ASSISTANT_DEBUG || "") === "1"
  );
}

function extractHydrationBlockValue(
  block: string | null | undefined,
  key: string,
) {
  if (!block) return null;
  const match = block.match(new RegExp(`^- ${key}:\\s*(.+)$`, "m"));
  const value = String(match?.[1] || "").trim();
  return value && value !== "onbekend" ? value : null;
}

function extractHydrationJsonPayload(
  block: string | null | undefined,
  key: string,
) {
  const value = extractHydrationBlockValue(block, key);
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanComparisonText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function enforceHydratedCategoryTotalAnswer(input: {
  route: HelpAssistantPlannerDecision["route"];
  hydration: HelpAssistantHydrationResult;
  routingDecision: HelpAssistantPlannerDecision;
  answerText: string;
}) {
  if (input.route !== "category_insight") return input.answerText;
  if (input.routingDecision.dataRequests.transactionQuestionType !== "category_total") {
    return input.answerText;
  }
  if (input.hydration.answerability !== "answerable") return input.answerText;
  const categoryLabel = extractHydrationBlockValue(
    input.hydration.categorySummaryBlock,
    "scopedCategoryLabel",
  );
  const categoryTotal = extractHydrationBlockValue(
    input.hydration.categorySummaryBlock,
    "scopedCategoryTotal",
  );
  const dataPeriod = extractHydrationBlockValue(
    input.hydration.categorySummaryBlock,
    "dataPeriod",
  );
  if (!categoryLabel || !categoryTotal || !dataPeriod) return input.answerText;

  const normalizedAnswer = cleanComparisonText(input.answerText);
  if (normalizedAnswer.includes(cleanComparisonText(categoryTotal))) {
    return input.answerText;
  }

  return `In ${dataPeriod} heb je in totaal ${categoryTotal} uitgegeven aan de categorie ${categoryLabel}.`;
}

function enforceHydratedTransactionAnswer(input: {
  route: HelpAssistantPlannerDecision["route"];
  hydration: HelpAssistantHydrationResult;
  routingDecision: HelpAssistantPlannerDecision;
  answerText: string;
}) {
  if (input.route !== "transactions_insight") return input.answerText;
  if (input.hydration.answerability !== "answerable") return input.answerText;

  const payload = extractHydrationJsonPayload(
    input.hydration.transactionFactsBlock,
    "payload",
  );
  if (!payload) return input.answerText;

  const questionType = String(payload.transactionQuestionType || "").trim();
  const merchantLabel = String(payload.merchantLabel || "").trim();
  const merchantTotal = String(payload.merchantTotal || "").trim();
  const merchantTransactionCount = String(
    payload.merchantTransactionCount || "",
  ).trim();
  const dataPeriod = String(payload.dataPeriod || "").trim();
  const normalizedAnswer = cleanComparisonText(input.answerText);

  if (questionType === "merchant_total" && merchantLabel && merchantTotal && dataPeriod) {
    if (
      normalizedAnswer.includes(cleanComparisonText(merchantTotal)) &&
      normalizedAnswer.includes(cleanComparisonText(merchantLabel))
    ) {
      return input.answerText;
    }
    return `In ${dataPeriod} heb je ${merchantTotal} uitgegeven bij ${merchantLabel}.`;
  }

  if (
    questionType === "merchant_frequency" &&
    merchantLabel &&
    merchantTransactionCount &&
    dataPeriod
  ) {
    if (
      normalizedAnswer.includes(cleanComparisonText(merchantTransactionCount)) &&
      normalizedAnswer.includes(cleanComparisonText(merchantLabel))
    ) {
      return input.answerText;
    }
    return `In ${dataPeriod} heb je ${merchantTransactionCount} betalingen gedaan bij ${merchantLabel}.`;
  }

  return input.answerText;
}

function shouldUseFallbackPlannerSource(input: {
  plannerResult: HelpAssistantPlannerDecision | null;
  fallbackPlannerResult: HelpAssistantPlannerDecision;
  latestUserText: string | null;
}) {
  const planner = input.plannerResult;
  if (!planner) return true;
  const latestUserText = input.latestUserText || null;
  if (
    planner.route === "general" &&
    input.fallbackPlannerResult.route !== "general" &&
    planner.confidence !== "high"
  ) {
    return true;
  }
  if (
    planner.route === "screen_explanation" &&
    input.fallbackPlannerResult.route !== "screen_explanation" &&
    input.fallbackPlannerResult.route !== "general" &&
    planner.confidence !== "high"
  ) {
    return true;
  }
  if (
    planner.route === "transactions_insight" &&
    planner.dataRequests.transactionQuestionType === "merchant_total" &&
    input.fallbackPlannerResult.route === "category_insight" &&
    input.fallbackPlannerResult.dataRequests.categoryScope !== "none" &&
    input.fallbackPlannerResult.dataRequests.categoryScope !== "unknown" &&
    !looksLikeExplicitMerchantLookup(latestUserText)
  ) {
    return true;
  }
  return false;
}

function pickThreadMessagesForSpendingFinalCall(input: {
  thread: HelpAssistantThreadState;
  latestUserMessage: HelpAssistantMessage | null;
}) {
  const candidates = pickThreadMessagesForModel(input.thread);
  if (!input.latestUserMessage) return candidates;
  const withoutLatestUser = candidates.filter(
    (message) => message.id !== input.latestUserMessage?.id,
  );
  return [...withoutLatestUser.slice(-4), input.latestUserMessage];
}

export function isFinancialAdviceQuestion(input: string) {
  return classifySpendingQuestionType(input) !== null;
}

export async function requestHelpAssistantReply({
  context,
  thread,
  unifiedFinancialContext,
  activeFlow,
  issueFlowActive,
}: HelpAssistantAIRequest): Promise<HelpAssistantAIResponse> {
  const latestUserMessage = getLatestUserMessage(thread);
  const latestUserIntentRaw = latestUserMessage
    ? classifyHelpAssistantIntent(latestUserMessage.text)
    : null;
  const latestUserIntent = latestUserIntentRaw
    ? {
        intent: latestUserIntentRaw.intent,
        confidence: latestUserIntentRaw.confidence,
      }
    : null;
  const preRequestedAmount = latestUserMessage
    ? parseRequestedAmountFromQuestion(latestUserMessage.text)
    : null;
  const latestUserLooksLikeDiagnosticQuestion = latestUserMessage
    ? (() => {
        const normalized = normalizeQuestionText(latestUserMessage.text);
        return (
          normalized.includes("waarom klopt") ||
          normalized.includes("klopt dit niet") ||
          normalized.includes("werkt niet") ||
          normalized.includes("bug")
        );
      })()
    : false;

  const initialRequestedTimeScope = detectRequestedTimeScope(
    latestUserMessage?.text || null,
  );
  const normalizedActiveFlow = normalizeActiveFlowDescriptor({
    activeFlow,
    issueFlowActive,
  });
  const plannerFinancialContextRequestContext = buildContextForRequestedMonthScope({
    context,
    monthScope: initialRequestedTimeScope.monthScopeHint,
  });

  let plannerFinancialContext: UnifiedFinancialAdviceContext | null =
    unifiedFinancialContext || null;
  const plannerCategoryCatalogScopes = latestUserMessage
    ? await resolveSafeCategoryCatalogScopes().catch(() => [])
    : [];
  if (
    !plannerFinancialContext &&
    latestUserMessage &&
    !isIssueLikeIntent(latestUserIntent) &&
    !latestUserLooksLikeDiagnosticQuestion &&
    (shouldPrimeFinancialCatalog(latestUserMessage.text) ||
      normalizedActiveFlow?.route === "category_insight" ||
      normalizedActiveFlow?.route === "transactions_insight")
  ) {
    plannerFinancialContext = await resolveUnifiedFinancialAdviceContext({
      context: plannerFinancialContextRequestContext,
      question: latestUserMessage.text,
      requestedAmount: preRequestedAmount,
    }).catch(() => null);
  }

  const plannerAvailableCategoryScopes = buildAvailableCategoryScopes(
    plannerFinancialContext,
    plannerCategoryCatalogScopes,
  );
  const fallbackPlannerResult = buildSafePlannerFallback({
    latestUserText: latestUserMessage?.text || null,
    activeFlow: normalizedActiveFlow,
    intentHint: latestUserIntent,
    availableCategoryScopes: plannerAvailableCategoryScopes,
    selectedPeriodKey: context.selectedPeriod?.key || null,
  });
  const plannerResult = latestUserMessage
    ? await classifyHelpAssistantPlanWithOpenAI({
        context,
        thread,
        activeFlow: normalizedActiveFlow,
        availableCategoryScopes: plannerAvailableCategoryScopes,
      })
    : null;
  const useFallbackPlannerSource = shouldUseFallbackPlannerSource({
    plannerResult,
    fallbackPlannerResult,
    latestUserText: latestUserMessage?.text || null,
  });
  const plannerSource =
    plannerResult && !useFallbackPlannerSource ? "planner" : "fallback";
  const normalizedRoutingDecision = normalizeRoutingDecision({
    decision:
      plannerResult && !useFallbackPlannerSource
        ? plannerResult
        : fallbackPlannerResult,
    activeFlow: normalizedActiveFlow,
    latestUserText: latestUserMessage?.text || null,
    intentHint: latestUserIntent,
    selectedPeriodKey: context.selectedPeriod?.key || null,
    availableCategoryScopes: plannerAvailableCategoryScopes,
  });

  const route = normalizedRoutingDecision.route;
  const responseActiveFlow = buildResponseActiveFlow({
    route: normalizedRoutingDecision.route,
    mode: normalizedRoutingDecision.mode,
    latestUserMessageId: latestUserMessage?.id || null,
  });
  const isIssueIntakeQuestion = route === "issue_intake";
  const isSpendingAdviceQuestion = route === "spending_advice";
  const requestedAmount = isSpendingAdviceQuestion ? preRequestedAmount : null;
  const requiresFinancialContext =
    isSpendingAdviceQuestion ||
    normalizedRoutingDecision.requires.monthBudget ||
    normalizedRoutingDecision.requires.cashflowSafety ||
    normalizedRoutingDecision.requires.expectedEndBalance ||
    normalizedRoutingDecision.requires.categorySummary ||
    normalizedRoutingDecision.requires.transactionFacts;
  const financialContextRequestContext = buildContextForRequestedMonthScope({
    context,
    monthScope: normalizedRoutingDecision.dataRequests.monthScope,
  });
  const requestedPeriodKey = resolveContextMonthKey(
    financialContextRequestContext.selectedPeriod,
  );
  const resolvedFinancialContext =
    latestUserMessage &&
    !latestUserLooksLikeDiagnosticQuestion &&
    requiresFinancialContext
      ? plannerFinancialContext &&
        resolveContextMonthKey(plannerFinancialContextRequestContext.selectedPeriod) ===
          resolveContextMonthKey(financialContextRequestContext.selectedPeriod)
        ? plannerFinancialContext
        : await resolveUnifiedFinancialAdviceContext({
            context: financialContextRequestContext,
            question: latestUserMessage.text,
            requestedAmount,
          }).catch(() => null)
      : null;

  const hydration = await buildHydrationResult({
    routingDecision: normalizedRoutingDecision,
    unifiedFinancialContext: resolvedFinancialContext,
    requestedPeriodKey,
    latestUserText: latestUserMessage?.text || null,
    context,
    availableCategoryScopes: plannerAvailableCategoryScopes,
  });
  const spendingFallback =
    isSpendingAdviceQuestion && resolvedFinancialContext
      ? buildSafeSpendingFallback({
          unifiedFinancialContext: resolvedFinancialContext,
        })
      : null;
  const repeatedQuestion = hasRepeatedUserQuestion(thread);
  const signalHints = latestUserMessage
    ? {
        confidence:
          latestUserMessage.metadata.classification?.confidence ||
          latestUserIntent?.confidence,
        route,
        repeatedQuestion,
        issueFlowIncomplete: Boolean(
          latestUserMessage.metadata.issueDraftCandidate &&
            thread.pendingIssueDraftIds.includes(latestUserMessage.id),
        ),
      }
    : { repeatedQuestion };

  const finalPromptSetup = buildFinalPromptSetup({
    context,
    routingDecision: normalizedRoutingDecision,
    hydration,
    unifiedFinancialContext: resolvedFinancialContext,
    requestedAmount,
    latestUserText: latestUserMessage?.text || null,
  });

  const threadMessagesForFinalCall = isSpendingAdviceQuestion
    ? pickThreadMessagesForSpendingFinalCall({
        thread,
        latestUserMessage,
      })
    : pickThreadMessagesForModel(thread);

  const openAIMessages = [
    ...finalPromptSetup.systemPrompts.map((prompt) => ({
      role: "system" as const,
      content: prompt.content,
    })),
    ...threadMessagesForFinalCall.map((message) => ({
      role: toOpenAIRole(message.role),
      content: message.text,
    })),
  ];

  const loadedContextBlocks = [
    normalizedRoutingDecision.requires.monthBudget ? "monthBudget" : null,
    normalizedRoutingDecision.requires.cashflowSafety ? "cashflowSafety" : null,
    normalizedRoutingDecision.requires.expectedEndBalance
      ? "expectedEndBalance"
      : null,
    normalizedRoutingDecision.requires.categorySummary ? "categorySummary" : null,
    normalizedRoutingDecision.requires.transactionFacts
      ? "transactionFacts"
      : null,
    normalizedRoutingDecision.requires.screenExplanation
      ? "screenExplanation"
      : null,
  ].filter(Boolean) as string[];

  logHelpAssistantDebug("planner_data_requests_raw", {
    dataRequests: plannerResult?.dataRequests || null,
    insightsFlow: plannerResult?.insightsFlow || null,
  });
  logHelpAssistantDebug("planner_data_requests_normalized", {
    dataRequests: normalizedRoutingDecision.dataRequests,
    insightsFlow: normalizedRoutingDecision.insightsFlow,
    requires: normalizedRoutingDecision.requires,
    needsClarification: normalizedRoutingDecision.needsClarification,
  });
  logHelpAssistantDebug("planner_result", {
    raw: plannerResult,
    fallback: fallbackPlannerResult,
    normalized: normalizedRoutingDecision,
    source: plannerSource,
    activeFlow: normalizedActiveFlow,
  });
  logHelpAssistantDebug("hydration_result", {
    loadedBlocks: hydration.loadedBlocks,
    limitations: hydration.limitations,
    answerability: hydration.answerability,
    periodMatch: hydration.periodMatch,
  });
  logHelpAssistantDebug("final_answer_setup", {
    route,
    mode: normalizedRoutingDecision.mode,
    insightsFlow: normalizedRoutingDecision.insightsFlow,
    useCase: finalPromptSetup.useCase,
    responseMode: finalPromptSetup.responseMode,
    promptLabels: finalPromptSetup.systemPrompts.map((prompt) => prompt.label),
    loadedContextBlocks,
    hydrationBlocksSent: hydration.loadedBlocks,
    answerability: hydration.answerability,
    periodMatch: hydration.periodMatch,
    continueActiveFlow: normalizedRoutingDecision.continueActiveFlow,
    activeFlowInfluence: normalizedRoutingDecision.activeFlowInfluence,
  });
  logHelpAssistantDebug("final_answer_context_blocks_sent", {
    promptLabels: finalPromptSetup.systemPrompts.map((prompt) => prompt.label),
    loadedContextBlocks,
    hydrationBlocksSent: hydration.loadedBlocks,
    dataRequests: normalizedRoutingDecision.dataRequests,
  });

  const openAIRequest = {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    response_format:
      finalPromptSetup.responseMode === "json_object"
        ? { type: "json_object" as const }
        : undefined,
    messages: openAIMessages,
  };

  try {
    const response =
      isSpendingAdviceQuestion && spendingFallback
        ? await postHelpAssistantSpendingAdviceCompletion({
            openAIRequest,
            safeFallback: toProxyFallback(spendingFallback),
            meta: {
              useCase: "help_spending_advice",
              routeName: context.routeName,
              screenId: context.screenId,
              screenTitle: context.screenTitle,
              platform: context.platform,
              periodLabel: context.selectedPeriod?.label || undefined,
              agentMode: "chat",
              responseMode: "json_object",
              fallbackEnabled: true,
              signalHints,
            },
          })
        : await postOpenAIChatCompletion(openAIRequest, {
            useCase: finalPromptSetup.useCase,
            routeName: context.routeName,
            screenId: context.screenId,
            screenTitle: context.screenTitle,
            platform: context.platform,
            periodLabel: context.selectedPeriod?.label || undefined,
            agentMode: "chat",
            responseMode: finalPromptSetup.responseMode,
            fallbackEnabled: true,
            signalHints,
          });

    const raw = await response.text();
    let parsed: ChatCompletionResponse | null = null;

    try {
      parsed = JSON.parse(raw) as ChatCompletionResponse;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const message =
        parsed && typeof parsed === "object"
          ? String((parsed as Record<string, unknown>).message || "").trim()
          : "";
      throw new Error(
        message || "Hulpassistent kon geen antwoord ophalen via proxy.",
      );
    }

    const payload = (parsed || {}) as ChatCompletionResponse;
    const responseText = String(
      payload.choices?.[0]?.message?.content || "",
    ).trim();
    const issueIntakeResponse = isIssueIntakeQuestion
      ? parseIssueIntakeResponse(responseText)
      : null;
    const issueIntakeFallbackText =
      "Vertel gerust wat je in gedachten hebt. Ik help je het kort en duidelijk te maken.";

    return {
      answerText: enforceHydratedTransactionAnswer({
        route,
        hydration,
        routingDecision: normalizedRoutingDecision,
        answerText: enforceHydratedCategoryTotalAnswer({
          route,
          hydration,
          routingDecision: normalizedRoutingDecision,
          answerText:
            issueIntakeResponse?.answerText ||
            (isIssueIntakeQuestion
              ? issueIntakeFallbackText
              : parseFinalAnswerText({
                  payload,
                  route,
                  fallback: spendingFallback || undefined,
                  unifiedFinancialContext: resolvedFinancialContext,
                })),
        }),
      }),
      model: String(payload.model || DEFAULT_MODEL),
      responseId: payload.id || null,
      unifiedFinancialContext: resolvedFinancialContext,
      issueIntake: issueIntakeResponse,
      activeFlow: responseActiveFlow,
      debug: shouldIncludeAssistantDebug()
        ? {
            route,
            plannerSource,
            plannerResult,
            fallbackPlannerResult,
            normalizedRoutingDecision,
            hydration,
            finalPromptUseCase: finalPromptSetup.useCase,
          }
        : undefined,
    };
  } catch {
    if (isSpendingAdviceQuestion && spendingFallback) {
      return {
        answerText: formatSpendingAdvicePatternFromSchema(spendingFallback),
        model: "local-safe-fallback-spending-v1",
        responseId: null,
        unifiedFinancialContext: resolvedFinancialContext,
        issueIntake: null,
        activeFlow: responseActiveFlow,
        debug: shouldIncludeAssistantDebug()
          ? {
              route,
              plannerSource,
              plannerResult,
              fallbackPlannerResult,
              normalizedRoutingDecision,
              hydration,
              finalPromptUseCase: "help_spending_advice",
              fallbackUsed: true,
            }
          : undefined,
      };
    }

    throw new Error("Hulpassistent kon geen antwoord ophalen via proxy.");
  }
}
