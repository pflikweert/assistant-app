import { classifySpendingQuestionType } from "./help-assistant-spending-advice";
import {
  buildPlannerDataRequestsDefaults,
  buildPlannerRequiresDefaults,
  countWords,
  detectRequestedTimeScope,
  isHelpAssistantResponseMode,
  isHelpAssistantTurnRoute,
  normalizeQuestionText,
  resolveDefaultInsightsFlowForRoute,
  resolveDefaultModeForRoute,
  sanitizeScopeSlug,
  tokenizeScopeText,
  type HelpAssistantActiveFlowDescriptor,
  type HelpAssistantAvailableCategoryScope,
  type HelpAssistantIntentHint,
  type HelpAssistantPlannerDataRequests,
  type HelpAssistantPlannerDecision,
  type HelpAssistantPlannerMonthScope,
  type HelpAssistantPlannerRequires,
  type HelpAssistantPlannerScopeSlug,
  type HelpAssistantPlannerTransactionQuestionType,
  type NormalizedActiveFlow,
} from "./help-assistant-orchestration-shared";

export type NormalizedRoutingDecision = HelpAssistantPlannerDecision;

export function looksLikeScreenExplanationQuestion(text: string) {
  const normalized = normalizeQuestionText(text);
  return (
    normalized.includes("leg dit scherm uit") ||
    normalized.includes("leg dit uit") ||
    normalized.includes("wat zie ik hier") ||
    normalized.includes("wat betekent dit") ||
    normalized.includes("hoe werkt dit scherm")
  );
}

export function looksLikeWeekScopedQuestion(text: string) {
  const normalized = normalizeQuestionText(text);
  return (
    normalized.includes("deze week") ||
    normalized.includes("dit weekend") ||
    normalized.includes("weekbudget") ||
    normalized.includes("tanken")
  );
}

export function shouldRequireCategorySummary(question: string | null | undefined) {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return false;
  return (
    normalized.includes("hoeveel heb ik aan") ||
    normalized.includes("hoeveel aan") ||
    normalized.includes("categorie") ||
    normalized.includes("kosten") ||
    normalized.includes("uitgaven") ||
    normalized.includes("uitgegeven") ||
    normalized.includes("besteed") ||
    normalized.includes("uitgegeven aan") ||
    normalized.includes("te veel uit aan")
  );
}

export function buildAvailableCategoryScopeMatcherText(input: {
  slug: string;
  label: string;
}) {
  return [input.slug.replace(/_/g, " "), input.label].join(" ");
}

export function inferCategoryScopeFromCatalog(input: {
  question: string | null | undefined;
  catalog: HelpAssistantAvailableCategoryScope[];
}): HelpAssistantPlannerScopeSlug {
  const normalizedQuestion = normalizeQuestionText(input.question);
  if (!normalizedQuestion) return "none";
  if (!input.catalog.length) return "none";

  const questionTokens = tokenizeScopeText(normalizedQuestion);
  let best: { slug: string; score: number } | null = null;

  for (const entry of input.catalog) {
    const slugText = entry.slug.replace(/_/g, " ");
    const labelText = normalizeQuestionText(entry.label);
    const entryTokens = new Set([
      ...tokenizeScopeText(entry.slug),
      ...tokenizeScopeText(entry.label),
    ]);

    let score = 0;
    if (normalizedQuestion.includes(slugText)) score += 3;
    if (labelText && normalizedQuestion.includes(labelText)) score += 4;
    for (const token of questionTokens) {
      if (entryTokens.has(token)) score += 1;
    }

    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { slug: entry.slug, score };
    }
  }

  return best ? best.slug : "none";
}

export function resolvePlannerDataCategoryScope(
  question: string | null | undefined,
  catalog?: HelpAssistantAvailableCategoryScope[],
): HelpAssistantPlannerScopeSlug {
  return inferCategoryScopeFromCatalog({
    question,
    catalog: catalog || [],
  });
}

export function resolvePlannerDataMerchantScope(
  question: string | null | undefined,
): HelpAssistantPlannerScopeSlug {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return "none";
  const match = normalized.match(/\bbij\s+([a-z0-9][a-z0-9\s]{1,40})$/i);
  if (!match?.[1]) return "none";
  return sanitizeScopeSlug(match[1], "unknown");
}

export function resolvePlannerTransactionQuestionType(
  question: string | null | undefined,
  input?: {
    categoryScope?: HelpAssistantPlannerScopeSlug;
    merchantScope?: HelpAssistantPlannerScopeSlug;
  },
): HelpAssistantPlannerTransactionQuestionType {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return "none";
  if (
    normalized.includes("hoe vaak") ||
    normalized.includes("frequent") ||
    normalized.includes("aantal")
  ) {
    return "merchant_frequency";
  }
  if (
    normalized.includes("waar") ||
    normalized.includes("welke winkel") ||
    normalized.includes("welke plekken")
  ) {
    return "category_places";
  }
  if (
    normalized.includes("hoeveel") ||
    normalized.includes("totaal") ||
    normalized.includes("uitgegeven")
  ) {
    if (input?.merchantScope && input.merchantScope !== "none") {
      return "merchant_total";
    }
    if (input?.categoryScope && input.categoryScope !== "none") {
      return "category_total";
    }
  }
  return "none";
}

export function buildFallbackDataRequests(
  latestUserText: string | null,
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[],
): HelpAssistantPlannerDataRequests {
  const categoryScope = resolvePlannerDataCategoryScope(
    latestUserText,
    availableCategoryScopes,
  );
  const merchantScope = resolvePlannerDataMerchantScope(latestUserText);
  const transactionQuestionType = resolvePlannerTransactionQuestionType(
    latestUserText,
    {
      categoryScope,
      merchantScope,
    },
  );
  const monthScope = latestUserText
    ? detectRequestedTimeScope(latestUserText).monthScopeHint || "current"
    : "none";
  return {
    monthScope,
    categoryScope,
    merchantScope,
    transactionQuestionType,
  };
}

export function normalizeActiveFlowDescriptor(input: {
  activeFlow?: HelpAssistantActiveFlowDescriptor | null;
  issueFlowActive?: boolean;
}): NormalizedActiveFlow | null {
  if (input.activeFlow && typeof input.activeFlow.route === "string") {
    const route = input.activeFlow.route.trim();
    const mode = String(input.activeFlow.mode || "").trim();
    const status = String(input.activeFlow.status || "").trim() || null;
    const anchorMessageId =
      String(input.activeFlow.anchorMessageId || "").trim() || null;
    const reason = String(input.activeFlow.reason || "").trim() || null;

    return {
      route: isHelpAssistantTurnRoute(route) ? route : "unknown",
      mode: isHelpAssistantResponseMode(mode) ? mode : "unknown",
      status,
      anchorMessageId,
      reason,
    };
  }

  if (input.issueFlowActive) {
    return {
      route: "issue_intake",
      mode: "issue_intake",
      status: "collecting",
      anchorMessageId: null,
      reason: "legacy_issue_flow_flag",
    };
  }

  return null;
}

export function isIssueLikeIntent(intent: HelpAssistantIntentHint) {
  if (!intent) return false;
  return (
    intent.intent === "feature_request" ||
    intent.intent === "feedback" ||
    intent.intent === "mogelijke_bug"
  );
}

function isLikelyShortClarificationReply(text: string | null | undefined) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const normalized = normalizeQuestionText(raw);
  if (!normalized) return false;
  if (classifySpendingQuestionType(normalized)) return false;
  if (looksLikeScreenExplanationQuestion(normalized)) return false;
  if (normalized.includes("?")) return false;
  const shortByWords = countWords(normalized) <= 5;
  const shortByLength = normalized.length <= 34;
  return shortByWords || shortByLength;
}

function isLikelyShortScopeRefinement(text: string | null | undefined) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const normalized = normalizeQuestionText(raw);
  if (!normalized) return false;
  if (looksLikeScreenExplanationQuestion(normalized)) return false;
  if (classifySpendingQuestionType(normalized)) return false;
  if (
    normalized.includes("vorige maand") ||
    normalized.includes("dit jaar") ||
    normalized.includes("trend")
  ) {
    return false;
  }
  return countWords(normalized.replace(/\?/g, "")) <= 3;
}

function hasExplicitIntentShift(input: {
  activeFlow: NormalizedActiveFlow | null;
  latestUserText: string | null;
  intentHint: HelpAssistantIntentHint;
}) {
  if (!input.activeFlow || !input.latestUserText) return false;
  if (input.activeFlow.route === "unknown") return false;

  const spendingType = classifySpendingQuestionType(input.latestUserText);
  if (spendingType && input.activeFlow.route !== "spending_advice") return true;

  if (
    looksLikeScreenExplanationQuestion(input.latestUserText) &&
    input.activeFlow.route !== "screen_explanation"
  ) {
    return true;
  }

  if (isIssueLikeIntent(input.intentHint) && input.activeFlow.route !== "issue_intake") {
    return true;
  }

  if (
    input.activeFlow.route === "issue_intake" &&
    !isIssueLikeIntent(input.intentHint) &&
    spendingType
  ) {
    return true;
  }

  return false;
}

function applyRouteDefaults(input: {
  decision: HelpAssistantPlannerDecision;
  latestUserText: string | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}) {
  const normalized = {
    ...input.decision,
    insightsFlow:
      input.decision.insightsFlow ||
      resolveDefaultInsightsFlowForRoute(input.decision.route),
    requires: { ...buildPlannerRequiresDefaults(), ...input.decision.requires },
    dataRequests: {
      ...buildPlannerDataRequestsDefaults(),
      ...input.decision.dataRequests,
    },
  };
  const latestUserText = input.latestUserText || "";

  if (normalized.route === "spending_advice") {
    normalized.insightsFlow = "spending_overview";
    normalized.mode =
      normalized.mode === "space_summary" ? "space_summary" : "spending_decision";
    normalized.requires.monthBudget = true;
    normalized.requires.cashflowSafety = true;
    normalized.requires.expectedEndBalance =
      normalized.mode === "spending_decision";
    if (
      !normalized.requires.categorySummary &&
      shouldRequireCategorySummary(latestUserText)
    ) {
      normalized.requires.categorySummary = true;
    }
    normalized.requires.transactionFacts = false;
    normalized.requires.screenExplanation = false;
    if (normalized.dataRequests.monthScope === "none") {
      normalized.dataRequests.monthScope = "current";
    }
    if (
      normalized.requires.categorySummary &&
      normalized.dataRequests.categoryScope === "none"
    ) {
      normalized.dataRequests.categoryScope = resolvePlannerDataCategoryScope(
        latestUserText,
        input.availableCategoryScopes,
      );
    }
    normalized.useScreenContext = false;
    return normalized;
  }

  if (normalized.route === "issue_intake") {
    normalized.insightsFlow = "issue_intake";
    normalized.mode = "issue_intake";
    normalized.requires = buildPlannerRequiresDefaults();
    normalized.dataRequests = buildPlannerDataRequestsDefaults();
    normalized.useScreenContext = true;
    return normalized;
  }

  if (normalized.route === "transactions_insight") {
    normalized.insightsFlow = "transaction_facts";
    normalized.mode = "transaction_lookup";
    normalized.requires = {
      ...buildPlannerRequiresDefaults(),
      transactionFacts: true,
    };
    if (normalized.dataRequests.monthScope === "none") {
      normalized.dataRequests.monthScope = "current";
    }
    if (normalized.dataRequests.transactionQuestionType === "none") {
      normalized.dataRequests.transactionQuestionType =
        resolvePlannerTransactionQuestionType(latestUserText, {
          categoryScope: normalized.dataRequests.categoryScope,
          merchantScope: normalized.dataRequests.merchantScope,
        });
    }
    if (normalized.dataRequests.merchantScope === "none") {
      normalized.dataRequests.merchantScope =
        resolvePlannerDataMerchantScope(latestUserText);
    }
    if (normalized.dataRequests.categoryScope === "none") {
      normalized.dataRequests.categoryScope = resolvePlannerDataCategoryScope(
        latestUserText,
        input.availableCategoryScopes,
      );
    }
    normalized.useScreenContext = false;
    return normalized;
  }

  if (normalized.route === "category_insight") {
    normalized.insightsFlow = "category_summary";
    normalized.mode = "category_summary";
    normalized.requires = {
      ...buildPlannerRequiresDefaults(),
      categorySummary: true,
    };
    if (normalized.dataRequests.monthScope === "none") {
      normalized.dataRequests.monthScope = "current";
    }
    if (normalized.dataRequests.categoryScope === "none") {
      normalized.dataRequests.categoryScope = resolvePlannerDataCategoryScope(
        latestUserText,
        input.availableCategoryScopes,
      );
    }
    normalized.useScreenContext = false;
    return normalized;
  }

  if (normalized.route === "screen_explanation") {
    normalized.insightsFlow = "screen_context";
    normalized.mode = "screen_help";
    normalized.requires = {
      ...buildPlannerRequiresDefaults(),
      screenExplanation: true,
    };
    normalized.dataRequests = buildPlannerDataRequestsDefaults();
    normalized.useScreenContext = true;
    return normalized;
  }

  normalized.insightsFlow = "general_reasoning";
  normalized.mode = "general_help";
  normalized.requires = buildPlannerRequiresDefaults();
  normalized.dataRequests = buildPlannerDataRequestsDefaults();
  normalized.requires.screenExplanation =
    normalized.useScreenContext ||
    normalized.requires.screenExplanation ||
    looksLikeScreenExplanationQuestion(latestUserText);
  normalized.useScreenContext =
    normalized.useScreenContext || normalized.requires.screenExplanation;
  return normalized;
}

export function normalizePlannerDataRequests(input: {
  dataRequests: HelpAssistantPlannerDataRequests;
  requires: HelpAssistantPlannerRequires;
  route: HelpAssistantPlannerDecision["route"];
  latestUserText: string | null;
  selectedPeriodKey: string | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}): {
  dataRequests: HelpAssistantPlannerDataRequests;
  fallbackReasons: string[];
  shouldClarify: boolean;
} {
  const fallbackReasons: string[] = [];
  let shouldClarify = false;
  const normalized: HelpAssistantPlannerDataRequests = {
    ...buildPlannerDataRequestsDefaults(),
    ...input.dataRequests,
  };
  const requestedTimeScope = detectRequestedTimeScope(input.latestUserText);

  if (
    requestedTimeScope.monthScopeHint === "previous" &&
    normalized.monthScope !== "previous"
  ) {
    normalized.monthScope = "previous";
    fallbackReasons.push("override_month_scope_to_previous_from_turn");
  }

  if (
    !["current", "previous", "specified", "none"].includes(normalized.monthScope)
  ) {
    normalized.monthScope = "none";
    fallbackReasons.push("invalid_month_scope");
  }

  if (
    ![
      "merchant_total",
      "merchant_frequency",
      "category_places",
      "category_total",
      "none",
    ].includes(normalized.transactionQuestionType)
  ) {
    normalized.transactionQuestionType = "none";
    fallbackReasons.push("invalid_transaction_question_type");
  }

  normalized.categoryScope = sanitizeScopeSlug(normalized.categoryScope, "none");
  normalized.merchantScope = sanitizeScopeSlug(normalized.merchantScope, "none");

  if (normalized.monthScope === "none" && requestedTimeScope.monthScopeHint) {
    normalized.monthScope = requestedTimeScope.monthScopeHint;
    fallbackReasons.push("inferred_month_scope_from_turn");
  }

  if (requestedTimeScope.unsupported === "year") {
    shouldClarify = true;
  }
  if (requestedTimeScope.unsupported === "trend") {
    shouldClarify = true;
  }

  if (
    normalized.monthScope === "none" &&
    (input.requires.monthBudget ||
      input.requires.cashflowSafety ||
      input.requires.expectedEndBalance ||
      input.requires.categorySummary ||
      input.requires.transactionFacts)
  ) {
    normalized.monthScope = "current";
    fallbackReasons.push("month_scope_none_promoted_to_current");
  }

  if (normalized.monthScope === "specified" && !input.selectedPeriodKey) {
    const requiresInsightData =
      input.requires.monthBudget ||
      input.requires.cashflowSafety ||
      input.requires.expectedEndBalance ||
      input.requires.categorySummary ||
      input.requires.transactionFacts;
    normalized.monthScope = requiresInsightData ? "current" : "none";
    fallbackReasons.push("month_scope_specified_without_period_context");
    shouldClarify = true;
  }

  if (normalized.categoryScope === "none" && input.requires.categorySummary) {
    const inferredCategory = resolvePlannerDataCategoryScope(
      input.latestUserText,
      input.availableCategoryScopes,
    );
    if (inferredCategory !== "none") {
      normalized.categoryScope = inferredCategory;
      fallbackReasons.push("inferred_category_scope_from_catalog");
    } else if ((input.availableCategoryScopes || []).length) {
      normalized.categoryScope = "unknown";
      fallbackReasons.push("category_scope_unknown_with_catalog");
      shouldClarify = true;
    }
  }

  if (normalized.transactionQuestionType === "none" && input.requires.transactionFacts) {
    const inferredType = resolvePlannerTransactionQuestionType(input.latestUserText, {
      categoryScope: normalized.categoryScope,
      merchantScope: normalized.merchantScope,
    });
    if (inferredType !== "none") {
      normalized.transactionQuestionType = inferredType;
      fallbackReasons.push("inferred_transaction_question_type_from_turn");
    } else {
      shouldClarify = true;
    }
  }

  if (
    normalized.transactionQuestionType === "none" &&
    input.requires.categorySummary &&
    normalized.categoryScope !== "none" &&
    normalized.categoryScope !== "unknown"
  ) {
    normalized.transactionQuestionType = "category_total";
    fallbackReasons.push("defaulted_transaction_question_type_category_total");
  }

  if (normalized.merchantScope === "none" && input.requires.transactionFacts) {
    const inferredMerchant = resolvePlannerDataMerchantScope(input.latestUserText);
    if (inferredMerchant !== "none") {
      normalized.merchantScope = inferredMerchant;
      fallbackReasons.push("inferred_merchant_scope_from_turn");
    }
  }

  if (!input.requires.transactionFacts) {
    const keepScopedCategoryQuestionType =
      input.requires.categorySummary &&
      (normalized.transactionQuestionType === "category_total" ||
        normalized.transactionQuestionType === "category_places");
    if (!keepScopedCategoryQuestionType) {
      normalized.transactionQuestionType = "none";
    }
    normalized.merchantScope = "none";
  }

  if (!input.requires.categorySummary) {
    normalized.categoryScope = "none";
  }

  if (
    input.route !== "transactions_insight" &&
    input.route !== "category_insight" &&
    !input.requires.monthBudget &&
    !input.requires.cashflowSafety &&
    !input.requires.expectedEndBalance &&
    !input.requires.categorySummary &&
    !input.requires.transactionFacts
  ) {
    normalized.monthScope = "none";
    normalized.categoryScope = "none";
    normalized.merchantScope = "none";
    normalized.transactionQuestionType = "none";
  }

  return {
    dataRequests: normalized,
    fallbackReasons,
    shouldClarify,
  };
}

export function normalizeRoutingDecision(input: {
  decision: HelpAssistantPlannerDecision;
  activeFlow: NormalizedActiveFlow | null;
  latestUserText: string | null;
  intentHint: HelpAssistantIntentHint;
  selectedPeriodKey: string | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}): NormalizedRoutingDecision {
  let normalized: NormalizedRoutingDecision = {
    ...input.decision,
    insightsFlow:
      input.decision.insightsFlow ||
      resolveDefaultInsightsFlowForRoute(input.decision.route),
    continueActiveFlow: Boolean(input.decision.continueActiveFlow),
    activeFlowInfluence: input.decision.activeFlowInfluence || "none",
    requires: { ...input.decision.requires },
    dataRequests: {
      ...buildPlannerDataRequestsDefaults(),
      ...input.decision.dataRequests,
    },
  };

  normalized = applyRouteDefaults({
    decision: normalized,
    latestUserText: input.latestUserText,
    availableCategoryScopes: input.availableCategoryScopes,
  });

  const dataRequestNormalization = normalizePlannerDataRequests({
    dataRequests: normalized.dataRequests,
    requires: normalized.requires,
    route: normalized.route,
    latestUserText: input.latestUserText,
    selectedPeriodKey: input.selectedPeriodKey,
    availableCategoryScopes: input.availableCategoryScopes,
  });
  normalized.dataRequests = dataRequestNormalization.dataRequests;
  if (dataRequestNormalization.shouldClarify) {
    normalized.needsClarification = true;
  }

  const hasActiveFlow =
    input.activeFlow != null && input.activeFlow.route !== "unknown";
  const explicitShift = hasExplicitIntentShift({
    activeFlow: input.activeFlow,
    latestUserText: input.latestUserText,
    intentHint: input.intentHint,
  });
  const shortClarificationContinuation =
    input.activeFlow?.route === "issue_intake" &&
    isLikelyShortClarificationReply(input.latestUserText);
  const shortScopeRefinementContinuation =
    (input.activeFlow?.route === "category_insight" ||
      input.activeFlow?.route === "transactions_insight") &&
    isLikelyShortScopeRefinement(input.latestUserText);

  if (!hasActiveFlow) {
    normalized.continueActiveFlow = false;
    normalized.activeFlowInfluence = "none";
    return normalized;
  }

  if (explicitShift) {
    normalized.continueActiveFlow = false;
    normalized.activeFlowInfluence = "low";
    return normalized;
  }

  if (shortClarificationContinuation && input.activeFlow?.route) {
    normalized.continueActiveFlow = true;
    if (normalized.confidence !== "high") {
      normalized.route = input.activeFlow.route;
      normalized.mode = resolveDefaultModeForRoute(input.activeFlow.route);
    }
    normalized.activeFlowInfluence =
      normalized.activeFlowInfluence === "none"
        ? "medium"
        : normalized.activeFlowInfluence;
    normalized = applyRouteDefaults({
      decision: normalized,
      latestUserText: input.latestUserText,
      availableCategoryScopes: input.availableCategoryScopes,
    });
    return normalized;
  }

  if (shortScopeRefinementContinuation && input.activeFlow?.route) {
    normalized.continueActiveFlow = true;
    normalized.route = input.activeFlow.route;
    normalized.mode = resolveDefaultModeForRoute(input.activeFlow.route);
    normalized.activeFlowInfluence =
      normalized.activeFlowInfluence === "none"
        ? "medium"
        : normalized.activeFlowInfluence;
    normalized = applyRouteDefaults({
      decision: normalized,
      latestUserText: input.latestUserText,
      availableCategoryScopes: input.availableCategoryScopes,
    });
    const rerun = normalizePlannerDataRequests({
      dataRequests: normalized.dataRequests,
      requires: normalized.requires,
      route: normalized.route,
      latestUserText: input.latestUserText,
      selectedPeriodKey: input.selectedPeriodKey,
      availableCategoryScopes: input.availableCategoryScopes,
    });
    normalized.dataRequests = rerun.dataRequests;
    if (rerun.shouldClarify) {
      normalized.needsClarification = true;
    }
    return normalized;
  }

  if (normalized.continueActiveFlow) {
    normalized.activeFlowInfluence =
      normalized.activeFlowInfluence === "none"
        ? "medium"
        : normalized.activeFlowInfluence;
  } else if (normalized.activeFlowInfluence === "high") {
    normalized.activeFlowInfluence = "medium";
  }

  return normalized;
}
