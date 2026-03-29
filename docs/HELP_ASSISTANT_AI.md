# Help Assistant AI Koppeling

## Bestaande infrastructuur

- Client proxy helper: `services/openai-proxy.ts`
- Centrale orchestration: `services/help-assistant-ai.ts`
- Planner: `services/help-assistant-planner.ts`
- Hydration: `services/help-assistant-hydration.ts`
- Financiële context: `services/help-assistant-financial-context.ts`

De hulpassistent gebruikt de bestaande auth-flow met Supabase access token. Er worden geen client-side secrets toegevoegd.

## Productrol Binnen De Nieuwe Visie

In de nieuwe Budio-koers is de assistent niet primair een losse chatfeature. Productmatig is dit de `Money Copilot`-laag bovenop de cockpit:

- context-first, niet chat-first
- uitleggend en besluitondersteunend
- ingebed op het juiste moment, niet leidend als apart productoppervlak

De assistent moet vooral helpen bij:

- begrijpen waarom een maand krap of rustig voelt
- toelichten wat veilig kan
- de beste volgende actie scherper maken

## Kernarchitectuur

Per user-turn gebeurt meestal:

1. laatste user-turn en lokale signalen bepalen
2. optioneel vroege financiële context laden voor category catalog
3. planner-call naar OpenAI
4. plannerresultaat normaliseren en zo nodig vervangen door veilige fallbackplanner
5. conditionele, truth-safe hydration uitvoeren
6. final answer-call doen voor de gekozen route

Er zijn dus meestal twee modelcalls:

1. planner-call
2. final answer-call

## Request/response model

Request bevat:

- `context` (`HelpAssistantContext`)
- `thread` (`HelpAssistantThreadState`)
- optioneel `unifiedFinancialContext`
- optioneel `activeFlow`
- backward-compat `issueFlowActive`

Belangrijkste responsevelden:

- `answerText`
- `model`
- `responseId`
- optioneel `unifiedFinancialContext`
- optioneel `issueIntake`
- optioneel nieuw `activeFlow`

## Plannercontract

Planner werkt turn-first en beoordeelt elke user-turn opnieuw.

Routes:

- `issue_intake`
- `spending_advice`
- `general`
- `transactions_insight`
- `category_insight`
- `screen_explanation`

Modes:

- `issue_intake`
- `spending_decision`
- `space_summary`
- `general_help`
- `transaction_lookup`
- `category_summary`
- `screen_help`

Verplichte plannercontext:

- `insightsFlow`
- `confidence`
- `needsClarification`
- `continueActiveFlow`
- `activeFlowInfluence`
- `requires`
- `dataRequests`
- `useScreenContext`

`dataRequests` classificeert alleen databehoefte:

- `monthScope`
- `categoryScope`
- `merchantScope`
- `transactionQuestionType`

De planner haalt nooit zelf data op.

## Hydrationlaag

De app beslist welke veilige blokken echt worden geladen.

Mogelijke blokken:

- financiële maandcontext
- cashflowveiligheid
- expected end balance
- category summary
- transaction facts
- screen explanation context

Belangrijke guardrails:

- ongeldige of onduidelijke `dataRequests` krijgen veilige fallback
- `previous month` probeert echte vorige maandcontext te laden
- category-scopes worden als catalogus meegegeven om scopegokken te verminderen
- geen ruwe transactierijen of privacygevoelige identifiers naar OpenAI

## Factual-answer guardrails

Voor lookupvragen corrigeert de app vrije modeltekst waar nodig met gehydrateerde waarheid:

- `category_insight` bij `category_total`
- `transactions_insight` bij `merchant_total`
- `transactions_insight` bij `merchant_frequency`

Zo blijft het eindantwoord feitelijk als de app al exactere data heeft.

## Issue-intake

Voor issue- of ideeturns verwacht de assistent JSON met onder meer:

- `meta.route = "issue_intake"`
- `answerText`
- `summary`
- `featureArea`
- `userNeed`
- `proposedChange`
- `followUpQuestion`
- `isReadyForSubmission`

Gedrag:

- de chat toont alleen de korte verdiepende vraag
- de samenvatting blijft in de vaste reviewkaart boven de chat
- `Annuleren` sluit de kaart direct
- pas na expliciete klik op `Versturen` loopt de server-side GitHub-flow

## Spending advice

Voor bestedingsvragen verwacht de assistent JSON met:

- `conclusion`
- `why`
- `risk`
- `nextStep`

Optioneel:

- `confidence`
- `dataGaps`
- `meta.route = "spending_advice"`

De UI blijft altijd het vaste 4-stappenpatroon renderen.

In de nieuwe productvisie hoort dit patroon vooral contextueel in de cockpit en relevante flows te landen, niet alleen als generieke chatuitwisseling.

## Use cases, modellen en beheer

Relevante AI-use-cases in de code:

- `help_general`
- `help_spending_advice`
- `help_transactions_insight`
- `help_category_insight`
- `budget_coach`
- `transaction_categorization`
- `import_pdf_mapping`

De adminlaag ondersteunt:

- modelcatalogus
- route-instellingen per use case
- usage- en kostenoverzicht
- review inbox voor lage confidence, fallback en niet-geholpen turns

## Privacy-aanpak

- Alleen veilige context gaat mee: scherm, periode en geaggregeerde signalen.
- Geen client-side GitHub writes.
- Geen ruwe transactiedumps naar OpenAI.
- Transaction/category hydration blijft truth-safe en geaggregeerd.
- Issue-submit voegt de geauthenticeerde melder server-side toe aan de issue-body.

## UI-koppeling

- `components/help-assistant/help-assistant-sheet.tsx`
  - maakt lokale user- en pending assistant-berichten
  - roept `requestHelpAssistantReply(...)` aan
  - vervangt pending assistant met AI-antwoord of foutstatus
  - houdt de reviewkaart vast boven de chat bij issue-intake

## Geleerde lessen

- Een router op vaste keywords zoals `budget` of `grafiek` is te fragiel.
- OpenAI bepaalt eerst de intent; de app past die daarna veilig toe.
- De reviewkaart werkt beter als vaste samenvatting dan als verborgen ticketsysteem.
- De chatregel moet de vraag of vervolgstap tonen, niet tegelijk de interne samenvatting.
