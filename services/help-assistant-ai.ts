import type {
  HelpAssistantMessage,
  HelpAssistantThreadState,
} from "@/services/help-assistant-chat";
import {
  buildHelpAssistantScreenContextLines,
  type HelpAssistantContext,
} from "@/services/help-assistant-context";
import {
  resolveUnifiedFinancialAdviceContext,
  type UnifiedFinancialAdviceContext,
} from "@/services/help-assistant-financial-context";
import {
  postHelpAssistantSpendingAdviceCompletion,
  postOpenAIChatCompletion,
  type SpendingAdviceProxyFallback,
} from "@/services/openai-proxy";
import Constants from "expo-constants";

const appEnv = ((Constants.expoConfig?.extra as Record<
  string,
  string | undefined
>) || process.env) as Record<string, string | undefined>;

const DEFAULT_MODEL = appEnv.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_CONTEXT_MESSAGES = 12;
const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const GENERAL_ASSISTANT_SYSTEM_PROMPT = [
  "Je bent de Budio Assistent in een Nederlandse budget- en financiële app.",
  "Je helpt met vier vraagtypes: schermuitleg, probleemhulp, feedback/feature-signalen en algemene financiële meedenkvraagstukken.",
  "Antwoord altijd in het Nederlands.",
  "Schrijf kort, duidelijk, vriendelijk en menselijk.",
  "Gebruik eenvoudige taal voor gewone gebruikers en vermijd technische uitleg tenzij dat echt nodig is.",
  "Wees product-specifiek: praat over budgetruimte, uitgaven, forecast, vaste lasten, transacties, import en komende maanden als dat relevant is.",
  "In Budio betekent 'ruimte' standaard: ruimte om nog uit te geven binnen budget en forecast.",
  "Maak onderscheid tussen wat zeker is en wat alleen afgeleid is uit context.",
  "Als data ontbreekt of onzeker is, zeg dat expliciet.",
  "Als je iets niet zeker weet, gebruik formuleringen zoals: 'op basis van wat ik nu zie' of 'voor zover je gegevens compleet zijn'.",
  "Geef nooit absolute garanties over geld, budgetten of toekomstige uitkomsten.",
  "Verzin nooit cijfers, transacties, categorieën, datums of conclusies die niet in de context staan.",
  "Bij probleemmeldingen: help eerst praktisch en rustig in plaats van direct technisch te escaleren.",
  "Als iets op een bug lijkt, benoem dat voorzichtig.",
  "Als iets op feedback of een feature-idee lijkt, vat dat kort samen in producttaal.",
  "Houd antwoorden compact: meestal 3 tot 6 zinnen, tenzij een gestructureerd formaat is gevraagd.",
  "Gebruik geen markdown headers in het antwoord.",
  "Gebruik alleen lijstjes als dat echt helpt voor duidelijkheid.",
].join(" ");
const SPENDING_ADVICE_SYSTEM_PROMPT = [
  "Je bent de Budio AI Buddy voor bestedingsruimte en financiële keuzes.",
  "Je taak is voorzichtig en bruikbaar meedenken over de vraag of de gebruiker nog geld kan uitgeven.",
  "Baseer je antwoord primair op budgetruimte, forecast, komende vaste lasten, geplande inkomsten en zichtbare risico's.",
  "Stuur niet op los saldo alleen; saldo zonder context is onvoldoende.",
  "Beoordeel altijd vanuit drie tijdslagen: nu, later deze maand en begin volgende maand.",
  "Gebruik alleen cijfers en feiten die expliciet in de huidige context staan.",
  "Verzin nooit bedragen, buffers, risico's of inkomsten.",
  "Hergebruik geen cijfers uit eerdere berichten als die niet opnieuw in de actuele context staan.",
  "Als data ontbreekt, benoem dat duidelijk als onzekerheid of beperking.",
  "Als data onzeker is, zeg letterlijk: 'op basis van wat ik nu zie'.",
  "Geef geen absolute zekerheid en doe niet alsof je financieel professioneel advies geeft.",
  "Je antwoord moet praktisch, menselijk en voorzichtig zijn.",
  "Gebruik voor de conclusie altijd één van deze richtingen: veilig, haalbaar maar krap, technisch mogelijk maar onverstandig, of onvoldoende data.",
  "Laat in why kort zien welke contextsignalen het zwaarst wogen.",
  "Laat in risk expliciet zien wat het risico is later deze maand of volgende maand.",
  "Laat in nextStep een concrete kleine vervolgstap zien, zoals bedrag verlagen, wachten of ontbrekende data checken.",
  "Gebruik altijd exact vier verplichte velden in JSON: conclusion, why, risk, nextStep.",
  "Optioneel mag confidence met waarden low, medium of high.",
  "Optioneel mag dataGaps als array met korte labels van ontbrekende info.",
  'Geef alleen JSON als output: {"conclusion":"...","why":"...","risk":"...","nextStep":"...","confidence":"low|medium|high","dataGaps":["..."]}',
].join(" ");

// Centrale prompt-library, zodat we later eenvoudig use-cases zoals bug triage of issue drafts kunnen toevoegen.
const PROMPT_LIBRARY = {
  generalAssistant: GENERAL_ASSISTANT_SYSTEM_PROMPT,
  spendingAdvice: SPENDING_ADVICE_SYSTEM_PROMPT,
} as const;

const SYSTEM_PROMPT = PROMPT_LIBRARY.generalAssistant;

type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  model?: string;
  id?: string;
};

export type HelpAssistantAIRequest = {
  context: HelpAssistantContext;
  thread: HelpAssistantThreadState;
  userMessageId?: string;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
};

export type HelpAssistantAIResponse = {
  answerText: string;
  model: string;
  responseId: string | null;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
};

type SpendingAdviceSections = {
  conclusion: string;
  why: string;
  risk: string;
  nextStep: string;
};

export type SpendingAdviceResponseSchema = SpendingAdviceSections & {
  confidence?: string;
  dataGaps?: string[];
};

function toOpenAIRole(role: HelpAssistantMessage["role"]) {
  return role === "assistant" ? "assistant" : "user";
}

function pickThreadMessagesForModel(thread: HelpAssistantThreadState) {
  const candidates = thread.messages.filter((message) =>
    message.status !== "error" && message.role !== "assistant"
      ? true
      : message.status === "ready",
  );

  return candidates.slice(-MAX_CONTEXT_MESSAGES);
}

function buildContextPrompt(context: HelpAssistantContext) {
  const period = context.selectedPeriod?.label || "niet geselecteerd";
  const baseLines = [
    `Scherm: ${context.screenTitle}`,
    `Route: ${context.routeName}`,
    `Platform: ${context.platform}`,
    `Periode: ${period}`,
  ];
  const screenSpecificLines = buildHelpAssistantScreenContextLines(context);

  if (!screenSpecificLines.length) {
    return baseLines.join("\n");
  }

  return [
    ...baseLines,
    "",
    "Schermspecifieke context:",
    ...screenSpecificLines.map((line) => `- ${line}`),
  ].join("\n");
}

function buildUnifiedFinancialContextPrompt(
  context: UnifiedFinancialAdviceContext,
) {
  const lines = [
    `Periode: ${context.period.label}`,
    `Periode-key: ${context.period.key}`,
    context.period.usedFallbackPeriod
      ? "Periode-selectie: fallback gebruikt (huidige maand)."
      : "Periode-selectie: expliciet gekozen periode.",
    context.budget.remainingVariableBudget != null
      ? `Resterend variabel budget: ${eur.format(context.budget.remainingVariableBudget)}`
      : "Resterend variabel budget: onbekend",
    context.budget.totalVariableBudget != null
      ? `Totaal variabel budget: ${eur.format(context.budget.totalVariableBudget)}`
      : "",
    context.budget.spentVariableBudget != null
      ? `Al besteed variabel: ${eur.format(context.budget.spentVariableBudget)}`
      : "",
    context.budget.weekRemainingBudget != null
      ? `Weekbudget resterend: ${eur.format(context.budget.weekRemainingBudget)}`
      : "Weekbudget resterend: onbekend",
    context.planning.upcomingCommittedIncomeTotal != null
      ? `Komende inkomsten: ${eur.format(context.planning.upcomingCommittedIncomeTotal)}`
      : "",
    context.planning.upcomingCommittedExpenseTotal != null
      ? `Komende vaste lasten: ${eur.format(
          context.planning.upcomingCommittedExpenseTotal,
        )}`
      : "Komende vaste lasten: onbekend",
    context.planning.remainingPlannedExpenseTotal != null
      ? `Nog geplande maandlasten: ${eur.format(context.planning.remainingPlannedExpenseTotal)}`
      : "Nog geplande maandlasten: onbekend",
    context.planning.remainingVariableExpenseEstimate != null
      ? `Nog variabele uitgaven (schatting): ${eur.format(
          context.planning.remainingVariableExpenseEstimate,
        )}`
      : "",
    context.forecastCurrentMonth.expectedEndBalance != null
      ? `Forecast eindsaldo maand: ${eur.format(
          context.forecastCurrentMonth.expectedEndBalance,
        )}`
      : "",
    context.forecastCurrentMonth.lowestExpectedBalance != null
      ? `Laagste verwachte saldo: ${eur.format(
          context.forecastCurrentMonth.lowestExpectedBalance,
        )}`
      : "",
    context.forecastCurrentMonth.remainingMonthNetTotal != null
      ? `Resterende maand netto beweging: ${eur.format(
          context.forecastCurrentMonth.remainingMonthNetTotal,
        )}`
      : "",
    context.forecastCurrentMonth.hasData
      ? `Huidige maand forecast status: ${context.forecastCurrentMonth.riskFlag} / ${context.forecastCurrentMonth.cashRiskFlag}`
      : "Huidige maand forecast status: beperkt",
    context.forecastNextMonth.hasData
      ? `Begin volgende maand (${context.forecastNextMonth.monthLabel}) verwacht eindsaldo: ${eur.format(
          context.forecastNextMonth.expectedEndBalance || 0,
        )}`
      : "",
    context.forecastNextMonth.hasData
      ? `Volgende maand risico: ${context.forecastNextMonth.riskFlag} / ${context.forecastNextMonth.cashRiskFlag}`
      : "Volgende maand forecast: ontbreekt of beperkt",
    `Context confidence: ${context.quality.confidence}`,
    context.quality.dataGaps.length
      ? `Interne datagaten: ${context.quality.dataGaps.join(", ")}`
      : "Interne datagaten: geen",
  ];

  return lines.filter(Boolean).join("\n");
}

function getLatestUserMessage(thread: HelpAssistantThreadState) {
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message.role === "user") return message;
  }
  return null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeBudgetSpaceQuestion(input: string) {
  const text = normalizeText(input);
  return (
    text.includes("ruimte") ||
    text.includes("uitgeven") ||
    text.includes("kan ik nog") ||
    text.includes("bestedingsruimte") ||
    text.includes("budget")
  );
}

export function isFinancialAdviceQuestion(input: string) {
  return looksLikeBudgetSpaceQuestion(input);
}

function parseRequestedAmountFromQuestion(input: string) {
  const normalized = normalizeText(input).replace(",", ".");
  const euroMatch = /(?:€|\beuro\b)\s*(\d+(?:\.\d+)?)/.exec(normalized);
  if (euroMatch) {
    const parsed = Number(euroMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const trailingMatch = /\b(\d+(?:\.\d+)?)\b/.exec(normalized);
  if (!trailingMatch) return null;
  const parsed = Number(trailingMatch[1]);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0 || parsed > 200000) return null;
  return parsed;
}

function formatSpendingAdvicePattern(sections: SpendingAdviceSections) {
  return [
    `1. Conclusie: ${sections.conclusion}`,
    `2. Waarom: ${sections.why}`,
    `3. Risico of nuance: ${sections.risk}`,
    `4. Slimmer alternatief of vervolgstap: ${sections.nextStep}`,
  ].join("\n");
}

function formatSpendingAdvicePatternFromSchema(
  sections: SpendingAdviceResponseSchema,
) {
  const riskAdditions = [
    sections.confidence ? `Betrouwbaarheid: ${sections.confidence}.` : "",
    sections.dataGaps?.length
      ? "Er ontbreken nog enkele signalen in de huidige context."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return formatSpendingAdvicePattern({
    conclusion: sections.conclusion,
    why: sections.why,
    risk: [sections.risk, riskAdditions].filter(Boolean).join(" "),
    nextStep: sections.nextStep,
  });
}

function mergeSpendingSchemaWithContext(input: {
  parsed: SpendingAdviceResponseSchema;
  unifiedFinancialContext: UnifiedFinancialAdviceContext | null;
}) {
  const { parsed, unifiedFinancialContext } = input;
  if (!unifiedFinancialContext) return parsed;

  const safeDataGaps = unifiedFinancialContext.quality.dataGaps;
  const safeConfidence =
    parsed.confidence ||
    (unifiedFinancialContext.quality.confidence === "high"
      ? "hoog"
      : unifiedFinancialContext.quality.confidence === "medium"
        ? "redelijk"
        : "beperkt");

  return {
    ...parsed,
    confidence: safeConfidence,
    dataGaps: safeDataGaps.length ? safeDataGaps : undefined,
  } satisfies SpendingAdviceResponseSchema;
}

function buildSafeSpendingFallback(input: {
  context: HelpAssistantContext;
  unifiedFinancialContext: UnifiedFinancialAdviceContext;
}): SpendingAdviceResponseSchema {
  const { context, unifiedFinancialContext } = input;
  const periodLabel = unifiedFinancialContext.period.label || "deze maand";
  const fromCurrentScreen =
    context.screenId === "budget" || context.screenId === "insights";

  return {
    conclusion: `Ik kan je bestedingsruimte voor ${periodLabel} nu niet betrouwbaar bevestigen.`,
    why: fromCurrentScreen
      ? "De AI-proxy kon deze vraag nu niet stabiel genoeg verwerken met je huidige budget- en forecastcontext."
      : "Dit scherm heeft beperkte budgetcontext en de AI-proxy gaf nu geen stabiel antwoord.",
    risk: "Op basis van wat ik nu zie wil ik geen schijnzekerheid geven over uitgavenruimte.",
    nextStep: fromCurrentScreen
      ? "Probeer je vraag opnieuw met bedrag en categorie, of controleer je Budget-overzicht voor de actuele ruimte."
      : "Open Budget of Inzichten en stel dezelfde vraag daar opnieuw met bedrag en categorie.",
    confidence: "laag",
    dataGaps: unifiedFinancialContext.quality.dataGaps,
  };
}

export function parseSpendingAdviceSchema(
  content: string,
): SpendingAdviceResponseSchema | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const directCandidates = [trimmed];
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) directCandidates.push(fenceMatch[1].trim());

  for (const candidate of directCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const conclusion = String(parsed.conclusion || "").trim();
      const why = String(parsed.why || "").trim();
      const risk = String(parsed.risk || "").trim();
      const nextStep = String(parsed.nextStep || "").trim();
      if (!conclusion || !why || !risk || !nextStep) continue;

      const confidence = String(parsed.confidence || "").trim() || undefined;
      const dataGaps = Array.isArray(parsed.dataGaps)
        ? parsed.dataGaps
            .map((entry) => String(entry || "").trim())
            .filter(Boolean)
        : undefined;

      return {
        conclusion,
        why,
        risk,
        nextStep,
        confidence,
        dataGaps: dataGaps?.length ? dataGaps : undefined,
      };
    } catch {
      // Ignore parse failures and continue to next candidate.
    }
  }

  return null;
}

function parseAnswerText(
  payload: ChatCompletionResponse,
  options?: {
    spendingAdviceQuestion?: boolean;
    fallback?: SpendingAdviceResponseSchema;
    unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
  },
) {
  const content = String(payload.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    if (options?.spendingAdviceQuestion && options.fallback) {
      return formatSpendingAdvicePatternFromSchema(options.fallback);
    }
    return "Ik kon nog geen antwoord ophalen. Probeer je vraag opnieuw.";
  }
  if (options?.spendingAdviceQuestion) {
    const parsed = parseSpendingAdviceSchema(content);
    if (parsed) {
      const merged = mergeSpendingSchemaWithContext({
        parsed,
        unifiedFinancialContext: options.unifiedFinancialContext || null,
      });
      return formatSpendingAdvicePatternFromSchema(merged);
    }
    if (options.fallback) {
      return formatSpendingAdvicePatternFromSchema(options.fallback);
    }
  }
  return content;
}

function toProxyFallback(
  fallback: SpendingAdviceResponseSchema,
): SpendingAdviceProxyFallback {
  return {
    conclusion: fallback.conclusion,
    why: fallback.why,
    risk: fallback.risk,
    nextStep: fallback.nextStep,
    confidence: fallback.confidence,
    dataGaps: fallback.dataGaps,
  };
}

export async function requestHelpAssistantReply({
  context,
  thread,
  unifiedFinancialContext,
}: HelpAssistantAIRequest): Promise<HelpAssistantAIResponse> {
  const latestUserMessage = getLatestUserMessage(thread);
  const isSpendingAdviceQuestion = latestUserMessage
    ? looksLikeBudgetSpaceQuestion(latestUserMessage.text)
    : false;

  const requestedAmount =
    isSpendingAdviceQuestion && latestUserMessage
      ? parseRequestedAmountFromQuestion(latestUserMessage.text)
      : null;
  const resolvedFinancialContext =
    isSpendingAdviceQuestion && latestUserMessage
      ? unifiedFinancialContext ||
        (await resolveUnifiedFinancialAdviceContext({
          context,
        }))
      : null;
  const spendingFallback =
    isSpendingAdviceQuestion && resolvedFinancialContext
      ? buildSafeSpendingFallback({
          context,
          unifiedFinancialContext: resolvedFinancialContext,
        })
      : null;

  const openAIMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(isSpendingAdviceQuestion
      ? [{ role: "system", content: SPENDING_ADVICE_SYSTEM_PROMPT }]
      : []),
    {
      role: "system",
      content: `Context:\n${buildContextPrompt(context)}`,
    },
    ...(resolvedFinancialContext
      ? [
          {
            role: "system",
            content: `Bestedingsadviescontext (centrale bron):\n${buildUnifiedFinancialContextPrompt(
              resolvedFinancialContext,
            )}`,
          },
          ...(requestedAmount != null
            ? [
                {
                  role: "system",
                  content: `Gevraagde uitgave: ${eur.format(
                    requestedAmount,
                  )}`,
                },
              ]
            : []),
        ]
      : []),
    ...pickThreadMessagesForModel(thread).map((message) => ({
      role: toOpenAIRole(message.role),
      content: message.text,
    })),
  ];

  const openAIRequest = {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    response_format: isSpendingAdviceQuestion
      ? { type: "json_object" }
      : undefined,
    messages: openAIMessages,
  };

  try {
    const response =
      isSpendingAdviceQuestion && spendingFallback
        ? await postHelpAssistantSpendingAdviceCompletion({
            openAIRequest,
            safeFallback: toProxyFallback(spendingFallback),
          })
        : await postOpenAIChatCompletion(openAIRequest);

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
    return {
      answerText: parseAnswerText(payload, {
        spendingAdviceQuestion: isSpendingAdviceQuestion,
        fallback: spendingFallback || undefined,
        unifiedFinancialContext: resolvedFinancialContext,
      }),
      model: String(payload.model || DEFAULT_MODEL),
      responseId: payload.id || null,
      unifiedFinancialContext: resolvedFinancialContext,
    };
  } catch {
    if (isSpendingAdviceQuestion && spendingFallback) {
      return {
        answerText: formatSpendingAdvicePatternFromSchema(spendingFallback),
        model: "local-safe-fallback-spending-v1",
        responseId: null,
        unifiedFinancialContext: resolvedFinancialContext,
      };
    }

    throw new Error("Hulpassistent kon geen antwoord ophalen via proxy.");
  }
}
