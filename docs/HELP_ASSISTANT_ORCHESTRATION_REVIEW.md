# Help Assistant Orchestration Review

Doel van dit document: een AI-specialist moet zonder extra reverse-engineering kunnen reviewen hoe de Budio Help Assistant nu werkt van user-turn tot final answer, inclusief planner, hydration, fallbacklogica en bekende breekpunten.

Productmatig hoort deze laag in de nieuwe visie gelezen te worden als de `Money Copilot` bovenop de dagelijkse financiële cockpit. De orchestration is dus belangrijk, maar niet bedoeld om een los chatproduct centraal te zetten.

Dit document beschrijft de actuele implementatie in:

- `services/help-assistant-ai.ts`
- `services/help-assistant-planner.ts`
- `services/help-assistant-hydration.ts`
- `services/help-assistant-financial-context.ts`
- `services/help-assistant-spending-advice.ts`
- `services/openai-proxy.ts`

## 1. Entry point

De volledige flow start in:

- `requestHelpAssistantReply(...)` in `services/help-assistant-ai.ts`

Input:

- `context`
- `thread`
- optioneel `unifiedFinancialContext`
- optioneel `activeFlow`
- legacy `issueFlowActive`

## 2. Hoofdarchitectuur in 1 lijn

Per user-turn gebeurt dit:

1. laatste user message bepalen
2. lokale intent- en amount-heuristiek bepalen
3. optioneel vroege financiële context laden voor planner-catalogus
4. generieke planner-call naar OpenAI
5. plannerresultaat parsen, normaliseren en zo nodig vervangen door veilige fallbackplanner
6. conditionele truth-safe hydration
7. final call op basis van gekozen route
8. antwoord parsen en teruggeven

Voor `spending_advice` loopt de final call via een proxy-wrapper met safe fallback.

Belangrijk nieuw punt:

- `transactions_insight` en `category_insight` hebben inmiddels echte hydrationpaden met veilige aggregaten; dit zijn niet meer alleen lichte prompt-routes
- de assistent moet vooral contextueel helpen bij veilige ruimte, risico en volgende actie, niet concurreren met home als primair productmoment

## 3. Threadselectie

Gebruikte helpers:

- `pickThreadMessagesForModel(thread)`
- `pickPlannerMessagesForModel(thread)`

Gedrag:

- maximaal 12 berichten voor de final call
- maximaal 6 berichten voor de planner call
- assistant-berichten met `status !== ready` worden uitgesloten

## 4. Plannerfase

De planner werkt turn-first:

- elke user-turn opnieuw beoordelen
- actieve flow is soft prior, nooit hard lock
- exact één `route`
- exact één `mode`
- exact één `insightsFlow`
- geen bedragen, datums of eindadvies in planneroutput
- `dataRequests` alleen classificeren, nooit zelf data ophalen

Beschikbare routes:

- `issue_intake`
- `spending_advice`
- `general`
- `transactions_insight`
- `category_insight`
- `screen_explanation`

## 5. Parser en validatie

Functie:

- `parseHelpAssistantPlannerDecision(...)`

Validatie:

- `route`, `mode`, `confidence` en `activeFlowInfluence` moeten geldige enumwaarden hebben
- `requires` moet volledig boolean zijn
- `useScreenContext` moet boolean zijn
- `dataRequests` wordt altijd genormaliseerd
- `insightsFlow` valt terug op de default voor de gekozen route

Belangrijk:

- planner mag incompleet zijn; de code forceert alsnog een geldig object
- lokale fallbackplanner blijft actief als tweede vangnet naast het model

## 6. Lokale fallbackplanner

Functie:

- `buildSafePlannerFallback(...)`

Deze draait naast de planner-call en geeft een veilige fallback als:

- planner stuk is
- planner onbruikbaar is
- planner te generiek routeert

Fallbackgevallen:

- issue/feedback/bug kan alsnog naar `issue_intake`
- echte ruimtevraag kan alsnog naar `spending_advice`
- lookupvragen kunnen alsnog naar `category_insight`, `transactions_insight` of `screen_explanation`

## 7. Hydrationlaag

De planner bepaalt databehoefte, maar de app bepaalt wat er echt wordt geladen.

Hydration kan onder meer laden:

- financiële maandcontext
- cashflowveiligheid
- expected end balance
- category summary
- transaction facts
- screen explanation context

Guardrails:

- geen ruwe transactierijen naar OpenAI
- geen privacygevoelige identifiers
- category- en merchantvragen gebruiken geaggregeerde of gestripte facts
- `previous month` probeert echt een vorige maandcontext te laden

## 8. Factual enforcement

De app kan vrije modeltekst vervangen door een feitelijk antwoord als de gehydrateerde waarheid duidelijker is.

Actuele gevallen:

- category total
- merchant total
- merchant frequency

Dit voorkomt dat lookupantwoorden alleen afhangen van vrije promptgeneratie.

## 9. Spending advice

`spending_advice` gebruikt:

- gehydrateerde financiële context
- vast JSON-schema
- safe fallback via proxy en client
- vast UI-patroon met conclusie, waarom, risico en vervolgstap

## 10. Issue-intake

Issue-intake gebruikt:

- aparte JSON-response
- vaste reviewkaart boven de chat
- expliciete submitflow
- server-side GitHub-submitpad

Belangrijk:

- de chatregel toont alleen de verdiepende vraag
- de reviewkaart houdt de samenvatting vast
- typed bevestigingen in de chat versturen niets vanzelf

## 11. Bekende aandachtspunten

- refinement-vragen zoals `brandstof?` leunen op recente threadcontext en `activeFlow`
- planner en fallbackplanner moeten in balans blijven zodat lookuproutes niet onnodig terugvallen naar `general`
- periodematch blijft belangrijk bij `vorige maand` en vergelijkbare tijdsvragen
