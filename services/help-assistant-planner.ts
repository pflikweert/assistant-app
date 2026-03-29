import type {
  HelpAssistantThreadState,
} from "./help-assistant-chat";
import {
  buildHelpAssistantScreenContextLines,
  type HelpAssistantContext,
} from "./help-assistant-context";
import { postOpenAIChatCompletion } from "./openai-proxy";
import { classifySpendingQuestionType } from "./help-assistant-spending-advice";
import {
  buildFallbackDataRequests,
  isIssueLikeIntent,
  looksLikeScreenExplanationQuestion,
  normalizePlannerDataRequests,
  normalizeRoutingDecision,
  resolvePlannerDataCategoryScope,
  resolvePlannerDataMerchantScope,
  resolvePlannerTransactionQuestionType,
  shouldRequireCategorySummary,
} from "./help-assistant-route-normalization";
import {
  buildPlannerDataRequestsDefaults,
  buildPlannerRequiresDefaults,
  cleanInlineText,
  DEFAULT_MODEL,
  isHelpAssistantPlannerInsightsFlow,
  parseJsonObject,
  pickPlannerMessagesForModel,
  resolveDefaultInsightsFlowForRoute,
  sanitizeScopeSlug,
  toOpenAIRole,
  type ChatCompletionResponse,
  type HelpAssistantAvailableCategoryScope,
  type HelpAssistantIntentHint,
  type HelpAssistantPlannerDataRequests,
  type HelpAssistantPlannerDecision,
  type HelpAssistantPlannerInsightsFlow,
  type HelpAssistantPlannerRequires,
  type HelpAssistantPlannerScopeSlug,
  type NormalizedActiveFlow,
} from "./help-assistant-orchestration-shared";

const HELP_ASSISTANT_PLANNER_PROMPT = [
  "Je bent de planner van de Budio Assistent.",
  "Je schrijft nooit eindantwoord of advies, alleen een beslisobject voor de volgende modelcall.",
  "Werk turn-first: beoordeel ELKE nieuwe user turn opnieuw.",
  "Een actieve flow is alleen soft prior, nooit een harde lock.",
  "Bepaal expliciet of de turn de actieve flow moet voortzetten of een intent-shift is.",
  "Bepaal intent en contextbehoefte voor exact één route en exact één mode.",
  "Route-opties: issue_intake, spending_advice, general, transactions_insight, category_insight, screen_explanation.",
  "Mode-opties: issue_intake, spending_decision, space_summary, general_help, transaction_lookup, category_summary, screen_help.",
  "Gebruik spending_advice alleen voor echte bestedingsruimte- of uitgavebeslissingen.",
  "Gebruik issue_intake voor ideeën, feedback, bugs of productproblemen.",
  "Gebruik general_help voor uitleg en algemene hulpvragen.",
  "Beschikbare insights-flows: general_reasoning, spending_overview, category_summary, transaction_facts, screen_context, issue_intake, none.",
  "Kies verplicht precies één insightsFlow als intern observability- en hydrationhint-veld.",
  "InsightsFlow is geen tweede router: gebruik het alleen als hint bij je gekozen route.",
  "Gebruik scherminformatie niet als financiële waarheid. Die is alleen relevant als screenExplanation nodig is.",
  "Noem nooit bedragen, datums of advies in je output.",
  "Geef exact JSON terug met dit schema:",
  "{",
  '  "route": "issue_intake|spending_advice|general|transactions_insight|category_insight|screen_explanation",',
  '  "mode": "issue_intake|spending_decision|space_summary|general_help|transaction_lookup|category_summary|screen_help",',
  '  "insightsFlow": "general_reasoning|spending_overview|category_summary|transaction_facts|screen_context|issue_intake|none",',
  '  "confidence": "low|medium|high",',
  '  "needsClarification": true,',
  '  "continueActiveFlow": false,',
  '  "activeFlowInfluence": "none|low|medium|high",',
  '  "requires": {',
  '    "monthBudget": true,',
  '    "cashflowSafety": true,',
  '    "expectedEndBalance": false,',
  '    "categorySummary": false,',
  '    "transactionFacts": false,',
  '    "screenExplanation": false',
  "  },",
  '  "dataRequests": {',
  '    "monthScope": "current|previous|specified|none",',
  '    "categoryScope": "slug|unknown|none",',
  '    "merchantScope": "merchant_slug|unknown|none",',
  '    "transactionQuestionType": "merchant_total|merchant_frequency|category_places|category_total|none"',
  "  },",
  '  "useScreenContext": false',
  "}",
  "Gebruik nooit letterlijk 'slug' of 'merchant_slug' als waarde; gebruik een echte canonieke slug of none/unknown.",
].join(" ");

function buildNeutralPlannerContextPrompt(input: {
  context: HelpAssistantContext;
  activeFlow: NormalizedActiveFlow | null;
}) {
  const { context, activeFlow } = input;
  const period = context.selectedPeriod?.label || "niet geselecteerd";
  const activeFlowText = activeFlow
    ? `route=${activeFlow.route}; mode=${activeFlow.mode}; status=${activeFlow.status || "unknown"}`
    : "geen";
  return [
    `Actieve flow (soft prior): ${activeFlowText}.`,
    `Platform: ${context.platform}`,
    `Periode: ${period}`,
    "Belangrijk: actieve flow mag beïnvloeden, maar nooit hard forceren.",
    "Let op: schermspecifieke regels zijn niet meegestuurd. Neem schermcontext alleen mee als de vraag expliciet om schermuitleg vraagt.",
  ].join("\n");
}

function buildPlannerPrompt(input: {
  context: HelpAssistantContext;
  activeFlow: NormalizedActiveFlow | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}) {
  const availableCategoryScopes = (input.availableCategoryScopes || [])
    .slice(0, 20)
    .map((scope) =>
      `${scope.slug} (${scope.label}${scope.kind ? `; kind=${scope.kind}` : ""})`,
    )
    .join(", ");
  return [
    HELP_ASSISTANT_PLANNER_PROMPT,
    "",
    `Planner-context:\n${buildNeutralPlannerContextPrompt(input)}`,
    availableCategoryScopes
      ? `Beschikbare categorie-scopes (kies hieruit of gebruik unknown/none): ${availableCategoryScopes}`
      : "Beschikbare categorie-scopes: niet beschikbaar in deze turn; gebruik unknown/none als scope niet expliciet is.",
    "Beschikbare insights-flows: spending_overview (budget/cashflow/eindsaldo), category_summary (categorie-totalen), transaction_facts (veilige transactie-aggregaten), screen_context (schermuitleg), issue_intake (idee- of bug-intake), general_reasoning (algemene hulp zonder extra insights-hydration), none.",
    "",
    "Geef exact één route en één mode die bij elkaar passen.",
    "Geef ook exact één insightsFlow terug; dit veld is verplicht.",
    "Zet continueActiveFlow op true als dit duidelijk een voortzetting is van de actieve flow.",
    "Zet continueActiveFlow op false bij duidelijke intent-shift.",
    "Gebruik dataRequests alleen om databehoefte te classificeren; haal nooit zelf data op.",
    "Vul in dataRequests nooit bedragen, datums of verzonnen transacties/merchants in.",
    "Als scope onduidelijk is, gebruik unknown of none in plaats van te gokken.",
  ].join("\n");
}

function parsePlannerRequires(
  value: unknown,
): HelpAssistantPlannerRequires | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const typed = value as Record<string, unknown>;
  const monthBudget = typed.monthBudget;
  const cashflowSafety = typed.cashflowSafety;
  const expectedEndBalance = typed.expectedEndBalance;
  const categorySummary = typed.categorySummary ?? typed.categoryStatus;
  const transactionFacts = typed.transactionFacts ?? false;
  const screenExplanation = typed.screenExplanation;
  if (
    typeof monthBudget !== "boolean" ||
    typeof cashflowSafety !== "boolean" ||
    typeof expectedEndBalance !== "boolean" ||
    typeof categorySummary !== "boolean" ||
    typeof transactionFacts !== "boolean" ||
    typeof screenExplanation !== "boolean"
  ) {
    return null;
  }
  return {
    monthBudget,
    cashflowSafety,
    expectedEndBalance,
    categorySummary,
    transactionFacts,
    screenExplanation,
  };
}

function parsePlannerDataRequests(
  value: unknown,
): HelpAssistantPlannerDataRequests {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return buildPlannerDataRequestsDefaults();
  }
  const typed = value as Record<string, unknown>;
  const monthScopeRaw = String(typed.monthScope || "")
    .trim()
    .toLowerCase();
  const transactionQuestionTypeRaw = String(typed.transactionQuestionType || "")
    .trim()
    .toLowerCase();
  const monthScope = ["current", "previous", "specified", "none"].includes(
    monthScopeRaw,
  )
    ? monthScopeRaw
    : "none";
  const transactionQuestionType = [
    "merchant_total",
    "merchant_frequency",
    "category_places",
    "category_total",
    "none",
  ].includes(transactionQuestionTypeRaw)
    ? transactionQuestionTypeRaw
    : "none";
  return {
    monthScope,
    categoryScope: sanitizeScopeSlug(typed.categoryScope, "none"),
    merchantScope: sanitizeScopeSlug(typed.merchantScope, "none"),
    transactionQuestionType,
  } as HelpAssistantPlannerDataRequests;
}

export function parseHelpAssistantPlannerDecision(
  content: string,
): HelpAssistantPlannerDecision | null {
  const parsed = parseJsonObject(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const route = String(parsed.route || "").trim();
  const mode = String(parsed.mode || "").trim();
  const insightsFlowRaw = cleanInlineText(String(parsed.insightsFlow || ""));
  const confidence = String(parsed.confidence || "").trim();
  const needsClarification = Boolean(parsed.needsClarification);
  const continueActiveFlow = Boolean(parsed.continueActiveFlow);
  const activeFlowInfluence = String(
    parsed.activeFlowInfluence || "none",
  ).trim();
  const requires = parsePlannerRequires(parsed.requires);
  const dataRequests = parsePlannerDataRequests(parsed.dataRequests);
  const useScreenContext = parsed.useScreenContext;

  if (
    ![
      "issue_intake",
      "spending_advice",
      "general",
      "transactions_insight",
      "category_insight",
      "screen_explanation",
    ].includes(route)
  ) {
    return null;
  }
  if (
    ![
      "general_help",
      "issue_intake",
      "space_summary",
      "spending_decision",
      "transaction_lookup",
      "category_summary",
      "screen_help",
    ].includes(mode)
  ) {
    return null;
  }
  if (!["low", "medium", "high"].includes(confidence)) return null;
  if (!["none", "low", "medium", "high"].includes(activeFlowInfluence)) {
    return null;
  }
  if (!requires) return null;
  if (typeof useScreenContext !== "boolean") return null;

  return {
    route: route as HelpAssistantPlannerDecision["route"],
    mode: mode as HelpAssistantPlannerDecision["mode"],
    insightsFlow: isHelpAssistantPlannerInsightsFlow(insightsFlowRaw)
      ? insightsFlowRaw
      : resolveDefaultInsightsFlowForRoute(route as HelpAssistantPlannerDecision["route"]),
    confidence: confidence as HelpAssistantPlannerDecision["confidence"],
    needsClarification,
    continueActiveFlow,
    activeFlowInfluence:
      activeFlowInfluence as HelpAssistantPlannerDecision["activeFlowInfluence"],
    requires,
    dataRequests,
    useScreenContext,
  };
}

export async function classifyHelpAssistantPlanWithOpenAI(input: {
  context: HelpAssistantContext;
  thread: HelpAssistantThreadState;
  activeFlow: NormalizedActiveFlow | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}) {
  const response = await postOpenAIChatCompletion(
    {
      model: DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildPlannerPrompt({
            context: input.context,
            activeFlow: input.activeFlow,
            availableCategoryScopes: input.availableCategoryScopes,
          }),
        },
        ...pickPlannerMessagesForModel(input.thread).map((message) => ({
          role: toOpenAIRole(message.role),
          content: message.text,
        })),
      ],
    },
    {
      useCase: "help_general",
      routeName: input.context.routeName,
      screenId: input.context.screenId,
      screenTitle: input.context.screenTitle,
      platform: input.context.platform,
      periodLabel: input.context.selectedPeriod?.label || undefined,
      agentMode: "chat",
      responseMode: "json_object",
      fallbackEnabled: true,
    },
  );

  const raw = await response.text();
  let parsed: ChatCompletionResponse | null = null;

  try {
    parsed = JSON.parse(raw) as ChatCompletionResponse;
  } catch {
    parsed = null;
  }

  if (!response.ok) return null;

  const payload = (parsed || {}) as ChatCompletionResponse;
  const content = String(payload.choices?.[0]?.message?.content || "").trim();
  if (!content) return null;
  return parseHelpAssistantPlannerDecision(content);
}

function isLikelyShortClarificationReply(text: string | null | undefined) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (raw.includes("?")) return false;
  return raw.length <= 34;
}

export function buildSafePlannerFallback(input: {
  latestUserText: string | null;
  activeFlow: NormalizedActiveFlow | null;
  intentHint: HelpAssistantIntentHint;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
  selectedPeriodKey?: string | null;
}): HelpAssistantPlannerDecision {
  const screenExplanation = looksLikeScreenExplanationQuestion(
    input.latestUserText || "",
  );
  const activeFlowInfluence = input.activeFlow ? "medium" : "none";
  const fallbackDataRequests = buildFallbackDataRequests(
    input.latestUserText,
    input.availableCategoryScopes,
  );

  if (
    input.activeFlow?.route === "issue_intake" &&
    isLikelyShortClarificationReply(input.latestUserText)
  ) {
    return {
      route: "issue_intake",
      mode: "issue_intake",
      insightsFlow: "issue_intake",
      confidence: "medium",
      needsClarification: true,
      continueActiveFlow: true,
      activeFlowInfluence,
      requires: buildPlannerRequiresDefaults(),
      dataRequests: buildPlannerDataRequestsDefaults(),
      useScreenContext: true,
    };
  }

  if (isIssueLikeIntent(input.intentHint)) {
    return {
      route: "issue_intake",
      mode: "issue_intake",
      insightsFlow: "issue_intake",
      confidence: input.intentHint?.confidence || "medium",
      needsClarification: true,
      continueActiveFlow: input.activeFlow?.route === "issue_intake",
      activeFlowInfluence,
      requires: buildPlannerRequiresDefaults(),
      dataRequests: buildPlannerDataRequestsDefaults(),
      useScreenContext: true,
    };
  }

  const spendingType = input.latestUserText
    ? classifySpendingQuestionType(input.latestUserText)
    : null;
  if (spendingType) {
    return {
      route: "spending_advice",
      mode: spendingType,
      insightsFlow: "spending_overview",
      confidence: "medium",
      needsClarification: false,
      continueActiveFlow: input.activeFlow?.route === "spending_advice",
      activeFlowInfluence,
      requires: {
        monthBudget: true,
        cashflowSafety: true,
        expectedEndBalance: spendingType === "spending_decision",
        categorySummary: shouldRequireCategorySummary(input.latestUserText),
        transactionFacts: false,
        screenExplanation: false,
      },
      dataRequests: {
        ...fallbackDataRequests,
        transactionQuestionType: "none",
        merchantScope: "none",
      },
      useScreenContext: false,
    };
  }

  if (screenExplanation) {
    return {
      route: "screen_explanation",
      mode: "screen_help",
      insightsFlow: "screen_context",
      confidence: "medium",
      needsClarification: false,
      continueActiveFlow: input.activeFlow?.route === "screen_explanation",
      activeFlowInfluence,
      requires: {
        ...buildPlannerRequiresDefaults(),
        screenExplanation: true,
      },
      dataRequests: buildPlannerDataRequestsDefaults(),
      useScreenContext: true,
    };
  }

  const normalizedUserText = cleanInlineText(String(input.latestUserText || ""));
  if (normalizedUserText) {
    const categoryScope = resolvePlannerDataCategoryScope(
      input.latestUserText,
      input.availableCategoryScopes,
    );
    const merchantScope = resolvePlannerDataMerchantScope(input.latestUserText);
    const transactionQuestionType = resolvePlannerTransactionQuestionType(
      input.latestUserText,
      {
        categoryScope,
        merchantScope,
      },
    );
    const needsCategorySummary = shouldRequireCategorySummary(input.latestUserText);
    const looksLikeTransactionLookup =
      merchantScope !== "none" ||
      transactionQuestionType === "merchant_total" ||
      transactionQuestionType === "merchant_frequency" ||
      normalizeTextForFallback(input.latestUserText).includes("transactie");

    if (looksLikeTransactionLookup) {
      const raw = {
        route: "transactions_insight",
        mode: "transaction_lookup",
        insightsFlow: "transaction_facts",
        confidence: "medium",
        needsClarification: transactionQuestionType === "none",
        continueActiveFlow: input.activeFlow?.route === "transactions_insight",
        activeFlowInfluence,
        requires: {
          ...buildPlannerRequiresDefaults(),
          transactionFacts: true,
        },
        dataRequests: {
          ...fallbackDataRequests,
          merchantScope,
          transactionQuestionType:
            transactionQuestionType === "none"
              ? merchantScope !== "none"
                ? "merchant_total"
                : "none"
              : transactionQuestionType,
        },
        useScreenContext: false,
      } satisfies HelpAssistantPlannerDecision;

      return normalizeRoutingDecision({
        decision: raw,
        activeFlow: input.activeFlow,
        latestUserText: input.latestUserText,
        intentHint: input.intentHint,
        selectedPeriodKey: input.selectedPeriodKey || null,
        availableCategoryScopes: input.availableCategoryScopes,
      });
    }

    if (
      needsCategorySummary ||
      transactionQuestionType === "category_total" ||
      transactionQuestionType === "category_places"
    ) {
      const inferredCategoryScope =
        categoryScope !== "none"
          ? categoryScope
          : (input.availableCategoryScopes || []).length
            ? "unknown"
            : "none";
      const raw = {
        route: "category_insight",
        mode: "category_summary",
        insightsFlow: "category_summary",
        confidence: "medium",
        needsClarification: inferredCategoryScope === "unknown",
        continueActiveFlow: input.activeFlow?.route === "category_insight",
        activeFlowInfluence,
        requires: {
          ...buildPlannerRequiresDefaults(),
          categorySummary: true,
        },
        dataRequests: {
          ...fallbackDataRequests,
          categoryScope: inferredCategoryScope,
          merchantScope: "none",
          transactionQuestionType:
            transactionQuestionType === "none"
              ? "category_total"
              : transactionQuestionType,
        },
        useScreenContext: false,
      } satisfies HelpAssistantPlannerDecision;

      return normalizeRoutingDecision({
        decision: raw,
        activeFlow: input.activeFlow,
        latestUserText: input.latestUserText,
        intentHint: input.intentHint,
        selectedPeriodKey: input.selectedPeriodKey || null,
        availableCategoryScopes: input.availableCategoryScopes,
      });
    }
  }

  return {
    route: "general",
    mode: "general_help",
    insightsFlow: "general_reasoning",
    confidence: input.intentHint?.confidence || "low",
    needsClarification: false,
    continueActiveFlow: false,
    activeFlowInfluence,
    requires: buildPlannerRequiresDefaults(),
    dataRequests: buildPlannerDataRequestsDefaults(),
    useScreenContext: false,
  };
}

function normalizeTextForFallback(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
