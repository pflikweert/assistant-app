import type {
  HelpAssistantMessage,
  HelpAssistantThreadState,
} from "@/services/help-assistant-chat";
import {
  classifyHelpAssistantIntent,
} from "@/services/help-assistant-intent";
import {
  buildHelpAssistantScreenContextLines,
  type HelpAssistantContext,
} from "@/services/help-assistant-context";
import {
  resolveUnifiedFinancialAdviceContext,
  type UnifiedFinancialAdviceContext,
} from "@/services/help-assistant-financial-context";
import {
  SPENDING_ADVICE_SYSTEM_PROMPT,
  buildSpendingAdviceContextPrompt,
  buildSpendingAdvicePromptVariant,
  classifySpendingQuestionType,
  parseRequestedAmountFromQuestion,
} from "@/services/help-assistant-spending-advice";
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
const MAX_PLANNER_MESSAGES = 6;
const HELP_ASSISTANT_DEBUG_ENABLED =
  String(appEnv.EXPO_PUBLIC_HELP_ASSISTANT_DEBUG || "") === "1";
const HELP_ASSISTANT_SYSTEM_PROMPT = [
  "Je bent de Budio Assistent in een Nederlandse consumenten-app voor budget en financiële sturing.",
  "Werk volgens de Budio-volgorde: eerst huidige stand, daarna ruimte, daarna risico, daarna advies.",
  "Beantwoord vragen in zes herkenbare hulpsoorten: schermuitleg, probleemhulp, mogelijke bug, feedback/feature-idee, algemene financiële meedenkvraag, en bestedingsruimte-vragen.",
  "Antwoord altijd in het Nederlands.",
  "Houd antwoorden kort, duidelijk en menselijk.",
  "Gebruik eenvoudige taal die past bij gewone gebruikers zonder financiële vaktaal.",
  "In Budio betekent 'ruimte': ruimte om nog uit te geven binnen budget en forecast.",
  "Forecast is altijd een verwachting, geen zekerheid.",
  "Gebruik alleen gegevens die expliciet in de actuele context staan.",
  "Verzin nooit bedragen, datums, transacties, categorieën of conclusies.",
  "Herhaal geen oude cijfers uit eerdere berichten als ze niet opnieuw in de context staan.",
  "Bij onzekerheid zeg je dit expliciet, bijvoorbeeld: 'op basis van wat ik nu zie' of 'voor zover je gegevens compleet zijn'.",
  "Geef nooit absolute garanties over geld of toekomstige uitkomsten.",
  "Bij probleemhulp: begin praktisch met rustige stappen; vraag pas daarna om extra details als dat nodig is.",
  "Bij mogelijke bug: benoem voorzichtig dat het op een app-fout kan lijken en geef een concrete vervolgstap.",
  "Bij feedback/feature-idee: vat het idee kort samen in producttaal en bevestig wat het oplost.",
  "Laat technische interne termen niet rauw zien aan de gebruiker; vertaal ze naar gewone taal.",
  "Gebruik maximaal 3-6 zinnen tenzij de vraag expliciet om structuur vraagt.",
].join(" ");
const HELP_ASSISTANT_PLANNER_PROMPT = [
  "Je bent de planner van de Budio Assistent.",
  "Je schrijft nooit eindantwoord of advies, alleen een beslisobject voor de volgende modelcall.",
  "Bepaal intent en contextbehoefte voor exact één route en exact één mode.",
  "Route-opties: issue_intake, spending_advice, general.",
  "Mode-opties: issue_intake, spending_decision, space_summary, general_help.",
  "Gebruik spending_advice alleen voor echte bestedingsruimte- of uitgavebeslissingen.",
  "Gebruik issue_intake voor ideeën, feedback, bugs of productproblemen.",
  "Gebruik general_help voor uitleg en algemene hulpvragen.",
  "Gebruik scherminformatie niet als financiële waarheid. Die is alleen relevant als screenExplanation nodig is.",
  "Noem nooit bedragen, datums of advies in je output.",
  "Geef exact JSON terug met dit schema:",
  "{",
  '  "route": "issue_intake|spending_advice|general",',
  '  "mode": "general_help|issue_intake|space_summary|spending_decision",',
  '  "confidence": "low|medium|high",',
  '  "needsClarification": true,',
  '  "requires": {',
  '    "monthBudget": true,',
  '    "cashflowSafety": true,',
  '    "expectedEndBalance": false,',
  '    "categoryStatus": false,',
  '    "weekContext": true,',
  '    "screenExplanation": false',
  "  },",
  '  "categoryHint": "groceries|fuel|housing|none",',
  '  "useScreenContext": false',
  "}",
].join(" ");

const ISSUE_INTAKE_SYSTEM_PROMPT = [
  "Je bent de Budio Assistent voor chat-first idee- en issue-intake.",
  "Je helpt de gebruiker rustig om een idee, feedback of probleem in gewone taal helder te maken.",
  "Je chatregel voor de gebruiker is altijd alleen 1 korte verdiepende vraag in gewone taal.",
  "De samenvatting bewaar je alleen voor de meldkaart en niet voor de chatregel.",
  "Je stelt die verdiepende vraag altijd, ook als de melding al bijna klaar is.",
  "Je mag nooit zeggen dat iets al is doorgestuurd, gemeld of opgelost voordat de gebruiker expliciet op versturen klikt.",
  "Je geeft altijd strict JSON terug met exact deze structuur:",
  "{",
  '  "meta": { "route": "issue_intake", "type": "idea|issue|feedback|bug|general", "subtype": "idea|issue|feedback|bug|general", "confidence": "low|medium|high", "state": "collecting|ready_to_review", "needsClarification": true, "context": { "screenId": "...", "screenTitle": "...", "routeName": "...", "platform": "...", "periodLabel": "..." } },',
  '  "answerText": "korte chatreactie in gewone taal",',
  '  "summary": "korte conceptsamenvatting",',
  '  "featureArea": "korte productplek of schermnaam",',
  '  "userNeed": "wat de gebruiker wil of wat er misgaat",',
  '  "proposedChange": "wat Budio volgens de gebruiker moet doen",',
  '  "followUpQuestion": "één korte verdiepende vraag in gewone taal",',
  '  "isReadyForSubmission": true',
  "}",
  "Gebruik geen technische labels als zichtbare uitleg. De meta-velden zijn alleen voor de app.",
  "Laat `answerText` alleen de verdiepende vraag bevatten; geen samenvattende inleiding, geen technische labels, en nooit 'ik geef dit door' of iets vergelijkbaars.",
  "Als de melding nog niet concreet genoeg is, zet state op collecting en needsClarification op true.",
  "Als de melding concreet genoeg is voor een reviewkaart, zet state op ready_to_review en isReadyForSubmission op true.",
  "Als het om een idee gaat, kies type/subtype idea. Als het om een probleem of bug gaat, kies issue of bug.",
  "Als het om feedback gaat, kies feedback.",
].join(" ");

// Centrale prompt-library, zodat we later eenvoudig use-cases zoals bug triage of issue drafts kunnen toevoegen.
const PROMPT_LIBRARY = {
  generalAssistant: HELP_ASSISTANT_SYSTEM_PROMPT,
  issueIntake: ISSUE_INTAKE_SYSTEM_PROMPT,
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
  issueFlowActive?: boolean;
};

export type HelpAssistantAIResponse = {
  answerText: string;
  model: string;
  responseId: string | null;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
  issueIntake?: HelpAssistantIssueDraftResponse | null;
};

type HelpAssistantTurnRoute = "issue_intake" | "spending_advice" | "general";

type HelpAssistantResponseMode =
  | "general_help"
  | "issue_intake"
  | "space_summary"
  | "spending_decision";

type HelpAssistantPlannerRequires = {
  monthBudget: boolean;
  cashflowSafety: boolean;
  expectedEndBalance: boolean;
  categoryStatus: boolean;
  weekContext: boolean;
  screenExplanation: boolean;
};

type HelpAssistantPlannerCategoryHint =
  | "groceries"
  | "fuel"
  | "housing"
  | "none";

type HelpAssistantPlannerDecision = {
  route: HelpAssistantTurnRoute;
  mode: HelpAssistantResponseMode;
  confidence: "low" | "medium" | "high";
  needsClarification: boolean;
  requires: HelpAssistantPlannerRequires;
  categoryHint: HelpAssistantPlannerCategoryHint;
  useScreenContext: boolean;
};

type SpendingAdviceSections = {
  conclusion: string;
  why: string;
  risk: string;
  nextStep: string;
};

type HelpAssistantStructuredResponseType =
  | "general"
  | "idea"
  | "issue"
  | "feedback"
  | "bug";

type HelpAssistantStructuredResponseContext = {
  screenId: string;
  screenTitle: string;
  routeName: string;
  platform: string;
  periodLabel: string | null;
};

type HelpAssistantIssueDraftResponse = {
  meta: {
    route: "issue_intake";
    type: HelpAssistantStructuredResponseType;
    subtype: "general" | "idea" | "issue" | "feedback" | "bug";
    confidence: "low" | "medium" | "high";
    state: "collecting" | "ready_to_review";
    needsClarification: boolean;
    context: HelpAssistantStructuredResponseContext;
  };
  answerText: string;
  summary: string;
  featureArea: string;
  userNeed: string;
  proposedChange: string;
  isReadyForSubmission: boolean;
  followUpQuestion?: string;
};

export type SpendingAdviceResponseSchema = SpendingAdviceSections & {
  meta?: {
    route: "spending_advice";
    type: "spending_advice";
    context: HelpAssistantStructuredResponseContext;
  };
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

function pickPlannerMessagesForModel(thread: HelpAssistantThreadState) {
  return pickThreadMessagesForModel(thread).slice(-MAX_PLANNER_MESSAGES);
}

function logHelpAssistantDebug(label: string, payload: Record<string, unknown>) {
  if (!HELP_ASSISTANT_DEBUG_ENABLED) return;
  try {
    console.info(`[help-assistant][${label}] ${JSON.stringify(payload)}`);
  } catch {
    // ignore debug logging failures
  }
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

function buildNeutralPlannerContextPrompt(input: {
  context: HelpAssistantContext;
  issueFlowActive: boolean;
}) {
  const { context, issueFlowActive } = input;
  const period = context.selectedPeriod?.label || "niet geselecteerd";
  return [
    `Actieve meldkaart: ${issueFlowActive ? "ja" : "nee"}.`,
    `Platform: ${context.platform}`,
    `Periode: ${period}`,
    "Let op: schermspecifieke regels zijn niet meegestuurd. Neem schermcontext alleen mee als de vraag expliciet om schermuitleg vraagt.",
  ].join("\n");
}

function buildGeneralRouteContextPrompt(input: {
  context: HelpAssistantContext;
  includeScreenContext: boolean;
}) {
  const { context, includeScreenContext } = input;
  const period = context.selectedPeriod?.label || "niet geselecteerd";
  const lines = [
    "Kanaal: general_help",
    `Platform: ${context.platform}`,
    `Periode: ${period}`,
  ];
  if (includeScreenContext) {
    lines.push("", `Context:\n${buildContextPrompt(context)}`);
  }
  return lines.join("\n");
}

function buildSpendingRouteContextPrompt(input: {
  context: HelpAssistantContext;
  mode: "space_summary" | "spending_decision";
}) {
  const { context, mode } = input;
  const period = context.selectedPeriod?.label || "niet geselecteerd";
  return [
    "Kanaal: spending_advice",
    `Mode: ${mode}`,
    `Periode: ${period}`,
    "Gedragsregel: geef hetzelfde financiële oordeel ongeacht huidig scherm. Scherminformatie is alleen UI-context, niet je financiële waarheid.",
    "Redeneervolgorde: 1) maandbudget, 2) verwacht eindsaldo (als beschikbaar), 3) cashflow safety, 4) weekcontext alleen aanvullend.",
  ].join("\n");
}

function buildCompactSpendingContextBlock(input: {
  context: HelpAssistantContext;
  mode: "space_summary" | "spending_decision";
  unifiedFinancialContext: UnifiedFinancialAdviceContext | null;
  requestedAmount: number | null;
  requiredBlocks: HelpAssistantPlannerRequires;
}) {
  const routeContext = `Spending-context:\n${buildSpendingRouteContextPrompt({
    context: input.context,
    mode: input.mode,
  })}`;
  if (!input.unifiedFinancialContext) {
    return routeContext;
  }
  const truthSafeContext = buildSpendingAdviceContextPrompt({
    context: input.unifiedFinancialContext,
    requestedAmount: input.requestedAmount,
    requiredBlocks: input.requiredBlocks,
  });
  return [routeContext, truthSafeContext].join("\n\n");
}

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      // keep trying other candidates
    }
  }

  return null;
}

function cleanInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getLatestUserMessage(thread: HelpAssistantThreadState) {
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message.role === "user") return message;
  }
  return null;
}

function hasRepeatedUserQuestion(thread: HelpAssistantThreadState) {
  const recentUserMessages = thread.messages.filter(
    (message) => message.role === "user",
  );
  if (recentUserMessages.length < 2) return false;

  const last = recentUserMessages[recentUserMessages.length - 1];
  const previous = recentUserMessages[recentUserMessages.length - 2];
  return normalizeText(last.text) === normalizeText(previous.text);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isFinancialAdviceQuestion(input: string) {
  return classifySpendingQuestionType(input) !== null;
}

function buildPlannerPrompt(input: {
  context: HelpAssistantContext;
  issueFlowActive: boolean;
}) {
  return [
    HELP_ASSISTANT_PLANNER_PROMPT,
    "",
    `Planner-context:\n${buildNeutralPlannerContextPrompt(input)}`,
    "",
    "Geef exact één route en één mode die bij elkaar passen.",
  ].join("\n");
}

function buildIssueIntakePrompt(context: HelpAssistantContext) {
  return [
    "Beoordeel of de gebruiker een idee, feedback, probleem of bug beschrijft.",
    "Vat de kern samen in gewone taal, kort en geruststellend.",
    "Als de melding nog vaag is, stel hooguit 1 korte verduidelijkende vraag.",
    "Als de melding concreet genoeg is, maak dan een compacte samenvatting die klaar is om te reviewen.",
    "Zorg dat featureArea een begrijpelijke productplek of schermnaam is.",
    "Geef in meta altijd route='issue_intake', type, subtype, confidence en context mee.",
    "Gebruik answerText voor de chatreactie die de gebruiker ziet.",
    "Gebruik summary voor de korte conceptsamenvatting.",
    "",
    `Context:\n${buildContextPrompt(context)}`,
  ].join("\n");
}

function parseIssueIntakeResponse(
  content: string,
): HelpAssistantIssueDraftResponse | null {
  const parsed = parseJsonObject(content);
  if (!parsed) return null;

  const answerText = String(parsed.answerText || "").trim();
  const summary = String(parsed.summary || "").trim();
  const featureArea = String(parsed.featureArea || "").trim();
  const userNeed = String(parsed.userNeed || "").trim();
  const proposedChange = String(parsed.proposedChange || "").trim();
  const isReadyForSubmission = Boolean(parsed.isReadyForSubmission);
  const meta = parsed.meta;

  if (!answerText || !summary || !featureArea || !userNeed || !proposedChange) {
    return null;
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;

  const typedMeta = meta as Record<string, unknown>;
  const route = String(typedMeta.route || "").trim();
  const type = String(typedMeta.type || "").trim();
  const subtype = String(typedMeta.subtype || "").trim();
  const confidence = String(typedMeta.confidence || "").trim();
  const state = String(typedMeta.state || "").trim();
  const needsClarification = Boolean(typedMeta.needsClarification);
  const context = typedMeta.context;

  if (route !== "issue_intake") return null;
  if (!["general", "idea", "issue", "feedback", "bug"].includes(type)) return null;
  if (!["general", "idea", "issue", "feedback", "bug"].includes(subtype)) return null;
  if (!["low", "medium", "high"].includes(confidence)) return null;
  if (!["collecting", "ready_to_review"].includes(state)) return null;
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;

  const typedContext = context as Record<string, unknown>;
  const screenId = String(typedContext.screenId || "").trim();
  const screenTitle = String(typedContext.screenTitle || "").trim();
  const routeName = String(typedContext.routeName || "").trim();
  const platform = String(typedContext.platform || "").trim();
  const periodLabelRaw = typedContext.periodLabel;
  const periodLabel =
    typeof periodLabelRaw === "string"
      ? periodLabelRaw.trim() || null
      : periodLabelRaw == null
        ? null
        : String(periodLabelRaw || "").trim() || null;

  if (!screenId || !screenTitle || !routeName || !platform) return null;

  return {
    meta: {
      route: "issue_intake",
      type: type as HelpAssistantStructuredResponseType,
      subtype: subtype as "general" | "idea" | "issue" | "feedback" | "bug",
      confidence: confidence as "low" | "medium" | "high",
      state: state as "collecting" | "ready_to_review",
      needsClarification,
      context: {
        screenId,
        screenTitle,
        routeName,
        platform,
        periodLabel,
      },
    },
    answerText: buildIssueIntakeAnswerText({
      type: type as HelpAssistantStructuredResponseType,
      featureArea,
      followUpQuestion:
        typeof parsed.followUpQuestion === "string"
          ? parsed.followUpQuestion.trim() || undefined
          : undefined,
    }),
    summary,
    featureArea,
    userNeed,
    proposedChange,
    isReadyForSubmission,
    followUpQuestion:
      typeof parsed.followUpQuestion === "string"
        ? parsed.followUpQuestion.trim() || undefined
        : undefined,
  };
}

function parsePlannerRequires(
  value: unknown,
): HelpAssistantPlannerRequires | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const typed = value as Record<string, unknown>;
  const monthBudget = typed.monthBudget;
  const cashflowSafety = typed.cashflowSafety;
  const expectedEndBalance = typed.expectedEndBalance;
  const categoryStatus = typed.categoryStatus;
  const weekContext = typed.weekContext;
  const screenExplanation = typed.screenExplanation;
  if (
    typeof monthBudget !== "boolean" ||
    typeof cashflowSafety !== "boolean" ||
    typeof expectedEndBalance !== "boolean" ||
    typeof categoryStatus !== "boolean" ||
    typeof weekContext !== "boolean" ||
    typeof screenExplanation !== "boolean"
  ) {
    return null;
  }
  return {
    monthBudget,
    cashflowSafety,
    expectedEndBalance,
    categoryStatus,
    weekContext,
    screenExplanation,
  };
}

function parseHelpAssistantPlannerDecision(
  content: string,
): HelpAssistantPlannerDecision | null {
  const parsed = parseJsonObject(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const route = String(parsed.route || "").trim();
  const mode = String(parsed.mode || "").trim();
  const confidence = String(parsed.confidence || "").trim();
  const needsClarification = Boolean(parsed.needsClarification);
  const requires = parsePlannerRequires(parsed.requires);
  const categoryHint = String(parsed.categoryHint || "").trim();
  const useScreenContext = parsed.useScreenContext;

  if (!["issue_intake", "spending_advice", "general"].includes(route)) {
    return null;
  }
  if (
    ![
      "general_help",
      "issue_intake",
      "space_summary",
      "spending_decision",
    ].includes(mode)
  ) {
    return null;
  }
  if (!["low", "medium", "high"].includes(confidence)) return null;
  if (!requires) return null;
  if (
    !["groceries", "fuel", "housing", "none"].includes(
      categoryHint || "none",
    )
  ) {
    return null;
  }
  if (typeof useScreenContext !== "boolean") {
    return null;
  }

  return {
    route: route as HelpAssistantTurnRoute,
    mode: mode as HelpAssistantResponseMode,
    confidence: confidence as "low" | "medium" | "high",
    needsClarification,
    requires,
    categoryHint: (categoryHint || "none") as HelpAssistantPlannerCategoryHint,
    useScreenContext,
  };
}

async function classifyHelpAssistantPlanWithOpenAI(input: {
  context: HelpAssistantContext;
  thread: HelpAssistantThreadState;
  issueFlowActive: boolean;
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
            issueFlowActive: input.issueFlowActive,
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

  if (!response.ok) {
    return null;
  }

  const payload = (parsed || {}) as ChatCompletionResponse;
  const content = String(payload.choices?.[0]?.message?.content || "").trim();
  if (!content) return null;
  return parseHelpAssistantPlannerDecision(content);
}

function normalizeQuestionText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function looksLikeScreenExplanationQuestion(text: string) {
  const normalized = normalizeQuestionText(text);
  return (
    normalized.includes("leg dit scherm uit") ||
    normalized.includes("leg dit uit") ||
    normalized.includes("wat zie ik hier") ||
    normalized.includes("wat betekent dit") ||
    normalized.includes("hoe werkt dit scherm")
  );
}

function looksLikeWeekScopedQuestion(text: string) {
  const normalized = normalizeQuestionText(text);
  return (
    normalized.includes("deze week") ||
    normalized.includes("dit weekend") ||
    normalized.includes("weekbudget") ||
    normalized.includes("tanken")
  );
}

function resolvePlannerCategoryHint(
  question: string | null | undefined,
): HelpAssistantPlannerCategoryHint {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return "none";
  if (
    normalized.includes("boodschap") ||
    normalized.includes("supermarkt")
  ) {
    return "groceries";
  }
  if (
    normalized.includes("benzine") ||
    normalized.includes("brandstof") ||
    normalized.includes("tank")
  ) {
    return "fuel";
  }
  if (
    normalized.includes("huur") ||
    normalized.includes("wonen") ||
    normalized.includes("woonlast")
  ) {
    return "housing";
  }
  return "none";
}

function shouldRequireCategoryStatus(question: string | null | undefined) {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return false;
  return (
    normalized.includes("boodschap") ||
    normalized.includes("supermarkt") ||
    normalized.includes("benzine") ||
    normalized.includes("brandstof") ||
    normalized.includes("tank") ||
    normalized.includes("horeca") ||
    normalized.includes("kleding") ||
    normalized.includes("uitgegeven aan") ||
    normalized.includes("te veel uit aan")
  );
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
  // Keep spending history compact; always end with the latest user question.
  return [...withoutLatestUser.slice(-4), input.latestUserMessage];
}

function isIssueLikeIntent(
  intent: ReturnType<typeof classifyHelpAssistantIntent> | null,
) {
  if (!intent) return false;
  return (
    intent.intent === "feature_request" ||
    intent.intent === "feedback" ||
    intent.intent === "mogelijke_bug"
  );
}

function buildSafePlannerFallback(input: {
  latestUserText: string | null;
  issueFlowActive: boolean;
  intentHint: ReturnType<typeof classifyHelpAssistantIntent> | null;
}) {
  if (input.issueFlowActive) {
    return {
      route: "issue_intake",
      mode: "issue_intake",
      confidence: "high",
      needsClarification: true,
      requires: {
        monthBudget: false,
        cashflowSafety: false,
        expectedEndBalance: false,
        categoryStatus: false,
        weekContext: false,
        screenExplanation: false,
      },
      categoryHint: "none",
      useScreenContext: true,
    } satisfies HelpAssistantPlannerDecision;
  }

  const screenExplanation = looksLikeScreenExplanationQuestion(
    input.latestUserText || "",
  );
  if (isIssueLikeIntent(input.intentHint)) {
    return {
      route: "issue_intake",
      mode: "issue_intake",
      confidence: input.intentHint?.confidence || "medium",
      needsClarification: true,
      requires: {
        monthBudget: false,
        cashflowSafety: false,
        expectedEndBalance: false,
        categoryStatus: false,
        weekContext: false,
        screenExplanation: false,
      },
      categoryHint: "none",
      useScreenContext: true,
    } satisfies HelpAssistantPlannerDecision;
  }

  const spendingType = input.latestUserText
    ? classifySpendingQuestionType(input.latestUserText)
    : null;
  if (spendingType) {
    const categoryHint = resolvePlannerCategoryHint(input.latestUserText);
    const requiresCategoryStatus =
      categoryHint !== "none" || shouldRequireCategoryStatus(input.latestUserText);
    return {
      route: "spending_advice",
      mode: spendingType,
      confidence: "medium",
      needsClarification: false,
      requires: {
        monthBudget: true,
        cashflowSafety: true,
        expectedEndBalance: spendingType === "spending_decision",
        categoryStatus: requiresCategoryStatus,
        weekContext: looksLikeWeekScopedQuestion(input.latestUserText || ""),
        screenExplanation: false,
      },
      categoryHint,
      useScreenContext: false,
    } satisfies HelpAssistantPlannerDecision;
  }

  return {
    route: "general",
    mode: "general_help",
    confidence: input.intentHint?.confidence || "low",
    needsClarification: false,
    requires: {
      monthBudget: false,
      cashflowSafety: false,
      expectedEndBalance: false,
      categoryStatus: false,
      weekContext: false,
      screenExplanation,
    },
    categoryHint: "none",
    useScreenContext: screenExplanation,
  } satisfies HelpAssistantPlannerDecision;
}

function normalizePlannerDecision(input: {
  plannerDecision: HelpAssistantPlannerDecision | null;
  fallbackDecision: HelpAssistantPlannerDecision;
  issueFlowActive: boolean;
}): HelpAssistantPlannerDecision {
  const raw = input.plannerDecision || input.fallbackDecision;
  const normalized: HelpAssistantPlannerDecision = {
    ...raw,
    requires: { ...raw.requires },
  };

  if (input.issueFlowActive) {
    normalized.route = "issue_intake";
    normalized.mode = "issue_intake";
    normalized.requires.monthBudget = false;
    normalized.requires.cashflowSafety = false;
    normalized.requires.expectedEndBalance = false;
    normalized.requires.categoryStatus = false;
    normalized.requires.weekContext = false;
    normalized.requires.screenExplanation = false;
    normalized.useScreenContext = true;
    return normalized;
  }

  if (normalized.route === "spending_advice") {
    if (
      normalized.mode !== "space_summary" &&
      normalized.mode !== "spending_decision"
    ) {
      normalized.mode = "spending_decision";
    }
    normalized.requires.monthBudget = true;
    normalized.requires.cashflowSafety =
      normalized.requires.cashflowSafety || normalized.requires.expectedEndBalance;
    if (normalized.mode === "spending_decision") {
      normalized.requires.expectedEndBalance = true;
    }
    if (normalized.requires.expectedEndBalance) {
      normalized.requires.cashflowSafety = true;
      normalized.requires.monthBudget = true;
    }
    if (normalized.requires.weekContext && !normalized.requires.monthBudget) {
      normalized.requires.weekContext = false;
    }
    if (
      !normalized.requires.categoryStatus &&
      normalized.categoryHint !== "none"
    ) {
      normalized.requires.categoryStatus = true;
    }
    normalized.requires.screenExplanation = false;
    normalized.useScreenContext = false;
  } else if (normalized.route === "issue_intake") {
    normalized.mode = "issue_intake";
    normalized.requires.monthBudget = false;
    normalized.requires.cashflowSafety = false;
    normalized.requires.expectedEndBalance = false;
    normalized.requires.categoryStatus = false;
    normalized.requires.weekContext = false;
    normalized.requires.screenExplanation = false;
    normalized.useScreenContext = true;
  } else {
    normalized.mode = "general_help";
    normalized.requires.monthBudget = false;
    normalized.requires.cashflowSafety = false;
    normalized.requires.expectedEndBalance = false;
    normalized.requires.categoryStatus = false;
    normalized.requires.weekContext = false;
    normalized.requires.screenExplanation =
      normalized.requires.screenExplanation || normalized.useScreenContext;
  }

  return normalized;
}

function buildIssueIntakeAnswerText(input: {
  type: HelpAssistantStructuredResponseType;
  featureArea: string;
  followUpQuestion?: string;
}) {
  const followUpQuestion =
    cleanInlineText(input.followUpQuestion || "") ||
    buildDeepeningQuestion({
      type: input.type,
      featureArea: input.featureArea,
    });

  return followUpQuestion;
}

function buildDeepeningQuestion(input: {
  type: HelpAssistantStructuredResponseType;
  featureArea: string;
}) {
  const featureArea = cleanInlineText(input.featureArea || "");
  const areaLower = featureArea.toLowerCase();
  const locationPhrase =
    areaLower === "dashboard"
      ? "op het dashboard"
      : featureArea
        ? `aan ${areaLower}`
        : "hier";

  if (input.type === "bug") {
    return "Waar merk je dit het duidelijkst en wat gebeurt er nu precies?";
  }

  if (input.type === "feedback") {
    return `Wat zou voor jou het belangrijkste verschil maken ${locationPhrase}?`;
  }

  if (featureArea) {
    return `Wat zou je graag willen toevoegen of veranderen ${locationPhrase}?`;
  }

  return "Kun je nog iets meer vertellen wat je precies in gedachten hebt?";
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
  const { unifiedFinancialContext } = input;
  const periodLabel = unifiedFinancialContext.period.label || "deze maand";

  return {
    conclusion: `Ik kan je bestedingsruimte voor ${periodLabel} nu niet betrouwbaar bevestigen.`,
    why: "De AI-proxy kon deze vraag nu niet stabiel genoeg verwerken met je huidige budget- en forecastcontext.",
    risk: "Op basis van wat ik nu zie wil ik geen schijnzekerheid geven over uitgavenruimte.",
    nextStep:
      "Probeer je vraag opnieuw met bedrag en categorie. Ik beoordeel het dan op je maandruimte en extra ruimte tot je volgende inkomsten.",
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
      const meta = parsed.meta;
      const typedMeta =
        meta && typeof meta === "object" && !Array.isArray(meta)
          ? (meta as Record<string, unknown>)
          : null;
      const metaRoute = String(typedMeta?.route || "").trim();
      const metaType = String(typedMeta?.type || "").trim();
      const metaContext = typedMeta?.context;
      const parsedMeta =
        metaRoute === "spending_advice" &&
        metaType === "spending_advice" &&
        metaContext &&
        typeof metaContext === "object" &&
        !Array.isArray(metaContext)
          ? {
              route: "spending_advice" as const,
              type: "spending_advice" as const,
              context: {
                screenId: String(
                  (metaContext as Record<string, unknown>).screenId || "",
                ).trim(),
                screenTitle: String(
                  (metaContext as Record<string, unknown>).screenTitle || "",
                ).trim(),
                routeName: String(
                  (metaContext as Record<string, unknown>).routeName || "",
                ).trim(),
                platform: String(
                  (metaContext as Record<string, unknown>).platform || "",
                ).trim(),
                periodLabel:
                  typeof (metaContext as Record<string, unknown>).periodLabel ===
                  "string"
                    ? String(
                        (metaContext as Record<string, unknown>).periodLabel,
                      ).trim() || null
                    : null,
              },
            }
          : undefined;

      return {
        conclusion,
        why,
        risk,
        nextStep,
        ...(parsedMeta ? { meta: parsedMeta } : {}),
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
  issueFlowActive,
}: HelpAssistantAIRequest): Promise<HelpAssistantAIResponse> {
  const latestUserMessage = getLatestUserMessage(thread);
  const latestUserIntent = latestUserMessage
    ? classifyHelpAssistantIntent(latestUserMessage.text)
    : null;
  const isIssueFlowActive = Boolean(issueFlowActive);
  const fallbackDecision = buildSafePlannerFallback({
    latestUserText: latestUserMessage?.text || null,
    issueFlowActive: isIssueFlowActive,
    intentHint: latestUserIntent,
  });
  const plannerDecision = latestUserMessage
    ? await classifyHelpAssistantPlanWithOpenAI({
        context,
        thread,
        issueFlowActive: isIssueFlowActive,
      })
    : null;
  let normalizedPlannerDecision = normalizePlannerDecision({
    plannerDecision,
    fallbackDecision,
    issueFlowActive: isIssueFlowActive,
  });
  const fallbackSpendingType = latestUserMessage
    ? classifySpendingQuestionType(latestUserMessage.text)
    : null;
  if (
    !isIssueFlowActive &&
    normalizedPlannerDecision.route === "general" &&
    fallbackSpendingType &&
    !isIssueLikeIntent(latestUserIntent)
  ) {
    normalizedPlannerDecision = normalizePlannerDecision({
      plannerDecision: {
        route: "spending_advice",
        mode: fallbackSpendingType,
        confidence: normalizedPlannerDecision.confidence,
        needsClarification: false,
        requires: {
          monthBudget: true,
          cashflowSafety: true,
          expectedEndBalance: fallbackSpendingType === "spending_decision",
          categoryStatus: resolvePlannerCategoryHint(
            latestUserMessage?.text,
          ) !== "none",
          weekContext: looksLikeWeekScopedQuestion(latestUserMessage?.text || ""),
          screenExplanation: false,
        },
        categoryHint: resolvePlannerCategoryHint(latestUserMessage?.text),
        useScreenContext: false,
      },
      fallbackDecision,
      issueFlowActive: false,
    });
  }
  const route = normalizedPlannerDecision.route;
  const mode = normalizedPlannerDecision.mode;
  const isIssueIntakeQuestion = mode === "issue_intake";
  const isSpendingAdviceQuestion =
    mode === "space_summary" || mode === "spending_decision";
  const spendingQuestionType = isSpendingAdviceQuestion ? mode : null;
  const spendingPromptVariant = spendingQuestionType
    ? buildSpendingAdvicePromptVariant(spendingQuestionType)
    : null;

  const requestedAmount =
    isSpendingAdviceQuestion && latestUserMessage
      ? parseRequestedAmountFromQuestion(latestUserMessage.text)
      : null;
  const requiresFinancialContext =
    normalizedPlannerDecision.requires.monthBudget ||
    normalizedPlannerDecision.requires.cashflowSafety ||
    normalizedPlannerDecision.requires.expectedEndBalance ||
    normalizedPlannerDecision.requires.categoryStatus;
  const resolvedFinancialContext =
    latestUserMessage && (isSpendingAdviceQuestion || requiresFinancialContext)
      ? unifiedFinancialContext ||
        (await resolveUnifiedFinancialAdviceContext({
          context,
          question: latestUserMessage.text,
          requestedAmount,
        }))
      : null;
  const spendingFallback =
    isSpendingAdviceQuestion && resolvedFinancialContext
      ? buildSafeSpendingFallback({
          context,
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

  const plannerFallbackUsed = plannerDecision == null;
  const plannerFallbackReason =
    !latestUserMessage
      ? "no_latest_user_message"
      : plannerDecision == null
        ? "planner_invalid_or_unavailable"
        : null;
  const fallbackOverrideToSpending =
    !isIssueFlowActive &&
    normalizedPlannerDecision.route === "spending_advice" &&
    plannerDecision?.route === "general" &&
    Boolean(fallbackSpendingType);

  const systemPrompts: { label: string; content: string }[] = [];
  if (isSpendingAdviceQuestion) {
    systemPrompts.push({
      label: "spending_primary",
      content: SPENDING_ADVICE_SYSTEM_PROMPT,
    });
    if (spendingPromptVariant) {
      systemPrompts.push({
        label: `spending_variant_${spendingQuestionType}`,
        content: spendingPromptVariant,
      });
    }
    systemPrompts.push({
      label: "spending_context_compact",
      content: buildCompactSpendingContextBlock({
        context,
        mode: spendingQuestionType || "spending_decision",
        unifiedFinancialContext: resolvedFinancialContext,
        requestedAmount,
        requiredBlocks: normalizedPlannerDecision.requires,
      }),
    });
  } else if (isIssueIntakeQuestion) {
    systemPrompts.push({
      label: "issue_primary",
      content: PROMPT_LIBRARY.issueIntake,
    });
    systemPrompts.push({
      label: "issue_context",
      content: buildIssueIntakePrompt(context),
    });
  } else {
    const includeScreenContext =
      normalizedPlannerDecision.useScreenContext ||
      normalizedPlannerDecision.requires.screenExplanation;
    systemPrompts.push({
      label: "general_primary",
      content: SYSTEM_PROMPT,
    });
    systemPrompts.push({
      label: "general_channel_context",
      content: buildGeneralRouteContextPrompt({
        context,
        includeScreenContext,
      }),
    });
  }

  const threadMessagesForFinalCall = isSpendingAdviceQuestion
    ? pickThreadMessagesForSpendingFinalCall({
        thread,
        latestUserMessage,
      })
    : pickThreadMessagesForModel(thread);

  const openAIMessages = [
    ...systemPrompts.map((prompt) => ({
      role: "system" as const,
      content: prompt.content,
    })),
    ...threadMessagesForFinalCall.map((message) => ({
      role: toOpenAIRole(message.role),
      content: message.text,
    })),
  ];

  const loadedContextBlocks = [
    normalizedPlannerDecision.requires.monthBudget ? "monthBudget" : null,
    normalizedPlannerDecision.requires.cashflowSafety ? "cashflowSafety" : null,
    normalizedPlannerDecision.requires.expectedEndBalance
      ? "expectedEndBalance"
      : null,
    normalizedPlannerDecision.requires.categoryStatus ? "categoryStatus" : null,
    normalizedPlannerDecision.requires.weekContext ? "weekContext" : null,
    normalizedPlannerDecision.requires.screenExplanation
      ? "screenExplanation"
      : null,
  ].filter(Boolean) as string[];
  const compactContextBlockPresent = systemPrompts.some(
    (prompt) => prompt.label === "spending_context_compact",
  );
  const spendingPayloadPresent = systemPrompts.some((prompt) =>
    prompt.content.includes("SpendingAdvice truth-safe payload JSON:"),
  );

  logHelpAssistantDebug("planner_result", {
    raw: plannerDecision,
    fallback: fallbackDecision,
    normalized: normalizedPlannerDecision,
    fallbackUsed: plannerFallbackUsed,
    fallbackReason: plannerFallbackReason,
    fallbackOverrideToSpending,
  });
  logHelpAssistantDebug("final_answer_setup", {
    route,
    mode,
    requires: normalizedPlannerDecision.requires,
    promptLabels: systemPrompts.map((prompt) => prompt.label),
    loadedContextBlocks,
    compactContextBlockPresent,
    spendingPayloadPresent,
    monthBudget: normalizedPlannerDecision.requires.monthBudget,
    expectedEndBalance: normalizedPlannerDecision.requires.expectedEndBalance,
    cashflowSafety: normalizedPlannerDecision.requires.cashflowSafety,
    plannerFallbackUsed,
    plannerFallbackReason,
    fallbackOverrideToSpending,
  });

  const openAIRequest = {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    response_format: isSpendingAdviceQuestion
      ? { type: "json_object" }
      : isIssueIntakeQuestion
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
            useCase: "help_general",
            routeName: context.routeName,
            screenId: context.screenId,
            screenTitle: context.screenTitle,
            platform: context.platform,
            periodLabel: context.selectedPeriod?.label || undefined,
            agentMode: "chat",
            responseMode:
              isIssueIntakeQuestion ? "json_object" : "text",
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
      answerText:
        issueIntakeResponse?.answerText ||
        (isIssueIntakeQuestion
          ? issueIntakeFallbackText
          : parseAnswerText(payload, {
              spendingAdviceQuestion: isSpendingAdviceQuestion,
              fallback: spendingFallback || undefined,
              unifiedFinancialContext: resolvedFinancialContext,
            })),
      model: String(payload.model || DEFAULT_MODEL),
      responseId: payload.id || null,
      unifiedFinancialContext: resolvedFinancialContext,
      issueIntake: issueIntakeResponse,
    };
  } catch {
    if (isSpendingAdviceQuestion && spendingFallback) {
      return {
        answerText: formatSpendingAdvicePatternFromSchema(spendingFallback),
        model: "local-safe-fallback-spending-v1",
        responseId: null,
        unifiedFinancialContext: resolvedFinancialContext,
        issueIntake: null,
      };
    }

    throw new Error("Hulpassistent kon geen antwoord ophalen via proxy.");
  }
}
