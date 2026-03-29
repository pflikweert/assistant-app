import { createInitialHelpAssistantThreadState, submitComposerMessageLocally } from "@/services/help-assistant-chat";
import { buildHelpAssistantContext, type HelpAssistantScreenId } from "@/services/help-assistant-context";
import {
  requestHelpAssistantReply,
  type HelpAssistantActiveFlowDescriptor,
} from "@/services/help-assistant-ai";
import {
  resolveSafeCategoryBreakdownInRange,
  resolveSafeCategoryCatalogScopes,
  resolveSafeMerchantAggregatesInRange,
  resolveUnifiedFinancialAdviceContext,
  type FinancialCategorySpendItem,
  type FinancialCategorySpendSubcategory,
} from "@/services/help-assistant-financial-context";
import { getCurrentMonthKey, getMonthOptionByKey } from "@/services/transaction-month-options";

type AssertionLevel = "strict" | "warn";
type EvalCaseKind =
  | "category_total_current"
  | "category_total_previous"
  | "subcategory_total_current"
  | "category_breakdown_current"
  | "merchant_total_current"
  | "merchant_frequency_current"
  | "income_total_current"
  | "income_ytd_average"
  | "budget_status"
  | "cashflow_risk"
  | "comparison_last_year"
  | "catalog_recognition";

type EvalCase = {
  id: string;
  question: string;
  screenId: HelpAssistantScreenId;
  periodKey: string;
  assertion: AssertionLevel;
  kind: EvalCaseKind;
  expected: Record<string, unknown>;
};

export type HelpAssistantLiveEvalCaseResult = {
  id: string;
  question: string;
  kind: EvalCaseKind;
  assertion: AssertionLevel;
  passed: boolean;
  reasons: string[];
  answerText: string;
  expected: Record<string, unknown>;
  assistantDebug?: Record<string, unknown>;
};

export type HelpAssistantLiveEvalSummary = {
  totalCases: number;
  strictCases: number;
  strictPassed: number;
  strictFailed: number;
  warnCases: number;
  warnPassed: number;
  warnFailed: number;
};

export type HelpAssistantLiveEvalReport = {
  generatedAtIso: string;
  periodKey: string;
  summary: HelpAssistantLiveEvalSummary;
  results: HelpAssistantLiveEvalCaseResult[];
};

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function toTitleLabel(label: string) {
  return String(label || "").trim();
}

function toQuestionLabel(label: string) {
  return String(label || "").trim().toLowerCase();
}

function firstMeaningfulToken(value: string) {
  return normalizeText(value)
    .split(" ")
    .find((token) => token.length >= 4) || "";
}

function amountCandidates(amount: number) {
  const rounded = Math.round(amount);
  const fixed2 = amount.toFixed(2);
  const comma2 = fixed2.replace(".", ",");
  const oneDecimal = amount.toFixed(1);
  const comma1 = oneDecimal.replace(".", ",");
  const currencyNl = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  const decimalNl = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return uniqueById([
    { id: String(rounded), value: `€${rounded}` },
    { id: `${rounded}-space`, value: `€ ${rounded}` },
    { id: fixed2, value: `€${fixed2}` },
    { id: comma2, value: `€${comma2}` },
    { id: oneDecimal, value: `€${oneDecimal}` },
    { id: comma1, value: `€${comma1}` },
    { id: `currency-nl-${rounded}`, value: currencyNl },
    { id: `decimal-nl-${rounded}`, value: decimalNl },
    { id: `plain-${rounded}`, value: String(rounded) },
    { id: `plain-${fixed2}`, value: fixed2 },
    { id: `plain-${comma2}`, value: comma2 },
    { id: `plain-decimal-nl-${rounded}`, value: decimalNl },
  ]).map((row) => row.value.toLowerCase());
}

function responseContainsAmount(text: string, amount: number) {
  const normalized = text
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const collapsed = normalized.replace(/\s+/g, "");
  return amountCandidates(amount).some((candidate) => {
    const normalizedCandidate = candidate
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return (
      normalized.includes(normalizedCandidate) ||
      collapsed.includes(normalizedCandidate.replace(/\s+/g, ""))
    );
  });
}

function responseContainsCount(text: string, count: number) {
  const numberWords: Record<number, string[]> = {
    1: ["1", "een", "1 keer"],
    2: ["2", "twee", "2 keer"],
    3: ["3", "drie", "3 keer"],
    4: ["4", "vier", "4 keer"],
    5: ["5", "vijf", "5 keer"],
    6: ["6", "zes", "6 keer"],
    7: ["7", "zeven", "7 keer"],
    8: ["8", "acht", "8 keer"],
    9: ["9", "negen", "9 keer"],
    10: ["10", "tien", "10 keer"],
  };
  const normalized = normalizeText(text);
  const candidates = numberWords[count] || [String(count), `${count} keer`];
  return candidates.some((candidate) => normalized.includes(normalizeText(candidate)));
}

function responseContainsLabel(text: string, label: string) {
  const normalized = normalizeText(text);
  const labelNormalized = normalizeText(label);
  if (!labelNormalized) return false;
  if (normalized.includes(labelNormalized)) return true;
  const token = firstMeaningfulToken(label);
  return token ? normalized.includes(token) : false;
}

function responseLooksTruthSafeLimited(text: string) {
  const normalized = normalizeText(text);
  return [
    "geen specifiek",
    "geen gegevens",
    "niet beschikbaar",
    "kan ik niet bepalen",
    "niet expliciet",
    "niet betrouwbaar",
    "alleen het totale bedrag",
    "heb ik nu niet",
    "niet genoeg",
  ].some((phrase) => normalized.includes(phrase));
}

function startOfYear(monthKey: string) {
  const [year] = String(monthKey).split("-");
  return `${year}-01`;
}

function buildMonthContext(periodKey: string, screenId: HelpAssistantScreenId) {
  const month = getMonthOptionByKey(periodKey);
  if (!month) {
    throw new Error(`Ongeldige eval-maand: ${periodKey}`);
  }
  return buildHelpAssistantContext({
    screenId,
    selectedPeriod: {
      key: month.key,
      label: month.label,
      startIso: month.startIso,
      endIsoExclusive: month.endIso,
    },
  });
}

function createCategoryCurrentQuestions(category: FinancialCategorySpendItem, periodKey: string): EvalCase[] {
  const label = toTitleLabel(category.label);
  const questionLabel = toQuestionLabel(category.label);
  const childLabels = (category.subcategories || [])
    .filter((item) => item.amount > 0)
    .map((item) => item.label);
  return [
    {
      id: `category-current-total-${category.key}-1`,
      question: `Hoeveel heb ik deze maand aan ${questionLabel} uitgegeven?`,
      screenId: "insights",
      periodKey,
      assertion: "strict",
      kind: "category_total_current",
      expected: { label, amount: category.amount, childLabels },
    },
    {
      id: `category-current-total-${category.key}-2`,
      question: `Wat ben ik deze maand kwijt aan ${questionLabel}?`,
      screenId: "insights",
      periodKey,
      assertion: "strict",
      kind: "category_total_current",
      expected: { label, amount: category.amount, childLabels },
    },
  ];
}

function createCategoryPreviousQuestions(category: FinancialCategorySpendItem, periodKey: string): EvalCase[] {
  const label = toTitleLabel(category.label);
  const questionLabel = toQuestionLabel(category.label);
  const childLabels = (category.subcategories || [])
    .filter((item) => item.amount > 0)
    .map((item) => item.label);
  return [
    {
      id: `category-previous-total-${category.key}-1`,
      question: `Wat ging er vorige maand naar ${questionLabel}?`,
      screenId: "insights",
      periodKey,
      assertion: "strict",
      kind: "category_total_previous",
      expected: { label, amount: category.amount, childLabels },
    },
  ];
}

function createSubcategoryQuestions(subcategory: FinancialCategorySpendSubcategory, periodKey: string): EvalCase[] {
  const label = toTitleLabel(subcategory.label);
  const questionLabel = toQuestionLabel(subcategory.label);
  return [
    {
      id: `subcategory-current-total-${subcategory.key}-1`,
      question: `Wat heb ik uitgegeven aan ${questionLabel}?`,
      screenId: "insights",
      periodKey,
      assertion: "strict",
      kind: "subcategory_total_current",
      expected: { label, amount: subcategory.amount },
    },
  ];
}

function createBreakdownQuestion(category: FinancialCategorySpendItem, periodKey: string): EvalCase[] {
  const childLabels = (category.subcategories || [])
    .filter((item) => item.amount > 0)
    .slice(0, 3)
    .map((item) => item.label);
  return [
    {
      id: `category-breakdown-${category.key}`,
      question: `Wat is de onderverdeling van de uitgaven binnen ${toQuestionLabel(category.label)}?`,
      screenId: "insights",
      periodKey,
      assertion: "strict",
      kind: "category_breakdown_current",
      expected: { label: category.label, childLabels },
    },
  ];
}

function createMerchantQuestions(
  merchant: { name: string; totalAmount: number; frequency: number },
  periodKey: string,
): EvalCase[] {
  return [
    {
      id: `merchant-total-${merchant.name}`,
      question: `Hoeveel gaf ik deze maand uit bij ${merchant.name}?`,
      screenId: "transactions",
      periodKey,
      assertion: "strict",
      kind: "merchant_total_current",
      expected: {
        merchantLabel: merchant.name,
        amount: merchant.totalAmount,
      },
    },
    {
      id: `merchant-frequency-${merchant.name}`,
      question: `Hoe vaak betaal ik bij ${merchant.name} deze maand?`,
      screenId: "transactions",
      periodKey,
      assertion: "strict",
      kind: "merchant_frequency_current",
      expected: {
        merchantLabel: merchant.name,
        count: merchant.frequency,
      },
    },
  ];
}

function createIncomeQuestions(category: FinancialCategorySpendItem, periodKey: string) {
  const label = toTitleLabel(category.label);
  const questionLabel = toQuestionLabel(category.label);
  return [
    {
      id: `income-current-${category.key}`,
      question: `Hoeveel ${questionLabel} heb ik deze maand ontvangen?`,
      screenId: "insights",
      periodKey,
      assertion: "strict",
      kind: "income_total_current",
      expected: { label, amount: category.amount },
    },
  ];
}

function createIncomeAverageQuestion(input: {
  categoryKey: string;
  label: string;
  averagePerMonth: number;
  yearToDateTotal: number;
  periodKey: string;
}) {
  return [
    {
      id: `income-average-${input.categoryKey}`,
      question: `Wat ontvang ik gemiddeld per maand aan ${toQuestionLabel(input.label)} dit jaar?`,
      screenId: "insights",
      periodKey: input.periodKey,
      assertion: "strict",
      kind: "income_ytd_average",
      expected: {
        label: input.label,
        averagePerMonth: input.averagePerMonth,
        yearToDateTotal: input.yearToDateTotal,
      },
    },
  ];
}

function createBudgetQuestions(periodKey: string) {
  return [
    {
      id: "budget-space-current",
      question: "Hoeveel kan ik deze maand nog uitgeven?",
      screenId: "budget",
      periodKey,
      assertion: "warn",
      kind: "budget_status",
      expected: {},
    },
    {
      id: "budget-over-current",
      question: "Ben ik deze maand al over mijn plan heen?",
      screenId: "budget",
      periodKey,
      assertion: "warn",
      kind: "budget_status",
      expected: {},
    },
    {
      id: "budget-risk-current",
      question: "Loop ik risico dat ik deze maand te weinig overhoud?",
      screenId: "budget",
      periodKey,
      assertion: "warn",
      kind: "cashflow_risk",
      expected: {},
    },
    {
      id: "budget-end-balance",
      question: "Waar kom ik waarschijnlijk op uit aan het einde van deze maand?",
      screenId: "budget",
      periodKey,
      assertion: "warn",
      kind: "cashflow_risk",
      expected: {},
    },
  ];
}

function createCatalogRecognitionQuestions(labels: string[], periodKey: string): EvalCase[] {
  return labels.map((label, index) => ({
    id: `catalog-recognition-${index + 1}`,
    question: `Wat geef ik uit aan ${toQuestionLabel(label)}?`,
    screenId: "insights",
    periodKey,
    assertion: "warn",
    kind: "catalog_recognition",
    expected: { label },
  }));
}

function createComparisonQuestions(labels: string[], periodKey: string): EvalCase[] {
  return labels.map((label, index) => ({
    id: `comparison-last-year-${index + 1}`,
    question: `Is ${toQuestionLabel(label)} duurder geworden dan vorig jaar?`,
    screenId: "insights",
    periodKey,
    assertion: "warn",
    kind: "comparison_last_year",
    expected: { label },
  }));
}

async function buildEvalCases(periodKey: string): Promise<EvalCase[]> {
  const currentMonth = getMonthOptionByKey(periodKey);
  if (!currentMonth) {
    throw new Error(`Kan evalcases niet bouwen voor ongeldige maand ${periodKey}`);
  }
  const previousMonth = getMonthOptionByKey(
    `${currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year}-${String(currentMonth.month === 1 ? 12 : currentMonth.month - 1).padStart(2, "0")}`,
  );
  const currentContext = buildMonthContext(periodKey, "insights");
  const currentFinancialContext = await resolveUnifiedFinancialAdviceContext({
    context: currentContext,
    question: "live eval current month",
    requestedAmount: null,
  });

  const previousBreakdown = previousMonth
    ? await resolveSafeCategoryBreakdownInRange({
        context: currentContext,
        startIso: previousMonth.startIso,
        endIsoExclusive: previousMonth.endIso,
      })
    : null;

  const currentIncomeBreakdown = await resolveSafeCategoryBreakdownInRange({
    context: currentContext,
    startIso: currentMonth.startIso,
    endIsoExclusive: currentMonth.endIso,
    direction: "income",
  });
  const ytdIncomeBreakdown = await resolveSafeCategoryBreakdownInRange({
    context: currentContext,
    startIso: `${startOfYear(periodKey)}-01`,
    endIsoExclusive: currentMonth.endIso,
    direction: "income",
  });
  const currentMerchants = await resolveSafeMerchantAggregatesInRange({
    context: currentContext,
    startIso: currentMonth.startIso,
    endIsoExclusive: currentMonth.endIso,
  });

  const currentCategories = (currentFinancialContext.spending.currentMonthBreakdown.categories || [])
    .filter((category) => category.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10);
  const previousCategories = (previousBreakdown?.categories || [])
    .filter((category) => category.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 8);
  const currentSubcategories = currentCategories
    .flatMap((category) =>
      (category.subcategories || []).filter((subcategory) => {
        const parentKey = normalizeText(category.categoryKey || category.key || "");
        const childKey = normalizeText(subcategory.categoryKey || subcategory.key || "");
        const parentLabel = normalizeText(category.label);
        const childLabel = normalizeText(subcategory.label);
        return !(parentKey === childKey && parentLabel === childLabel);
      }),
    )
    .filter((subcategory) => subcategory.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10);
  const breakdownCategories = currentCategories
    .filter((category) => (category.subcategories || []).filter((child) => child.amount > 0).length >= 2)
    .slice(0, 8);
  const merchantCases = currentMerchants
    .filter((merchant) => merchant.total > 0 && merchant.transactionCount > 0)
    .sort(
      (left, right) =>
        right.transactionCount - left.transactionCount || right.total - left.total,
    )
    .slice(0, 10);
  const incomeCategories = (currentIncomeBreakdown.categories || [])
    .filter((category) => category.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
  const incomeAverageCases = (ytdIncomeBreakdown.categories || [])
    .filter((category) => category.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)
    .map((category) => ({
      categoryKey: category.categoryKey || category.key,
      label: category.label,
      yearToDateTotal: category.amount,
      averagePerMonth: category.amount / currentMonth.month,
    }));

  const catalogScopes = await resolveSafeCategoryCatalogScopes();
  const currentLabels = new Set([
    ...currentCategories.map((category) => normalizeText(category.label)),
    ...currentSubcategories.map((subcategory) => normalizeText(subcategory.label)),
  ]);
  const recognitionLabels = catalogScopes
    .map((scope) => scope.label)
    .filter((label) => !currentLabels.has(normalizeText(label)))
    .slice(0, 15);

  const comparisonLabels = currentSubcategories
    .slice(0, 5)
    .map((item) => item.label)
    .concat(currentCategories.slice(0, 5).map((item) => item.label))
    .slice(0, 10);

  const cases = [
    ...currentCategories.flatMap((category) => createCategoryCurrentQuestions(category, periodKey)),
    ...previousCategories.flatMap((category) => createCategoryPreviousQuestions(category, periodKey)),
    ...currentSubcategories.flatMap((subcategory) => createSubcategoryQuestions(subcategory, periodKey)),
    ...breakdownCategories.flatMap((category) => createBreakdownQuestion(category, periodKey)),
    ...merchantCases.flatMap((merchant) =>
      createMerchantQuestions(
        {
          name: merchant.merchantLabel,
          totalAmount: merchant.total,
          frequency: merchant.transactionCount,
        },
        periodKey,
      ),
    ),
    ...incomeCategories.flatMap((category) => createIncomeQuestions(category, periodKey)),
    ...incomeAverageCases.flatMap((input) =>
      createIncomeAverageQuestion({
        ...input,
        periodKey,
      }),
    ),
    ...createBudgetQuestions(periodKey),
    ...createCatalogRecognitionQuestions(recognitionLabels, periodKey),
    ...createComparisonQuestions(comparisonLabels, periodKey),
  ];

  return cases.slice(0, 100);
}

function evaluateCase(input: {
  evalCase: EvalCase;
  answerText: string;
}): HelpAssistantLiveEvalCaseResult {
  const reasons: string[] = [];
  const { evalCase, answerText } = input;

  switch (evalCase.kind) {
    case "category_total_current":
    case "category_total_previous":
    case "subcategory_total_current":
    case "income_total_current": {
      const label = String(evalCase.expected.label || "");
      const amount = Number(evalCase.expected.amount || 0);
      const childLabels = (evalCase.expected.childLabels as string[] | undefined) || [];
      const hasLabel = responseContainsLabel(answerText, label);
      const hasChildContext =
        childLabels.length > 0 &&
        childLabels.some((childLabel) => responseContainsLabel(answerText, childLabel));
      if (!hasLabel && !hasChildContext) {
        reasons.push(`verwacht label niet gevonden: ${label}`);
      }
      if (!responseContainsAmount(answerText, amount)) {
        reasons.push(`verwacht bedrag niet gevonden: ${amount}`);
      }
      break;
    }
    case "category_breakdown_current": {
      const childLabels = (evalCase.expected.childLabels as string[]) || [];
      if (!childLabels.length) {
        reasons.push("geen childLabels beschikbaar voor breakdown-eval");
      } else if (!childLabels.some((label) => responseContainsLabel(answerText, label))) {
        reasons.push(`geen subcategorielabel gevonden in antwoord (${childLabels.join(", ")})`);
      }
      break;
    }
    case "merchant_total_current": {
      const merchantLabel = String(evalCase.expected.merchantLabel || "");
      const amount = Number(evalCase.expected.amount || 0);
      if (!responseContainsLabel(answerText, merchantLabel)) {
        reasons.push(`merchant niet gevonden: ${merchantLabel}`);
      }
      if (!responseContainsAmount(answerText, amount)) {
        reasons.push(`merchantbedrag niet gevonden: ${amount}`);
      }
      break;
    }
    case "merchant_frequency_current": {
      const merchantLabel = String(evalCase.expected.merchantLabel || "");
      const count = Number(evalCase.expected.count || 0);
      if (!responseContainsLabel(answerText, merchantLabel)) {
        reasons.push(`merchant niet gevonden: ${merchantLabel}`);
      }
      if (!responseContainsCount(answerText, count)) {
        reasons.push(`merchantfrequentie niet gevonden: ${count}`);
      }
      break;
    }
    case "income_ytd_average": {
      const label = String(evalCase.expected.label || "");
      const averagePerMonth = Number(evalCase.expected.averagePerMonth || 0);
      if (!responseContainsLabel(answerText, label)) {
        reasons.push(`inkomenslabel niet gevonden: ${label}`);
      }
      if (!responseContainsAmount(answerText, averagePerMonth)) {
        reasons.push(`gemiddelde per maand niet gevonden: ${averagePerMonth}`);
      }
      break;
    }
    case "budget_status":
    case "cashflow_risk": {
      if (!answerText.trim()) {
        reasons.push("leeg antwoord voor budget/risk-vraag");
      }
      break;
    }
    case "comparison_last_year":
    case "catalog_recognition": {
      const label = String(evalCase.expected.label || "");
      if (!responseContainsLabel(answerText, label) && !responseLooksTruthSafeLimited(answerText)) {
        reasons.push(`geen categorieherkenning of limitation voor ${label}`);
      }
      break;
    }
  }

  return {
    id: evalCase.id,
    question: evalCase.question,
    kind: evalCase.kind,
    assertion: evalCase.assertion,
    passed: reasons.length === 0,
    reasons,
    answerText,
    expected: evalCase.expected,
  };
}

async function askAssistant(input: {
  question: string;
  periodKey: string;
  screenId: HelpAssistantScreenId;
  activeFlow?: HelpAssistantActiveFlowDescriptor | null;
}) {
  const context = buildMonthContext(input.periodKey, input.screenId);
  const thread = submitComposerMessageLocally(
    createInitialHelpAssistantThreadState(),
    context,
    input.question,
  ).thread;
  return requestHelpAssistantReply({
    context,
    thread,
    activeFlow: input.activeFlow || null,
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`timeout: ${label}`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function runLiveHelpAssistantEval(input?: {
  periodKey?: string;
  limit?: number;
}) {
  const periodKey = input?.periodKey || getCurrentMonthKey(new Date("2026-03-29T12:00:00Z"));
  const limit = Math.max(1, Math.round(input?.limit || 100));
  const evalCases = (await buildEvalCases(periodKey)).slice(0, limit);
  const results: HelpAssistantLiveEvalCaseResult[] = [];

  for (const evalCase of evalCases) {
    let result: HelpAssistantLiveEvalCaseResult;
    try {
      let lastError: unknown = null;
      let response: Awaited<ReturnType<typeof askAssistant>> | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          response = await withTimeout(
            askAssistant({
              question: evalCase.question,
              periodKey: evalCase.periodKey,
              screenId: evalCase.screenId,
            }),
            45_000,
            `${evalCase.id}#${attempt}`,
          );
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!response) {
        throw lastError instanceof Error
          ? lastError
          : new Error("assistant response ontbreekt na retries");
      }
      result = evaluateCase({
        evalCase,
        answerText: response.answerText,
      });
      result.assistantDebug = (response.debug || undefined) as
        | Record<string, unknown>
        | undefined;
    } catch (error) {
      result = {
        id: evalCase.id,
        question: evalCase.question,
        kind: evalCase.kind,
        assertion: evalCase.assertion,
        passed: false,
        reasons: [
          error instanceof Error ? error.message : "onbekende evalfout",
        ],
        answerText: "",
        expected: evalCase.expected,
        assistantDebug: undefined,
      };
    }
    results.push(result);
    // Helpful progress line during long live runs.
    console.log(
      `[help-assistant-live-eval] ${result.passed ? "PASS" : "FAIL"} ${result.id}: ${result.question}`,
    );
  }

  const strictCases = results.filter((result) => result.assertion === "strict");
  const warnCases = results.filter((result) => result.assertion === "warn");
  return {
    generatedAtIso: new Date().toISOString(),
    periodKey,
    summary: {
      totalCases: results.length,
      strictCases: strictCases.length,
      strictPassed: strictCases.filter((result) => result.passed).length,
      strictFailed: strictCases.filter((result) => !result.passed).length,
      warnCases: warnCases.length,
      warnPassed: warnCases.filter((result) => result.passed).length,
      warnFailed: warnCases.filter((result) => !result.passed).length,
    },
    results,
  } satisfies HelpAssistantLiveEvalReport;
}
