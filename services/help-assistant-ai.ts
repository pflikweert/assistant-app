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
  "Kies verplicht precies één insightsFlow die aangeeft welk intern insights-pad of modelblok nodig is om de vraag truth-safe te beantwoorden.",
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
  activeFlow?: HelpAssistantActiveFlowDescriptor | null;
  issueFlowActive?: boolean;
};

export type HelpAssistantAIResponse = {
  answerText: string;
  model: string;
  responseId: string | null;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
  issueIntake?: HelpAssistantIssueDraftResponse | null;
};

type HelpAssistantTurnRoute =
  | "issue_intake"
  | "spending_advice"
  | "general"
  | "transactions_insight"
  | "category_insight"
  | "screen_explanation";

type HelpAssistantResponseMode =
  | "general_help"
  | "issue_intake"
  | "space_summary"
  | "spending_decision"
  | "transaction_lookup"
  | "category_summary"
  | "screen_help";

type HelpAssistantActiveFlowInfluence = "none" | "low" | "medium" | "high";

type HelpAssistantPlannerRequires = {
  monthBudget: boolean;
  cashflowSafety: boolean;
  expectedEndBalance: boolean;
  categorySummary: boolean;
  transactionFacts: boolean;
  screenExplanation: boolean;
};

type HelpAssistantPlannerMonthScope =
  | "current"
  | "previous"
  | "specified"
  | "none";

type HelpAssistantPlannerTransactionQuestionType =
  | "merchant_total"
  | "merchant_frequency"
  | "category_places"
  | "category_total"
  | "none";

type HelpAssistantPlannerScopeSlug = string | "none" | "unknown";

type HelpAssistantPlannerInsightsFlow =
  | "general_reasoning"
  | "spending_overview"
  | "category_summary"
  | "transaction_facts"
  | "screen_context"
  | "issue_intake"
  | "none";

type HelpAssistantPlannerDataRequests = {
  monthScope: HelpAssistantPlannerMonthScope;
  categoryScope: HelpAssistantPlannerScopeSlug;
  merchantScope: HelpAssistantPlannerScopeSlug;
  transactionQuestionType: HelpAssistantPlannerTransactionQuestionType;
};

type HelpAssistantHydrationPlan = {
  financialSnapshot: boolean;
  categorySummary: boolean;
  transactionFacts: boolean;
  monthScopeResolved: HelpAssistantPlannerMonthScope;
  categoryScopeResolved: HelpAssistantPlannerScopeSlug;
  merchantScopeResolved: HelpAssistantPlannerScopeSlug;
  questionTypeResolved: HelpAssistantPlannerTransactionQuestionType;
  limitations: string[];
  fallbacks: string[];
};

type HydratedAssistantDataBlocks = {
  financialSnapshotBlock: string | null;
  categorySummaryBlock: string | null;
  transactionFactsBlock: string | null;
  limitations: string[];
  loadedBlocks: string[];
};

type HelpAssistantAvailableCategoryScope = {
  slug: string;
  label: string;
  source: "spending" | "subcategory" | "budget";
};

type HelpAssistantPlannerDecision = {
  route: HelpAssistantTurnRoute;
  mode: HelpAssistantResponseMode;
  insightsFlow: HelpAssistantPlannerInsightsFlow;
  confidence: "low" | "medium" | "high";
  needsClarification: boolean;
  continueActiveFlow: boolean;
  activeFlowInfluence: HelpAssistantActiveFlowInfluence;
  requires: HelpAssistantPlannerRequires;
  dataRequests: HelpAssistantPlannerDataRequests;
  useScreenContext: boolean;
};

export type HelpAssistantActiveFlowDescriptor = {
  route: HelpAssistantTurnRoute | string;
  mode?: HelpAssistantResponseMode | string | null;
  status?: string | null;
  anchorMessageId?: string | null;
  reason?: string | null;
};

type NormalizedActiveFlow = {
  route: HelpAssistantTurnRoute | "unknown";
  mode: HelpAssistantResponseMode | "unknown";
  status: string | null;
  anchorMessageId: string | null;
  reason: string | null;
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

function buildGeneralRouteContextPrompt(input: {
  context: HelpAssistantContext;
  includeScreenContext: boolean;
  route: Exclude<HelpAssistantTurnRoute, "spending_advice" | "issue_intake">;
  mode: Exclude<
    HelpAssistantResponseMode,
    "spending_decision" | "space_summary" | "issue_intake"
  >;
  insightsFlow: HelpAssistantPlannerInsightsFlow;
  requires: HelpAssistantPlannerRequires;
  dataRequests: HelpAssistantPlannerDataRequests;
  needsClarification: boolean;
}) {
  const {
    context,
    includeScreenContext,
    route,
    mode,
    insightsFlow,
    requires,
    dataRequests,
  } = input;
  const period = context.selectedPeriod?.label || "niet geselecteerd";
  const lines = [
    "Kanaal: general_help",
    `Planner-route: ${route}`,
    `Planner-mode: ${mode}`,
    `Insights-flow: ${insightsFlow}`,
    `DataRequest: monthScope=${dataRequests.monthScope}, categoryScope=${dataRequests.categoryScope}, merchantScope=${dataRequests.merchantScope}, transactionQuestionType=${dataRequests.transactionQuestionType}`,
    `Platform: ${context.platform}`,
    `Periode: ${period}`,
  ];
  if (requires.transactionFacts || route === "transactions_insight") {
    lines.push(
      "Routehint: geef alleen transactiefeiten als ze expliciet in de context staan. Als feiten ontbreken, zeg dat expliciet en stel maximaal 1 verduidelijkingsvraag.",
    );
  }
  if (requires.categorySummary || route === "category_insight") {
    lines.push(
      "Routehint: geef alleen categorie-samenvattingen op basis van expliciete context. Verzin geen bedragen, categorieën of totalen.",
    );
    if (dataRequests.transactionQuestionType === "category_total") {
      lines.push(
        "Als `scopedCategoryTotal` beschikbaar is, noem dit bedrag expliciet en koppel het aan de genoemde categorie.",
      );
    }
  }
  if (input.needsClarification) {
    lines.push(
      "Planner vraagt verduidelijking: stel 1 korte, concrete vraag voordat je aannames maakt.",
    );
  }
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
  latestUserText: string | null;
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
    requiredBlocks: {
      monthBudget: input.requiredBlocks.monthBudget,
      cashflowSafety: input.requiredBlocks.cashflowSafety,
      expectedEndBalance: input.requiredBlocks.expectedEndBalance,
      categoryStatus: input.requiredBlocks.categorySummary,
      weekContext: looksLikeWeekScopedQuestion(input.latestUserText || ""),
      screenExplanation: input.requiredBlocks.screenExplanation,
    },
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
  activeFlow: NormalizedActiveFlow | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}) {
  const availableCategoryScopes = (input.availableCategoryScopes || [])
    .slice(0, 20)
    .map((scope) => `${scope.slug} (${scope.label})`)
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

function buildPlannerDataRequestsDefaults(): HelpAssistantPlannerDataRequests {
  return {
    monthScope: "none",
    categoryScope: "none",
    merchantScope: "none",
    transactionQuestionType: "none",
  };
}

function sanitizeScopeSlug(
  value: unknown,
  fallback: "none" | "unknown",
): HelpAssistantPlannerScopeSlug {
  const placeholderTokens = new Set([
    "slug",
    "category_slug",
    "merchant_slug",
    "categoryscope",
    "merchantscope",
    "category_scope",
    "merchant_scope",
    "category",
    "merchant",
  ]);
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "none" || raw === "unknown") return raw;
  if (placeholderTokens.has(raw)) return fallback;
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!slug) return fallback;
  if (placeholderTokens.has(slug)) return fallback;
  return slug;
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
    ? (monthScopeRaw as HelpAssistantPlannerMonthScope)
    : "none";
  const transactionQuestionType = [
    "merchant_total",
    "merchant_frequency",
    "category_places",
    "category_total",
    "none",
  ].includes(transactionQuestionTypeRaw)
    ? (transactionQuestionTypeRaw as HelpAssistantPlannerTransactionQuestionType)
    : "none";
  return {
    monthScope,
    categoryScope: sanitizeScopeSlug(typed.categoryScope, "none"),
    merchantScope: sanitizeScopeSlug(typed.merchantScope, "none"),
    transactionQuestionType,
  };
}

function isHelpAssistantPlannerInsightsFlow(
  value: string | null | undefined,
): value is HelpAssistantPlannerInsightsFlow {
  return (
    value === "general_reasoning" ||
    value === "spending_overview" ||
    value === "category_summary" ||
    value === "transaction_facts" ||
    value === "screen_context" ||
    value === "issue_intake" ||
    value === "none"
  );
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
  const insightsFlowRaw = String(parsed.insightsFlow || "").trim();
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
  if (typeof useScreenContext !== "boolean") {
    return null;
  }

  return {
    route: route as HelpAssistantTurnRoute,
    mode: mode as HelpAssistantResponseMode,
    insightsFlow: isHelpAssistantPlannerInsightsFlow(insightsFlowRaw)
      ? insightsFlowRaw
      : resolveDefaultInsightsFlowForRoute(route as HelpAssistantTurnRoute),
    confidence: confidence as "low" | "medium" | "high",
    needsClarification,
    continueActiveFlow,
    activeFlowInfluence: activeFlowInfluence as HelpAssistantActiveFlowInfluence,
    requires,
    dataRequests,
    useScreenContext,
  };
}

async function classifyHelpAssistantPlanWithOpenAI(input: {
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

function shouldRequireCategorySummary(question: string | null | undefined) {
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

function tokenizeScopeText(value: string | null | undefined) {
  return normalizeQuestionText(value)
    .split(/[\s_]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        ![
          "de",
          "het",
          "een",
          "aan",
          "van",
          "met",
          "voor",
          "naar",
          "mijn",
          "deze",
          "deze",
          "dit",
          "die",
          "dat",
          "nog",
          "wel",
        ].includes(token),
    );
}

function buildAvailableCategoryScopes(
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

function inferCategoryScopeFromCatalog(input: {
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

function resolvePlannerDataCategoryScope(
  question: string | null | undefined,
  catalog?: HelpAssistantAvailableCategoryScope[],
): HelpAssistantPlannerScopeSlug {
  return inferCategoryScopeFromCatalog({
    question,
    catalog: catalog || [],
  });
}

function resolvePlannerDataMerchantScope(
  question: string | null | undefined,
): HelpAssistantPlannerScopeSlug {
  const normalized = normalizeQuestionText(question);
  if (!normalized) return "none";
  const match = normalized.match(/\bbij\s+([a-z0-9][a-z0-9\s]{1,40})$/i);
  if (!match?.[1]) return "none";
  return sanitizeScopeSlug(match[1], "unknown");
}

function resolvePlannerTransactionQuestionType(
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

function isLikelyScopedLookupFollowup(text: string | null | undefined) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const normalized = normalizeQuestionText(raw);
  if (!normalized) return false;
  if (
    normalized.includes("trend") ||
    normalized.includes("jaar") ||
    normalized.includes("vorige maand")
  ) {
    return false;
  }
  return countWords(normalized) <= 3 || normalized.endsWith("?");
}

function normalizePlannerDataRequests(input: {
  dataRequests: HelpAssistantPlannerDataRequests;
  requires: HelpAssistantPlannerRequires;
  route: HelpAssistantTurnRoute;
  latestUserText: string | null;
  selectedPeriodKey: string | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}): {
  dataRequests: HelpAssistantPlannerDataRequests;
  fallbackReasons: string[];
  limitationHints: string[];
  shouldClarify: boolean;
} {
  const fallbackReasons: string[] = [];
  const limitationHints: string[] = [];
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

  if (normalized.monthScope === "none") {
    if (requestedTimeScope.monthScopeHint) {
      normalized.monthScope = requestedTimeScope.monthScopeHint;
      fallbackReasons.push("inferred_month_scope_from_turn");
    }
  }

  if (requestedTimeScope.unsupported === "year") {
    limitationHints.push("jaar_scope_nog_niet_volledig_gehydrateerd");
    shouldClarify = true;
  }
  if (requestedTimeScope.unsupported === "trend") {
    limitationHints.push("trend_scope_nog_niet_volledig_gehydrateerd");
    shouldClarify = true;
  }

  if (normalized.monthScope === "none") {
    if (
      input.requires.monthBudget ||
      input.requires.cashflowSafety ||
      input.requires.expectedEndBalance ||
      input.requires.categorySummary ||
      input.requires.transactionFacts
    ) {
      normalized.monthScope = "current";
      fallbackReasons.push("month_scope_none_promoted_to_current");
    }
  }

  if (normalized.monthScope === "specified" && !input.selectedPeriodKey) {
    const requiresFinancialOrInsightData =
      input.requires.monthBudget ||
      input.requires.cashflowSafety ||
      input.requires.expectedEndBalance ||
      input.requires.categorySummary ||
      input.requires.transactionFacts;
    normalized.monthScope = requiresFinancialOrInsightData ? "current" : "none";
    fallbackReasons.push("month_scope_specified_without_period_context");
    limitationHints.push("specifieke_maand_niet_beschikbaar");
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
      limitationHints.push("categorie_scope_onduidelijk");
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
      limitationHints.push("transactie_vraagtype_onduidelijk");
      shouldClarify = true;
    }
  }

  if (
    normalized.transactionQuestionType === "none" &&
    input.requires.categorySummary &&
    normalized.categoryScope !== "none" &&
    normalized.categoryScope !== "unknown" &&
    isLikelyScopedLookupFollowup(input.latestUserText)
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
    limitationHints,
    shouldClarify,
  };
}

function buildHydrationPlan(input: {
  planner: HelpAssistantPlannerDecision;
  context: HelpAssistantContext;
  latestUserText: string | null;
  rawDataRequests?: HelpAssistantPlannerDataRequests | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}): HelpAssistantHydrationPlan {
  const requiresFinancialSnapshot =
    input.planner.requires.monthBudget ||
    input.planner.requires.cashflowSafety ||
    input.planner.requires.expectedEndBalance;
  const normalizedDataRequestResult = normalizePlannerDataRequests({
    dataRequests: input.rawDataRequests || input.planner.dataRequests,
    requires: input.planner.requires,
    route: input.planner.route,
    latestUserText: input.latestUserText,
    selectedPeriodKey: input.context.selectedPeriod?.key || null,
    availableCategoryScopes: input.availableCategoryScopes,
  });
  const limitations = [...normalizedDataRequestResult.limitationHints];
  const fallbacks = [...normalizedDataRequestResult.fallbackReasons];

  return {
    financialSnapshot: requiresFinancialSnapshot,
    categorySummary: input.planner.requires.categorySummary,
    transactionFacts: input.planner.requires.transactionFacts,
    monthScopeResolved: normalizedDataRequestResult.dataRequests.monthScope,
    categoryScopeResolved: normalizedDataRequestResult.dataRequests.categoryScope,
    merchantScopeResolved: normalizedDataRequestResult.dataRequests.merchantScope,
    questionTypeResolved:
      normalizedDataRequestResult.dataRequests.transactionQuestionType,
    limitations,
    fallbacks,
  };
}

function formatAmount(value: number | null | undefined) {
  if (!Number.isFinite(value as number)) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function buildHydratedAssistantDataBlocks(input: {
  hydrationPlan: HelpAssistantHydrationPlan;
  unifiedFinancialContext: UnifiedFinancialAdviceContext | null;
  resolvedMonthScope: HelpAssistantPlannerMonthScope;
  requestedPeriodKey: string | null;
}): HydratedAssistantDataBlocks {
  const loadedBlocks: string[] = [];
  const limitations = [...input.hydrationPlan.limitations];
  if (!input.unifiedFinancialContext) {
    if (
      input.hydrationPlan.financialSnapshot ||
      input.hydrationPlan.categorySummary ||
      input.hydrationPlan.transactionFacts
    ) {
      limitations.push("financiele_context_niet_beschikbaar");
    }
    return {
      financialSnapshotBlock: null,
      categorySummaryBlock: null,
      transactionFactsBlock: null,
      limitations,
      loadedBlocks,
    };
  }

  let financialSnapshotBlock: string | null = null;
  if (input.hydrationPlan.financialSnapshot) {
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
  if (input.hydrationPlan.categorySummary) {
    loadedBlocks.push("categorySummary");
    const categories =
      input.unifiedFinancialContext.spending.currentMonthBreakdown.categories || [];
    const availableCategoryScopes = buildAvailableCategoryScopes(
      input.unifiedFinancialContext,
    );
    const normalizedScope = sanitizeScopeSlug(
      input.hydrationPlan.categoryScopeResolved,
      "none",
    );
    const scopeReference = availableCategoryScopes.find(
      (scope) => scope.slug === normalizedScope,
    );
    const scopeTokens = tokenizeScopeText(
      [normalizedScope.replace(/_/g, " "), scopeReference?.label || ""].join(" "),
    );
    const normalizeMatchText = (value: string | null | undefined) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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
      if (normalizedScope === "none" || normalizedScope === "unknown") {
        return true;
      }
      const directCandidates = [
        sanitizeScopeSlug(category.categoryKey || "", "none"),
        sanitizeScopeSlug(category.key || "", "none"),
        sanitizeScopeSlug(category.label || "", "none"),
      ];
      if (directCandidates.includes(normalizedScope)) return true;
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
      normalizedScope === "none" || normalizedScope === "unknown"
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
      normalizedScope !== "none" && normalizedScope !== "unknown" && mapped.length === 1
        ? mapped[0]
        : null;
    const hasRequestedMonthData =
      input.hydrationPlan.monthScopeResolved === "previous"
        ? input.requestedPeriodKey != null &&
          input.unifiedFinancialContext.period.key === input.requestedPeriodKey
        : input.hydrationPlan.monthScopeResolved === input.resolvedMonthScope;
    if (!mapped.length && normalizedScope !== "none" && normalizedScope !== "unknown") {
      limitations.push("categorie_scope_niet_gevonden_in_geaggregeerde_data");
    }
    if (!hasRequestedMonthData) {
      limitations.push("month_scope_niet_volledig_gehydrateerd");
    }
    categorySummaryBlock = [
      "Truth-safe categorySummary:",
      `- monthScope: ${input.hydrationPlan.monthScopeResolved}`,
      `- dataPeriod: ${input.unifiedFinancialContext.period.label || "onbekend"}`,
      `- categoryScope: ${normalizedScope}`,
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
  if (input.hydrationPlan.transactionFacts) {
    loadedBlocks.push("transactionFacts");
    const hasRequestedMonthData =
      input.hydrationPlan.monthScopeResolved === "previous"
        ? input.requestedPeriodKey != null &&
          input.unifiedFinancialContext.period.key === input.requestedPeriodKey
        : input.hydrationPlan.monthScopeResolved === input.resolvedMonthScope;
    const questionType = input.hydrationPlan.questionTypeResolved;
    const merchantScope = sanitizeScopeSlug(
      input.hydrationPlan.merchantScopeResolved,
      "none",
    );
    const categoryScope = sanitizeScopeSlug(
      input.hydrationPlan.categoryScopeResolved,
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
      monthScope: input.hydrationPlan.monthScopeResolved,
      dataPeriod: input.unifiedFinancialContext.period.label || "onbekend",
      transactionQuestionType: questionType,
      categoryScope,
      merchantScope,
      answerability: "limited",
    };

    if (questionType === "category_total" && categoryMatch) {
      payload.answerability = "partial";
      payload.categoryTotal = formatAmount(categoryMatch.amount);
      payload.categoryTransactionCount = categoryMatch.transactionCount;
    } else if (questionType === "category_places") {
      limitations.push("merchant_locaties_niet_beschikbaar_zonder_extra_hydration");
    } else if (
      questionType === "merchant_total" ||
      questionType === "merchant_frequency"
    ) {
      limitations.push("merchant_aggregaten_niet_beschikbaar_in_deze_hydrationlaag");
    } else if (questionType === "none") {
      limitations.push("transactie_vraagtype_onduidelijk");
    }

    transactionFactsBlock = [
      "Truth-safe transactionFacts:",
      `- payload: ${JSON.stringify(payload)}`,
    ].join("\n");
    if (!hasRequestedMonthData) {
      limitations.push("month_scope_niet_volledig_gehydrateerd");
    }
  }

  return {
    financialSnapshotBlock,
    categorySummaryBlock,
    transactionFactsBlock,
    limitations,
    loadedBlocks,
  };
}

function buildHydratedDataContextPrompt(
  blocks: HydratedAssistantDataBlocks,
): string | null {
  const parts = [
    blocks.financialSnapshotBlock,
    blocks.categorySummaryBlock,
    blocks.transactionFactsBlock,
  ].filter(Boolean) as string[];
  if (blocks.limitations.length) {
    parts.push(
      [
        "Hydration-beperkingen:",
        ...blocks.limitations.map((item) => `- ${item}`),
        "Regel: verzin geen ontbrekende transacties, merchants of bedragen.",
      ].join("\n"),
    );
  }
  if (!parts.length) return null;
  return parts.join("\n\n");
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

function isHelpAssistantTurnRoute(
  value: string | null | undefined,
): value is HelpAssistantTurnRoute {
  return (
    value === "issue_intake" ||
    value === "spending_advice" ||
    value === "general" ||
    value === "transactions_insight" ||
    value === "category_insight" ||
    value === "screen_explanation"
  );
}

function isHelpAssistantResponseMode(
  value: string | null | undefined,
): value is HelpAssistantResponseMode {
  return (
    value === "general_help" ||
    value === "issue_intake" ||
    value === "space_summary" ||
    value === "spending_decision" ||
    value === "transaction_lookup" ||
    value === "category_summary" ||
    value === "screen_help"
  );
}

function resolveDefaultModeForRoute(route: HelpAssistantTurnRoute) {
  if (route === "issue_intake") return "issue_intake" as const;
  if (route === "spending_advice") return "spending_decision" as const;
  if (route === "transactions_insight") return "transaction_lookup" as const;
  if (route === "category_insight") return "category_summary" as const;
  if (route === "screen_explanation") return "screen_help" as const;
  return "general_help" as const;
}

function resolveDefaultInsightsFlowForRoute(
  route: HelpAssistantTurnRoute,
): HelpAssistantPlannerInsightsFlow {
  if (route === "issue_intake") return "issue_intake";
  if (route === "spending_advice") return "spending_overview";
  if (route === "transactions_insight") return "transaction_facts";
  if (route === "category_insight") return "category_summary";
  if (route === "screen_explanation") return "screen_context";
  return "general_reasoning";
}

function resolveRouteFromInsightsFlow(
  insightsFlow: HelpAssistantPlannerInsightsFlow,
): HelpAssistantTurnRoute | null {
  if (insightsFlow === "issue_intake") return "issue_intake";
  if (insightsFlow === "spending_overview") return "spending_advice";
  if (insightsFlow === "transaction_facts") return "transactions_insight";
  if (insightsFlow === "category_summary") return "category_insight";
  if (insightsFlow === "screen_context") return "screen_explanation";
  return null;
}

function normalizeActiveFlowDescriptor(input: {
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

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
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
  intentHint: ReturnType<typeof classifyHelpAssistantIntent> | null;
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

  if (
    isIssueLikeIntent(input.intentHint) &&
    input.activeFlow.route !== "issue_intake"
  ) {
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

function shouldPrimeFinancialCatalog(question: string | null | undefined) {
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
  if (classifySpendingQuestionType(normalized)) return true;
  if (shouldRequireCategorySummary(normalized)) return true;
  if (
    normalized.includes("transactie") ||
    normalized.includes("categorie") ||
    normalized.includes("uitgegeven")
  ) {
    return true;
  }
  return false;
}

function detectRequestedTimeScope(
  question: string | null | undefined,
): {
  monthScopeHint: HelpAssistantPlannerMonthScope | null;
  unsupported: "year" | "trend" | null;
} {
  const normalized = normalizeQuestionText(question);
  if (!normalized) {
    return { monthScopeHint: null, unsupported: null };
  }
  if (
    normalized.includes("dit jaar") ||
    normalized.includes("afgelopen jaar") ||
    normalized.includes("vorig jaar") ||
    normalized.includes("jaarlijks")
  ) {
    return { monthScopeHint: null, unsupported: "year" };
  }
  if (
    normalized.includes("trend") ||
    normalized.includes("ontwikkeling") ||
    normalized.includes("verloop")
  ) {
    return { monthScopeHint: null, unsupported: "trend" };
  }
  if (normalized.includes("vorige maand") || normalized.includes("afgelopen maand")) {
    return { monthScopeHint: "previous", unsupported: null };
  }
  if (
    normalized.includes("deze maand") ||
    normalized.includes("deze periode") ||
    normalized.includes("nu")
  ) {
    return { monthScopeHint: "current", unsupported: null };
  }
  return { monthScopeHint: null, unsupported: null };
}

function resolveContextMonthKey(context: HelpAssistantContext) {
  const explicitKey = String(context.selectedPeriod?.key || "").trim();
  if (/^\d{4}-\d{2}$/.test(explicitKey)) return explicitKey;
  const fromStartIso = String(context.selectedPeriod?.startIso || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(fromStartIso)) return fromStartIso;
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey: string, deltaMonths: number) {
  const [yearValue, monthValue] = String(monthKey || "").split("-");
  const year = Number.parseInt(yearValue || "", 10);
  const month = Number.parseInt(monthValue || "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const shiftedDate = new Date(year, month - 1 + deltaMonths, 1);
  const start = new Date(shiftedDate.getFullYear(), shiftedDate.getMonth(), 1);
  const end = new Date(shiftedDate.getFullYear(), shiftedDate.getMonth() + 1, 1);
  const toIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  return {
    key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    startIso: toIso(start),
    endIso: toIso(end),
  };
}

function buildContextForRequestedMonthScope(input: {
  context: HelpAssistantContext;
  monthScope: HelpAssistantPlannerMonthScope | null | undefined;
}) {
  if (input.monthScope !== "previous") {
    return input.context;
  }
  const baseMonthKey = resolveContextMonthKey(input.context);
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

function buildPlannerRequiresDefaults(): HelpAssistantPlannerRequires {
  return {
    monthBudget: false,
    cashflowSafety: false,
    expectedEndBalance: false,
    categorySummary: false,
    transactionFacts: false,
    screenExplanation: false,
  };
}

function buildFallbackDataRequests(
  latestUserText: string | null,
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[],
): HelpAssistantPlannerDataRequests {
  const categoryScope = resolvePlannerDataCategoryScope(
    latestUserText,
    availableCategoryScopes,
  );
  const merchantScope = resolvePlannerDataMerchantScope(latestUserText);
  const transactionQuestionType =
    resolvePlannerTransactionQuestionType(latestUserText, {
      categoryScope,
      merchantScope,
    });
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

function applyRouteModeAndRequiresDefaults(input: {
  decision: HelpAssistantPlannerDecision;
  latestUserText: string | null;
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
    if (
      normalized.mode !== "space_summary" &&
      normalized.mode !== "spending_decision"
    ) {
      normalized.mode = "spending_decision";
    }
    normalized.requires.monthBudget = true;
    normalized.requires.cashflowSafety = true;
    if (normalized.mode === "spending_decision") {
      normalized.requires.expectedEndBalance = true;
    }
    if (normalized.requires.expectedEndBalance) {
      normalized.requires.cashflowSafety = true;
      normalized.requires.monthBudget = true;
    }
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
      normalized.dataRequests.categoryScope =
        resolvePlannerDataCategoryScope(latestUserText);
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
    normalized.requires = buildPlannerRequiresDefaults();
    normalized.requires.transactionFacts = true;
    if (normalized.dataRequests.monthScope === "none") {
      normalized.dataRequests.monthScope = "current";
    }
    if (normalized.dataRequests.transactionQuestionType === "none") {
      normalized.dataRequests.transactionQuestionType =
        resolvePlannerTransactionQuestionType(latestUserText);
    }
    if (normalized.dataRequests.merchantScope === "none") {
      normalized.dataRequests.merchantScope =
        resolvePlannerDataMerchantScope(latestUserText);
    }
    if (normalized.dataRequests.categoryScope === "none") {
      normalized.dataRequests.categoryScope =
        resolvePlannerDataCategoryScope(latestUserText);
    }
    normalized.useScreenContext = false;
    return normalized;
  }

  if (normalized.route === "category_insight") {
    normalized.insightsFlow = "category_summary";
    normalized.mode = "category_summary";
    normalized.requires = buildPlannerRequiresDefaults();
    normalized.requires.categorySummary = true;
    if (normalized.dataRequests.monthScope === "none") {
      normalized.dataRequests.monthScope = "current";
    }
    if (normalized.dataRequests.categoryScope === "none") {
      normalized.dataRequests.categoryScope =
        resolvePlannerDataCategoryScope(latestUserText);
    }
    normalized.useScreenContext = false;
    return normalized;
  }

  if (normalized.route === "screen_explanation") {
    normalized.insightsFlow = "screen_context";
    normalized.mode = "screen_help";
    normalized.requires = buildPlannerRequiresDefaults();
    normalized.dataRequests = buildPlannerDataRequestsDefaults();
    normalized.requires.screenExplanation = true;
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

function buildSafePlannerFallback(input: {
  latestUserText: string | null;
  activeFlow: NormalizedActiveFlow | null;
  intentHint: ReturnType<typeof classifyHelpAssistantIntent> | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}) {
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
    } satisfies HelpAssistantPlannerDecision;
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
    } satisfies HelpAssistantPlannerDecision;
  }

  const spendingType = input.latestUserText
    ? classifySpendingQuestionType(input.latestUserText)
    : null;
  if (spendingType) {
    const requiresCategorySummary = shouldRequireCategorySummary(
      input.latestUserText,
    );
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
        categorySummary: requiresCategorySummary,
        transactionFacts: false,
        screenExplanation: false,
      },
      dataRequests: {
        ...fallbackDataRequests,
        transactionQuestionType: "none",
        merchantScope: "none",
      },
      useScreenContext: false,
    } satisfies HelpAssistantPlannerDecision;
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
    } satisfies HelpAssistantPlannerDecision;
  }

  const normalizedUserText = normalizeQuestionText(input.latestUserText);
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
      normalizedUserText.includes("transactie");

    if (looksLikeTransactionLookup) {
      return {
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
      return {
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
  } satisfies HelpAssistantPlannerDecision;
}

function normalizePlannerDecision(input: {
  plannerDecision: HelpAssistantPlannerDecision | null;
  fallbackDecision: HelpAssistantPlannerDecision;
  activeFlow: NormalizedActiveFlow | null;
  latestUserText: string | null;
  intentHint: ReturnType<typeof classifyHelpAssistantIntent> | null;
  selectedPeriodKey: string | null;
  availableCategoryScopes?: HelpAssistantAvailableCategoryScope[];
}): HelpAssistantPlannerDecision {
  const raw = input.plannerDecision || input.fallbackDecision;
  let normalized: HelpAssistantPlannerDecision = {
    ...raw,
    insightsFlow:
      raw.insightsFlow || resolveDefaultInsightsFlowForRoute(raw.route),
    continueActiveFlow: Boolean(raw.continueActiveFlow),
    activeFlowInfluence: raw.activeFlowInfluence || "none",
    requires: { ...raw.requires },
    dataRequests: {
      ...buildPlannerDataRequestsDefaults(),
      ...raw.dataRequests,
    },
  };
  normalized = applyRouteModeAndRequiresDefaults({
    decision: normalized,
    latestUserText: input.latestUserText,
  });
  const routeFromInsightsFlow = resolveRouteFromInsightsFlow(normalized.insightsFlow);
  if (
    routeFromInsightsFlow &&
    normalized.route === "general" &&
    routeFromInsightsFlow !== "general"
  ) {
    normalized.route = routeFromInsightsFlow;
    normalized.mode = resolveDefaultModeForRoute(routeFromInsightsFlow);
    normalized = applyRouteModeAndRequiresDefaults({
      decision: normalized,
      latestUserText: input.latestUserText,
    });
  }
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
    normalized = applyRouteModeAndRequiresDefaults({
      decision: normalized,
      latestUserText: input.latestUserText,
    });
    return normalized;
  }

  if (shortScopeRefinementContinuation && input.activeFlow?.route) {
    normalized.continueActiveFlow = true;
    normalized.route = input.activeFlow.route;
    normalized.mode = resolveDefaultModeForRoute(input.activeFlow.route);
    normalized.insightsFlow = resolveDefaultInsightsFlowForRoute(
      input.activeFlow.route,
    );
    normalized.activeFlowInfluence =
      normalized.activeFlowInfluence === "none"
        ? "medium"
        : normalized.activeFlowInfluence;
    normalized = applyRouteModeAndRequiresDefaults({
      decision: normalized,
      latestUserText: input.latestUserText,
    });
    const rerunDataRequestNormalization = normalizePlannerDataRequests({
      dataRequests: normalized.dataRequests,
      requires: normalized.requires,
      route: normalized.route,
      latestUserText: input.latestUserText,
      selectedPeriodKey: input.selectedPeriodKey,
      availableCategoryScopes: input.availableCategoryScopes,
    });
    normalized.dataRequests = rerunDataRequestNormalization.dataRequests;
    if (rerunDataRequestNormalization.shouldClarify) {
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
  activeFlow,
  issueFlowActive,
}: HelpAssistantAIRequest): Promise<HelpAssistantAIResponse> {
  const latestUserMessage = getLatestUserMessage(thread);
  const latestUserIntent = latestUserMessage
    ? classifyHelpAssistantIntent(latestUserMessage.text)
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
  const plannerFinancialContextRequestContext = buildContextForRequestedMonthScope({
    context,
    monthScope: initialRequestedTimeScope.monthScopeHint,
  });
  let plannerFinancialContext: UnifiedFinancialAdviceContext | null =
    unifiedFinancialContext || null;
  if (
    !plannerFinancialContext &&
    latestUserMessage &&
    !isIssueLikeIntent(latestUserIntent) &&
    !latestUserLooksLikeDiagnosticQuestion &&
    shouldPrimeFinancialCatalog(latestUserMessage.text)
  ) {
    plannerFinancialContext = await resolveUnifiedFinancialAdviceContext({
      context: plannerFinancialContextRequestContext,
      question: latestUserMessage.text,
      requestedAmount: preRequestedAmount,
    }).catch(() => null);
  }
  const plannerAvailableCategoryScopes = buildAvailableCategoryScopes(
    plannerFinancialContext,
  );
  const normalizedActiveFlow = normalizeActiveFlowDescriptor({
    activeFlow,
    issueFlowActive,
  });
  const fallbackDecision = buildSafePlannerFallback({
    latestUserText: latestUserMessage?.text || null,
    activeFlow: normalizedActiveFlow,
    intentHint: latestUserIntent,
    availableCategoryScopes: plannerAvailableCategoryScopes,
  });
  const plannerDecision = latestUserMessage
    ? await classifyHelpAssistantPlanWithOpenAI({
        context,
        thread,
        activeFlow: normalizedActiveFlow,
        availableCategoryScopes: plannerAvailableCategoryScopes,
      })
    : null;
  let normalizedPlannerDecision = normalizePlannerDecision({
    plannerDecision,
    fallbackDecision,
    activeFlow: normalizedActiveFlow,
    latestUserText: latestUserMessage?.text || null,
    intentHint: latestUserIntent,
    selectedPeriodKey: context.selectedPeriod?.key || null,
    availableCategoryScopes: plannerAvailableCategoryScopes,
  });
  const fallbackSpendingType = latestUserMessage
    ? classifySpendingQuestionType(latestUserMessage.text)
    : null;
  if (
    (normalizedPlannerDecision.route === "general" ||
      normalizedPlannerDecision.route === "screen_explanation") &&
    fallbackSpendingType &&
    !isIssueLikeIntent(latestUserIntent)
  ) {
    normalizedPlannerDecision = normalizePlannerDecision({
      plannerDecision: {
        route: "spending_advice",
        mode: fallbackSpendingType,
        insightsFlow: "spending_overview",
        confidence: normalizedPlannerDecision.confidence,
        needsClarification: false,
        continueActiveFlow: false,
        activeFlowInfluence: normalizedActiveFlow ? "low" : "none",
        requires: {
          monthBudget: true,
          cashflowSafety: true,
          expectedEndBalance: fallbackSpendingType === "spending_decision",
          categorySummary: shouldRequireCategorySummary(
            latestUserMessage?.text,
          ),
          transactionFacts: false,
          screenExplanation: false,
        },
        dataRequests: {
          ...buildFallbackDataRequests(
            latestUserMessage?.text || null,
            plannerAvailableCategoryScopes,
          ),
          transactionQuestionType: "none",
          merchantScope: "none",
        },
        useScreenContext: false,
      },
      fallbackDecision,
      activeFlow: normalizedActiveFlow,
      latestUserText: latestUserMessage?.text || null,
      intentHint: latestUserIntent,
      selectedPeriodKey: context.selectedPeriod?.key || null,
      availableCategoryScopes: plannerAvailableCategoryScopes,
    });
  }
  if (
    (normalizedPlannerDecision.route === "general" ||
      normalizedPlannerDecision.route === "screen_explanation") &&
    (fallbackDecision.route === "category_insight" ||
      fallbackDecision.route === "transactions_insight") &&
    !isIssueLikeIntent(latestUserIntent) &&
    !fallbackSpendingType
  ) {
    normalizedPlannerDecision = normalizePlannerDecision({
      plannerDecision: fallbackDecision,
      fallbackDecision,
      activeFlow: normalizedActiveFlow,
      latestUserText: latestUserMessage?.text || null,
      intentHint: latestUserIntent,
      selectedPeriodKey: context.selectedPeriod?.key || null,
      availableCategoryScopes: plannerAvailableCategoryScopes,
    });
  }
  const route = normalizedPlannerDecision.route;
  const mode = normalizedPlannerDecision.mode;
  const isIssueIntakeQuestion =
    route === "issue_intake" || mode === "issue_intake";
  const isSpendingAdviceQuestion =
    route === "spending_advice" ||
    mode === "space_summary" ||
    mode === "spending_decision";
  const spendingQuestionType = isSpendingAdviceQuestion
    ? mode === "space_summary"
      ? "space_summary"
      : "spending_decision"
    : null;
  const spendingPromptVariant = spendingQuestionType
    ? buildSpendingAdvicePromptVariant(spendingQuestionType)
    : null;

  const requestedAmount = isSpendingAdviceQuestion ? preRequestedAmount : null;
  const requiresFinancialContext =
    normalizedPlannerDecision.requires.monthBudget ||
    normalizedPlannerDecision.requires.cashflowSafety ||
    normalizedPlannerDecision.requires.expectedEndBalance ||
    normalizedPlannerDecision.requires.categorySummary ||
    normalizedPlannerDecision.requires.transactionFacts;
  const financialContextRequestContext = buildContextForRequestedMonthScope({
    context,
    monthScope: normalizedPlannerDecision.dataRequests.monthScope,
  });
  const resolvedMonthScopeForHydration: HelpAssistantPlannerMonthScope =
    normalizedPlannerDecision.dataRequests.monthScope === "previous"
      ? "previous"
      : "current";
  const resolvedFinancialContext =
    latestUserMessage &&
    !latestUserLooksLikeDiagnosticQuestion &&
    (isSpendingAdviceQuestion || requiresFinancialContext)
      ? (plannerFinancialContext &&
        resolveContextMonthKey(plannerFinancialContextRequestContext) ===
          resolveContextMonthKey(financialContextRequestContext)
          ? plannerFinancialContext
          :
        (await resolveUnifiedFinancialAdviceContext({
          context: financialContextRequestContext,
          question: latestUserMessage.text,
          requestedAmount,
        })))
      : null;
  const availableCategoryScopes = buildAvailableCategoryScopes(
    resolvedFinancialContext || plannerFinancialContext,
  );
  const renormalizedDataRequests = normalizePlannerDataRequests({
    dataRequests: normalizedPlannerDecision.dataRequests,
    requires: normalizedPlannerDecision.requires,
    route: normalizedPlannerDecision.route,
    latestUserText: latestUserMessage?.text || null,
    selectedPeriodKey: context.selectedPeriod?.key || null,
    availableCategoryScopes,
  });
  normalizedPlannerDecision = {
    ...normalizedPlannerDecision,
    dataRequests: renormalizedDataRequests.dataRequests,
    needsClarification:
      normalizedPlannerDecision.needsClarification ||
      renormalizedDataRequests.shouldClarify,
  };
  const hydrationPlan = buildHydrationPlan({
    planner: normalizedPlannerDecision,
    context,
    latestUserText: latestUserMessage?.text || null,
    rawDataRequests: plannerDecision?.dataRequests || null,
    availableCategoryScopes,
  });
  const hydratedDataBlocks = buildHydratedAssistantDataBlocks({
    hydrationPlan,
    unifiedFinancialContext: resolvedFinancialContext,
    resolvedMonthScope: resolvedMonthScopeForHydration,
    requestedPeriodKey: resolveContextMonthKey(financialContextRequestContext),
  });
  const hydratedDataPrompt = buildHydratedDataContextPrompt(hydratedDataBlocks);
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
    normalizedPlannerDecision.route === "spending_advice" &&
    (plannerDecision?.route === "general" ||
      plannerDecision?.route === "screen_explanation") &&
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
        latestUserText: latestUserMessage?.text || null,
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
    const mappedGeneralRoute: Exclude<
      HelpAssistantTurnRoute,
      "spending_advice" | "issue_intake"
    > =
      route === "spending_advice" || route === "issue_intake"
        ? "general"
        : route;
    const mappedGeneralMode: Exclude<
      HelpAssistantResponseMode,
      "spending_decision" | "space_summary" | "issue_intake"
    > =
      mode === "spending_decision" ||
      mode === "space_summary" ||
      mode === "issue_intake"
        ? "general_help"
        : mode;
    systemPrompts.push({
      label: "general_primary",
      content: SYSTEM_PROMPT,
    });
    systemPrompts.push({
      label: "general_channel_context",
      content: buildGeneralRouteContextPrompt({
        context,
        includeScreenContext,
        route: mappedGeneralRoute,
        mode: mappedGeneralMode,
        insightsFlow: normalizedPlannerDecision.insightsFlow,
        requires: normalizedPlannerDecision.requires,
        dataRequests: normalizedPlannerDecision.dataRequests,
        needsClarification: normalizedPlannerDecision.needsClarification,
      }),
    });
    if (hydratedDataPrompt) {
      systemPrompts.push({
        label: "general_hydrated_data",
        content: hydratedDataPrompt,
      });
    }
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
    normalizedPlannerDecision.requires.categorySummary ? "categorySummary" : null,
    normalizedPlannerDecision.requires.transactionFacts
      ? "transactionFacts"
      : null,
    normalizedPlannerDecision.requires.screenExplanation
      ? "screenExplanation"
      : null,
  ].filter(Boolean) as string[];
  const selectedHydrationBlocks = [
    hydrationPlan.financialSnapshot ? "financialSnapshot" : null,
    hydrationPlan.categorySummary ? "categorySummary" : null,
    hydrationPlan.transactionFacts ? "transactionFacts" : null,
  ].filter(Boolean) as string[];
  const compactContextBlockPresent = systemPrompts.some(
    (prompt) => prompt.label === "spending_context_compact",
  );
  const spendingPayloadPresent = systemPrompts.some((prompt) =>
    prompt.content.includes("SpendingAdvice truth-safe payload JSON:"),
  );

  logHelpAssistantDebug("planner_data_requests_raw", {
    dataRequests: plannerDecision?.dataRequests || null,
    insightsFlow: plannerDecision?.insightsFlow || null,
  });
  logHelpAssistantDebug("planner_data_requests_normalized", {
    dataRequests: normalizedPlannerDecision.dataRequests,
    insightsFlow: normalizedPlannerDecision.insightsFlow,
    requires: normalizedPlannerDecision.requires,
    needsClarification: normalizedPlannerDecision.needsClarification,
  });
  logHelpAssistantDebug("hydration_plan_selected_blocks", {
    selectedBlocks: selectedHydrationBlocks,
    resolvedScopes: {
      monthScope: hydrationPlan.monthScopeResolved,
      categoryScope: hydrationPlan.categoryScopeResolved,
      merchantScope: hydrationPlan.merchantScopeResolved,
      transactionQuestionType: hydrationPlan.questionTypeResolved,
    },
  });
  if (hydrationPlan.fallbacks.length || hydratedDataBlocks.limitations.length) {
    logHelpAssistantDebug("hydration_plan_fallbacks", {
      fallbackReasons: hydrationPlan.fallbacks,
      limitations: hydratedDataBlocks.limitations,
    });
  }
  logHelpAssistantDebug("planner_result", {
    raw: plannerDecision,
    fallback: fallbackDecision,
    normalized: normalizedPlannerDecision,
    activeFlow: normalizedActiveFlow,
    fallbackUsed: plannerFallbackUsed,
    fallbackReason: plannerFallbackReason,
    fallbackOverrideToSpending,
  });
  logHelpAssistantDebug("final_answer_setup", {
    route,
    mode,
    insightsFlow: normalizedPlannerDecision.insightsFlow,
    requires: normalizedPlannerDecision.requires,
    dataRequests: normalizedPlannerDecision.dataRequests,
    promptLabels: systemPrompts.map((prompt) => prompt.label),
    loadedContextBlocks,
    selectedHydrationBlocks,
    hydratedBlocksSent: hydratedDataBlocks.loadedBlocks,
    hydrationLimitations: hydratedDataBlocks.limitations,
    compactContextBlockPresent,
    spendingPayloadPresent,
    monthBudget: normalizedPlannerDecision.requires.monthBudget,
    expectedEndBalance: normalizedPlannerDecision.requires.expectedEndBalance,
    cashflowSafety: normalizedPlannerDecision.requires.cashflowSafety,
    continueActiveFlow: normalizedPlannerDecision.continueActiveFlow,
    activeFlowInfluence: normalizedPlannerDecision.activeFlowInfluence,
    plannerFallbackUsed,
    plannerFallbackReason,
    fallbackOverrideToSpending,
  });
  logHelpAssistantDebug("final_answer_context_blocks_sent", {
    promptLabels: systemPrompts.map((prompt) => prompt.label),
    loadedContextBlocks,
    hydratedBlocksSent: hydratedDataBlocks.loadedBlocks,
    insightsFlow: normalizedPlannerDecision.insightsFlow,
    dataRequests: normalizedPlannerDecision.dataRequests,
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
