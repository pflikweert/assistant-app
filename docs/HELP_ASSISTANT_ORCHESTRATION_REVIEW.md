# Help Assistant Orchestration Review

Doel van dit document: een AI-specialist moet zonder extra reverse-engineering kunnen reviewen hoe de Budio Help Assistant nu exact werkt van user turn tot final answer, inclusief prompts, fallbacklogica, hydration en bekende breekpunten.

Dit document beschrijft de huidige implementatie in:

- `services/help-assistant-ai.ts`
- `services/help-assistant-spending-advice.ts`
- `services/openai-proxy.ts`

## 1. Entry Point

De volledige flow start in:

- `requestHelpAssistantReply(...)` in `services/help-assistant-ai.ts`

Input:

- `context`: scherm, route, platform, geselecteerde periode, screenContext
- `thread`: chatgeschiedenis
- `unifiedFinancialContext?`: optionele al-gehydrateerde financiële context
- `activeFlow?`: generieke actieve flow descriptor
- `issueFlowActive?`: legacy backward-compat

## 2. Hoofdarchitectuur in 1 lijn

Per user turn gebeurt dit:

1. laatste user message bepalen
2. lokale intent- en amount-heuristiek bepalen
3. optioneel vroege financiële context laden voor planner-catalogus
4. generieke planner-call naar OpenAI
5. plannerresultaat parsen + normaliseren + fallback/guardrails
6. conditionele truth-safe hydration
7. final call op basis van gekozen route
8. antwoord parsen en teruggeven

Er zijn dus meestal 2 modelcalls:

1. planner-call
2. final answer-call

Voor `spending_advice` loopt de final call via een proxy-wrapper met safe fallback.

## 3. Threadselectie

Gebruikte helpers:

- `pickThreadMessagesForModel(thread)`
- `pickPlannerMessagesForModel(thread)`

Gedrag:

- maximaal `12` berichten voor de final call
- maximaal `6` berichten voor de planner call
- assistant-berichten met `status !== ready` worden uitgesloten
- de planner ziet dus alleen een compacte recente turngeschiedenis

Belang:

- als cruciale context buiten die laatste 6 berichten valt, ziet de planner die niet
- als een refinement-vraag zoals `brandstof?` te weinig expliciete context bevat, moet de actieve flow of de vorige turn dat opvangen

## 4. Plannerfase

### 4.1 Planner prompt

De planner-system-prompt komt uit `HELP_ASSISTANT_PLANNER_PROMPT` in `services/help-assistant-ai.ts`.

Belangrijkste regels:

- turn-first: elke turn opnieuw beoordelen
- actieve flow is soft prior, nooit hard lock
- exact één `route`
- exact één `mode`
- exact één `insightsFlow`
- geen bedragen, datums of eindadvies in planneroutput
- dataRequests alleen classificeren, nooit zelf data ophalen

### 4.2 Beschikbare planner-routes

- `issue_intake`
- `spending_advice`
- `general`
- `transactions_insight`
- `category_insight`
- `screen_explanation`

### 4.3 Beschikbare modes

- `issue_intake`
- `spending_decision`
- `space_summary`
- `general_help`
- `transaction_lookup`
- `category_summary`
- `screen_help`

### 4.4 Verplicht insightsFlow

Nieuw verplicht planner-veld:

- `general_reasoning`
- `spending_overview`
- `category_summary`
- `transaction_facts`
- `screen_context`
- `issue_intake`
- `none`

Doel:

- planner moet expliciet zeggen welk intern insights-pad nodig is
- code kan daarna route en insightsFlow op elkaar controleren

### 4.5 Planner-context die wordt meegestuurd

Via `buildPlannerPrompt(...)` krijgt OpenAI:

- neutrale turn-context
- actieve flow als soft prior
- platform
- periode-label
- beschikbare category scopes, als die al bekend zijn
- beschikbare insights-flows

Voorbeeld planner-inputsystemprompt-opbouw:

```text
HELP_ASSISTANT_PLANNER_PROMPT

Planner-context:
Actieve flow (soft prior): route=...; mode=...; status=...
Platform: ...
Periode: ...

Beschikbare categorie-scopes: groceries (Boodschappen), fuel (Brandstof), ...
Beschikbare insights-flows: spending_overview, category_summary, transaction_facts, ...
```

### 4.6 Planner-output schema

Verwachte JSON:

```json
{
  "route": "issue_intake|spending_advice|general|transactions_insight|category_insight|screen_explanation",
  "mode": "issue_intake|spending_decision|space_summary|general_help|transaction_lookup|category_summary|screen_help",
  "insightsFlow": "general_reasoning|spending_overview|category_summary|transaction_facts|screen_context|issue_intake|none",
  "confidence": "low|medium|high",
  "needsClarification": true,
  "continueActiveFlow": false,
  "activeFlowInfluence": "none|low|medium|high",
  "requires": {
    "monthBudget": true,
    "cashflowSafety": true,
    "expectedEndBalance": false,
    "categorySummary": false,
    "transactionFacts": false,
    "screenExplanation": false
  },
  "dataRequests": {
    "monthScope": "current|previous|specified|none",
    "categoryScope": "slug|unknown|none",
    "merchantScope": "merchant_slug|unknown|none",
    "transactionQuestionType": "merchant_total|merchant_frequency|category_places|category_total|none"
  },
  "useScreenContext": false
}
```

## 5. Parser en validatie van planner-output

Functie:

- `parseHelpAssistantPlannerDecision(...)`

Validatie:

- `route` moet in toegestane enum zitten
- `mode` moet in toegestane enum zitten
- `confidence` moet `low|medium|high` zijn
- `activeFlowInfluence` moet `none|low|medium|high` zijn
- `requires` moet volledig boolean zijn
- `useScreenContext` moet boolean zijn
- `dataRequests` wordt altijd genormaliseerd
- `insightsFlow` valt terug op `resolveDefaultInsightsFlowForRoute(route)` als planner hem mist of ongeldig invult

Belangrijk:

- planner mag dus incompleet zijn; code forceert alsnog een geldig object

## 6. Lokale fallbackplanner

Functie:

- `buildSafePlannerFallback(...)`

Deze draait altijd naast de planner-call en geeft een veilige fallback als:

- planner stuk is
- planner onbruikbaar is
- planner te generiek routeert

### 6.1 Issue fallback

Als lokale `classifyHelpAssistantIntent(...)` issue/feedback/bug herkent:

- route -> `issue_intake`
- mode -> `issue_intake`
- insightsFlow -> `issue_intake`

### 6.2 Spending fallback

Gebaseerd op `classifySpendingQuestionType(...)` in `services/help-assistant-spending-advice.ts`.

`spending_advice` wordt alleen nog gebruikt voor echte ruimte- of beslisvragen zoals:

- `heb ik nog budget`
- `ben ik over budget`
- `kan ik dit nog uitgeven`
- `hoeveel ruimte heb ik nog`

Niet meer voor historische/category lookup-vragen zoals:

- `hoeveel heb ik aan auto uitgegeven`
- `hoeveel aan brandstof vorige maand`
- `wat is de trend`

### 6.3 Category fallback

Als de uservraag lijkt op category spend/summary:

- route -> `category_insight`
- mode -> `category_summary`
- insightsFlow -> `category_summary`

Hierbij wordt generiek geprobeerd category scope af te leiden uit de beschikbare category catalogus.

### 6.4 Transaction fallback

Als merchant/transactie lookup aannemelijk is:

- route -> `transactions_insight`
- mode -> `transaction_lookup`
- insightsFlow -> `transaction_facts`

### 6.5 Screen fallback

Voor schermuitlegvragen:

- route -> `screen_explanation`
- mode -> `screen_help`
- insightsFlow -> `screen_context`

## 7. Spending classifier

Implementatie:

- `classifySpendingQuestionType(...)` in `services/help-assistant-spending-advice.ts`

Belangrijk onderscheid:

- echte budget/space/beslisvragen -> `space_summary` of `spending_decision`
- historische/analytische/category-vragen -> `null`
- bug/probleemvragen -> `null`

Dit is cruciaal omdat deze classifier op meerdere plekken invloed heeft:

- fallback routing
- intent-shift guardrails
- short clarification detection
- planner pre-hydration

## 8. Active flow en continuation vs intent shift

### 8.1 Active flow

Actieve flow wordt genormaliseerd via:

- `normalizeActiveFlowDescriptor(...)`

Ondersteunt:

- nieuw generiek `activeFlow`
- legacy `issueFlowActive`

### 8.2 Short continuation

Helpers:

- `isLikelyShortClarificationReply(...)`
- `isLikelyShortScopeRefinement(...)`

Gedrag:

- korte issue-antwoorden kunnen `issue_intake` voortzetten
- korte refinements zoals `brandstof?` kunnen `category_insight` of `transactions_insight` voortzetten

### 8.3 Explicit intent shift

Helper:

- `hasExplicitIntentShift(...)`

Voorbeelden:

- actieve issueflow + user stelt spendingvraag -> shift toegestaan
- actieve categoryflow + user stelt schermuitlegvraag -> shift toegestaan
- actieve flow is nooit hard lock

## 9. Data-request normalisatie

Functie:

- `normalizePlannerDataRequests(...)`

Deze laag corrigeert planneroutput en turnsignalen.

### 9.1 Maandscope

Herkenning uit turn:

- `deze maand` -> `current`
- `vorige maand` / `afgelopen maand` -> `previous`
- `dit jaar` / `afgelopen jaar` -> unsupported jaarscope
- `trend` / `ontwikkeling` / `verloop` -> unsupported trendscope

Fallbacks:

- ontbrekende maar noodzakelijke maandscope -> promote naar `current`
- `specified` zonder bruikbare periode -> fallback naar `current` of `none` + clarification

### 9.2 Category scope

Planner mag alleen slugs classificeren.

De code bouwt zelf een veilige category catalogus via:

- `buildAvailableCategoryScopes(...)`

Bronnen:

- `spending.currentMonthBreakdown.categories`
- `subcategories`
- `budgetPlan.variableCategoryBudgets`

Daarna inferreert de code via `inferCategoryScopeFromCatalog(...)` bijvoorbeeld:

- `boodschappen` -> `groceries`
- `brandstof` -> `fuel`

zonder dat daar per categorie handcoded if/else-logica voor nodig is.

### 9.3 Transaction question type

Functie:

- `resolvePlannerTransactionQuestionType(...)`

Heuristiek:

- `hoe vaak`, `frequent`, `aantal` -> `merchant_frequency`
- `waar`, `welke winkel`, `welke plekken` -> `category_places`
- `hoeveel`, `totaal`, `uitgegeven` + categoryScope -> `category_total`
- `hoeveel`, `totaal`, `uitgegeven` + merchantScope -> `merchant_total`

## 10. Wanneer wordt financiële context vroeg geladen?

Functie:

- `shouldPrimeFinancialCatalog(...)`

Doel:

- vóór de plannercall al category catalogus beschikbaar maken als dat nuttig is

Prime gebeurt bij:

- spendingvragen
- category summary-vragen
- vragen met `transactie`, `categorie`, `uitgegeven`

Prime gebeurt bewust niet bij:

- diagnostische vragen zoals `waarom klopt mijn budget niet`
- `klopt dit niet`
- `werkt niet`
- `bug`

## 11. Periodeverschuiving voor vorige maand

Helpers:

- `detectRequestedTimeScope(...)`
- `resolveContextMonthKey(...)`
- `shiftMonthKey(...)`
- `buildContextForRequestedMonthScope(...)`

Gedrag:

- als vraag `vorige maand` bevat, bouwt de orchestration een aangepaste context met vorige maand als selectedPeriod
- die aangepaste context gaat naar `resolveUnifiedFinancialAdviceContext(...)`

Belangrijk:

- dit werkt alleen goed als `context.selectedPeriod.key` of `startIso` bruikbaar is, of de fallback naar huidige maand logisch is
- als de financial context-service alsnog huidige maand teruggeeft, markeert de hydrationlaag dit als mismatch

## 12. Normalisatie van plannerresultaat

Functie:

- `normalizePlannerDecision(...)`

Volgorde:

1. plannerresultaat of fallbackresultaat kiezen
2. `insightsFlow` defaulten
3. route/mode/requires defaults toepassen
4. route eventueel overrulen op basis van `insightsFlow`
5. `dataRequests` normaliseren
6. continuation/intent-shift guardrails toepassen

### 12.1 Belangrijke route-promoties

Als planner:

- `route = general`
- maar `insightsFlow = category_summary`

dan promote code dit alsnog naar:

- `route = category_insight`
- `mode = category_summary`

Zelfde principe voor:

- `transaction_facts` -> `transactions_insight`
- `screen_context` -> `screen_explanation`
- `spending_overview` -> `spending_advice`

## 13. Extra override direct na normalisatie

In `requestHelpAssistantReply(...)` zitten nog 2 extra safety overrides:

### 13.1 Override naar spending

Als planner `general` of `screen_explanation` gaf, maar lokale spending-classifier een echte spendingvraag ziet:

- override naar `spending_advice`

### 13.2 Override naar category/transactions

Als planner `general` of `screen_explanation` gaf, maar fallbackplanner `category_insight` of `transactions_insight` zag:

- override naar die fallbackroute

Dit is bewust toegevoegd omdat de planner in de praktijk nog te vaak te vaag routeerde.

## 14. Hydration plan

Functie:

- `buildHydrationPlan(...)`

Output:

- `financialSnapshot`
- `categorySummary`
- `transactionFacts`
- `monthScopeResolved`
- `categoryScopeResolved`
- `merchantScopeResolved`
- `questionTypeResolved`
- `limitations`
- `fallbacks`

Mapping:

- `requires.monthBudget|cashflowSafety|expectedEndBalance` -> `financialSnapshot`
- `requires.categorySummary` -> `categorySummary`
- `requires.transactionFacts` -> `transactionFacts`

## 15. Truth-safe hydrated blocks

Functie:

- `buildHydratedAssistantDataBlocks(...)`

### 15.1 financialSnapshot

Bevat:

- periode
- resterend variabel budget
- verwacht eindsaldo
- cashflow risico

### 15.2 categorySummary

Bevat:

- gevraagde monthScope
- `dataPeriod` van de werkelijk geladen financiële context
- categoryScope
- beschikbare category scopes
- `scopedCategoryLabel`
- `scopedCategoryTotal`
- `scopedCategoryTransactionCount`
- lijst `categories`

Belangrijk:

- matching gebeurt op `categoryKey`, `key`, `label` en subcategory-labels
- als geen match -> `categorie_scope_niet_gevonden_in_geaggregeerde_data`
- als gevraagde maand niet overeenkomt met werkelijk geladen periode -> `month_scope_niet_volledig_gehydrateerd`

### 15.3 transactionFacts

Bevat alleen aggregaatpayload:

- `monthScope`
- `dataPeriod`
- `transactionQuestionType`
- `categoryScope`
- `merchantScope`
- `answerability`
- optioneel `categoryTotal`
- optioneel `categoryTransactionCount`

Nooit:

- ruwe transactierijen
- merchantlijst met privacygevoelige details
- verzonnen totals

## 16. Final answer promptopbouw

### 16.1 Spending route

System prompts:

1. `SPENDING_ADVICE_SYSTEM_PROMPT`
2. vraagtype-variant:
   - `SPENDING_SPACE_QUESTION_PROMPT`
   - of `SPENDING_DECISION_QUESTION_PROMPT`
3. compact spending context block via `buildCompactSpendingContextBlock(...)`

Deze final call vraagt JSON terug.

### 16.2 Issue intake route

System prompts:

1. `ISSUE_INTAKE_SYSTEM_PROMPT`
2. issue-contextblock via `buildIssueIntakePrompt(...)`

Deze final call vraagt JSON terug.

### 16.3 General/category/transactions/screen route

System prompts:

1. `HELP_ASSISTANT_SYSTEM_PROMPT`
2. channel context via `buildGeneralRouteContextPrompt(...)`
3. optioneel `general_hydrated_data`

Voorbeeld channel-context:

```text
Kanaal: general_help
Planner-route: category_insight
Planner-mode: category_summary
Insights-flow: category_summary
DataRequest: monthScope=previous, categoryScope=fuel, merchantScope=none, transactionQuestionType=category_total
Platform: web
Periode: maart 2026
Routehint: geef alleen categorie-samenvattingen op basis van expliciete context. Verzin geen bedragen, categorieën of totalen.
Als `scopedCategoryTotal` beschikbaar is, noem dit bedrag expliciet en koppel het aan de genoemde categorie.
```

## 17. OpenAI proxy-calls

Functies:

- `postOpenAIChatCompletion(body, meta?)`
- `postHelpAssistantSpendingAdviceCompletion({ openAIRequest, safeFallback, meta })`

Envelope:

```json
{
  "openai": { "...": "chat completion request" },
  "meta": {
    "useCase": "...",
    "routeName": "...",
    "screenId": "...",
    "screenTitle": "...",
    "platform": "...",
    "periodLabel": "...",
    "signalHints": { "...": "..." },
    "safeFallback": { "...": "alleen bij spending" }
  }
}
```

## 18. Debug logging

Als `EXPO_PUBLIC_HELP_ASSISTANT_DEBUG=1`:

- `planner_data_requests_raw`
- `planner_data_requests_normalized`
- `hydration_plan_selected_blocks`
- `hydration_plan_fallbacks`
- `planner_result`
- `final_answer_setup`
- `final_answer_context_blocks_sent`

Voor review zijn dit de belangrijkste logs om live te vergelijken met een fout antwoord.

## 19. Bekende kritieke reviewpunten

Dit zijn de plekken waar de flow nog steeds inhoudelijk stuk kan voelen, ook als de unit tests groen zijn.

### 19.1 Planner ziet alleen compacte thread

De planner ziet slechts de laatste 6 threadberichten. Daardoor kan een refinement-turn te weinig context bevatten als:

- actieve flow ontbreekt
- vorige user turn buiten het plannerwindow valt

### 19.2 Category catalogus is alleen zo goed als de geaggregeerde context

De planner krijgt alleen categorieën mee die in:

- `currentMonthBreakdown`
- `subcategories`
- `variableCategoryBudgets`

voorkomen.

Als `auto` niet als category label/slug in die geaggregeerde set zit, kan:

- `brandstof` nog wel werken
- maar `auto` te breed blijven en clarificatie nodig hebben

### 19.3 Vorige maand vertrouwt op financial context service

De orchestration vraagt vorige maand op, maar als `resolveUnifiedFinancialAdviceContext(...)`:

- geen vorige maand ondersteunt
- huidige maand teruggeeft
- geselecteerde periode negeert

dan ontstaat:

- `monthScope=previous`
- maar `dataPeriod` is nog huidige maand

Dat wordt nu wel gelabeld als limitation, maar lost de databron niet op.

### 19.4 Route kan goed zijn terwijl final answer nog te zwak is

Zelfs met correcte route:

- als `scopedCategoryTotal` onbekend blijft
- of `categories: []`

dan geeft het general kanaal nog steeds een zwak antwoord.

De kernvraag is dan niet routing, maar:

- waarom hydration geen match vond
- of waarom de financial context geen relevante categorie bevatte

### 19.5 Diagnostic vragen worden bewust niet gehydrateerd

Vragen zoals:

- `Waarom klopt mijn budget niet?`

krijgen nu bewust geen vroege financiële hydration. Dat is veilig, maar kan ook betekenen dat het antwoord praktisch blijft in plaats van data-gedreven.

## 20. Concrete reviewvragen voor de AI-specialist

1. Is de plannerprompt te breed of te abstract, waardoor `general` nog te vaak wordt gekozen?
2. Is `insightsFlow` voldoende sterk als contract, of moet route volledig daarvan worden afgeleid?
3. Is de category catalogus rijk genoeg voor brede hoofdvragen zoals `auto`, `huis`, `boodschappen`, `zorg`?
4. Moet previous-month hydration eerder en explicieter worden afgedwongen?
5. Is de final prompt voor `general_help` sterk genoeg om `scopedCategoryTotal` altijd te gebruiken als die aanwezig is?
6. Moet de assistant voor category- en transaction-insight niet een eigen dedicated final modelprompt krijgen in plaats van general-channel reuse?
7. Moet de code de mismatch `monthScope=previous` + `dataPeriod=current` harder afvangen en geen inhoudelijk antwoord meer laten geven?

## 21. Aanbevolen live debugvolgorde

Bij een mislukte vraag zoals:

- `hoeveel heb ik aan mijn auto uitgegeven deze maand?`
- `hoeveel aan brandstof vorige maand?`

check in deze volgorde:

1. `planner_result.raw`
2. `planner_result.normalized`
3. `planner_data_requests_normalized`
4. `hydration_plan_selected_blocks`
5. `hydration_plan_fallbacks`
6. `final_answer_context_blocks_sent`
7. de exacte `general_hydrated_data` prompt

Als daar al `scopedCategoryTotal: onbekend` of `categories: []` staat, zit het probleem niet meer in de final modelcall maar eerder in:

- category scope inference
- period hydration
- financial context sourcing

## 22. Huidige teststatus

De huidige unit tests voor deze laag zijn groen, inclusief:

- category spend route switch weg van spending advice
- short scope refinement continuation
- category scope inference vanuit catalogus
- previous month limitation-detectie
- spending-vragen op juiste spending-pad
- diagnostische budget mismatch niet onnodig financieel hydrateren

Belangrijk voor review:

- groene tests bewijzen alleen dat de huidige geprogrammeerde contracten consistent zijn
- ze bewijzen niet dat de assistant in productie altijd de juiste business-context of rijk genoeg categoriescope ontvangt
