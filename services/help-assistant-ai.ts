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
const SPENDING_ADVICE_SYSTEM_PROMPT = [
  "Je bent de Budio AI Buddy voor bestedingsruimte-vragen.",
  "Je taak is voorzichtig, compact en bruikbaar meedenken over uitgavenruimte.",
  "Budgetruimte, planning en forecast zijn leidend; los saldo is nooit leidend.",
  "Denk altijd in drie tijdslagen: nu, later deze maand en begin volgende maand.",
  "Gebruik alleen data die expliciet in de huidige context staat.",
  "Verzin nooit bedragen, datums, transacties, categorieën of risico's.",
  "Als data ontbreekt of beperkt is, benoem onzekerheid expliciet.",
  "Gebruik dan letterlijke veilige formulering: 'op basis van wat ik nu zie'.",
  "Geef geen absolute zekerheid en geen professioneel financieel advies.",
  "Vertaal technische signalen naar gewone taal; toon geen ruwe interne veldnamen.",
  "Je antwoord blijft altijd compact, menselijk en in het Nederlands.",
  "Geef in JSON ook een meta-blok terug met route='spending_advice', type='spending_advice' en context met screenId, screenTitle, routeName, platform en periodLabel.",
  "De bestaande velden conclusion, why, risk en nextStep blijven gewoon op root-niveau aanwezig.",
  "Output is exact JSON met verplichte velden: conclusion, why, risk, nextStep.",
  "Optioneel: confidence (low|medium|high) en dataGaps (korte labels).",
  'Geef uitsluitend JSON terug in dit formaat: {"conclusion":"...","why":"...","risk":"...","nextStep":"...","confidence":"low|medium|high","dataGaps":["..."]}',
].join(" ");

const SPENDING_SPACE_QUESTION_PROMPT = [
  "Vraagtype: ruimtevraag (bijv. 'hoeveel ruimte heb ik nog?').",
  "Start met een directe samenvatting van de beschikbare ruimte binnen budget en forecast voor de gekozen periode.",
  "Gebruik geen normatief oordeel als hoofdboodschap, tenzij data duidelijk onvoldoende is.",
  "why: noem kort de belangrijkste contextsignalen die de samenvatting dragen.",
  "risk: benoem kort het risico voor later deze maand en begin volgende maand.",
  "nextStep: geef optioneel een kleine vervolgstap die direct helpt.",
  "Als ruimte niet betrouwbaar te bepalen is, kies in conclusion: 'onvoldoende data'.",
].join(" ");

const SPENDING_DECISION_QUESTION_PROMPT = [
  "Vraagtype: uitgavebeslissing (bijv. 'kan ik nog 40 euro uit eten?').",
  "Geef in conclusion expliciet één richting: veilig, haalbaar maar krap, technisch mogelijk maar onverstandig, of onvoldoende data.",
  "why: onderbouw kort met budgetruimte + planning + forecastsignalen.",
  "risk: benoem wat later deze maand of begin volgende maand kan knellen.",
  "nextStep: geef een concrete kleine vervolgstap, zoals bedrag verlagen, wachten of eerst data controleren.",
].join(" ");

const HELP_ASSISTANT_TURN_ROUTER_PROMPT = [
  "Je bent de router van de Budio Assistent.",
  "Bepaal voor de laatste gebruikerszin en de context exact één route: issue_intake, spending_advice of general.",
  "Gebruik issue_intake als de gebruiker vooral een idee, feedback, probleem of bug meldt, ook als er woorden als budget, grafiek of dashboard in staan.",
  "Gebruik spending_advice alleen als de gebruiker echt vraagt naar bestedingsruimte, hoeveel er nog kan, of een uitgavebeslissing wil maken.",
  "Gebruik general voor schermuitleg of andere hulp die geen idee, issue of budgetvraag is.",
  "Je mag niet op basis van vaste woordregels beslissen; redeneer op intent en context.",
  "Geef uitsluitend JSON terug met deze structuur:",
  "{",
  '  "route": "issue_intake|spending_advice|general",',
  '  "confidence": "low|medium|high",',
  '  "type": "idea|issue|feedback|bug|spending_advice|general",',
  '  "subtype": "idea|issue|feedback|bug|general",',
  '  "needsClarification": true,',
  '  "meta": { "type": "idea|issue|feedback|bug|spending_advice|general", "subtype": "idea|issue|feedback|bug|general", "confidence": "low|medium|high", "context": { "screenId": "...", "screenTitle": "...", "routeName": "...", "platform": "...", "periodLabel": "..." } }',
  "}",
  "Zorg dat de meta-context altijd de huidige schermcontext bevat.",
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
  spendingAdvice: SPENDING_ADVICE_SYSTEM_PROMPT,
  spendingSpaceQuestion: SPENDING_SPACE_QUESTION_PROMPT,
  spendingDecisionQuestion: SPENDING_DECISION_QUESTION_PROMPT,
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

type HelpAssistantTurnRoutingResponse = {
  route: HelpAssistantTurnRoute;
  confidence: "low" | "medium" | "high";
  type: "idea" | "issue" | "feedback" | "bug" | "spending_advice" | "general";
  subtype: "idea" | "issue" | "feedback" | "bug" | "general";
  needsClarification: boolean;
  meta: {
    type: "idea" | "issue" | "feedback" | "bug" | "spending_advice" | "general";
    subtype: "idea" | "issue" | "feedback" | "bug" | "general";
    confidence: "low" | "medium" | "high";
    context: HelpAssistantStructuredResponseContext;
  };
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

function buildUnifiedFinancialContextPrompt(
  context: UnifiedFinancialAdviceContext,
) {
  const currentMonthRiskLabel = toRiskSignalLabel({
    riskFlag: context.forecastCurrentMonth.riskFlag,
    cashRiskFlag: context.forecastCurrentMonth.cashRiskFlag,
  });
  const nextMonthRiskLabel = toRiskSignalLabel({
    riskFlag: context.forecastNextMonth.riskFlag,
    cashRiskFlag: context.forecastNextMonth.cashRiskFlag,
  });
  const readableDataGaps = context.quality.dataGaps
    .map((gap) => toReadableDataGapLabel(gap))
    .filter(Boolean);

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
      ? `Huidige maand risicosignaal: ${currentMonthRiskLabel}`
      : "Huidige maand forecast status: beperkt",
    context.forecastNextMonth.hasData
      ? `Begin volgende maand (${context.forecastNextMonth.monthLabel}) verwacht eindsaldo: ${eur.format(
          context.forecastNextMonth.expectedEndBalance || 0,
        )}`
      : "",
    context.forecastNextMonth.hasData
      ? `Begin volgende maand risicosignaal: ${nextMonthRiskLabel}`
      : "Volgende maand forecast: ontbreekt of beperkt",
    `Context confidence: ${context.quality.confidence}`,
    readableDataGaps.length
      ? `Datakwaliteit: ${readableDataGaps.join(", ")}`
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

function looksLikeProblemOrBugQuestion(input: string) {
  const text = normalizeText(input);
  return (
    text.includes("waarom klopt") ||
    text.includes("klopt dit niet") ||
    text.includes("ik zie een fout") ||
    text.includes("dit werkt niet") ||
    text.includes("bug") ||
    text.includes("error")
  );
}

type SpendingQuestionType = "space_summary" | "spending_decision";

function classifySpendingQuestionType(input: string): SpendingQuestionType | null {
  const text = normalizeText(input);
  if (looksLikeProblemOrBugQuestion(text)) return null;
  if (!looksLikeBudgetSpaceQuestion(text)) return null;

  const isSpaceSummaryQuestion =
    text.includes("hoeveel ruimte") ||
    text.includes("ruimte heb ik nog") ||
    text.includes("ruimte over") ||
    text.includes("hoeveel kan ik nog");

  if (isSpaceSummaryQuestion) return "space_summary";
  return "spending_decision";
}

export function isFinancialAdviceQuestion(input: string) {
  return classifySpendingQuestionType(input) !== null;
}

function buildTurnRouterPrompt(context: HelpAssistantContext, issueFlowActive: boolean) {
  return [
    HELP_ASSISTANT_TURN_ROUTER_PROMPT,
    "",
    `Actieve meldkaart: ${issueFlowActive ? "ja" : "nee"}.`,
    "",
    `Context:\n${buildContextPrompt(context)}`,
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

function parseHelpAssistantTurnRoutingResponse(
  content: string,
): HelpAssistantTurnRoutingResponse | null {
  const parsed = parseJsonObject(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const route = String(parsed.route || "").trim();
  const confidence = String(parsed.confidence || "").trim();
  const type = String(parsed.type || "").trim();
  const subtype = String(parsed.subtype || "").trim();
  const needsClarification = Boolean(parsed.needsClarification);
  const meta = parsed.meta;

  if (!["issue_intake", "spending_advice", "general"].includes(route)) return null;
  if (!["low", "medium", "high"].includes(confidence)) return null;
  if (
    ![
      "idea",
      "issue",
      "feedback",
      "bug",
      "spending_advice",
      "general",
    ].includes(type)
  ) {
    return null;
  }
  if (!["idea", "issue", "feedback", "bug", "general"].includes(subtype)) {
    return null;
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;

  const typedMeta = meta as Record<string, unknown>;
  const metaType = String(typedMeta.type || "").trim();
  const metaSubtype = String(typedMeta.subtype || "").trim();
  const metaConfidence = String(typedMeta.confidence || "").trim();
  const metaContext = typedMeta.context;

  if (![
    "idea",
    "issue",
    "feedback",
    "bug",
    "spending_advice",
    "general",
  ].includes(metaType)) {
    return null;
  }
  if (!["idea", "issue", "feedback", "bug", "general"].includes(metaSubtype)) {
    return null;
  }
  if (!["low", "medium", "high"].includes(metaConfidence)) return null;
  if (
    !metaContext ||
    typeof metaContext !== "object" ||
    Array.isArray(metaContext)
  ) {
    return null;
  }

  const typedContext = metaContext as Record<string, unknown>;
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
    route: route as HelpAssistantTurnRoute,
    confidence: confidence as "low" | "medium" | "high",
    type: type as HelpAssistantTurnRoutingResponse["type"],
    subtype: subtype as HelpAssistantTurnRoutingResponse["subtype"],
    needsClarification,
    meta: {
      type: metaType as HelpAssistantTurnRoutingResponse["meta"]["type"],
      subtype: metaSubtype as HelpAssistantTurnRoutingResponse["meta"]["subtype"],
      confidence: metaConfidence as "low" | "medium" | "high",
      context: {
        screenId,
        screenTitle,
        routeName,
        platform,
        periodLabel,
      },
    },
  };
}

async function classifyHelpAssistantTurnWithOpenAI(input: {
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
          content: buildTurnRouterPrompt(input.context, input.issueFlowActive),
        },
        ...pickThreadMessagesForModel(input.thread).map((message) => ({
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
  return parseHelpAssistantTurnRoutingResponse(content);
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

function selectSpendingPromptVariant(type: SpendingQuestionType) {
  if (type === "space_summary") {
    return PROMPT_LIBRARY.spendingSpaceQuestion;
  }
  return PROMPT_LIBRARY.spendingDecisionQuestion;
}

function toRiskSignalLabel(input: {
  riskFlag: "none" | "deficit_warning";
  cashRiskFlag: "none" | "cash_gap_warning";
}) {
  if (
    input.riskFlag === "deficit_warning" &&
    input.cashRiskFlag === "cash_gap_warning"
  ) {
    return "tekortsignaal en kans op tijdelijk kastekort";
  }
  if (input.riskFlag === "deficit_warning") {
    return "tekortsignaal voor deze periode";
  }
  if (input.cashRiskFlag === "cash_gap_warning") {
    return "kans op tijdelijk kastekort";
  }
  return "geen direct risicosignaal";
}

function toReadableDataGapLabel(label: string) {
  const mapping: Record<string, string> = {
    periode_niet_specifiek: "periode was niet expliciet gekozen",
    budgetruimte_onvolledig: "budgetruimte is deels onvolledig",
    planning_signalen_beperkt: "planning-signalen zijn beperkt",
    forecast_signalen_beperkt: "forecast-signalen zijn beperkt",
    volgende_maand_forecast_ontbreekt:
      "begin volgende maand heeft nog beperkte forecastdata",
  };
  return mapping[label] || "";
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
  const routeDecision = !isIssueFlowActive && latestUserMessage
    ? await classifyHelpAssistantTurnWithOpenAI({
        context,
        thread,
        issueFlowActive: isIssueFlowActive,
      })
    : null;
  const route: HelpAssistantTurnRoute =
    isIssueFlowActive
      ? "issue_intake"
      : routeDecision?.route || "general";
  const isIssueIntakeQuestion = route === "issue_intake";
  const isSpendingAdviceQuestion = route === "spending_advice";
  const spendingQuestionType =
    latestUserMessage && isSpendingAdviceQuestion
      ? classifySpendingQuestionType(latestUserMessage.text) || "spending_decision"
      : null;
  const spendingPromptVariant = spendingQuestionType
    ? selectSpendingPromptVariant(spendingQuestionType)
    : null;

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
  const repeatedQuestion = hasRepeatedUserQuestion(thread);
  const signalHints = latestUserMessage
    ? {
        confidence:
          latestUserMessage.metadata.classification?.confidence ||
          latestUserIntent?.confidence,
        route: routeDecision?.route || route,
        repeatedQuestion,
        issueFlowIncomplete: Boolean(
          latestUserMessage.metadata.issueDraftCandidate &&
            thread.pendingIssueDraftIds.includes(latestUserMessage.id),
        ),
      }
    : { repeatedQuestion };

  const openAIMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(isSpendingAdviceQuestion
      ? [
          { role: "system", content: SPENDING_ADVICE_SYSTEM_PROMPT },
          ...(spendingPromptVariant
            ? [{ role: "system", content: spendingPromptVariant }]
            : []),
        ]
      : []),
    ...(isIssueIntakeQuestion
      ? [
          { role: "system", content: PROMPT_LIBRARY.issueIntake },
          {
            role: "system",
            content: buildIssueIntakePrompt(context),
          },
        ]
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
              isSpendingAdviceQuestion || isIssueIntakeQuestion
                ? "json_object"
                : "text",
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
