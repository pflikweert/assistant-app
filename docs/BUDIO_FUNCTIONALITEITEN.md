# BUDIO FUNCTIONALITEITEN

## Versieblok

- Datum: 26 maart 2026
- Doel: complete contextbron voor mensen en AI
- Doelgroep van dit document: productpartners, testers, investeerders, nieuwe teamleden, AI-assistenten
- Productstatus: actieve consumentenfinance-app met doorlopende verfijning

## Budio in 1 minuut

Budio helpt mensen grip te krijgen op hun geld zonder financiële vaktaal. De app brengt saldo, transacties, budgettempo en forecast samen in één rustige ervaring. In plaats van alleen terugkijken laat Budio ook vooruitzien: wat komt eraan, waar zit risico, en waar kun je bijsturen.

Kernprobleem dat Budio oplost:

- veel mensen zien losse banktransacties, maar geen duidelijk maandbeeld
- budgetteren voelt vaak ingewikkeld of te streng
- forecast is vaak vaag en niet gekoppeld aan echte transacties

Kernoplossing:

- actuele rekeningstand + variabel budget + tempo + forecast in één producttaal
- snelle correctieflow voor categorieën (handmatig en via AI)
- herkenning van abonnementen, vaste lasten en terugkerende patronen

## Waarom Budio

Budio is gebouwd voor heldere financiële keuzes in het dagelijks leven. Niet voor boekhouding, wel voor persoonlijke sturing.

Productprincipes:

- eerst huidige stand, dan ruimte, dan trend/risico, dan advies
- begrijpelijke taal voor niet-technische gebruikers
- geen dubbele informatie op hetzelfde niveau
- duidelijke klikbaarheid en duidelijke detailniveaus
- forecast is verwachting, geen zekerheid

## Doelgroep

Primair:

- consumenten van tiener tot senior
- mensen die overzicht willen op maandruimte en terugkerende lasten
- mensen die budgetten willen bijsturen zonder complexe spreadsheet-logica

Secondair:

- mensen die net starten met financiële planning
- partners/gezinssituaties met gezamenlijke uitgavensturing

Niet bedoeld voor:

- zakelijk boekhouden
- complexe enterprise-finance workflows

## Statuslegenda

- `Actief`: primaire, actuele productflow
- `Legacy`: oudere overgangsflow die nog in de codebase staat
- `Technisch/Hulproute`: ondersteunende of router-/bridgeflow, niet het hoofdproductverhaal

---

## Pagina-voor-pagina overzicht (alle routes)

### Hoofdschermen (`(tabs)`)

### Route: `app/(tabs)/index.tsx`

- Status: `Actief`
- Doel van deze pagina: Dashboard met actuele stand en snelle maand-/weekcontext
- Voor wie / wanneer: dagelijks startscherm
- Kernfunctionaliteiten:
  - huidig saldo
  - recente transacties
  - maand- en weektempo-indicatie
- Belangrijkste acties:
  - doorklik naar transacties en detail
- Relatie met andere pagina's:
  - voedt door naar `Transactions`, `Budget`, `Transaction Detail`

### Route: `app/(tabs)/transactions.tsx`

- Status: `Actief`
- Doel van deze pagina: centrale transactielijst met zoeken en filters
- Voor wie / wanneer: uitgavenanalyse en correcties
- Kernfunctionaliteiten:
  - filteren op type/categorie/rekening/periode
  - zoekveld en snelle filterchips
  - importactie vanuit transacties
- Belangrijkste acties:
  - open transactie-detail
  - categorie/labels controleren
- Relatie met andere pagina's:
  - koppeling met `transaction-detail`, `import-control`, `subscriptions`

### Route: `app/(tabs)/budget.tsx`

- Status: `Actief`
- Doel van deze pagina: week- en maandsturing op variabel budget
- Voor wie / wanneer: doorlopende maandcontrole
- Kernfunctionaliteiten:
  - variabel budget, weekritme, maandtempo
  - categorie-opbouw en week-/maandmodalen
  - uitsluiten/meetellen van transacties in budget
- Belangrijkste acties:
  - budget aanpassen
  - categorie-instellingen openen
- Relatie met andere pagina's:
  - gebruikt transactiedata en forecastcontext

### Route: `app/(tabs)/insights.tsx`

- Status: `Actief`
- Doel van deze pagina: trend-, risico- en forecastuitleg
- Voor wie / wanneer: periodieke analyse en vooruitblik
- Kernfunctionaliteiten:
  - forecastkaart
  - wat valt op
  - komende momenten
  - resterende maand modal
- Belangrijkste acties:
  - doorklikken naar relevante detailflows
- Relatie met andere pagina's:
  - bouwt bovenop budget/forecast/transactieservices

### Route: `app/(tabs)/settings.tsx`

- Status: `Actief`
- Doel van deze pagina: account- en appinstellingen
- Voor wie / wanneer: beheer en voorkeuren
- Kernfunctionaliteiten:
  - accountbeheer
  - utility-navigatie
  - onderhouds- en statusacties
- Belangrijkste acties:
  - navigeren naar wachtwoord, gekoppelde rekeningen, etc.
- Relatie met andere pagina's:
  - toegangspunt voor beheerflows

### Route: `app/admin/index.tsx`

- Status: `Actief`
- Doel van deze pagina: compacte Budio-beheeromgeving voor AI-inzicht en configuratie
- Voor wie / wanneer: alleen voor admingebruikers
- Kernfunctionaliteiten:
  - review inbox voor assistentfrictie
  - AI-verbruik met live OpenAI totalen en 10-minuten cache
  - per-use-case route- en modelinstellingen
- Belangrijkste acties:
  - review-item bekijken en status wijzigen
  - AI-route-instellingen aanpassen
- Relatie met andere pagina's:
  - ontsloten vanuit `Instellingen`

### Route: `app/(tabs)/_layout.tsx`

- Status: `Technisch/Hulproute`
- Doel van deze pagina: tab-navigatiestructuur
- Voor wie / wanneer: routerlaag
- Kernfunctionaliteiten:
  - tab-registratie
  - shellintegratie
- Belangrijkste acties:
  - n.v.t. (structuur)
- Relatie met andere pagina's:
  - container voor alle hoofdschermen

### Help Assistant

- Status: `Actief`
- Shelltype: `utility/subscherm`
- Doel van deze flow: rustige hulpassistent voor schermuitleg, probleemhulp,
  idee-intake en bestedingsruimtevragen
- Voor wie / wanneer: wanneer een gebruiker context of sturing nodig heeft
- Kernfunctionaliteiten:
  - OpenAI-router bepaalt per beurt of de vraag in `issue_intake`,
    `spending_advice` of `general` valt
  - issue-/idee-flow toont een compacte reviewkaart vast boven de chat
  - reviewkaart blijft zichtbaar en kan live worden bijgewerkt in de chat
  - `Annuleren` sluit de kaart direct
  - issue/idee-meldingen worden pas na expliciete klik op `Versturen` naar de
    server-side GitHub-flow gestuurd
  - quick actions starten de intake of vullen direct een duidelijke vraag in
- Belangrijkste acties:
  - schermuitleg vragen
  - idee of probleem melden
  - bestedingsruimte of forecastvraag stellen
- Relatie met andere pagina's:
  - gebruikt de context van het actieve scherm als veilige basis voor AI en
    meldkaartsamenvatting
  - respecteert dezelfde budget-/forecasttaal als Dashboard, Budget en Insights
  - gebruikt geen directe client-side GitHub writes

### Route: `help-assistant`

- Status: `Actief`
- Doel van deze pagina: modal-/sheetflow voor de Help Assistant
- Voor wie / wanneer: vanuit elke relevante appcontext
- Kernfunctionaliteiten:
  - vaste reviewbanner voor meldingen
  - chat-first intake
  - spending advice en algemene hulp in dezelfde sheet
- Belangrijkste acties:
  - uitklappen van context, sturen, annuleren
- Relatie met andere pagina's:
  - gekoppeld aan context van de actieve route en periode

### Utility- en detailflows

### Route: `app/transaction-detail.tsx`

- Status: `Actief`
- Doel van deze pagina: volledige context en correctie per transactie
- Voor wie / wanneer: bij twijfel of foutieve categorisatie
- Kernfunctionaliteiten:
  - categorie wijzigen (AI/handmatig)
  - regelbeheer rond tegenpartij
  - budget-inclusie/exclusie
- Belangrijkste acties:
  - bevestigen van categorie-aanpassing
- Relatie met andere pagina's:
  - aangeroepen vanuit transactielijsten en budgetdetails

### Route: `app/transactions.tsx`

- Status: `Technisch/Hulproute`
- Doel van deze pagina: route-entry voor transacties
- Voor wie / wanneer: routing-compatibiliteit
- Kernfunctionaliteiten:
  - route-omleiding of bridgegedrag
- Belangrijkste acties:
  - n.v.t.
- Relatie met andere pagina's:
  - hangt samen met `app/(tabs)/transactions.tsx`

### Route: `app/analysis-detail.tsx`

- Status: `Actief`
- Doel van deze pagina: verdiepend analyse-detail
- Voor wie / wanneer: detailuitleg van geaggregeerde inzichten
- Kernfunctionaliteiten:
  - detailregels achter analyses
  - context per groep/categorie
- Belangrijkste acties:
  - inspectie, terugnavigatie
- Relatie met andere pagina's:
  - vanuit `Insights` of samenvattingsblokken

### Route: `app/subscriptions.tsx`

- Status: `Actief`
- Doel van deze pagina: beheer van abonnementen en terugkerende uitgaven
- Voor wie / wanneer: controle op vaste terugkerende kosten
- Kernfunctionaliteiten:
  - abonnement detecteren en beheren
  - koppelingen met transacties
  - regels voor matching
- Belangrijkste acties:
  - abonnement toevoegen/wijzigen
- Relatie met andere pagina's:
  - gekoppeld aan transactiedetail en forecast

### Route: `app/bankrekeningen.tsx`

- Status: `Actief`
- Doel van deze pagina: beheer van bankrekeningen in de app
- Voor wie / wanneer: rekening toevoegen/bewerken/archiveren
- Kernfunctionaliteiten:
  - rekeningnaam/type/provider
  - actief/archiefstatus
  - budget-inclusie op rekeningniveau
- Belangrijkste acties:
  - rekeningformulieren openen en opslaan
- Relatie met andere pagina's:
  - beïnvloedt transactiefilters en budget-inclusie

### Route: `app/rekeningen-koppelen.tsx`

- Status: `Actief`
- Doel van deze pagina: rekeningen koppelen in importflow
- Voor wie / wanneer: na importdetectie
- Kernfunctionaliteiten:
  - matchen van gevonden rekeningen
  - voorbereiding op importafronding
- Belangrijkste acties:
  - koppeling bevestigen
- Relatie met andere pagina's:
  - onderdeel van importketen

### Route: `app/import-control.tsx`

- Status: `Actief`
- Doel van deze pagina: importcontrole en validatie
- Voor wie / wanneer: tijdens importworkflow
- Kernfunctionaliteiten:
  - controle van importbron/bestanden
  - status en vervolgstappen
- Belangrijkste acties:
  - door naar afronden
- Relatie met andere pagina's:
  - samen met `csv-import`, `import-afronden`

### Route: `app/import-afronden.tsx`

- Status: `Actief`
- Doel van deze pagina: finale importbevestiging
- Voor wie / wanneer: laatste stap import
- Kernfunctionaliteiten:
  - samenvatting van importresultaat
  - bevestiging van verwerken
- Belangrijkste acties:
  - import afronden
- Relatie met andere pagina's:
  - eindpunt van importflow

### Route: `app/csv-import.tsx`

- Status: `Actief`
- Doel van deze pagina: bestandimport starten
- Voor wie / wanneer: nieuwe transacties uploaden
- Kernfunctionaliteiten:
  - bestandsselectie
  - parserstart
- Belangrijkste acties:
  - bestand kiezen en uploaden
- Relatie met andere pagina's:
  - startpunt importflow

### Route: `app/category-budget-groups.tsx`

- Status: `Actief`
- Doel van deze pagina: beheren van categorie-budgetgroepen
- Voor wie / wanneer: finetunen van budget- en insightlogica
- Kernfunctionaliteiten:
  - categorieën groeperen
  - overrides beheren
- Belangrijkste acties:
  - groepen aanpassen/oplaan
- Relatie met andere pagina's:
  - impact op budget en insights

### Route: `app/account/change-password.tsx`

- Status: `Actief`
- Doel van deze pagina: wachtwoord wijzigen
- Voor wie / wanneer: accountbeveiliging
- Kernfunctionaliteiten:
  - wachtwoordvalidatie
  - updateflow
- Belangrijkste acties:
  - wijziging bevestigen
- Relatie met andere pagina's:
  - gekoppeld aan auth en settings

### Auth- en systeemroutes

### Route: `app/auth/login.tsx`

- Status: `Actief`
- Doel van deze pagina: inloggen
- Voor wie / wanneer: toegang tot app
- Kernfunctionaliteiten:
  - e-mail/wachtwoord login
- Belangrijkste acties:
  - aanmelden
- Relatie met andere pagina's:
  - toegang tot hoofdapp

### Route: `app/auth/register.tsx`

- Status: `Actief`
- Doel van deze pagina: accountregistratie
- Voor wie / wanneer: nieuwe gebruikers
- Kernfunctionaliteiten:
  - account aanmaken
  - validatie
- Belangrijkste acties:
  - registratie bevestigen
- Relatie met andere pagina's:
  - start auth-onboarding

### Route: `app/auth/forgot-password.tsx`

- Status: `Actief`
- Doel van deze pagina: resetverzoek starten
- Voor wie / wanneer: wachtwoord vergeten
- Kernfunctionaliteiten:
  - reset e-mail trigger
- Belangrijkste acties:
  - reset aanvragen
- Relatie met andere pagina's:
  - auth herstelketen

### Route: `app/auth/reset-password.tsx`

- Status: `Actief`
- Doel van deze pagina: resetflow vervolgen
- Voor wie / wanneer: via resetlink
- Kernfunctionaliteiten:
  - tokengebaseerde reset
- Belangrijkste acties:
  - nieuw wachtwoord instellen
- Relatie met andere pagina's:
  - auth herstelketen

### Route: `app/auth/new-password.tsx`

- Status: `Actief`
- Doel van deze pagina: nieuw wachtwoord instellen binnen recoveryflow
- Voor wie / wanneer: vervolg op reset
- Kernfunctionaliteiten:
  - wachtwoordregels en bevestiging
- Belangrijkste acties:
  - opslaan nieuw wachtwoord
- Relatie met andere pagina's:
  - auth herstelketen

### Route: `app/auth/_layout.tsx`

- Status: `Technisch/Hulproute`
- Doel van deze pagina: auth-routerlayout
- Voor wie / wanneer: structuurlaag
- Kernfunctionaliteiten:
  - auth-stack opbouw
- Belangrijkste acties:
  - n.v.t.
- Relatie met andere pagina's:
  - container voor auth-routes

### Route: `app/login.tsx`

- Status: `Technisch/Hulproute`
- Doel van deze pagina: compatibele login-entry
- Voor wie / wanneer: fallback/bridge
- Kernfunctionaliteiten:
  - routeverwijzing
- Belangrijkste acties:
  - n.v.t.
- Relatie met andere pagina's:
  - samenhang met `app/auth/login.tsx`

### Route: `app/modal.tsx`

- Status: `Technisch/Hulproute`
- Doel van deze pagina: generieke modale route/demo shell
- Voor wie / wanneer: systeem of experimentele route
- Kernfunctionaliteiten:
  - modalpresentatie
- Belangrijkste acties:
  - n.v.t.
- Relatie met andere pagina's:
  - shell- en navigatietestpad

### Route: `app/_layout.tsx`

- Status: `Technisch/Hulproute`
- Doel van deze pagina: root-layout en globale providers
- Voor wie / wanneer: appbootstrap
- Kernfunctionaliteiten:
  - root routing
  - globale wrappers
- Belangrijkste acties:
  - n.v.t.
- Relatie met andere pagina's:
  - container voor alle routes

### Route: `app/insights-legacy.tsx`

- Status: `Legacy`
- Doel van deze pagina: oudere inzichtenimplementatie
- Voor wie / wanneer: overgangscontext en fallbackhistoriek
- Kernfunctionaliteiten:
  - eerdere insightopbouw
- Belangrijkste acties:
  - n.v.t. voor primaire flow
- Relatie met andere pagina's:
  - vervangen door `app/(tabs)/insights.tsx`, blijft als referentie/overgang

---

## Service-voor-service functionele mapping

### Auth & sessie

- `services/auth-email-validation.ts` (`helper`): valideert e-mailinvoer voor authflows.
- `services/auth-error-messages.ts` (`helper`): vertaalt authfouten naar begrijpelijke copy.
- `services/auth-password-errors.ts` (`helper`): structureert wachtwoordfouten.
- `services/auth-password-validation.ts` (`helper`): regels voor sterk/valide wachtwoord.
- `services/auth-routing.ts` (`kernlogica`): bepaalt authroute-overgangen.
- `services/auth-session.ts` (`kernlogica`): sessiestatus ophalen/bewaken.
- `services/auth-url.ts` (`helper`): auth-URL parsing/normalisatie.

### Infra & basislaag

- `services/supabase.ts` (`kernlogica`): Supabase client en platformconfig.
- `services/current-user.ts` (`kernlogica`): huidige user-id/identity-resolutie.
- `services/api-base.ts` (`helper`): basis voor API-calls buiten pure DB-queries.
- `services/openai-proxy.ts` (`kernlogica`): veilige proxylaag voor AI-calls, use-case metadata en centrale telemetrie.
- `services/pattern-normalization.ts` (`helper`): tekstnormalisatie voor matching/dedupe.

### Transacties & categorisatie

- `services/categorization.ts` (`kernlogica`): batch/AI categoriseren en orchestration.
- `services/categorization-repository.ts` (`kernlogica`): categorie-reads/writes op transacties.
- `services/categorization-status.ts` (`helper`): status van background categorisatie.
- `services/category-display.ts` (`helper`): categoriepadlabels voor UI.
- `services/category-icon.ts` (`helper`): iconmapping categorieen.
- `services/transaction-ai-categorization.ts` (`kernlogica`): AI-hercategorisatie op transactie.
- `services/transaction-rule-management.ts` (`kernlogica`): regels voor toekomstige toewijzingen.
- `services/transaction-details.ts` (`helper`): detailnormalisatie voor transactieweergave.
- `services/transaction-data-cleanup.ts` (`helper`): opschoning legacy strings/velden.
- `services/transaction-month-options.ts` (`kernlogica`): maandkeuzes en maandnavigatie.
- `services/analysis.ts` (`kernlogica`): analyse-opbouw voor detail/insight context.

### Bankrekeningen

- `services/bank-accounts.ts` (`kernlogica`): bankrekening CRUD, actief/archief, budgetinclusie.
- `services/own-account-transfer-heuristics.ts` (`helper`): heuristiek voor interne overboekingen.

### Budget & week/maandsturing

- `services/budget-plan.ts` (`kernlogica`): hoofdrekenlogica voor budgetplan.
- `services/budget-plan-repository.ts` (`kernlogica`): instellingen/overrides opslag.
- `services/budget-plan-surface.ts` (`kernlogica`): user-facing loader met guardrail-lagen.
- `services/budget-week-guardrails.ts` (`kernlogica`): mildere weekherverdeling op basis van maandruimte.
- `services/budget-week-utils.ts` (`kernlogica`): weekranges en basale weekbudgetverdeling.
- `services/budget-week-attention.ts` (`helper`): categorie-attentierijen voor weeksturing.
- `services/budget-risk.ts` (`kernlogica`): statuslabels op schema/let op/boven tempo.
- `services/budget-lock-utils.ts` (`helper`): lock- en allocatiehulplogica.
- `services/budget-income-preview.ts` (`helper`): inkomenspreview voor budgetbeheer.
- `services/budget-coach.ts` (`helper`): coachende samenvatting/acties op budget.
- `services/category-budget-groups.ts` (`kernlogica`): beheer effectieve budgetgroepen.

### Forecast & risico

- `services/forecasting.ts` (`kernlogica`): maandforecastopbouw en persist.
- `services/forecast-month-math.ts` (`kernlogica`): rekendefinities voor cashflow/eindsaldo.
- `services/forecast-refresh.ts` (`kernlogica`): dirty/fresh status en recompute-triggering.
- `services/forecast-reference.ts` (`helper`): referentiedata voor forecastvensters.
- `services/forecast-timeline.ts` (`kernlogica`): timeline-events en datumlogica.
- `services/forecast-timeline-events.ts` (`kernlogica`): timeline-event opslag/reads.
- `services/forecast-budget-plan-requests.ts` (`helper`): budgetplan-requestbeschrijvingen voor forecast.
- `services/forecast-income-baseline.ts` (`kernlogica`): income baseline voor voorspelling.
- `services/forecast-income-utils.ts` (`helper`): inkomenhulpfuncties.
- `services/forecast-derived-income-sources.ts` (`kernlogica`): afgeleide inkomstenbronnen.
- `services/forecast-expense-baseline.ts` (`kernlogica`): expense baseline inclusief budgettrendkoppeling.
- `services/forecast-expense-utils.ts` (`helper`): expensehulpfuncties.
- `services/forecast-expense-source-display.ts` (`helper`): displaylabels forecastbron.
- `services/month-forecast-summary.ts` (`kernlogica`): compacte maandforecast-read voor surfaces.

### Insights-selectoren

- `services/insights-month-context.ts` (`kernlogica`): maandcontextstatus en kernsamenvatting.
- `services/insights-forecast-card.ts` (`kernlogica`): model voor forecastkaart.
- `services/insights-category-summary.ts` (`kernlogica`): categorieblok in insights.
- `services/insights-upcoming-moments.ts` (`kernlogica`): selectie van komende momenten.
- `services/insights-remaining-month.ts` (`kernlogica`): resterende-maand berekeningen.
- `services/insights-highlights.ts` (`kernlogica`): selectie/dedupe/confidence voor wat valt op.
- `services/insights-highlight-history.ts` (`helper`): repeat-suppressiehistoriek.
- `services/latest-known-balance.ts` (`kernlogica`): gedeelde live saldo-snapshotbron.

### Import-pipeline

- `services/import/index.ts` (`kernlogica`): importentry en orchestratie.
- `services/import/types.ts` (`helper`): types voor importflow.
- `services/import/import-source.ts` (`kernlogica`): bronkeuze en source-state.
- `services/import/import-flow-state.ts` (`kernlogica`): voortgangstoestand importflow.
- `services/import/import-runner.ts` (`kernlogica`): pipeline-runner.
- `services/import/import-web-drop.ts` (`helper`): web drag-and-drop handling.
- `services/import/csv-parser.ts` (`kernlogica`): CSV parsing.
- `services/import/pdf-parser.ts` (`kernlogica`): PDF parsing.
- `services/import/rabobank-pdf-ai-mapper.ts` (`helper`): Rabobank PDF veldmapping.
- `services/import/normalizer.ts` (`kernlogica`): normalisatie van importrows.
- `services/import/transaction-import-parser.ts` (`kernlogica`): parsing naar transactievorm.
- `services/import/transaction-import-match.ts` (`kernlogica`): matching/dedupe bij import.

### Subscriptions & herhaling

- `services/subscriptions.ts` (`kernlogica`): abonnementprofielen, koppelingen en lifecycle.
- `services/rare-subscriptions.ts` (`helper`): detectie van minder frequente terugkerende patronen.

### Semantiek

- `services/income-semantics.ts` (`kernlogica`): betekenislaag voor inkomenssoorten en compensaties.

### Testbestanden

- `*.test.ts` en `*.test.tsx` vallen buiten functionele matrix en worden gebruikt als validatie van gedrag.

---

## Wat kan Budio nu? (pitch-ready)

### 1. Saldoinzicht

- Gebruikerswaarde: direct weten waar je nu staat.
- Onderliggende onderdelen:
  - Pagina's: `Dashboard`, `Insights`
  - Services: `latest-known-balance`, `transaction-details`, `supabase`

### 2. Transactiebeheer en filters

- Gebruikerswaarde: snel vinden, begrijpen en corrigeren van transacties.
- Onderliggende onderdelen:
  - Pagina's: `Transactions`, `Transaction Detail`
  - Services: `categorization-repository`, `transaction-month-options`, `category-display`

### 3. Categorisatie (handmatig + AI + regels)

- Gebruikerswaarde: minder handwerk en meer consistente indeling.
- Onderliggende onderdelen:
  - Pagina's: `Transaction Detail`, `Transactions`
  - Services: `categorization`, `transaction-ai-categorization`, `transaction-rule-management`

### 4. Budgetsturing week/maand

- Gebruikerswaarde: bijsturen voordat de maand ontspoort.
- Onderliggende onderdelen:
  - Pagina's: `Budget`
  - Services: `budget-plan`, `budget-risk`, `budget-week-guardrails`

### 5. Forecast en komende momenten

- Gebruikerswaarde: vooruitkijken met risicosignalen i.p.v. alleen terugkijken.
- Onderliggende onderdelen:
  - Pagina's: `Insights`
  - Services: `forecasting`, `forecast-month-math`, `insights-upcoming-moments`

### 6. Import en controleflow

- Gebruikerswaarde: bankdata snel in de app en veilig gecontroleerd.
- Onderliggende onderdelen:
  - Pagina's: `csv-import`, `import-control`, `import-afronden`, `rekeningen-koppelen`
  - Services: `services/import/*`, `bank-accounts`, `transaction-import-match`

### 7. Abonnementen en vaste lasten

- Gebruikerswaarde: terugkerende kosten zichtbaar en beheersbaar.
- Onderliggende onderdelen:
  - Pagina's: `Subscriptions`, `Budget`, `Insights`
  - Services: `subscriptions`, `rare-subscriptions`, `forecast-timeline`

---

## Route Coverage Matrix (alle `app/` routes)

| Route                             | Status              | Korte functionele samenvatting    | Sectie           |
| --------------------------------- | ------------------- | --------------------------------- | ---------------- |
| `app/(tabs)/_layout.tsx`          | Technisch/Hulproute | Tabrouter en shellkoppeling       | Pagina-overzicht |
| `app/(tabs)/budget.tsx`           | Actief              | Budget week/maand sturing         | Pagina-overzicht |
| `app/(tabs)/index.tsx`            | Actief              | Dashboard met saldo en tempo      | Pagina-overzicht |
| `app/(tabs)/insights.tsx`         | Actief              | Inzichten, forecast en signalen   | Pagina-overzicht |
| `app/(tabs)/settings.tsx`         | Actief              | Instellingen en beheer            | Pagina-overzicht |
| `app/(tabs)/transactions.tsx`     | Actief              | Transactielijst met filters       | Pagina-overzicht |
| `app/_layout.tsx`                 | Technisch/Hulproute | Rootlayout en providers           | Pagina-overzicht |
| `app/account/change-password.tsx` | Actief              | Wachtwoord wijzigen               | Pagina-overzicht |
| `app/analysis-detail.tsx`         | Actief              | Detailuitleg analyses             | Pagina-overzicht |
| `app/auth/_layout.tsx`            | Technisch/Hulproute | Authrouterlayout                  | Pagina-overzicht |
| `app/auth/forgot-password.tsx`    | Actief              | Wachtwoord reset aanvragen        | Pagina-overzicht |
| `app/auth/login.tsx`              | Actief              | Inloggen                          | Pagina-overzicht |
| `app/auth/new-password.tsx`       | Actief              | Nieuw wachtwoord instellen        | Pagina-overzicht |
| `app/auth/register.tsx`           | Actief              | Accountregistratie                | Pagina-overzicht |
| `app/auth/reset-password.tsx`     | Actief              | Resetflow afronden                | Pagina-overzicht |
| `app/bankrekeningen.tsx`          | Actief              | Rekeningen beheren                | Pagina-overzicht |
| `app/category-budget-groups.tsx`  | Actief              | Budgetgroepbeheer                 | Pagina-overzicht |
| `app/csv-import.tsx`              | Actief              | Import starten                    | Pagina-overzicht |
| `app/import-afronden.tsx`         | Actief              | Import afronden                   | Pagina-overzicht |
| `app/import-control.tsx`          | Actief              | Importcontrole                    | Pagina-overzicht |
| `app/insights-legacy.tsx`         | Legacy              | Oude inzichtenflow                | Pagina-overzicht |
| `app/login.tsx`                   | Technisch/Hulproute | Login bridge-route                | Pagina-overzicht |
| `app/modal.tsx`                   | Technisch/Hulproute | Generieke modalroute              | Pagina-overzicht |
| `app/rekeningen-koppelen.tsx`     | Actief              | Rekeningen koppelen in importflow | Pagina-overzicht |
| `app/subscriptions.tsx`           | Actief              | Abonnementenbeheer                | Pagina-overzicht |
| `app/transaction-detail.tsx`      | Actief              | Transactiecontext en correctie    | Pagina-overzicht |
| `app/transactions.tsx`            | Technisch/Hulproute | Transacties route-entry           | Pagina-overzicht |

---

## Service Coverage Matrix (alle non-test `services/` files)

| Service                                        | Status     | Korte functionele samenvatting                | Sectie                      |
| ---------------------------------------------- | ---------- | --------------------------------------------- | --------------------------- |
| `services/analysis.ts`                         | kernlogica | Analyseopbouw voor detail en inzichten        | Transacties & categorisatie |
| `services/api-base.ts`                         | helper     | API-basishulp voor requests                   | Infra & basislaag           |
| `services/auth-email-validation.ts`            | helper     | E-mailvalidatie voor authflows                | Auth & sessie               |
| `services/auth-error-messages.ts`              | helper     | Authfouten naar menselijke meldingen          | Auth & sessie               |
| `services/auth-password-errors.ts`             | helper     | Structuur voor wachtwoordfouten               | Auth & sessie               |
| `services/auth-password-validation.ts`         | helper     | Wachtwoordregels en validatie                 | Auth & sessie               |
| `services/auth-routing.ts`                     | kernlogica | Routeregels tussen authstappen                | Auth & sessie               |
| `services/auth-session.ts`                     | kernlogica | Sessiebeheer en authstatus                    | Auth & sessie               |
| `services/auth-url.ts`                         | helper     | URL parsing voor authlinks                    | Auth & sessie               |
| `services/bank-accounts.ts`                    | kernlogica | CRUD en status van bankrekeningen             | Bankrekeningen              |
| `services/budget-coach.ts`                     | helper     | Coachende budgetsamenvattingen                | Budget & week/maandsturing  |
| `services/budget-income-preview.ts`            | helper     | Inkomenspreview in budgetbeheer               | Budget & week/maandsturing  |
| `services/budget-lock-utils.ts`                | helper     | Lock/allocatiehulplogica                      | Budget & week/maandsturing  |
| `services/budget-plan-repository.ts`           | kernlogica | Opslag budgetinstellingen en overrides        | Budget & week/maandsturing  |
| `services/budget-plan-surface.ts`              | kernlogica | User-facing budgetloader met guardrails       | Budget & week/maandsturing  |
| `services/budget-plan.ts`                      | kernlogica | Hoofdberekening budgetplan                    | Budget & week/maandsturing  |
| `services/budget-risk.ts`                      | kernlogica | Risicotones en labels op schema/let op        | Budget & week/maandsturing  |
| `services/budget-week-attention.ts`            | helper     | Weekcategorie-attentieblokken                 | Budget & week/maandsturing  |
| `services/budget-week-guardrails.ts`           | kernlogica | Mildere weekherverdeling op maandruimte       | Budget & week/maandsturing  |
| `services/budget-week-utils.ts`                | kernlogica | Weekranges en basisverdeling                  | Budget & week/maandsturing  |
| `services/categorization-repository.ts`        | kernlogica | Categorie write/read op transacties           | Transacties & categorisatie |
| `services/categorization-status.ts`            | helper     | Background categorisatiestatus                | Transacties & categorisatie |
| `services/categorization.ts`                   | kernlogica | Categorisatie-orchestratie                    | Transacties & categorisatie |
| `services/category-budget-groups.ts`           | kernlogica | Categoriebudgetgroepen en overrides           | Budget & week/maandsturing  |
| `services/category-display.ts`                 | helper     | Categoriepadlabels voor UI                    | Transacties & categorisatie |
| `services/category-icon.ts`                    | helper     | Categorie-icoonresolutie                      | Transacties & categorisatie |
| `services/current-user.ts`                     | kernlogica | Current user-id en identity                   | Infra & basislaag           |
| `services/forecast-budget-plan-requests.ts`    | helper     | Budgetplanrequestdescriptoren voor forecast   | Forecast & risico           |
| `services/forecast-derived-income-sources.ts`  | kernlogica | Afgeleide inkomstenbronnen                    | Forecast & risico           |
| `services/forecast-expense-baseline.ts`        | kernlogica | Expense baseline voor forecast                | Forecast & risico           |
| `services/forecast-expense-source-display.ts`  | helper     | UI-labels voor forecastbron                   | Forecast & risico           |
| `services/forecast-expense-utils.ts`           | helper     | Hulpfuncties expensecalculaties               | Forecast & risico           |
| `services/forecast-income-baseline.ts`         | kernlogica | Income baseline voor forecast                 | Forecast & risico           |
| `services/forecast-income-utils.ts`            | helper     | Hulpfuncties inkomenscalculaties              | Forecast & risico           |
| `services/forecast-month-math.ts`              | kernlogica | Kernrekenregels maandforecast                 | Forecast & risico           |
| `services/forecast-reference.ts`               | helper     | Referentiedatumlogica forecast                | Forecast & risico           |
| `services/forecast-refresh.ts`                 | kernlogica | Dirty/fresh en herberekeningstriggers         | Forecast & risico           |
| `services/forecast-timeline-events.ts`         | kernlogica | Timeline event persistence/read               | Forecast & risico           |
| `services/forecast-timeline.ts`                | kernlogica | Timeline event logica                         | Forecast & risico           |
| `services/forecasting.ts`                      | kernlogica | End-to-end forecast opbouw en opslag          | Forecast & risico           |
| `services/import/csv-parser.ts`                | kernlogica | CSV inleesparser                              | Import-pipeline             |
| `services/import/import-flow-state.ts`         | kernlogica | Importflowstatus en state                     | Import-pipeline             |
| `services/import/import-runner.ts`             | kernlogica | Uitvoering importpipeline                     | Import-pipeline             |
| `services/import/import-source.ts`             | kernlogica | Importbronkeuze en routing                    | Import-pipeline             |
| `services/import/import-web-drop.ts`           | helper     | Web drag/drop handling                        | Import-pipeline             |
| `services/import/index.ts`                     | kernlogica | Import entry/orchestratie                     | Import-pipeline             |
| `services/import/normalizer.ts`                | kernlogica | Normalisatie importrecords                    | Import-pipeline             |
| `services/import/pdf-parser.ts`                | kernlogica | PDF parser                                    | Import-pipeline             |
| `services/import/rabobank-pdf-ai-mapper.ts`    | helper     | Rabobank PDF veldmapping                      | Import-pipeline             |
| `services/import/transaction-import-match.ts`  | kernlogica | Matching/dedupe imported transacties          | Import-pipeline             |
| `services/import/transaction-import-parser.ts` | kernlogica | Parser naar transactiemodel                   | Import-pipeline             |
| `services/import/types.ts`                     | helper     | Typedefinities import                         | Import-pipeline             |
| `services/income-semantics.ts`                 | kernlogica | Inkomenssemantiek en compensaties             | Semantiek                   |
| `services/insights-category-summary.ts`        | kernlogica | Categorie-overzichtmodel voor Insights        | Insights-selectoren         |
| `services/insights-forecast-card.ts`           | kernlogica | Forecastkaartmodel                            | Insights-selectoren         |
| `services/insights-highlight-history.ts`       | helper     | Historiek voor repeat suppression             | Insights-selectoren         |
| `services/insights-highlights.ts`              | kernlogica | Selectie, confidence en dedupe insights       | Insights-selectoren         |
| `services/insights-month-context.ts`           | kernlogica | Maandcontextstatus en summary                 | Insights-selectoren         |
| `services/insights-remaining-month.ts`         | kernlogica | Rest-maand berekening                         | Insights-selectoren         |
| `services/insights-upcoming-moments.ts`        | kernlogica | Komende momenten selectie                     | Insights-selectoren         |
| `services/latest-known-balance.ts`             | kernlogica | Laatste bekende saldo bron                    | Insights-selectoren         |
| `services/month-forecast-summary.ts`           | kernlogica | Maandforecast-summary loader                  | Forecast & risico           |
| `services/openai-proxy.ts`                     | kernlogica | Proxylaag naar AI endpoint en AI-telemetrie   | Infra & basislaag           |
| `services/admin-access.ts`                     | helper     | Adminrol en toegangsbepaling                  | Beheerlagen                 |
| `services/ai-route-settings.ts`                | helper     | Laden en wijzigen van AI route-instellingen   | Beheerlagen                 |
| `services/ai-review-inbox.ts`                  | helper     | Review-inbox ophalen en bijwerken             | Beheerlagen                 |
| `services/ai-usage.ts`                         | helper     | AI-verbruiksoverzicht                         | Beheerlagen                 |
| `services/own-account-transfer-heuristics.ts`  | helper     | Heuristieken interne overboekingen            | Bankrekeningen              |
| `services/pattern-normalization.ts`            | helper     | Tekstnormalisatie voor matching               | Infra & basislaag           |
| `services/rare-subscriptions.ts`               | helper     | Detectie minder frequente abonnementspatronen | Subscriptions & herhaling   |
| `services/subscriptions.ts`                    | kernlogica | Abonnementprofielen en koppelingen            | Subscriptions & herhaling   |
| `services/supabase.ts`                         | kernlogica | Database/auth client                          | Infra & basislaag           |
| `services/transaction-ai-categorization.ts`    | kernlogica | AI hercategorisatie per transactie            | Transacties & categorisatie |
| `services/transaction-data-cleanup.ts`         | helper     | Opschoning details/legacy velden              | Transacties & categorisatie |
| `services/transaction-details.ts`              | helper     | Detailopbouw transacties                      | Transacties & categorisatie |
| `services/transaction-month-options.ts`        | kernlogica | Maandselectie en periodeopties                | Transacties & categorisatie |
| `services/transaction-rule-management.ts`      | kernlogica | Regelbeheer tegenpartij/categorie             | Transacties & categorisatie |

---

## Compleetheidscheck

- Totaal routes gevonden in `app/`: `27`
- Totaal services gevonden in `services/` (inclusief tests): `125`
- Totaal non-test servicefiles in matrix: `73`
- Routes opgenomen in route matrix: `27`
- Services opgenomen in service matrix: `73`
- Resultaat: volledige dekking van alle huidige routes en alle non-test services in deze codebase.

## Gebruik van dit document

- Voor mensen: snelle productcontext + betrouwbare featurekaart.
- Voor AI: complete functionele mapping met statuslabels en domeingrenzen.
- Voor pitch: secties `Budio in 1 minuut`, `Waarom Budio` en `Wat kan Budio nu?` zijn direct herbruikbaar.
