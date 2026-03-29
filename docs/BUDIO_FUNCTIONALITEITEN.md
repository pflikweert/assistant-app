# BUDIO FUNCTIONALITEITEN

## Versieblok

- Datum: 29 maart 2026
- Doel: complete contextbron voor mensen en AI
- Doelgroep van dit document: productpartners, testers, investeerders, nieuwe teamleden, AI-assistenten
- Productstatus: actieve consumentenfinance-app met doorlopende verfijning

## Budio in 1 minuut

Budio is de dagelijkse financiële cockpit die huishoudens zonder financiële vaktaal laat zien waar ze staan, wat eraan komt, wat veilig kan en wat nu de slimste volgende stap is. De app brengt actuele rekeningstand, veilige ruimte, tempo, terugkerende lasten en forecast samen in één rustige, Nederlandstalige ervaring.

Kernprobleem dat Budio oplost:

- veel mensen zien losse banktransacties, maar geen bruikbaar maandbeeld
- budgetteren voelt snel streng of technisch
- forecasts zijn vaak vaag of niet gekoppeld aan echte transacties en rekeningen

Kernoplossing:

- actuele stand + `Nu vrij` + `Veilig tot volgende inkomen` + risico + volgende actie in één producttaal
- snelle correctieflow voor categorieën, regels en abonnementskoppelingen
- conservatieve voorspelling op basis van transacties, budgetlogica, vaste patronen en rekeningrollen
- contextuele `Money Copilot` die uitlegt, richting geeft en helpt beslissen

## Waarom Budio

Budio is gebouwd voor heldere financiële keuzes in het dagelijks leven. Niet voor boekhouding, wel voor persoonlijke sturing.

Productprincipes:

- eerst huidige stand, dan veilige ruimte, dan trend of risico, dan advies
- home is de dominante ervaring; andere schermen zijn ondersteunende motoren of detailniveaus
- beslissingen gaan vóór categorieën, beheeropties of interne mechaniek
- begrijpelijke taal voor niet-technische gebruikers
- geen dubbele informatie op hetzelfde niveau
- duidelijke klikbaarheid en duidelijke detailniveaus
- de UI presenteert financiële uitkomsten, maar verzint geen eigen financiële waarheid
- forecast is altijd verwachting, nooit zekerheid
- AI mag helpen bij uitleg, routing en suggesties, maar niet bij het overschrijven van financiële kernwaarden

## Nieuwe Productvisie En Koersverschuiving

De actuele productvisie staat uitgewerkt in `docs/BUDIO_PRODUCTVISIE_ROADMAP.md`. De harde begrippen- en migratielaag staat in:

- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`

De kernverschuiving is:

- van budgetapp naar dagelijkse financiële cockpit
- van schermdenken naar één dominant home-productmoment
- van observatie naar veilige ruimte, komende risico's en beste volgende actie
- van losse AI-feature naar contextuele `Money Copilot`

Wat dit betekent voor het bestaande product:

- `Dashboard` is niet alleen een overzicht, maar het primaire antwoordscherm
- `Budget`, `Insights`, forecast en abonnementen zijn onderliggende motoren voor de cockpit
- `Transactions` blijft belangrijk voor scanbaarheid, begrip en correctie, maar niet als productcentrum
- de hulpassistent is ondersteunend en context-first, niet chat-first

## Doelgroep

Primair:

- consumenten van tiener tot senior
- mensen die overzicht willen op maandruimte en terugkerende lasten
- mensen die budgetten willen bijsturen zonder spreadsheet-denken

Secondair:

- starters met financiële planning
- huishoudens of partners met gedeelde uitgavensturing

Niet bedoeld voor:

- zakelijk boekhouden
- enterprise-finance workflows

## Statuslegenda

- `Actief`: primaire, actuele productflow
- `Legacy`: oudere overgangsflow die nog in de codebase staat
- `Legacy redirect`: compatibele bridge naar een nieuwere route
- `Technisch/Hulproute`: ondersteunende of router-/shellflow, niet het hoofdproductverhaal

---

## Pagina-voor-pagina overzicht (alle routes)

### Hoofdschermen (`(tabs)`)

### Route: `app/(tabs)/index.tsx`

- Status: `Actief`
- Doel: primair home-cockpit-scherm voor stand, ruimte, risico en dagelijkse context
- Kernfunctionaliteiten:
  - huidig saldo en maandcontext
  - bouwt toe naar `Nu vrij` en `Veilig tot volgende inkomen` als dominante home-antwoorden
  - komende risico's en statuscallouts
  - entry naar concrete vervolgstappen via detail, beheer of assistent
  - recente transacties
  - entry naar detail en hulpassistent

### Route: `app/(tabs)/transactions.tsx`

- Status: `Actief`
- Doel: centrale transactielijst met zoeken, filters en correctie-ingangen
- Kernfunctionaliteiten:
  - filteren op type, categorie, rekening en periode
  - zoeken en snelle filterchips
  - importactie en doorklik naar transactie-detail

### Route: `app/(tabs)/budget.tsx`

- Status: `Actief`
- Doel: ondersteunende sturingslaag voor veilige ruimte, tempo en budgetbeheer
- Kernfunctionaliteiten:
  - variabel budget, weekritme en maandtempo
  - categorie-opbouw en budgetbeheer
  - transactie-inclusie of -exclusie in budget
  - forecastbron in samenhang met budgetlogica
  - startpunt voor de begeleide budget-instelflow met `Slim met Budio` (primair) en `Handmatig` (secundair)
  - analyse → voorstel → verfijning als leidende instelvolgorde
  - strategiekeuze tussen `Standaard`, `Balans`, `Bespaarmodus` en `Handmatig`
  - lokale blokbewerkingen voor `Aanpak`, `Inkomstenbasis`, `Vaste lasten & reserveringen` en `Variabele budgetverdeling`

### Budget instellen

De budget-instelflow is ontworpen als begeleide voorstelroute binnen de bestaande budgetmotor.

- Budio berekent eerst inkomen, vaste lasten, reserveringen en variabele ruimte
- de gebruiker ziet daarna een voorstel en hoeft vooral te bevestigen of bij te sturen
- AI helpt met uitleg, advies en verfijning, maar niet als chat-first startpunt
- de start blijft rustig en voorstelgestuurd met `Slim met Budio` als primaire route en `Handmatig` als fallback
- lokale bewerkingsflows zijn secundair en vervangen de hoofdflow niet
- voorstel-scherm werkt besluitgestuurd: eerst `strategie`, `maandgevoel`, `veiligheid/impact` en `beste volgende stap`, daarna pas categorieverdeling
- review-scherm start met `wat dit plan betekent voor je maand`, gevolgd door `ingesteld`, `aangepast` en `finetunen`
- coachlaag gebruikt compacte quick actions (zoals `maak iets zuiniger` of `verdeel opnieuw`) zonder chat-first productgedrag
- de v1-engine en toolgrenzen staan uitgewerkt in `docs/design/budget-setup-engine-v1.md`

### Route: `app/(tabs)/insights.tsx`

- Status: `Actief`
- Doel: verdiepende uitleglaag voor trend, risico, forecast en waarom iets aandacht vraagt
- Kernfunctionaliteiten:
  - forecastsamenvatting
  - `Wat valt op`
  - `Komende momenten`
  - resterende-maandcontext en categorie-overzichten

### Route: `app/(tabs)/settings.tsx`

- Status: `Actief`
- Doel: account- en appinstellingen
- Kernfunctionaliteiten:
  - accountbeheer
  - utilitynavigatie
  - toegang tot beheer- en beveiligingsflows

### Route: `app/admin/index.tsx`

- Status: `Actief`
- Doel: compacte beheeromgeving voor AI-observability en routering
- Voor wie: alleen admingebruikers
- Kernfunctionaliteiten:
  - review inbox voor assistentfrictie
  - AI-verbruik, kosten en OpenAI-totalen
  - per use-case model- en route-instellingen

### Routefamilie: `app/admin/design-system/*`

- Status: `Actief`
- Doel: interne design-system hub voor overzicht, tokens, componenten, patronen, bronnen en wijzigingshistorie
- Voor wie: alleen admingebruikers
- Kernfunctionaliteiten:
  - overzicht van de canonieke referenties en governance-afspraken
  - tokenpagina met kleuren, typografie, spacing, radius, borders en shadows
  - componentpagina met live previews en praktische usage-notes
  - patroonpagina met shellkeuzes en opbouwregels
  - bronnen- en syncpagina met Stitch project, canonical asset en leidende docs
  - compact changelog-overzicht voor interne referentie

### Route: `app/(tabs)/_layout.tsx`

- Status: `Technisch/Hulproute`
- Doel: tabnavigatie en shellregistratie

### Help Assistant

- Status: `Actief`
- Shelltype: `utility/subscherm`
- Doel van deze flow: contextuele `Money Copilot` voor uitleg, bestedingsruimte, keuzes, categorie- en transactievragen, probleemmeldingen en ideeën
- Kernfunctionaliteiten:
  - turn-first planner via OpenAI beoordeelt elke user-turn opnieuw
  - actieve flow werkt als soft prior, nooit als harde lock
  - planner-routes: `issue_intake`, `spending_advice`, `general`, `transactions_insight`, `category_insight`, `screen_explanation`
  - planner geeft altijd `mode`, `insightsFlow`, `requires`, `dataRequests`, `continueActiveFlow` en `activeFlowInfluence` terug
  - de app hydrateert daarna conditioneel alleen veilige contextblokken
  - category- en merchantvragen gebruiken truth-safe aggregaten, geen ruwe transactiedumps
  - voor bepaalde lookupvragen dwingt de app feitelijke antwoorden af op basis van gehydrateerde totalen
  - issue-/idee-flow toont een vaste reviewkaart boven de chat en verstuurt pas na expliciete bevestiging
  - quick actions starten gesprekken of vullen vragen voor, maar doen geen directe submit
- Relatie met andere pagina's:
  - gebruikt het actieve scherm, de periode en de financiële context als veilige basis
  - respecteert dezelfde budget-, forecast- en producttaal als Dashboard, Budget en Insights

### Route: `help-assistant`

- Status: `Actief`
- Doel: modal-/sheetflow voor de hulpassistent
- Kernfunctionaliteiten:
  - lokale chatstate
  - pending assistant-state en foutafhandeling
  - reviewbanner voor issue-intake
  - contextchips en quick actions

### Utility- en detailflows

### Route: `app/transactions/[id].tsx`

- Status: `Actief`
- Doel: actuele route voor transactie-detail

### Route: `app/transaction-detail.tsx`

- Status: `Actief`
- Doel: detailweergave en correctieflow per transactie
- Kernfunctionaliteiten:
  - categorie wijzigen via AI of handmatig
  - regels beheren voor toekomstige matching
  - budget-inclusie of -exclusie
  - historie van dezelfde tegenpartij

### Route: `app/analysis-detail.tsx`

- Status: `Actief`
- Doel: verdiepend analyse-detail vanuit Insights

### Route: `app/subscriptions.tsx`

- Status: `Actief`
- Doel: beheer van abonnementen en terugkerende uitgaven

### Route: `app/bankrekeningen.tsx`

- Status: `Actief`
- Doel: beheer van bankrekeningen en forecast-/budgetscope

### Route: `app/accounts/link.tsx`

- Status: `Actief`
- Doel: rekeningen koppelen tijdens importflow

### Route: `app/rekeningen-koppelen.tsx`

- Status: `Legacy redirect`
- Doel: bridge naar `app/accounts/link.tsx`

### Route: `app/import-control.tsx`

- Status: `Actief`
- Doel: importcontrole en validatie

### Route: `app/import-afronden.tsx`

- Status: `Actief`
- Doel: finale importbevestiging

### Route: `app/csv-import.tsx`

- Status: `Actief`
- Doel: bestandsimport starten

### Route: `app/category-budget-groups.tsx`

- Status: `Actief`
- Doel: budgetgroepbeheer voor categorieën

### Route: `app/settings/security/password.tsx`

- Status: `Actief`
- Doel: wachtwoord wijzigen

### Route: `app/account/change-password.tsx`

- Status: `Legacy redirect`
- Doel: bridge naar `app/settings/security/password.tsx`

### Auth- en systeemroutes

### Route: `app/auth/login.tsx`

- Status: `Actief`
- Doel: inloggen

### Route: `app/auth/register.tsx`

- Status: `Actief`
- Doel: accountregistratie

### Route: `app/auth/forgot-password.tsx`

- Status: `Actief`
- Doel: resetverzoek starten

### Route: `app/auth/reset-password.tsx`

- Status: `Actief`
- Doel: resetflow vervolgen

### Route: `app/auth/new-password.tsx`

- Status: `Actief`
- Doel: nieuw wachtwoord instellen in recoveryflow

### Route: `app/auth/_layout.tsx`

- Status: `Technisch/Hulproute`
- Doel: auth-routerlayout

### Route: `app/login.tsx`

- Status: `Technisch/Hulproute`
- Doel: compatibele login-entry

### Route: `app/transactions.tsx`

- Status: `Technisch/Hulproute`
- Doel: route-entry/bridge naar transacties

### Route: `app/modal.tsx`

- Status: `Technisch/Hulproute`
- Doel: generieke modalroute of demo-shell

### Route: `app/+html.tsx`

- Status: `Technisch/Hulproute`
- Doel: web-HTML shell voor Expo Web

### Route: `app/_layout.tsx`

- Status: `Technisch/Hulproute`
- Doel: root-layout en globale providers

### Route: `app/insights-legacy.tsx`

- Status: `Legacy`
- Doel: oudere inzichtenimplementatie als overgangsreferentie

---

## Service-voor-service functionele mapping

### Auth & sessie

- authvalidatie, foutvertaling, URL-routing en sessiebeheer via `auth-*` services
- huidige gebruiker en identity-opbouw via `current-user.ts`

### Infra, API en observability

- Supabase client en platformconfig via `supabase.ts`
- generieke API-basis via `api-base.ts`
- OpenAI-proxy, response-adapter, usage, pricing, telemetry en org-usage via de AI-infra-services
- request-cache, perf-metrics, runtime-debug en timezone-provider als ondersteunende infrastructuur

### Transacties, categorisatie en regels

- transactienormalisatie, detailopbouw, datumvensters en maandopties
- categorisatie-orchestratie, AI-hercategorisatie, repositorylaag en statusbewaking
- tegenpartijregels en cleanup van legacy detailstrings

### Bankrekeningen, scope en semantiek

- bankrekening-CRUD, simpele forecastinstellingen en rekeningfilters
- `finance-scope` en `finance-scope-preference` bepalen welk geldbeeld een surface gebruikt
- `financial-semantics`, `income-semantics` en `financial-surface-semantics` bewaken betekenis van geldlagen en UI-interpretatie

### Budget & week/maandsturing

- budgetplan, repository, surface-loader en locklogica
- weekverdeling, guardrails, attenties, risico en coachsamenvattingen
- budgetgroepbeheer en inkomenspreview

### Forecast & risico

- end-to-end forecastopbouw in `forecasting.ts`
- refresh, referentiedata, month math, roll-forward en summary-adapters
- event-normalisatie, forecast-domain, accountregels en timeline-persist/read
- income- en expense-baselines plus bronweergave
- reserve-opbouw via reserve-rules en reserve-surface
- zeldzame abonnementssignalen via `rare-subscriptions.ts`

### Insights-selectoren

- maandcontext, forecastkaart, highlights, repeat suppression, categorie-overzichten, resterende maand en komende momenten
- `latest-known-balance.ts` als gedeelde live saldo-ankerbron

### Help Assistant & AI

- contextmodel, chatstate, intentheuristiek en quick actions
- planner, route-normalisatie, hydration, financial context en spending-advice-signalen
- final prompts, orchestration-shared helpers, live eval, issue draft/flow/submit en GitHub-serverpad
- AI modelcatalogus, use cases, admin route settings en review inbox

### Import-pipeline

- bronkeuze, runner, parser, normalizer, dedupe/matching en web drop
- PDF parser en Rabobank AI-mapper als aanvullende importlagen

### Abonnementen, explainability en formattering

- subscription-profielen en koppelingen
- explainability, explain-logic, safety-explanation en safety-spend-window voor mensentaal en guardrails
- gedeelde UI-formatters voor labels, datums, valuta en percentages

---

## Forecastmodel: volledige werking

Deze sectie beschrijft hoe het forecastmodel nu technisch en productmatig werkt op basis van de actuele implementatie.

### 1) Doel en output van het model

Het model maakt per maand een conservatieve cashflowverwachting met:

- verwachte inkomsten en uitgaven
- verwacht eindsaldo van de maand
- laagste verwachte operationele punt in de maand
- eerstvolgend verwacht moment in de timeline
- risico-indicatoren:
  - `riskFlag`: `deficit_warning` als het verwachte eindsaldo negatief is
  - `cashRiskFlag`: `cash_gap_warning` als de timeline tussentijds onder nul komt

### 2) Scope, geldlagen en rekeningrollen

Forecast werkt niet alleen op één generiek saldo, maar op een gekozen `MoneyViewScope` met expliciete rekeningrollen.

Belangrijke begrippen:

- `MoneyViewScope`: welk geldbeeld de gebruiker of surface bekijkt
- rekeningrollen: `operational`, `reserve`, `goal`, `shared`, `observation_only`, `excluded`
- money layers: `operational`, `reserved`, `net_worth`, `free_to_spend`

### 3) Wanneer forecast wordt herberekend

- forecast kan `dirty` worden gezet na relevante mutaties
- `ensureForecastFresh(...)` herberekent alleen als nodig
- gelijktijdige refreshes per gebruiker en scope worden gededuped

### 4) Maandscope en referentiedatum

- voor verleden wordt alleen de gevraagde maand berekend
- voor huidige of toekomstige context wordt een venster vooruit berekend, standaard tot 6 maanden
- elke maand krijgt een `forecastReferenceDate`

Dit bepaalt welke transacties al geboekt zijn en welke events nog verwacht zijn.

### 5) Databronnen die worden gebruikt

- transacties met ruime lookback
- categorieën en budgetgroepen
- bankrekeningen en hun scope-/forecastinstellingen
- budgetplan per forecastmaand
- persisted income sources
- subscription profiles
- rare subscription signalen
- annual obligation reserve rules
- laatste bekende balansanker

Belangrijk:

- uitgesloten rekeningen en `budget_excluded` transacties tellen niet zomaar mee
- de UI mag deze logica niet zelf opnieuw uitvinden

### 6) Event-normalisatie en certainty-lagen

`forecast-event-normalization.ts` bouwt een canonieke eventset voor de maand.

Die eventset onderscheidt:

- eventtypes: `income`, `expense`, `internal_transfer`, `reserve_allocation`, `correction`
- certainty: `booked`, `committed`, `inferred`, `estimated`
- timeline-kind: `income`, `fixed_cost`, `subscription`, `savings_transfer`

Belangrijk gedrag:

- interne overboekingen en reserve-allocaties worden apart behandeld om dubbeltelling te voorkomen
- accountmetadata en inkomenssemantiek winnen van oudere heuristiek

### 7) Income-opbouw

Income komt uit meerdere lagen:

1. baseline
- budget- of trendgebaseerde income-baseline
- include/exclude per income-bucket

2. committed income events
- recurrente inkomens uit historie
- persisted income sources
- afgeleide inkomstenbronnen uit transacties

Conservatieve regel:

- wat al als geboekt is gezien in de maand, wordt niet nog eens als toekomstig inkomen opgevoerd

### 8) Expense-opbouw

Expense-basis ondersteunt meerdere bronnen:

- `budget_settings`
- `trend`

Verder tellen mee:

- vaste lasten en abonnementen uit historie
- actieve subscription profiles
- rare subscriptions als aanvullend signaal
- spaaruitstroom als aparte laag
- reserve-regels voor grotere jaarlijkse of halfjaarlijkse verplichtingen

Conservatieve regel:

- maand-tot-nu uitgaven vormen een harde ondergrens

### 9) Geboekte maandtotalen en rekenschil

`forecast-month-math.ts` combineert geboekt, baseline en committed:

- resterende income gebruikt een conservatieve max-logica
- expenseblokken gebruiken eveneens een max-benadering
- voor huidige maand kan de berekening starten vanaf het laatste bekende operationele balansanker
- toekomstige maanden chainen op verwachte eindsaldi van eerdere maanden

### 10) Timeline, laagste punt en cash-risico

`forecast-timeline.ts` bouwt de volgorde van toekomstige events:

- alleen events na referentiedatum en binnen de gekozen maand
- running balance vanaf het actuele anker
- opslag van `lowestExpectedBalance` en `lowestExpectedBalanceDate`
- `cashRiskFlag` wordt `cash_gap_warning` zodra de reeks onder nul komt

### 11) Reserve-regels en zeldzame abonnementen

Forecast gebruikt twee extra voorzichtig-lagen:

- `rare-subscriptions.ts` detecteert halfjaarlijkse, jaarlijkse of mogelijke single-pattern lasten
- `reserve-rules.ts` kan daaruit conservatief maandreserves afleiden voor annual obligations

Belangrijk:

- deze laag is ondersteunend, niet autonoom financieel leidend
- ontbrekende tabellen of niet-uitgerolde migraties vallen stil en defensief terug

### 12) Persist, readpad en adapters

Persist:

- maandsamenvatting naar `monthly_cashflow_forecasts`
- timeline-events naar `forecast_timeline_events`

Readpad:

- `month-forecast-summary.ts` triggert zo nodig eerst refresh
- scoped latest-known balance kan een extra refresh afdwingen voor de huidige maand
- adapters en roll-forward helpers houden oudere readpaden en nieuwe forecaststaat op elkaar aangesloten

### 13) Conservatieve ontwerpkeuzes

- forecast blijft een verwachting, geen zekerheid
- bij twijfel liever minder slimme afleiding dan een onjuiste conclusie
- schema-safe fallbacks bij ontbrekende tabellen, kolommen of migraties
- AI schrijft geen financiële kernwaarden over

---

## Help Assistant en AI: volledige werking

### 1) Entry point en lokale staat

De flow start in `requestHelpAssistantReply(...)` met:

- `HelpAssistantContext`
- `HelpAssistantThreadState`
- optioneel al geladen financiële context
- optioneel `activeFlow`

De lokale chatstate bewaart:

- user- en assistant-berichten
- pending assistant placeholders
- pending issue draft ids
- metadata over bron, intent, target en context

### 2) Planner-first orchestration

Per user-turn gebeurt meestal:

1. lokale intent- en amount-signalen bepalen
2. optioneel vroege financiële context laden voor category catalog
3. planner-call naar OpenAI
4. parser + normalisatie + fallbackplanner
5. conditionele hydration
6. final answer-call op basis van gekozen route

Productmatig blijft dit secundair aan de cockpit: de assistent vult home en schermcontext aan, maar vervangt ze niet als primaire experience.

### 3) Actuele route- en modecontracten

Routes:

- `issue_intake`
- `spending_advice`
- `general`
- `transactions_insight`
- `category_insight`
- `screen_explanation`

Belangrijke plannervelden:

- `mode`
- `insightsFlow`
- `requires`
- `dataRequests`
- `needsClarification`
- `continueActiveFlow`
- `activeFlowInfluence`
- `useScreenContext`

### 4) Hydration en truth-safe data

De planner haalt zelf nooit data op. De app bepaalt welke veilige blokken worden geladen, onder meer:

- maandbudget en cashflowveiligheid
- expected end balance
- category summary
- transaction facts
- screen explanation context

Belangrijk:

- geen ruwe transactierijen naar OpenAI
- geen privacygevoelige identifiers
- category- en merchantvragen gebruiken geaggregeerde of gestriptte feiten
- bij `previous month` probeert de app echt de vorige maandcontext te laden

### 5) Guardrails op feitelijke antwoorden

Voor bepaalde lookup-routes corrigeert de app het eindantwoord als nodig:

- `category_insight` met `category_total`
- `transactions_insight` met `merchant_total` of `merchant_frequency`

### 6) Spending advice

`spending_advice` gebruikt:

- financiële context met budget-, planning- en forecastsignalen
- veilig fallbackadvies uit app-code
- vast antwoordspatroon: conclusie, waarom, risico, vervolgstap

### 7) Issue-intake en GitHub-pad

Issue- of idee-intake werkt via:

- vaste reviewkaart boven de chat
- AI-samenvatting en verdiepende vraag
- expliciete submit-actie
- server-side issueflow en submitpad

### 8) Use cases, modellen en beheer

Actieve AI-use-cases in de code:

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
- usage/cost monitoring
- review inbox voor lage confidence, fallback of niet-geholpen antwoorden

### 9) Eval en kwaliteitsbewaking

Voor de hulpassistent bestaat een live eval-harness:

- `npm run test:help-assistant-eval`
- output naar `tmp/help-assistant-live-eval-report.json`

---

## Wat kan Budio nu? (pitch-ready)

### 1. Dagelijkse cockpit

- toont actuele rekeningstand en de juiste financiële context per surface
- gebruikt scoped balansankers voor dashboard, budget en insights
- is de plek waar Budio uiteindelijk direct antwoord moet geven op ruimte, risico en volgende actie

### 2. Veilige ruimte en sturing

- variabel budget, weekritme en maandtempo
- logische overlapweken en guardrails
- fundament voor `safe to spend` en `veilig tot volgende inkomen`

### 3. Vooruitblik en risico

- verwacht eindsaldo en laagste punt
- cash-gap signalen
- betekenisvolle komende momenten op basis van timeline-events
- forecastbron, scope en reserve-signalen in samenhang

### 4. Begrip en correctie

- scanbare transactielijst met zoeken, maandkeuze en filters
- snelle doorklik naar detail, correctie en abonnementskoppeling
- handmatige categoriewijziging, AI-hercategorisatie en tegenpartijregels

### 5. Reserves en terugkerende lasten

- actieve subscription profiles
- koppeling met transacties
- detectie van minder frequente lasten
- basis voor conservatieve reserve-opbouw

### 6. Money Copilot

- schermuitleg en algemene hulp
- bestedingsruimtevragen
- feitelijke categorie- en transactievragen
- ideeën en problemen melden via reviewkaart

### 7. Datagrondslag

- CSV en PDF import
- normalisatie, matching en dedupe
- rekeningkoppeling en afrondcontrole

---

## Route Coverage Matrix (samenvatting)

- Totaal routes gevonden in `app/`: `32`
- Hoofdschermen: Dashboard, Transacties, Budget, Insights, Instellingen
- Utility/detail: Help Assistant, Transactie-detail, Analyse-detail, Import, Bankrekeningen, Subscriptions, Budgetgroepbeheer, Wachtwoord
- Auth/system: login, register, reset, layouts, web HTML shell en bridge-routes

## Service Coverage Matrix (samenvatting)

- Totaal non-test servicefiles in `services/`: `128`
- Belangrijkste servicefamilies:
  - auth en sessie
  - infra en API
  - transacties en categorisatie
  - bankrekeningen en scope
  - budget
  - forecast en risico
  - insights
  - Help Assistant en AI
  - import
  - abonnementen, explainability en formattering

## Compleetheidscheck

- Route-inventaris bijgewerkt inclusief `app/+html.tsx` en `app/transactions/[id].tsx`
- Forecastsectie bijgewerkt met scope, money layers, event-normalisatie, reserves en read/adapters
- Help Assistant-sectie bijgewerkt met planner, hydration, factual guardrails, use cases en admin-observability
- Designdocs bewust buiten scope gelaten

## Gebruik van dit document

- Voor mensen: snelle productcontext en betrouwbare featurekaart
- Voor AI: functionele subsystemen, producttaal en guardrails
- Voor pitch: secties `Budio in 1 minuut`, `Waarom Budio` en `Wat kan Budio nu?`
- Voor koers: lees samen met `docs/BUDIO_PRODUCTVISIE_ROADMAP.md`, `docs/BUDIO_PRODUCT_CONTRACT.md` en `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
