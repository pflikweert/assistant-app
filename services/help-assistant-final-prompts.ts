import {
  buildHelpAssistantScreenContextLines,
  type HelpAssistantContext,
} from "./help-assistant-context";
import type { UnifiedFinancialAdviceContext } from "./help-assistant-financial-context";
import {
  SPENDING_ADVICE_SYSTEM_PROMPT,
  buildSpendingAdviceContextPrompt,
  buildSpendingAdvicePromptVariant,
} from "./help-assistant-spending-advice";
import type { SpendingAdviceProxyFallback } from "./openai-proxy";
import {
  cleanInlineText,
  parseJsonObject,
  type ChatCompletionResponse,
  type HelpAssistantHydrationResult,
  type HelpAssistantIssueDraftResponse,
  type HelpAssistantPlannerRequires,
  type HelpAssistantResponseMode,
  type HelpAssistantStructuredResponseContext,
  type HelpAssistantStructuredResponseType,
  type SpendingAdviceResponseSchema,
  type SpendingAdviceSections,
} from "./help-assistant-orchestration-shared";
import type { NormalizedRoutingDecision } from "./help-assistant-route-normalization";
import { looksLikeWeekScopedQuestion } from "./help-assistant-route-normalization";

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
].join(" ");

const TRANSACTIONS_INSIGHT_SYSTEM_PROMPT = [
  "Je bent de Budio Assistent voor transactie- en lookupvragen.",
  "Antwoord feitelijk, compact en lookup-gericht.",
  "Gebruik geen adviestoon tenzij de gebruiker daar expliciet om vraagt.",
  "Gebruik alleen feiten uit de meegegeven truth-safe payload.",
  "Bij match-onzekerheid of blocked answerability: geef geen bedrag of harde conclusie, maar benoem de beperking expliciet.",
  "Bij partial answerability: geef alleen de beperkte waarheid die expliciet in de payload staat.",
].join(" ");

const CATEGORY_INSIGHT_SYSTEM_PROMPT = [
  "Je bent de Budio Assistent voor categorie-inzichten.",
  "Antwoord samenvattend, duidelijk en bedraggericht als een scoped totaal expliciet beschikbaar is.",
  "Claim nooit een categoriebudget of budgetoverschrijding tenzij dat expliciet in de payload staat.",
  "Bij blocked answerability of period mismatch: geef geen bedrag of harde conclusie, maar benoem de beperking expliciet.",
  "Bij partial answerability: geef alleen de beperkte waarheid uit de payload en noem die ook beperkt.",
].join(" ");

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

function buildGeneralRouteContextPrompt(input: {
  context: HelpAssistantContext;
  includeScreenContext: boolean;
  routingDecision: NormalizedRoutingDecision;
}) {
  const period = input.context.selectedPeriod?.label || "niet geselecteerd";
  const lines = [
    "Kanaal: general_help",
    `Planner-route: ${input.routingDecision.route}`,
    `Planner-mode: ${input.routingDecision.mode}`,
    `Insights-flow: ${input.routingDecision.insightsFlow}`,
    `DataRequest: monthScope=${input.routingDecision.dataRequests.monthScope}, categoryScope=${input.routingDecision.dataRequests.categoryScope}, merchantScope=${input.routingDecision.dataRequests.merchantScope}, transactionQuestionType=${input.routingDecision.dataRequests.transactionQuestionType}`,
    `Platform: ${input.context.platform}`,
    `Periode: ${period}`,
  ];
  if (input.routingDecision.needsClarification) {
    lines.push(
      "Planner vraagt verduidelijking: stel 1 korte, concrete vraag voordat je aannames maakt.",
    );
  }
  if (input.includeScreenContext) {
    lines.push("", `Context:\n${buildContextPrompt(input.context)}`);
  }
  return lines.join("\n");
}

function buildInsightRouteContextPrompt(input: {
  route: "transactions_insight" | "category_insight";
  routingDecision: NormalizedRoutingDecision;
  hydration: HelpAssistantHydrationResult;
  context: HelpAssistantContext;
}) {
  const lines = [
    `Kanaal: ${input.route}`,
    `Planner-route: ${input.route}`,
    `Planner-mode: ${input.routingDecision.mode}`,
    `Insights-flow: ${input.routingDecision.insightsFlow}`,
    `Answerability: ${input.hydration.answerability}`,
    `PeriodMatch: ${input.hydration.periodMatch}`,
    `DataRequest: monthScope=${input.routingDecision.dataRequests.monthScope}, categoryScope=${input.routingDecision.dataRequests.categoryScope}, merchantScope=${input.routingDecision.dataRequests.merchantScope}, transactionQuestionType=${input.routingDecision.dataRequests.transactionQuestionType}`,
    `Periode: ${input.context.selectedPeriod?.label || "niet geselecteerd"}`,
  ];
  if (input.routingDecision.needsClarification) {
    lines.push(
      "Planner vraagt verduidelijking: stel maximaal 1 korte verduidelijkingsvraag.",
    );
  }
  if (input.route === "transactions_insight") {
    lines.push(
      "Routehint: geef alleen transactiefeiten als ze expliciet in de context staan. Als feiten ontbreken, zeg dat expliciet en stel maximaal 1 verduidelijkingsvraag.",
    );
    lines.push(
      "Gedrag: geef lookup-feiten kort en zakelijk; geen budgetadvies of forecastuitleg tenzij de gebruiker dat expliciet vraagt.",
    );
  }
  if (input.route === "category_insight") {
    lines.push(
      "Gedrag: noem een scoped categoriebedrag alleen als dat expliciet als totaal in de payload staat.",
    );
    lines.push(
      "Als `subcategoryBreakdown` beschikbaar is en de gebruiker vraagt naar onderverdeling, subcategorieën of posten binnen een categorie, noem die onderverdeling expliciet.",
    );
    lines.push(
      "Als `subcategoryBreakdownSummary` of vergelijking-/gemiddelde-velden beschikbaar zijn, gebruik die direct en zeg niet dat die informatie ontbreekt.",
    );
    if (
      input.routingDecision.dataRequests.transactionQuestionType === "category_total"
    ) {
      lines.push(
        "Als `scopedCategoryTotal` beschikbaar is, noem dit bedrag expliciet en koppel het aan de genoemde categorie.",
      );
      lines.push(
        "Gebruik `scopedCategoryTotal` als canoniek totaal voor de gevraagde categorie; vervang dit niet door een bedrag van een subcategorie.",
      );
      lines.push(
        "Als `scopedCategoryGranularity` gelijk is aan `category`, gebruik dan nooit een bedrag uit `subcategoryBreakdown` als hoofdantwoord op de totaalvraag.",
      );
      lines.push(
        "Bij een totaalvraag over een categorie moet het eerste genoemde bedrag altijd `scopedCategoryTotal` zijn. Eventuele subcategoriebedragen komen pas daarna als toelichting.",
      );
    }
  }
  return lines.join("\n");
}

function buildHydratedDataContextPrompt(
  hydration: HelpAssistantHydrationResult,
): string | null {
  const parts = [
    hydration.financialSnapshotBlock,
    hydration.categorySummaryBlock,
    hydration.transactionFactsBlock,
  ].filter(Boolean) as string[];
  parts.push(
    [
      "Hydration-status:",
      `- answerability: ${hydration.answerability}`,
      `- periodMatch: ${hydration.periodMatch}`,
    ].join("\n"),
  );
  if (hydration.limitations.length) {
    parts.push(
      [
        "Hydration-beperkingen:",
        ...hydration.limitations.map((item) => `- ${item}`),
        "Regel: verzin geen ontbrekende transacties, merchants, categorieën of bedragen.",
      ].join("\n"),
    );
  }
  return parts.filter(Boolean).join("\n\n");
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

export function buildSafeSpendingFallback(input: {
  unifiedFinancialContext: UnifiedFinancialAdviceContext;
}): SpendingAdviceResponseSchema {
  const periodLabel = input.unifiedFinancialContext.period.label || "deze maand";

  return {
    conclusion: `Ik kan je bestedingsruimte voor ${periodLabel} nu niet betrouwbaar bevestigen.`,
    why: "De AI-proxy kon deze vraag nu niet stabiel genoeg verwerken met je huidige budget- en forecastcontext.",
    risk: "Op basis van wat ik nu zie wil ik geen schijnzekerheid geven over uitgavenruimte.",
    nextStep:
      "Probeer je vraag opnieuw met bedrag en categorie. Ik beoordeel het dan op je maandruimte en extra ruimte tot je volgende inkomsten.",
    confidence: "laag",
    dataGaps: input.unifiedFinancialContext.quality.dataGaps,
  };
}

function formatSpendingAdvicePattern(sections: SpendingAdviceSections) {
  return [
    `1. Conclusie: ${sections.conclusion}`,
    `2. Waarom: ${sections.why}`,
    `3. Risico of nuance: ${sections.risk}`,
    `4. Slimmer alternatief of vervolgstap: ${sections.nextStep}`,
  ].join("\n");
}

export function formatSpendingAdvicePatternFromSchema(
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

export function parseIssueIntakeResponse(
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
  const parsedContext: HelpAssistantStructuredResponseContext = {
    screenId: String(typedContext.screenId || "").trim(),
    screenTitle: String(typedContext.screenTitle || "").trim(),
    routeName: String(typedContext.routeName || "").trim(),
    platform: String(typedContext.platform || "").trim(),
    periodLabel:
      typeof typedContext.periodLabel === "string"
        ? typedContext.periodLabel.trim() || null
        : typedContext.periodLabel == null
          ? null
          : String(typedContext.periodLabel || "").trim() || null,
  };

  if (
    !parsedContext.screenId ||
    !parsedContext.screenTitle ||
    !parsedContext.routeName ||
    !parsedContext.platform
  ) {
    return null;
  }

  return {
    meta: {
      route: "issue_intake",
      type: type as HelpAssistantStructuredResponseType,
      subtype: subtype as "general" | "idea" | "issue" | "feedback" | "bug",
      confidence: confidence as "low" | "medium" | "high",
      state: state as "collecting" | "ready_to_review",
      needsClarification,
      context: parsedContext,
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

export function parseFinalAnswerText(input: {
  payload: ChatCompletionResponse;
  route: NormalizedRoutingDecision["route"];
  fallback?: SpendingAdviceResponseSchema;
  unifiedFinancialContext?: UnifiedFinancialAdviceContext | null;
}): string {
  const content = String(input.payload.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    if (input.route === "spending_advice" && input.fallback) {
      return formatSpendingAdvicePatternFromSchema(input.fallback);
    }
    return "Ik kon nog geen antwoord ophalen. Probeer je vraag opnieuw.";
  }

  if (input.route === "spending_advice") {
    const parsed = parseSpendingAdviceSchema(content);
    if (parsed) {
      const merged = mergeSpendingSchemaWithContext({
        parsed,
        unifiedFinancialContext: input.unifiedFinancialContext || null,
      });
      return formatSpendingAdvicePatternFromSchema(merged);
    }
    if (input.fallback) {
      return formatSpendingAdvicePatternFromSchema(input.fallback);
    }
  }

  return content;
}

export function toProxyFallback(
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

export function buildFinalPromptSetup(input: {
  context: HelpAssistantContext;
  routingDecision: NormalizedRoutingDecision;
  hydration: HelpAssistantHydrationResult;
  unifiedFinancialContext: UnifiedFinancialAdviceContext | null;
  requestedAmount: number | null;
  latestUserText: string | null;
}) {
  const systemPrompts: { label: string; content: string }[] = [];
  const route = input.routingDecision.route;
  const mode = input.routingDecision.mode;

  if (route === "spending_advice") {
    const spendingMode: "space_summary" | "spending_decision" =
      mode === "space_summary" ? "space_summary" : "spending_decision";
    systemPrompts.push({
      label: "spending_primary",
      content: SPENDING_ADVICE_SYSTEM_PROMPT,
    });
    systemPrompts.push({
      label: `spending_variant_${spendingMode}`,
      content: buildSpendingAdvicePromptVariant(spendingMode),
    });
    systemPrompts.push({
      label: "spending_context_compact",
      content: buildCompactSpendingContextBlock({
        context: input.context,
        mode: spendingMode,
        unifiedFinancialContext: input.unifiedFinancialContext,
        requestedAmount: input.requestedAmount,
        latestUserText: input.latestUserText,
        requiredBlocks: input.routingDecision.requires,
      }),
    });
    return {
      systemPrompts,
      useCase: "help_spending_advice" as const,
      responseMode: "json_object" as const,
    };
  }

  if (route === "issue_intake") {
    systemPrompts.push({
      label: "issue_primary",
      content: ISSUE_INTAKE_SYSTEM_PROMPT,
    });
    systemPrompts.push({
      label: "issue_context",
      content: buildIssueIntakePrompt(input.context),
    });
    return {
      systemPrompts,
      useCase: "help_general" as const,
      responseMode: "json_object" as const,
    };
  }

  if (route === "transactions_insight") {
    systemPrompts.push({
      label: "transactions_primary",
      content: TRANSACTIONS_INSIGHT_SYSTEM_PROMPT,
    });
    systemPrompts.push({
      label: "transactions_context",
      content: buildInsightRouteContextPrompt({
        route,
        routingDecision: input.routingDecision,
        hydration: input.hydration,
        context: input.context,
      }),
    });
    systemPrompts.push({
      label: "transactions_hydrated_data",
      content: buildHydratedDataContextPrompt(input.hydration),
    });
    return {
      systemPrompts,
      useCase: "help_transactions_insight" as const,
      responseMode: "text" as const,
    };
  }

  if (route === "category_insight") {
    systemPrompts.push({
      label: "category_primary",
      content: CATEGORY_INSIGHT_SYSTEM_PROMPT,
    });
    systemPrompts.push({
      label: "category_context",
      content: buildInsightRouteContextPrompt({
        route,
        routingDecision: input.routingDecision,
        hydration: input.hydration,
        context: input.context,
      }),
    });
    systemPrompts.push({
      label: "category_hydrated_data",
      content: buildHydratedDataContextPrompt(input.hydration),
    });
    return {
      systemPrompts,
      useCase: "help_category_insight" as const,
      responseMode: "text" as const,
    };
  }

  const includeScreenContext =
    input.routingDecision.useScreenContext ||
    input.routingDecision.requires.screenExplanation;
  systemPrompts.push({
    label: "general_primary",
    content: HELP_ASSISTANT_SYSTEM_PROMPT,
  });
  systemPrompts.push({
    label: "general_channel_context",
    content: buildGeneralRouteContextPrompt({
      context: input.context,
      includeScreenContext,
      routingDecision: input.routingDecision,
    }),
  });
  if (
    input.hydration.financialSnapshotBlock ||
    input.hydration.categorySummaryBlock ||
    input.hydration.transactionFactsBlock
  ) {
    systemPrompts.push({
      label: "general_hydrated_data",
      content: buildHydratedDataContextPrompt(input.hydration),
    });
  }
  return {
    systemPrompts,
    useCase: "help_general" as const,
    responseMode: "text" as const,
  };
}
