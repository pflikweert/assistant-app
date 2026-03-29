# Budio Cockpit Migration Map

## Doel

Deze map vertaalt de bestaande repo-opbouw naar de nieuwe cockpitarchitectuur. Het doel is niet om meteen te hernoemen of breed te refactoren, maar om expliciet vast te leggen wat behouden, aangepast, samengevouwen of afgebouwd wordt.

De Home-truth en beslisvolgorde worden aanvullend vastgelegd in `docs/BUDIO_HOME_CONTRACT.md`.

## Migratieregel

- verander nog geen interne route- of servicenames puur om producttaal te laten aansluiten
- gebruik deze map om eerst de productrol en beslisarchitectuur te bepalen
- pas daarna selectief code en surfaces aan

## Schermen Naar Nieuwe Cockpitrol

| Huidig item | Huidige rol | Nieuwe cockpitrol | Actie | Belangrijkste afhankelijkheden | Grootste risico |
| --- | --- | --- | --- | --- | --- |
| `app/(tabs)/index.tsx` | Dashboard/overzicht | Primair cockpit-home | `aanpassen` | latest-known-balance, forecast, budget surface, risk/selectors, explainability | home blijft te veel doorverwijzen in plaats van antwoorden |
| `app/(tabs)/budget.tsx` | Budgetsturing | Onderliggende stuurmotor voor veilige ruimte en tempo | `aanpassen` | budget-plan, budget-risk, week guardrails, reserve rules | Budget blijft productidentiteit i.p.v. motorlaag |
| `app/budget/setup.tsx` | Begeleide budget-instelflow | Utility/subflow voor voorstel, analyse en verfijning | `toevoegen` | budget-plan, budget-coach, reserve rules, income preview, setup sheets | flow wordt alsnog een tweede budgethome |
| `app/(tabs)/insights.tsx` | Uitleg en analyse | Verdiepende uitleglaag achter home | `samenvouwen` | insights selectors, forecast timeline, explainability | parallel productgevoel naast home |
| `app/(tabs)/transactions.tsx` | Transactielijst en correctie | Begrip- en correctielaag die home voedt | `behouden` | categorization, rules, filters, detailflow | te veel primaire aandacht voor browsegedrag |
| `app/subscriptions.tsx` | Abonnementenbeheer | `Subscription Assassin` utilitylaag | `aanpassen` | subscriptions, rare-subscriptions, reserve rules | blijft passief beheer in plaats van actiegerichte bespaarlaag |
| `app/transaction-detail.tsx` en `app/transactions/[id].tsx` | Detailcorrectie | Ondersteunende correctielaag | `behouden` | transaction details, AI categorization, rules | detailflow wordt te zwaar voor dagelijks moment |
| `app/bankrekeningen.tsx` | Rekeningenbeheer | Utilitylaag voor scope, bronnen en instellingen | `behouden` | bank accounts, finance scope, account rules | te veel gebruikersoppervlak voor interne complexiteit |
| `app/category-budget-groups.tsx` | Budgetgroepbeheer | Backoffice-achtige utilitylaag | `samenvouwen` | category budget groups, budget plan | blijft te zichtbaar voor eindgebruiker |
| `app/import-control.tsx`, `app/import-afronden.tsx`, `app/csv-import.tsx`, `app/accounts/link.tsx` | Importketen | Datatoevoerlaag voor cockpit | `behouden` | import runner, parser, matching, account linking | import wordt productmatig te centraal |
| `help-assistant` | Chat-/hulpassistent | Contextuele `Money Copilot` | `aanpassen` | help-assistant orchestration, financial context, issue flow | chat-first productidentiteit |
| `app/(tabs)/settings.tsx` | Instellingen | Utility- en beheerlaag | `behouden` | auth/settings flows | te veel route-centrale productnavigatie |
| `app/admin/index.tsx` | AI admin | Interne observabilitylaag | `behouden` | ai route settings, usage, review inbox | lekt productmatig naar eindgebruikersdenken |
| `app/insights-legacy.tsx` | Oude inzichtenflow | Legacy referentie | `afbouwen` | legacy routing, fallbackpaden | blijft oude productstructuur onnodig in leven |

## Services Naar Nieuwe Cockpitrol

| Servicefamilie | Voorbeelden | Nieuwe cockpitrol | Actie | Afhankelijkheden | Grootste risico |
| --- | --- | --- | --- | --- | --- |
| Balans- en scopewaarheid | `latest-known-balance`, `finance-scope`, `bank-accounts`, `forecast-account-rules` | Canonieke home truth anchor | `behouden` | account metadata, money view scope, balance parsing | cockpit krijgt geen stabiele “waar sta ik nu”-bron |
| Budgetmotor | `budget-plan*`, `budget-risk`, `budget-week-*` | Stuurt veilige ruimte en tempo | `aanpassen` | budget settings, reserves, forecast coupling | budget blijft als los subsysteem aanvoelen |
| Forecastmotor | `forecast*`, `month-forecast-summary`, `forecast-timeline*` | Vooruitblik, cash-risico en komende momenten | `behouden` | refresh, event normalization, summary adapters | forecasting blijft technisch zichtbaar i.p.v. productmatig rustig |
| Reserve- en seizoenslaag | `reserve-rules`, `reserve-surface`, `rare-subscriptions` | `Autopilot Reserves` fundament | `aanpassen` | budget plan, reserve UI, subscriptions | reservebetekenis blijft onduidelijk voor gebruiker |
| Subscriptionlaag | `subscriptions`, delen van `analysis` en recurring logic | `Subscription Assassin` fundament | `aanpassen` | transaction matches, profile rules, forecast events | blijft lijstbeheer zonder actie-impact |
| Cockpit-uitleg en safety | `financial-surface-semantics`, `safety-spend-window`, `explainability`, `confidence-model` | Kern van cockpitlabels en veilige ruimte | `behouden` | balance/forecast inputs, reserve surface | begrippen lopen productmatig uit elkaar |
| Insights-selectoren | `insights-*` | Achterliggende verklaringslaag voor home | `samenvouwen` | forecast summary, category groups, history | dubbele uitleg op home en insights |
| Help Assistant / Money Copilot | `help-assistant-*`, `openai-proxy`, `ai-use-cases` | Contextuele uitleg- en advieslaag | `aanpassen` | financial context, hydration, screen context | AI wordt alsnog los chatkanaal |
| Correctie en begrip | `categorization*`, `transaction-*`, `analysis` | Begrip, herstel en datakwaliteit | `behouden` | detailflow, filters, rules | te veel focus op handmatig beheer in primair productmoment |
| Import en acquisitie | `services/import/*` | Datatoevoerlaag | `behouden` | CSV/PDF parsing, matching, account linking | importbeslissingen bepalen onnodig de cockpitstructuur |
| Admin en observability | `admin-*`, `ai-usage`, `ai-review-inbox`, `ai-route-settings` | Interne besturingslaag | `behouden` | admin auth, usage logging | mengt zich met eindgebruikersproduct |

## Doorwerking Van Het Home-Contract

### Dashboard / Home

Home wordt gevoed door:

- balans- en scopewaarheid
- safety-spend-window en forecastsamenvatting
- budgettempo en reserve-oppervlak
- risicoselectoren en explainability

Home is primair bedoeld voor:

- `Veilig tot volgende inkomen` als leidend antwoord
- `Nu vrij` als secundaire context
- maximaal 1 dominante risicokaart
- exact 1 dominante actiekaart
- compact blok `Reserves & buffer`

Niet meer bedoeld als primaire Home-content:

- gelijkwaardige dashboardgrids
- losse budget- of trendkaarten zonder directe besliswaarde
- standaard subscription-optimalisatiekaarten
- browseblokken die vooral doorverwijzen

### Budget

Budget voedt Home met:

- tempo-, guardrail- en budgetdruksignalen
- input voor veilige ruimte
- reserve- en beschermlogica

Niet bedoeld als primaire Home-content:

- budgetbeheer en categorie-inrichting
- week- en maandmechaniek in detail
- instellingen, overrides en beheerflows

### Insights

Insights voedt Home met:

- forecastuitleg en trendcontext
- verklaringen achter `Komende risico's`
- concrete `Komende momenten` als die aantoonbaar besliswaarde hebben

Niet bedoeld als primaire Home-content:

- meerdere analysekaarten tegelijk
- uitgebreide timelines en maandvergelijkingen
- parallelle productnarratieven naast Home

### Subscriptions

Subscriptions voedt Home met:

- signalen voor subscription optimization als lagere prioriteitsactie
- uitzonderlijk een Home-risico als er nabije, aantoonbare cash-impact of tijdsgevoelig financieel risico is

Niet bedoeld als primaire Home-content:

- profiel- of regelbeheer
- lijsten met gekoppelde betalingen
- algemene bespaar- of optimalisatieverhalen zonder nabij financieel risico

### Help Assistant / Money Copilot

Help Assistant / Money Copilot voedt Home met:

- uitleg van bestaande Home-waarheid
- context bij het dominante risico of de dominante actie
- detailuitleg over de split tussen buffer en concrete reserveringen

Niet bedoeld als primaire Home-content:

- een los chat-first hoofdmoment
- speculatieve nieuwe waarheid
- parallelle prioritering buiten de vaste Home-volgorde

## Samenvouwrichtingen

Deze oppervlakken horen productmatig dichter naar home te bewegen, zonder nu al een rename- of route-sweep te doen:

- inzichten over `veilige ruimte`, `verwacht eindsaldo` en `komende risico's`
- uitleg waarom een maand krap of stabiel voelt
- subscription-waarde en reserve-impact
- beste volgende actie

Dat betekent:

- eerst selectors, termen en prioriteitsregels harmoniseren
- daarna home verrijken
- pas daarna schermen versmallen of visueel afbouwen
- subscription-optimalisatie blijft daarbij standaard buiten `Komende risico's`, tenzij een nabij cash- of tijdsrisico aantoonbaar is

## Afbouwrichtingen

- `insights-legacy` blijft alleen legacy totdat de cockpituitleg stabiel is
- utility-achtige beheeroppervlakken blijven bestaan, maar horen minder zichtbaar te worden als primaire productverhalen

## Afhankelijkheden

Voor een veilige migratie moeten deze volgordes bewaakt worden:

1. productcontract vastleggen
2. home-contract vastleggen
3. cockpitrol per scherm en servicefamilie vastleggen
4. kernbegrippen harmoniseren op home, budget, insights en AI
5. pas daarna selectief UI, selectors en flows herschikken

## Open Migratievragen

- Welke secundaire Home-blokken krijgen later nog een compacte plek op Home, en welke blijven definitief alleen verdiepingslaag?
- Wanneer is `Budget` nog een apart hoofdscherm, en wanneer wordt het vooral een beheerlaag achter home?
- Moet `Insights` uiteindelijk blijven als verdiepend scherm, of grotendeels samenvallen met cockpituitleg?
- Welke utilityschermen mogen zichtbare primaire navigatie behouden, en welke horen alleen via acties of settings bereikbaar te zijn?
