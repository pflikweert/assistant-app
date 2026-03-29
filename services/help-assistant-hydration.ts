import type { HelpAssistantContext } from "./help-assistant-context";
import {
  resolveSafeCategoryBreakdownInRange,
  resolveSafeMerchantAggregatesInRange,
  type FinancialCategorySpendBreakdown,
  type SafeMerchantAggregate,
  type UnifiedFinancialAdviceContext,
} from "./help-assistant-financial-context";
import {
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
  additionalScopes: HelpAssistantAvailableCategoryScope[] = [],
): HelpAssistantAvailableCategoryScope[] {
  const entries = new Map<string, HelpAssistantAvailableCategoryScope>();
  const sourcePriority: Record<HelpAssistantAvailableCategoryScope["source"], number> = {
    catalog: 0,
    budget: 1,
    spending: 2,
    subcategory: 3,
  };
  const register = (input: {
    slugRaw: string | null | undefined;
    labelRaw: string | null | undefined;
    source: HelpAssistantAvailableCategoryScope["source"];
    kind?: HelpAssistantAvailableCategoryScope["kind"];
  }) => {
    const slug = sanitizeScopeSlug(input.slugRaw, "none");
    const label = String(input.labelRaw || "").trim();
    if (slug === "none" || slug === "unknown") return;
    if (!label) return;
    const existing = entries.get(slug);
    if (!existing) {
      entries.set(slug, {
        slug,
        label,
        source: input.source,
        kind: input.kind,
      });
      return;
    }
    if (sourcePriority[input.source] > sourcePriority[existing.source]) {
      entries.set(slug, {
        slug,
        label,
        source: input.source,
        kind: input.kind,
      });
    }
  };

  for (const scope of additionalScopes) {
    register({
      slugRaw: scope.slug,
      labelRaw: scope.label,
      source: scope.source,
      kind: scope.kind,
    });
  }

  for (const category of context?.spending.currentMonthBreakdown.categories || []) {
    register({
      slugRaw: category.categoryKey || category.key,
      labelRaw: category.label,
      source: "spending",
      kind: "expense",
    });
    for (const subcategory of category.subcategories || []) {
      register({
        slugRaw: subcategory.categoryKey || subcategory.key,
        labelRaw: `${category.label} > ${subcategory.label}`,
        source: "subcategory",
        kind: "expense",
      });
    }
  }

  for (const budgetCategory of context?.budgetPlan.variableCategoryBudgets || []) {
    register({
      slugRaw: budgetCategory.categoryKey,
      labelRaw: budgetCategory.label,
      source: "budget",
      kind: "expense",
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

function inferCategoryScope(input: {
  latestUserText: string | null | undefined;
  availableCategoryScopes: HelpAssistantAvailableCategoryScope[];
  requestedScope: string;
}) {
  const sourcePriority: Record<
    HelpAssistantAvailableCategoryScope["source"],
    number
  > = {
    catalog: 0,
    budget: 1,
    spending: 2,
    subcategory: 3,
  };
  const inferredScope =
    input.latestUserText && input.availableCategoryScopes.length
      ? input.availableCategoryScopes
          .map((scope) => ({
            slug: scope.slug,
            label: scope.label,
            source: scope.source,
            score: (() => {
              const normalizedQuestion = normalizeQuestionText(input.latestUserText);
              if (!normalizedQuestion) return 0;
              const collapsedQuestion = normalizedQuestion.replace(/\s+/g, "");
              let score = 0;
              const slugText = scope.slug.replace(/_/g, " ");
              const labelText = normalizeQuestionText(scope.label);
              const leafLabelText = normalizeQuestionText(
                scope.label.split(">").pop()?.trim() || scope.label,
              );
              const collapsedLabelText = labelText.replace(/\s+/g, "");
              const collapsedLeafLabelText = leafLabelText.replace(/\s+/g, "");
              const entryTokens = new Set([
                ...tokenizeScopeText(scope.slug),
                ...tokenizeScopeText(scope.label),
              ]);
              if (normalizedQuestion.includes(slugText)) score += 3;
              if (labelText && normalizedQuestion.includes(labelText)) score += 4;
              if (leafLabelText && normalizedQuestion.includes(leafLabelText)) score += 5;
              if (
                collapsedQuestion &&
                collapsedLabelText &&
                (collapsedQuestion.includes(collapsedLabelText) ||
                  collapsedLabelText.includes(collapsedQuestion))
              ) {
                score += 6;
              }
              if (
                collapsedQuestion &&
                collapsedLeafLabelText &&
                (collapsedQuestion.includes(collapsedLeafLabelText) ||
                  collapsedLeafLabelText.includes(collapsedQuestion))
              ) {
                score += 7;
              }
              for (const token of tokenizeScopeText(normalizedQuestion)) {
                if (entryTokens.has(token)) score += 1;
              }
              return score;
            })(),
          }))
          .sort(
            (a, b) =>
              b.score - a.score ||
              sourcePriority[b.source] - sourcePriority[a.source],
          )[0]
      : null;

  if (
    (input.requestedScope === "none" || input.requestedScope === "unknown") &&
    inferredScope &&
    inferredScope.score > 0
  ) {
    return inferredScope.slug;
  }

  return input.requestedScope;
}

function categoryMatchesScope(input: {
  category: {
    key: string;
    categoryKey?: string | null;
    label: string;
    subcategories?: {
      key: string;
      categoryKey?: string | null;
      label: string;
    }[];
  };
  scope: string;
  scopeReferenceLabel?: string | null;
}) {
  if (input.scope === "none" || input.scope === "unknown") {
    return true;
  }

  const directCandidates = [
    sanitizeScopeSlug(input.category.categoryKey || "", "none"),
    sanitizeScopeSlug(input.category.key || "", "none"),
    sanitizeScopeSlug(input.category.label || "", "none"),
  ];
  if (directCandidates.includes(input.scope)) return true;

  const scopeTokens = tokenizeScopeText(
    [input.scope.replace(/_/g, " "), input.scopeReferenceLabel || ""].join(" "),
  );
  const textCandidates = [
    normalizeMatchText(input.category.categoryKey || ""),
    normalizeMatchText(input.category.label || ""),
  ];
  for (const subcategory of input.category.subcategories || []) {
    textCandidates.push(normalizeMatchText(subcategory.categoryKey || ""));
    textCandidates.push(normalizeMatchText(subcategory.label || ""));
  }

  return scopeTokens.some((token) =>
    textCandidates.some((candidate) => candidate.includes(token)),
  );
}

type ScopedSpendEntry = {
  category: string;
  label: string;
  total: string;
  rawTotal: number;
  transactionCount: number;
  granularity: "category" | "subcategory";
  parentCategory?: string;
  parentLabel?: string;
};

function buildScopeCandidates(input: {
  breakdown: FinancialCategorySpendBreakdown;
  scope: string;
  availableCategoryScopes: HelpAssistantAvailableCategoryScope[];
}) {
  const scopeReference = input.availableCategoryScopes.find(
    (scope) => scope.slug === input.scope,
  );
  const scopeTokens = tokenizeScopeText(
    [input.scope.replace(/_/g, " "), scopeReference?.label || ""].join(" "),
  );

  const categoryEntries: ScopedSpendEntry[] = input.breakdown.categories.map((category) => ({
    category: sanitizeScopeSlug(category.categoryKey || category.key, "unknown"),
    label: category.label,
    total: formatAmount(category.amount) || "onbekend",
    rawTotal: category.amount,
    transactionCount: category.transactionCount,
    granularity: "category",
  }));

  const subcategoryEntries: ScopedSpendEntry[] = input.breakdown.categories.flatMap(
    (category) =>
      (category.subcategories || []).map((subcategory) => ({
        category: sanitizeScopeSlug(
          subcategory.categoryKey || subcategory.key,
          "unknown",
        ),
        label: subcategory.label,
        total: formatAmount(subcategory.amount) || "onbekend",
        rawTotal: subcategory.amount,
        transactionCount: subcategory.transactionCount,
        granularity: "subcategory" as const,
        parentCategory: sanitizeScopeSlug(
          category.categoryKey || category.key,
          "unknown",
        ),
        parentLabel: category.label,
      })),
  );

  if (input.scope === "none" || input.scope === "unknown") {
    return {
      categoryEntries,
      subcategoryEntries,
      exactCategoryMatches: [] as ScopedSpendEntry[],
      exactSubcategoryMatches: [] as ScopedSpendEntry[],
      fuzzyCategoryMatches: [] as ScopedSpendEntry[],
      fuzzySubcategoryMatches: [] as ScopedSpendEntry[],
    };
  }

  const exactCategoryMatches = categoryEntries.filter(
    (entry) => entry.category === input.scope,
  );
  const exactSubcategoryMatches = subcategoryEntries.filter(
    (entry) => entry.category === input.scope,
  );
  const fuzzyCategoryMatches = input.breakdown.categories
    .filter((category) =>
      categoryMatchesScope({
        category,
        scope: input.scope,
        scopeReferenceLabel: scopeReference?.label || null,
      }),
    )
    .map((category) => ({
      category: sanitizeScopeSlug(category.categoryKey || category.key, "unknown"),
      label: category.label,
      total: formatAmount(category.amount) || "onbekend",
      rawTotal: category.amount,
      transactionCount: category.transactionCount,
      granularity: "category" as const,
    }));
  const fuzzySubcategoryMatches = subcategoryEntries.filter((entry) => {
    const candidates = [
      normalizeMatchText(entry.category),
      normalizeMatchText(entry.label),
      normalizeMatchText(entry.parentCategory || ""),
      normalizeMatchText(entry.parentLabel || ""),
    ];
    return scopeTokens.some((token) =>
      candidates.some((candidate) => candidate.includes(token)),
    );
  });

  return {
    categoryEntries,
    subcategoryEntries,
    exactCategoryMatches,
    exactSubcategoryMatches,
    fuzzyCategoryMatches,
    fuzzySubcategoryMatches,
  };
}

function mapScopedCategories(input: {
  breakdown: FinancialCategorySpendBreakdown;
  scope: string;
  availableCategoryScopes: HelpAssistantAvailableCategoryScope[];
}) {
  const candidates = buildScopeCandidates(input);
  const mapped =
    input.scope === "none" || input.scope === "unknown"
      ? candidates.categoryEntries.slice(0, 5)
      : candidates.exactSubcategoryMatches.length
        ? candidates.exactSubcategoryMatches
        : candidates.exactCategoryMatches.length
          ? candidates.exactCategoryMatches
          : candidates.fuzzyCategoryMatches.length
            ? candidates.fuzzyCategoryMatches
            : candidates.fuzzySubcategoryMatches;

  const scopedCategory =
    input.scope !== "none" && input.scope !== "unknown" && mapped.length === 1
      ? mapped[0]
      : null;
  const scopedParentCategory =
    scopedCategory?.granularity === "category"
      ? input.breakdown.categories.find(
          (category) =>
            sanitizeScopeSlug(category.categoryKey || category.key, "unknown") ===
            scopedCategory.category,
        ) || null
      : null;
  const scopedSubcategoryBreakdown =
    scopedParentCategory && scopedParentCategory.subcategories?.length
      ? scopedParentCategory.subcategories.map((subcategory) => ({
          category: sanitizeScopeSlug(
            subcategory.categoryKey || subcategory.key,
            "unknown",
          ),
          label: subcategory.label,
          total: formatAmount(subcategory.amount) || "onbekend",
          transactionCount: subcategory.transactionCount,
        }))
      : [];

  return {
    mapped,
    scopedCategory,
    scopedSubcategoryBreakdown,
  };
}

function buildMonthRange(monthKey: string | null) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const shifted = shiftMonthKey(monthKey, 0);
  if (!shifted) return null;
  return {
    startIso: shifted.startIso,
    endIsoExclusive: shifted.endIso,
    label: shifted.label,
  };
}

function buildPreviousMonthRange(monthKey: string | null) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const shifted = shiftMonthKey(monthKey, -1);
  if (!shifted) return null;
  return {
    startIso: shifted.startIso,
    endIsoExclusive: shifted.endIso,
    label: shifted.label,
  };
}

function buildYearToDateRange(monthKey: string | null) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [year] = monthKey.split("-");
  const end = shiftMonthKey(monthKey, 1);
  if (!year || !end) return null;
  return {
    startIso: `${year}-01-01`,
    endIsoExclusive: end.startIso,
    label: `${year} tot geselecteerde maand`,
  };
}

function buildSameMonthLastYearRange(monthKey: string | null) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const shifted = shiftMonthKey(monthKey, -12);
  if (!shifted) return null;
  return {
    startIso: shifted.startIso,
    endIsoExclusive: shifted.endIso,
    label: shifted.label,
  };
}

function countMonthsInYearToDate(monthKey: string | null) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [, monthValue] = monthKey.split("-");
  const month = Number.parseInt(monthValue || "", 10);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
}

function asksForBreakdown(text: string | null | undefined) {
  const normalized = normalizeQuestionText(text);
  if (!normalized) return false;
  return (
    normalized.includes("onderverdeling") ||
    normalized.includes("subcategorie") ||
    normalized.includes("sub categorie") ||
    normalized.includes("binnen ") ||
    normalized.includes("welke posten") ||
    normalized.includes("waar bestaat")
  );
}

function asksForAverage(text: string | null | undefined) {
  const normalized = normalizeQuestionText(text);
  if (!normalized) return false;
  return (
    normalized.includes("gemiddelde") ||
    normalized.includes("gemiddeld") ||
    normalized.includes("per maand")
  );
}

function asksForLastYearComparison(text: string | null | undefined) {
  const normalized = normalizeQuestionText(text);
  if (!normalized) return false;
  return (
    normalized.includes("vorig jaar") ||
    normalized.includes("duurder geworden") ||
    normalized.includes("gestegen") ||
    normalized.includes("meer dan vorig jaar") ||
    normalized.includes("minder dan vorig jaar")
  );
}

function findMerchantAggregate(input: {
  merchantScope: string;
  aggregates: SafeMerchantAggregate[];
}) {
  const exact = input.aggregates.find(
    (aggregate) => aggregate.merchantKey === input.merchantScope,
  );
  if (exact) return exact;
  return (
    input.aggregates.find(
      (aggregate) =>
        aggregate.merchantKey.includes(input.merchantScope) ||
        input.merchantScope.includes(aggregate.merchantKey),
    ) || null
  );
}

export async function buildHydrationResult(input: {
  routingDecision: NormalizedRoutingDecision;
  unifiedFinancialContext: UnifiedFinancialAdviceContext | null;
  requestedPeriodKey: string | null;
  latestUserText?: string | null;
  context: HelpAssistantContext;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}): Promise<HelpAssistantHydrationResult> {
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
    const availableCategoryScopes = buildAvailableCategoryScopes(
      input.unifiedFinancialContext,
      input.availableCategoryScopes || [],
    );
    const requestedScope = sanitizeScopeSlug(
      input.routingDecision.dataRequests.categoryScope,
      "none",
    );
    const averageRequested = asksForAverage(input.latestUserText);
    const lastYearComparisonRequested = asksForLastYearComparison(
      input.latestUserText,
    );
    const effectiveScope = inferCategoryScope({
      latestUserText: input.latestUserText || null,
      availableCategoryScopes,
      requestedScope,
    });
    const scopeReference = availableCategoryScopes.find(
      (scope) => scope.slug === effectiveScope,
    );
    const categoryDirection = scopeReference?.kind === "income" ? "income" : "expense";
    const requestedRange = buildMonthRange(input.requestedPeriodKey);
    const currentBreakdown =
      categoryDirection === "expense"
        ? input.unifiedFinancialContext.spending.currentMonthBreakdown
        : requestedRange
          ? await resolveSafeCategoryBreakdownInRange({
              context: input.context,
              startIso: requestedRange.startIso,
              endIsoExclusive: requestedRange.endIsoExclusive,
              direction: "income",
            }).catch(() => ({
              total: 0,
              transactionCount: 0,
              categories: [],
            }))
          : {
              total: 0,
              transactionCount: 0,
              categories: [],
            };
    const currentScoped = mapScopedCategories({
      breakdown: currentBreakdown,
      scope: effectiveScope,
      availableCategoryScopes,
    });

    let trendComparisonBlock: string[] = [];
    let yearSummaryBlock: string[] = [];
    let comparisonBlock: string[] = [];
    let averageBlock: string[] = [];

    if (!currentScoped.mapped.length && effectiveScope !== "none" && effectiveScope !== "unknown") {
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
      !currentScoped.scopedCategory &&
      requestedTimeScope.unsupported !== "year" &&
      !asksForBreakdown(input.latestUserText)
    ) {
      answerability = mergeAnswerability(answerability, "blocked");
    }

    if (periodMatch === "mismatch") {
      answerability = mergeAnswerability(answerability, "blocked");
    }

    if (requestedTimeScope.unsupported === "trend" && input.requestedPeriodKey) {
      const previousRange = buildPreviousMonthRange(input.requestedPeriodKey);
      if (previousRange) {
        const previousBreakdown = await resolveSafeCategoryBreakdownInRange({
          context: input.context,
          startIso: previousRange.startIso,
          endIsoExclusive: previousRange.endIsoExclusive,
          direction: categoryDirection,
        }).catch(() => null);
        if (previousBreakdown) {
          const previousScoped = mapScopedCategories({
            breakdown: previousBreakdown,
            scope: effectiveScope,
            availableCategoryScopes,
          });
          if (currentScoped.scopedCategory && previousScoped.scopedCategory) {
            const delta =
              currentScoped.scopedCategory.rawTotal - previousScoped.scopedCategory.rawTotal;
            trendComparisonBlock = [
              `- trendComparisonPeriod: ${previousRange.label} -> ${input.unifiedFinancialContext.period.label || "huidige maand"}`,
              `- previousScopedCategoryTotal: ${previousScoped.scopedCategory.total}`,
              `- trendDelta: ${formatAmount(delta) || "onbekend"}`,
              `- trendDirection: ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`,
            ];
            limitations.push("trend_scope_beperkt_tot_maandvergelijking");
            answerability = mergeAnswerability(answerability, periodMatch === "mismatch" ? "blocked" : "answerable");
          } else {
            limitations.push("trend_scope_nog_niet_volledig_gehydrateerd");
            answerability = mergeAnswerability(answerability, "partial");
          }
        } else {
          limitations.push("trend_scope_nog_niet_volledig_gehydrateerd");
          answerability = mergeAnswerability(answerability, "partial");
        }
      }
    }

    if (
      (requestedTimeScope.unsupported === "year" || averageRequested) &&
      !lastYearComparisonRequested &&
      input.requestedPeriodKey
    ) {
      const yearRange = buildYearToDateRange(input.requestedPeriodKey);
      if (yearRange) {
        const yearBreakdown = await resolveSafeCategoryBreakdownInRange({
          context: input.context,
          startIso: yearRange.startIso,
          endIsoExclusive: yearRange.endIsoExclusive,
          direction: categoryDirection,
        }).catch(() => null);
        if (yearBreakdown) {
          const yearScoped = mapScopedCategories({
            breakdown: yearBreakdown,
            scope: effectiveScope,
            availableCategoryScopes,
          });
          if (yearScoped.scopedCategory) {
            const monthCount = countMonthsInYearToDate(input.requestedPeriodKey);
            yearSummaryBlock = [
              `- yearSummaryRange: ${yearRange.label}`,
              `- yearToDateCategoryTotal: ${yearScoped.scopedCategory.total}`,
              `- yearToDateCategoryTransactionCount: ${yearScoped.scopedCategory.transactionCount}`,
            ];
            if (monthCount && monthCount > 0) {
              averageBlock = [
                `- averagePerMonthRange: ${yearRange.label}`,
                `- averagePerMonthTotal: ${formatAmount(
                  yearScoped.scopedCategory.rawTotal / monthCount,
                ) || "onbekend"}`,
                `- averagePerMonthMonthCount: ${monthCount}`,
              ];
            }
            limitations.push("jaar_scope_beperkt_tot_jaartotaal_tot_geselecteerde_maand");
            answerability = mergeAnswerability(answerability, "answerable");
          } else {
            limitations.push("jaar_scope_nog_niet_volledig_gehydrateerd");
            answerability = mergeAnswerability(answerability, "partial");
          }
        } else {
          limitations.push("jaar_scope_nog_niet_volledig_gehydrateerd");
          answerability = mergeAnswerability(answerability, "partial");
        }
      }
    }

    if (lastYearComparisonRequested && input.requestedPeriodKey) {
      const lastYearRange = buildSameMonthLastYearRange(input.requestedPeriodKey);
      if (lastYearRange) {
        const lastYearBreakdown = await resolveSafeCategoryBreakdownInRange({
          context: input.context,
          startIso: lastYearRange.startIso,
          endIsoExclusive: lastYearRange.endIsoExclusive,
          direction: categoryDirection,
        }).catch(() => null);
        if (lastYearBreakdown) {
          const lastYearScoped = mapScopedCategories({
            breakdown: lastYearBreakdown,
            scope: effectiveScope,
            availableCategoryScopes,
          });
          if (currentScoped.scopedCategory && lastYearScoped.scopedCategory) {
            const delta =
              currentScoped.scopedCategory.rawTotal - lastYearScoped.scopedCategory.rawTotal;
            comparisonBlock = [
              `- comparisonReferencePeriod: ${lastYearRange.label}`,
              `- comparisonReferenceTotal: ${lastYearScoped.scopedCategory.total}`,
              `- comparisonDelta: ${formatAmount(delta) || "onbekend"}`,
              `- comparisonDirection: ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`,
            ];
            answerability = mergeAnswerability(
              answerability,
              periodMatch === "mismatch" ? "blocked" : "answerable",
            );
          } else {
            limitations.push("vergelijking_vorig_jaar_niet_volledig_beschikbaar");
            answerability = mergeAnswerability(answerability, "partial");
          }
        } else {
          limitations.push("vergelijking_vorig_jaar_niet_volledig_beschikbaar");
          answerability = mergeAnswerability(answerability, "partial");
        }
      }
    }

    categorySummaryBlock = [
      "Truth-safe categorySummary:",
      `- monthScope: ${input.routingDecision.dataRequests.monthScope}`,
      `- dataPeriod: ${input.unifiedFinancialContext.period.label || "onbekend"}`,
      `- periodMatch: ${periodMatch}`,
      `- categoryDirection: ${categoryDirection}`,
      `- categoryScope: ${effectiveScope}`,
      `- availableCategoryScopes: ${JSON.stringify(
        availableCategoryScopes.slice(0, 20),
      )}`,
      currentScoped.scopedCategory
        ? `- scopedCategoryLabel: ${currentScoped.scopedCategory.label}`
        : "- scopedCategoryLabel: onbekend",
      currentScoped.scopedCategory
        ? `- scopedCategoryTotal: ${currentScoped.scopedCategory.total}`
        : "- scopedCategoryTotal: onbekend",
      currentScoped.scopedCategory
        ? `- scopedCategoryTransactionCount: ${currentScoped.scopedCategory.transactionCount}`
        : "- scopedCategoryTransactionCount: onbekend",
      currentScoped.scopedSubcategoryBreakdown.length
        ? `- subcategoryBreakdown: ${JSON.stringify(
            currentScoped.scopedSubcategoryBreakdown,
          )}`
        : "- subcategoryBreakdown: []",
      currentScoped.scopedSubcategoryBreakdown.length
        ? `- subcategoryBreakdownSummary: ${currentScoped.scopedSubcategoryBreakdown
            .map((item) => `${item.label} ${item.total}`)
            .join(", ")}`
        : "- subcategoryBreakdownSummary: geen",
      ...trendComparisonBlock,
      ...comparisonBlock,
      ...yearSummaryBlock,
      ...averageBlock,
      `- categories: ${JSON.stringify(currentScoped.mapped.map(({ rawTotal, ...rest }) => rest))}`,
    ].join("\n");
  }

  let transactionFactsBlock: string | null = null;
  if (input.routingDecision.requires.transactionFacts) {
    loadedBlocks.push("transactionFacts");
    const questionType = input.routingDecision.dataRequests.transactionQuestionType;
    const merchantScope = sanitizeScopeSlug(
      input.routingDecision.dataRequests.merchantScope,
      "none",
    );
    const categoryScope = sanitizeScopeSlug(
      input.routingDecision.dataRequests.categoryScope,
      "none",
    );

    const payload: Record<string, unknown> = {
      monthScope: input.routingDecision.dataRequests.monthScope,
      dataPeriod: input.unifiedFinancialContext.period.label || "onbekend",
      periodMatch,
      transactionQuestionType: questionType,
      categoryScope,
      merchantScope,
      answerability: "blocked",
    };

    let aggregateRange = buildMonthRange(input.requestedPeriodKey);
    if (requestedTimeScope.unsupported === "year") {
      aggregateRange = buildYearToDateRange(input.requestedPeriodKey);
    }

    if (aggregateRange && questionType !== "none") {
      const merchantAggregates = await resolveSafeMerchantAggregatesInRange({
        context: input.context,
        startIso: aggregateRange.startIso,
        endIsoExclusive: aggregateRange.endIsoExclusive,
        categoryScope:
          categoryScope !== "none" && categoryScope !== "unknown"
            ? categoryScope
            : null,
      }).catch(() => [] as SafeMerchantAggregate[]);

      if (questionType === "merchant_total" || questionType === "merchant_frequency") {
        const matchedMerchant =
          merchantScope !== "none" && merchantScope !== "unknown"
            ? findMerchantAggregate({
                merchantScope,
                aggregates: merchantAggregates,
              })
            : null;
        if (matchedMerchant) {
          payload.answerability = periodMatch === "mismatch" ? "blocked" : "answerable";
          payload.merchantLabel = matchedMerchant.merchantLabel;
          payload.merchantTotal = formatAmount(matchedMerchant.total);
          payload.merchantTransactionCount = matchedMerchant.transactionCount;
          answerability = mergeAnswerability(
            answerability,
            periodMatch === "mismatch" ? "blocked" : "answerable",
          );
        } else {
          payload.answerability = "partial";
          limitations.push("merchant_match_onvoldoende_zeker");
          answerability = mergeAnswerability(answerability, "partial");
        }
      } else if (questionType === "category_places") {
        if (merchantAggregates.length) {
          payload.answerability = periodMatch === "mismatch" ? "blocked" : "answerable";
          payload.topMerchants = merchantAggregates.slice(0, 5).map((aggregate) => ({
            merchant: aggregate.merchantLabel,
            merchantKey: aggregate.merchantKey,
            total: formatAmount(aggregate.total),
            transactionCount: aggregate.transactionCount,
          }));
          answerability = mergeAnswerability(
            answerability,
            periodMatch === "mismatch" ? "blocked" : "answerable",
          );
        } else {
          payload.answerability = "partial";
          limitations.push("merchant_locaties_niet_gevonden_in_geaggregeerde_data");
          answerability = mergeAnswerability(answerability, "partial");
        }
      } else {
        limitations.push("transactie_scope_niet_betrouwbaar_beantwoordbaar");
        answerability = mergeAnswerability(answerability, "blocked");
      }

      if (requestedTimeScope.unsupported === "year") {
        limitations.push("jaar_scope_beperkt_tot_jaartotaal_tot_geselecteerde_maand");
      }
    } else if (questionType === "none") {
      limitations.push("transactie_vraagtype_onduidelijk");
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
