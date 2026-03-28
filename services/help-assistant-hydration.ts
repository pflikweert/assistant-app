import type { HelpAssistantContext } from "./help-assistant-context";
import type { UnifiedFinancialAdviceContext } from "./help-assistant-financial-context";
import {
  buildPlannerDataRequestsDefaults,
  detectRequestedTimeScope,
  formatAmount,
  normalizeQuestionText,
  resolveContextMonthKey,
  sanitizeScopeSlug,
  shiftMonthKey,
  tokenizeScopeText,
  type HelpAssistantAvailableCategoryScope,
  type HelpAssistantHydrationAnswerability,
  type HelpAssistantHydrationPeriodMatch,
  type HelpAssistantHydrationResult,
} from "./help-assistant-orchestration-shared";
import type { NormalizedRoutingDecision } from "./help-assistant-route-normalization";

export function shouldPrimeFinancialCatalog(question: string | null | undefined) {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return false;
  if (
    normalized.includes("waarom klopt") ||
    normalized.includes("klopt dit niet") ||
    normalized.includes("werkt niet") ||
    normalized.includes("bug")
  ) {
    return false;
  }
  if (
    normalized.includes("ruimte") ||
    normalized.includes("uitgeven") ||
    normalized.includes("budget") ||
    normalized.includes("over budget")
  ) {
    return true;
  }
  if (
    normalized.includes("transactie") ||
    normalized.includes("categorie") ||
    normalized.includes("uitgegeven") ||
    normalized.includes("besteed")
  ) {
    return true;
  }
  return false;
}

export function buildAvailableCategoryScopes(
  context: UnifiedFinancialAdviceContext | null | undefined,
): HelpAssistantAvailableCategoryScope[] {
  if (!context) return [];
  const entries = new Map<string, HelpAssistantAvailableCategoryScope>();
  const register = (input: {
    slugRaw: string | null | undefined;
    labelRaw: string | null | undefined;
    source: HelpAssistantAvailableCategoryScope["source"];
  }) => {
    const slug = sanitizeScopeSlug(input.slugRaw, "none");
    const label = String(input.labelRaw || "").trim();
    if (slug === "none" || slug === "unknown") return;
    if (!label) return;
    const existing = entries.get(slug);
    if (!existing) {
      entries.set(slug, { slug, label, source: input.source });
      return;
    }
    if (existing.source === "budget" && input.source !== "budget") {
      entries.set(slug, { slug, label, source: input.source });
    }
  };

  for (const category of context.spending.currentMonthBreakdown.categories || []) {
    register({
      slugRaw: category.categoryKey || category.key,
      labelRaw: category.label,
      source: "spending",
    });
    for (const subcategory of category.subcategories || []) {
      register({
        slugRaw: subcategory.categoryKey || subcategory.key,
        labelRaw: subcategory.label,
        source: "subcategory",
      });
    }
  }

  for (const budgetCategory of context.budgetPlan.variableCategoryBudgets || []) {
    register({
      slugRaw: budgetCategory.categoryKey,
      labelRaw: budgetCategory.label,
      source: "budget",
    });
  }

  return [...entries.values()];
}

export function buildContextForRequestedMonthScope(input: {
  context: HelpAssistantContext;
  monthScope: "current" | "previous" | "specified" | "none" | null | undefined;
}) {
  if (input.monthScope !== "previous") {
    return input.context;
  }
  const baseMonthKey = resolveContextMonthKey(input.context.selectedPeriod);
  const previousMonth = shiftMonthKey(baseMonthKey, -1);
  if (!previousMonth) return input.context;
  return {
    ...input.context,
    selectedPeriod: {
      key: previousMonth.key,
      label: previousMonth.label,
      startIso: previousMonth.startIso,
      endIsoExclusive: previousMonth.endIso,
    },
  } satisfies HelpAssistantContext;
}

function mergeAnswerability(
  current: HelpAssistantHydrationAnswerability,
  next: HelpAssistantHydrationAnswerability,
): HelpAssistantHydrationAnswerability {
  if (current === "blocked" || next === "blocked") return "blocked";
  if (current === "partial" || next === "partial") return "partial";
  return "answerable";
}

function normalizeMatchText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPeriodMatch(input: {
  monthScope: NormalizedRoutingDecision["dataRequests"]["monthScope"];
  dataPeriodKey: string | null;
  requestedPeriodKey: string | null;
}): HelpAssistantHydrationPeriodMatch {
  if (input.monthScope === "none") return "unknown";
  if (!input.dataPeriodKey || !input.requestedPeriodKey) return "unknown";
  return input.dataPeriodKey === input.requestedPeriodKey ? "exact" : "mismatch";
}

export function buildHydrationResult(input: {
  routingDecision: NormalizedRoutingDecision;
  unifiedFinancialContext: UnifiedFinancialAdviceContext | null;
  requestedPeriodKey: string | null;
  latestUserText?: string | null;
}): HelpAssistantHydrationResult {
  const loadedBlocks: string[] = [];
  const limitations: string[] = [];
  let answerability: HelpAssistantHydrationAnswerability = "answerable";
  let periodMatch: HelpAssistantHydrationPeriodMatch = "unknown";

  const needsHydration =
    input.routingDecision.requires.monthBudget ||
    input.routingDecision.requires.cashflowSafety ||
    input.routingDecision.requires.expectedEndBalance ||
    input.routingDecision.requires.categorySummary ||
    input.routingDecision.requires.transactionFacts;

  if (!input.unifiedFinancialContext) {
    if (needsHydration) {
      limitations.push("financiele_context_niet_beschikbaar");
      answerability = "blocked";
    }
    return {
      financialSnapshotBlock: null,
      categorySummaryBlock: null,
      transactionFactsBlock: null,
      loadedBlocks,
      limitations,
      answerability,
      periodMatch,
    };
  }

  periodMatch = buildPeriodMatch({
    monthScope: input.routingDecision.dataRequests.monthScope,
    dataPeriodKey: input.unifiedFinancialContext.period.key || null,
    requestedPeriodKey: input.requestedPeriodKey,
  });

  if (periodMatch === "mismatch") {
    limitations.push("month_scope_niet_volledig_gehydrateerd");
  }
  const requestedTimeScope = detectRequestedTimeScope(input.latestUserText);
  if (requestedTimeScope.unsupported === "year") {
    limitations.push("jaar_scope_nog_niet_volledig_gehydrateerd");
    answerability = mergeAnswerability(answerability, "partial");
  }
  if (requestedTimeScope.unsupported === "trend") {
    limitations.push("trend_scope_nog_niet_volledig_gehydrateerd");
    answerability = mergeAnswerability(answerability, "partial");
  }

  let financialSnapshotBlock: string | null = null;
  if (
    input.routingDecision.requires.monthBudget ||
    input.routingDecision.requires.cashflowSafety ||
    input.routingDecision.requires.expectedEndBalance
  ) {
    loadedBlocks.push("financialSnapshot");
    const context = input.unifiedFinancialContext;
    financialSnapshotBlock = [
      "Truth-safe financialSnapshot:",
      `- Periode: ${context.period.label || "onbekend"}`,
      `- Resterend variabel budget: ${formatAmount(
        context.budget.remainingVariableBudget,
      ) || "onbekend"}`,
      `- Verwacht eindsaldo: ${formatAmount(
        context.forecastCurrentMonth.expectedEndBalance,
      ) || "onbekend"}`,
      `- Cashflow risico: ${context.forecastCurrentMonth.cashRiskFlag}`,
    ].join("\n");
  }

  let categorySummaryBlock: string | null = null;
  if (input.routingDecision.requires.categorySummary) {
    loadedBlocks.push("categorySummary");
    const categories =
      input.unifiedFinancialContext.spending.currentMonthBreakdown.categories || [];
    const availableCategoryScopes = buildAvailableCategoryScopes(
      input.unifiedFinancialContext,
    );
    const inferredScope =
      input.latestUserText && availableCategoryScopes.length
        ? availableCategoryScopes
            .map((scope) => ({
              slug: scope.slug,
              label: scope.label,
              score: (() => {
                const normalizedQuestion = normalizeQuestionText(input.latestUserText);
                if (!normalizedQuestion) return 0;
                let score = 0;
                const slugText = scope.slug.replace(/_/g, " ");
                const labelText = normalizeQuestionText(scope.label);
                const entryTokens = new Set([
                  ...tokenizeScopeText(scope.slug),
                  ...tokenizeScopeText(scope.label),
                ]);
                if (normalizedQuestion.includes(slugText)) score += 3;
                if (labelText && normalizedQuestion.includes(labelText)) score += 4;
                for (const token of tokenizeScopeText(normalizedQuestion)) {
                  if (entryTokens.has(token)) score += 1;
                }
                return score;
              })(),
            }))
            .sort((a, b) => b.score - a.score)[0]
        : null;
    const normalizedScope = sanitizeScopeSlug(
      input.routingDecision.dataRequests.categoryScope,
      "none",
    );
    const effectiveScope =
      (normalizedScope === "none" || normalizedScope === "unknown") &&
      inferredScope &&
      inferredScope.score > 0
        ? inferredScope.slug
        : normalizedScope;
    const scopeReference = availableCategoryScopes.find(
      (scope) => scope.slug === effectiveScope,
    );
    const scopeTokens = tokenizeScopeText(
      [effectiveScope.replace(/_/g, " "), scopeReference?.label || ""].join(" "),
    );
    const categoryMatchesScope = (category: {
      key: string;
      categoryKey?: string | null;
      label: string;
      subcategories?: {
        key: string;
        categoryKey?: string | null;
        label: string;
      }[];
    }) => {
      if (effectiveScope === "none" || effectiveScope === "unknown") {
        return true;
      }
      const directCandidates = [
        sanitizeScopeSlug(category.categoryKey || "", "none"),
        sanitizeScopeSlug(category.key || "", "none"),
        sanitizeScopeSlug(category.label || "", "none"),
      ];
      if (directCandidates.includes(effectiveScope)) return true;
      const textCandidates = [
        normalizeMatchText(category.categoryKey || ""),
        normalizeMatchText(category.label || ""),
      ];
      for (const subcategory of category.subcategories || []) {
        textCandidates.push(normalizeMatchText(subcategory.categoryKey || ""));
        textCandidates.push(normalizeMatchText(subcategory.label || ""));
      }
      return scopeTokens.some((token) =>
        textCandidates.some((candidate) => candidate.includes(token)),
      );
    };

    const scopedCategories =
      effectiveScope === "none" || effectiveScope === "unknown"
        ? categories.slice(0, 5)
        : categories.filter((category) => categoryMatchesScope(category));
    const mapped = scopedCategories.map((category) => ({
      category: sanitizeScopeSlug(
        category.categoryKey || category.key,
        "unknown",
      ),
      label: category.label,
      total: formatAmount(category.amount) || "onbekend",
      transactionCount: category.transactionCount,
    }));
    const scopedCategory =
      effectiveScope !== "none" && effectiveScope !== "unknown" && mapped.length === 1
        ? mapped[0]
        : null;

    if (!mapped.length && effectiveScope !== "none" && effectiveScope !== "unknown") {
      limitations.push("categorie_scope_niet_gevonden_in_geaggregeerde_data");
      answerability = mergeAnswerability(answerability, "blocked");
    } else if (effectiveScope === "unknown") {
      limitations.push("categorie_scope_onduidelijk");
      answerability = mergeAnswerability(answerability, "partial");
    } else if (effectiveScope === "none") {
      answerability = mergeAnswerability(answerability, "partial");
    }

    if (
      input.routingDecision.dataRequests.transactionQuestionType === "category_total" &&
      !scopedCategory
    ) {
      answerability = mergeAnswerability(answerability, "blocked");
    }

    if (periodMatch === "mismatch") {
      answerability = mergeAnswerability(answerability, "blocked");
    }

    categorySummaryBlock = [
      "Truth-safe categorySummary:",
      `- monthScope: ${input.routingDecision.dataRequests.monthScope}`,
      `- dataPeriod: ${input.unifiedFinancialContext.period.label || "onbekend"}`,
      `- periodMatch: ${periodMatch}`,
      `- categoryScope: ${effectiveScope}`,
      `- availableCategoryScopes: ${JSON.stringify(
        availableCategoryScopes.slice(0, 20),
      )}`,
      scopedCategory
        ? `- scopedCategoryLabel: ${scopedCategory.label}`
        : "- scopedCategoryLabel: onbekend",
      scopedCategory
        ? `- scopedCategoryTotal: ${scopedCategory.total}`
        : "- scopedCategoryTotal: onbekend",
      scopedCategory
        ? `- scopedCategoryTransactionCount: ${scopedCategory.transactionCount}`
        : "- scopedCategoryTransactionCount: onbekend",
      `- categories: ${JSON.stringify(mapped)}`,
    ].join("\n");
  }

  let transactionFactsBlock: string | null = null;
  if (input.routingDecision.requires.transactionFacts) {
    loadedBlocks.push("transactionFacts");
    const questionType =
      input.routingDecision.dataRequests.transactionQuestionType ||
      buildPlannerDataRequestsDefaults().transactionQuestionType;
    const merchantScope = sanitizeScopeSlug(
      input.routingDecision.dataRequests.merchantScope,
      "none",
    );
    const categoryScope = sanitizeScopeSlug(
      input.routingDecision.dataRequests.categoryScope,
      "none",
    );
    const categories =
      input.unifiedFinancialContext.spending.currentMonthBreakdown.categories || [];
    const availableCategoryScopes = buildAvailableCategoryScopes(
      input.unifiedFinancialContext,
    );
    const scopeReference = availableCategoryScopes.find(
      (scope) => scope.slug === categoryScope,
    );
    const scopeTokens = tokenizeScopeText(
      [categoryScope.replace(/_/g, " "), scopeReference?.label || ""].join(" "),
    );
    const categoryMatch =
      categoryScope === "none" || categoryScope === "unknown"
        ? null
        : categories.find((category) => {
            const normalizedCategoryKey = sanitizeScopeSlug(
              category.categoryKey || category.key,
              "none",
            );
            const textCandidates = [
              normalizeQuestionText(category.categoryKey || ""),
              normalizeQuestionText(category.label || ""),
              ...(category.subcategories || []).flatMap((subcategory) => [
                normalizeQuestionText(subcategory.categoryKey || ""),
                normalizeQuestionText(subcategory.label || ""),
              ]),
            ];
            return (
              normalizedCategoryKey === categoryScope ||
              textCandidates.some((candidate) =>
                scopeTokens.some((token) => candidate.includes(token)),
              )
            );
          }) || null;

    const payload: Record<string, unknown> = {
      monthScope: input.routingDecision.dataRequests.monthScope,
      dataPeriod: input.unifiedFinancialContext.period.label || "onbekend",
      periodMatch,
      transactionQuestionType: questionType,
      categoryScope,
      merchantScope,
      answerability: "blocked",
    };

    if (questionType === "category_total" && categoryMatch) {
      payload.answerability = periodMatch === "mismatch" ? "blocked" : "answerable";
      payload.categoryTotal = formatAmount(categoryMatch.amount);
      payload.categoryTransactionCount = categoryMatch.transactionCount;
      answerability = mergeAnswerability(
        answerability,
        periodMatch === "mismatch" ? "blocked" : "answerable",
      );
    } else if (questionType === "category_places") {
      limitations.push("merchant_locaties_niet_beschikbaar_zonder_extra_hydration");
      answerability = mergeAnswerability(answerability, "blocked");
    } else if (
      questionType === "merchant_total" ||
      questionType === "merchant_frequency"
    ) {
      limitations.push("merchant_aggregaten_niet_beschikbaar_in_deze_hydrationlaag");
      answerability = mergeAnswerability(answerability, "blocked");
    } else if (questionType === "none") {
      limitations.push("transactie_vraagtype_onduidelijk");
      answerability = mergeAnswerability(answerability, "blocked");
    } else {
      limitations.push("transactie_scope_niet_betrouwbaar_beantwoordbaar");
      answerability = mergeAnswerability(answerability, "blocked");
    }

    if (periodMatch === "mismatch") {
      answerability = mergeAnswerability(answerability, "blocked");
    }

    transactionFactsBlock = [
      "Truth-safe transactionFacts:",
      `- payload: ${JSON.stringify(payload)}`,
    ].join("\n");
  }

  return {
    financialSnapshotBlock,
    categorySummaryBlock,
    transactionFactsBlock,
    loadedBlocks,
    limitations,
    answerability,
    periodMatch,
  };
}
