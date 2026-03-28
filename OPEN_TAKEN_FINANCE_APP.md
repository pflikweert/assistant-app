# Openstaande Taken Finance App

## Korte status

De grote herontwerpronde is functioneel klaar. De app heeft nu:

- een herbouwde navigatie en informatie-architectuur
- opnieuw opgebouwde hoofdschermen voor `Dashboard`, `Budget`, `Insights` en
  transactiedetail
- uniforme budget- en risicologica
- een timing-aware forecast met cash-gap-signalen
- budgetgroepbeheer en inkomenssemantiek als extra productlaag

De focus is nu niet meer "opnieuw bouwen", maar:

- afronden en valideren
- visuele polish
- laatste productlagen toevoegen waar ze echt waarde geven

## Nieuwe leerpunten (vastgelegd)

- `Insights` werkt beter als rustige, lineaire scrollpagina zonder extra top-subnavigatie.
- Maandcontext moet altijd expliciet zichtbaar en bedienbaar zijn (maandselector onder hero).
- `Wat valt op` moet inhoudelijk slim filteren, maar niet leegvallen:
  - confidence-gating + semantische dedupe + repeat suppression blijven verplicht
  - repeat suppression moet rekening houden met activiteit (zoals laatste transactiedatum)
  - no-data en stabiele maand tonen altijd een menselijk fallback-inzicht
- Voor `Insights`-informatieblokken werkt een vaste verticale ritmiek van `32px` beter voor rust en scanbaarheid.
- De nieuwe gedeelde modal-shell is nu de standaard voor selectorflows en bottom-sheet modals:
  - backdrop, sheet, handle, close-knop en footer horen centraal in de shell
  - modals en pickerflows bouwen daarbovenop als gedeelde inhoudscomponent
  - nieuwe modalvarianten mogen geen losse sheet- of backdropstyling meer dupliceren
- Forecast-samenvatting werkt het duidelijkst als premium card met:
  - eindsaldo als hoofdsignaal
  - statuschip
  - laagste-saldo subblok
  - korte menselijke uitlegzin
- `Komende momenten` moet productmatig streng blijven:
  - toon alleen betekenisvolle forecastmomenten
  - gebruik echte transactielabels, categorieën en budgetgroepcontext
  - liever een nette empty state dan generieke gokcopy
  - keep forecast/timeline reads schema-safe zolang referentievelden niet overal gegarandeerd beschikbaar zijn
- Web drag & drop in utility-schermen (zoals import) is op Expo Web niet betrouwbaar via alleen React Native `onDrop` op een `View`:
  - gebruik globale DOM listeners op web (`dragenter`, `dragover`, `dragleave`, `drop`)
  - blokkeer browsernavigatie altijd met `preventDefault` + `stopPropagation`
  - accepteer drop alleen binnen het bedoelde doelvlak via hit-test
- Help Assistant werkt beter als OpenAI de intent en route bepaalt:
  - lokale keywordregels mogen niet de bron van waarheid zijn
  - issue-/idee-kaarten moeten als vaste reviewbanner boven de chat blijven staan
  - `Annuleren` moet de kaart direct sluiten en niet laten terugkomen door oude threadstate
  - zichtbare chatcopy moet alleen de verduidelijkende vraag tonen, niet de interne samenvatting
- In `Transacties` toont het bankrekeningfilter alleen actieve rekeningen:
  - gearchiveerde rekeningen verschijnen niet als filteroptie
  - historische transacties blijven zichtbaar via `Alles` en periode/type/categorie-filters
- Testbestanden horen niet in `app/` bij Expo Router:
  - bestanden onder `app/` kunnen als route gebundeld worden
  - Vitest tests voor routewrappers daarom buiten `app/` plaatsen (bijv. onder `services/`)

## Learnings uit sessie 2026-03-25

- In `Budget > Deze maand` werkt de detailmodal stabieler en consistenter met gedeelde transactierijen:
  - summarypills tonen hele euro's met `Math.floor`
  - transactielijst gebruikt `TransactionListRow`
  - `budget_excluded = true` transacties blijven buiten dit overzicht
- In `Budget > Deze maand` moet de budgetactie compact in de transactieregel zelf zitten:
  - geen losse actierij onder de transactie
  - gebruik een kleine inline actiechip rechts in de regel
  - copy moet actiegericht zijn: `Uitsluiten` (uit budget) en `Meenemen` (weer in budget)
  - na `Uitsluiten` verdwijnt de transactie direct uit de maandlijst
- In transactierijen is leeshiërarchie belangrijk:
  - ontvanger bovenaan
  - omschrijving op tweede regel
  - meta/datum in subtiele stijl
- In `Transacties` geeft een compacte header meer rust:
  - zoekveld lager
  - actieve filterchips kleiner
  - per chip een directe `x`-actie om alleen die filter te verwijderen
  - importactie als icoon naast filter, zonder extra grote importkaart
- `Abonnementen` hoort in het headermenu als tekstlink onder sectie `Transacties` (zelfde stijl als `Importeren`), niet in de primaire hoofdlijst.
- In `Transaction Detail > Categorie wijzigen` werkt een duidelijke keuze-flow beter op kleine schermen:
  - moduskeuze `Via AI` of `Handmatig`
  - optieblokken inklapbaar met `Toon opties` / `Verberg opties` (standaard verborgen)
  - compact categoriezoekveld staat vast bovenaan en scrolt niet mee
  - `Via AI` past bij bevestigen dezelfde opties toe als handmatig (bulk op tegenpartij + toekomstige regel)

## Redesign Roadmap

Deze volgorde gebruiken we voortaan als we schermen verder redesignen:

### Stap 1 - Shell Eerst

Doel: één vaste app-basis waar alle schermen op landen.

- topbar-componenten centraliseren
- backdrop- en hero-shells centraliseren
- quick menu en bottom navigation één keer stylen
- modal headers en detail headers hergebruiken
- modal shells, pickerflows en bevestigingspanelen centraliseren
- vaste contentkolom en screen padding gelijk trekken
- hero/topbar-offset per shellfamilie gelijk trekken (gebruik `Transactions` als referentie voor hoofdschermen)

Exit-criteria:

- dezelfde shellgedrag- en spacingregels gelden op Dashboard, Transactions,
  Budget, Insights, Subscriptions en detailpagina's
- geen unieke inline header- of shellstyling meer per scherm
- geen ongewenste verschillen meer in ruimte tussen topbar en hero binnen dezelfde schermfamilie

### Stap 2 - Herbruikbare UI-Bouwstenen

Doel: alle terugkerende visuele patronen als component vastleggen.

- hero shells
- stat blocks
- text blocks
- detail cards
- filter launchers
- list rows
- empty states
- statuspills

Exit-criteria:

- als een patroon op 2 of meer schermen terugkomt, bestaat er een gedeelde component
- schermen leveren vooral inhoud en uitzonderingen aan, geen eigen styling-variant

Update (huidige stand):

- transactierij en transactielijstblok zijn nu als gedeelde componenten ingezet voor `Transactions`, `Dashboard` recents en `Transaction Detail` historie
- detailstatusblokken en calloutblokken zijn gecomponentiseerd (budgetstatus, abonnementscallout, ronde icon-knop)
- budget-voortgang gebruikt nu een gedeelde component (`FinanceBudgetProgressBar`) op Dashboard (maand + week) met vaste statuskleurregels

### Stap 3 - Scherminhoud Per Scherm Aanpakken

Doel: elk scherm afwerken binnen dezelfde visuele taal.

Volgorde:

1. `Transaction Detail`
2. `Transactions`
3. `Dashboard`
4. `Budget`
5. `Insights`
6. `Subscriptions`
7. `Settings` en utility-schermen

Per scherm:

- hero op basis van de shared shell
- contentzone onder de hero volgens de pattern library
- acties, filters en detailblokken in herbruikbare bouwstenen
- oude unieke styling opruimen zodra de gedeelde variant staat

Exit-criteria:

- scherm ziet duidelijk uit als onderdeel van dezelfde app-familie
- dezelfde componenten worden hergebruikt in plaats van herbouwd

### Stap 4 - Standaardisatie En Opruimen

Doel: voorkomen dat er opnieuw losse varianten ontstaan.

- inline styles verplaatsen naar gedeelde componenten of tokens
- oude schermspecifieke shells verwijderen
- spacing- en typografieregels expliciet in docs vastleggen
- nieuwe uitzonderingen alleen toestaan met een duidelijke reden

Exit-criteria:

- nieuwe schermen kunnen worden opgebouwd door bestaande componenten te combineren
- losse stijl-duplicatie is zichtbaar afgenomen

### Stap 5 - QA En Final Polish

Doel: de uitwerking afmaken zonder nieuwe patronen te introduceren.

- mobile/web-vergelijking
- header-, hero- en footer-ritme nalopen
- aria/focus gedrag nalopen
- performance en scroll-gedrag nalopen
- laatste visuele verschillen per scherm wegwerken
- expliciete offset-check: `Dashboard`, `Transactions`, `Settings`, `Subscriptions` hebben gelijk hero/topbar-ritme
- expliciete breedte-check utilityschermen: content onder hero gebruikt gecentreerde `max-width` (geen onbedoelde full-width op desktop)

Exit-criteria:

- schermen voelen consistent, rustig en compleet
- geen onverwachte scroll-, focus- of shellproblemen meer

## Wat nu echt openstaat

### Hoogste prioriteit

- Handmatige en inhoudelijke validatie op forecastbedragen:
  - maandrapportbedragen kloppen nog niet overal exact
  - reconciliatie nodig tussen `actueel + resterende budgetforecast` en wat in
    `Insights > Maandrapport` getoond wordt
  - extra controle nodig op huidige maand voor:
    - variabel inkomen
    - variabele kosten
    - netto resultaat na herberekening
- Handmatige QA op forecastbron:
  - `Trend` versus `Budgetplan` in `Budget > Beheer`
  - zichtbaarheid van de actieve bron in `Insights > Voorspelling`
  - toekomstmaanden gebruiken hun eigen ingestelde maandbudgetten waar aanwezig
  - logisch refreshgedrag na budget-save, categoriseren en abonnementwijzigingen
- Handmatige QA op budgetweken:
  - maanden die midden in een week starten
  - maanden die midden in een week eindigen
  - eerste en laatste overlapweek tonen logische deelbudgetten
  - opvolgende maand neemt bij open vorige maand het herverdeelde overlapbudget goed mee
  - categorie-weekbudgetten volgen dezelfde daggewogen verdeling
- Handmatige QA op budgetgroepbeheer:
  - lange categorienamen
  - zoeken en filteren
  - refreshgedrag na wijzigen
  - consistentie tussen `Transactions`, detail, `Budget` en `Insights`
- Handmatige QA op inkomenssemantiek:
  - belastingteruggave als incidentele meevaller
  - `KGB` en toeslagen als structureel inkomen
  - `ZVW` en wegenbelasting-correcties als kostencompensatie
  - forecast blijft vrij van eenmalige teruggaves
- Visuele polish in simulator of web:
  - status- en tempocopy nalopen
  - forecaststrip, maandnavigatie en empty states nalopen
  - iconen, spacing en mobile feel nalopen

### Daarna oppakken

- Forecastfundament fase 2 uitbouwen:
  - nieuwe semantieklaag doorzetten naar een echte genormaliseerde eventlaag
  - `reserved balance` en `net worth` expliciet modelleren in selectors en adapters
  - budget-inclusie loskoppelen van forecast- en net-worth-inclusie zonder bestaande schermcontracten direct te breken
  - pas daarna database/persistence-velden en reads/writes aanpassen
- `Rekeningen koppelen` daadwerkelijk uitbouwen:
  - per gevonden rekening een echte matchflow tonen
  - nieuwe rekening aanmaken vanuit een gedeelde sheet
  - `Import controleren` als echte finale bevestigingsstap met importactie
- Herverdeling-preview in `Budget > Beheer` voordat de gebruiker opslaat
- `Wat is veranderd`-laag in `Insights`
- extra coach- of advieskaarten in `Budget` en `Insights`
- verdere verfijning van `Komende momenten` als gedeeld patroon zodra forecast reference-data app-breed stabiel is
- extra schermtests voor de geharmoniseerde flows
- `Bankrekeningen` verder verfijnen:
  - aparte instelling `Tonen in overzicht` toevoegen als later onderscheid nodig is tussen `Alleen overzicht` en `Verborgen`
  - bulkacties of filters toevoegen voor grotere rekeninglijsten
- Spaar-/interne-overboekingsherkenning verdiepen:
  - interne overboekingen bij voorkeur koppelen op echte rekeningrelatie (bron/doel) in plaats van alleen detailtekst
  - gerichte recategorisatie-run voorbereiden zodra rekeningkoppeling hiervoor als betrouwbare bron beschikbaar is
- Help Assistant AI verder verfijnen:
  - routerprompt per schermtype en intentklasse blijven toetsen op edgecases zoals budget + grafiek + dashboard
  - vaste reviewbanner visueel en tekstueel blijven polijsten
  - spending advice en issue-intake alleen nog via de AI-router laten starten, niet via nieuwe hardcoded woordregels
  - aanvullende QA op `Annuleren`, live-updating van de kaart en mobiele/webervaring

### Nog niet af

Deze onderdelen zijn inhoudelijk nog niet "klaar klaar":

- volledige visuele QA op mobile en web
- volledige QA op forecastbron en overlapweken
- allocatiesuggestie voor meevallers
- aparte insightkaart voor ontvangen belastingmeevallers
- herverdeling-preview in budgetbeheer
- `Wat is veranderd`-laag in `Insights`
- eventuele backfill of recategorisatie-run voor oudere transacties als QA dat
  nodig maakt

## Wanneer deze ronde klaar is

Deze huidige afrondronde telt als klaar als:

- forecastbron `Trend` versus `Budgetplan` stabiel werkt
- overlapweken in budget logisch voelen in echte maandscenario's
- budgetgroepbeheer en inkomenssemantiek handmatig zijn nagekeken
- `Settings`, `Subscriptions` en `Transaction Detail` visueel voldoende gepolijst zijn
- er geen grote regressies meer zitten in forecast-refresh, budgetsave of
  categorisatieflows

## Fase-overzicht

### Fase 1 - Herontwerp en herstel kernflows

Status: afgerond

Afgerond:

- Dashboard herontworpen en opnieuw opgebouwd
- Transactielijst herontworpen en opnieuw opgebouwd
- `Transaction Detail` herontworpen en opnieuw opgebouwd
- `Budget` en `Insights` opnieuw gestructureerd als samenhangend duo
- `Budget` teruggebracht naar `Week`, `Maand` en `Beheer`
- `Insights` teruggebracht naar `Trends`, `Voorspelling` en `Controle`
- budget-weekdetail, buiten-budget en maanddrilldowns hersteld
- categorie-detail drilldown toegevoegd vanuit `Budget > Maand`
- transactie-iconen app-breed gekoppeld aan echte transactiecategorieen
- Google Material iconensysteem met lokale fonts ingevoerd

### Fase 2 - Logica, semantiek en forecast

Status: grotendeels afgerond, nog QA en afronding

Afgerond:

- risicobalken en risk-logic uniform gemaakt
- `Nog vrij te besteden`, status en weektempo semantisch gelijkgetrokken op
  dashboard, budget en insights
- week-attentionlogica verplaatst naar gedeelde helper met unit tests
- forecast fallbacklogica verbeterd met recente volledige maanden
- forecastscenario's uitgebreid voor weinig historie en oude uitschieters
- timing-aware forecast toegevoegd voor inkomsten en vaste uitgaven
- toekomstmaanden in `Insights > Voorspelling` gebruiken nu hun eigen
  maand-specifieke budgetplan in plaats van het huidige maandplan
- forecastmodel uitgebreid met `booked`, `remaining`, `expected_cash_out_total`,
  `savings_outflow` en `forecast_reference_date`
- forecast-refreshlaag toegevoegd met user-specifieke dirty/stale-aansturing
- handmatige refreshknop toegevoegd in `Settings` om forecast opnieuw te
  berekenen
- dirty-marking doorgetrokken naar categorisatie-, budget-, budgetgroep- en
  abonnementprofielwijzigingen
- forecast-uitgavenbron instelbaar gemaakt:
  - `Trend`
  - `Budgetplan`
- budget weekverdeling daggewogen gemaakt:
  - vorige maand telt mee in de eerste overlapweek
  - volgende maand telt mee in de laatste overlapweek
  - categorie-weekbudgetten volgen dezelfde verdeling
- als de vorige maand nog open staat, erft de eerste overlapweek van de
  volgende maand nu het herverdeelde laatste weekbudget van die open maand
- `Insights > Voorspelling` toont nu:
  - eindsaldo, laagste saldo en status
  - maandstrip voor huidige maand plus 6 maanden vooruit
  - maandoverzicht met `geboekt` versus `nog verwacht`
  - aparte regels voor `uitgaven` en `naar sparen`
- status- en tempocopy verder gelijkgetrokken
- relevante unit tests toegevoegd of uitgebreid

Nog open binnen deze fase:

- bedragen in `Insights > Maandrapport` nog volledig reconciliëren met het
  centrale forecastmodel, vooral in de huidige maand
- handmatige QA op forecastbron
- handmatige QA op overlapweken
- handmatige QA op forecast-refreshstatus en refreshflows

### Fase 3 - Productverdieping en beheerlagen

Status: grotendeels afgerond, nog QA

Afgerond:

- `Verborgen`-laag toegevoegd in `Insights` voor zeldzame abonnementen
- budgetgroepbeheer per categorie toegevoegd in `Settings`
- user-specifieke override-laag toegevoegd voor budgetgroepen
- effectieve budgetgroepen doorgetrokken naar:
  - `Transactions`
  - `Transaction Detail`
  - `Budget`
  - `Insights`
  - `analysis-detail`
- budgetgroep-indeling van account `pflikweert` gepromoveerd naar systeemdefault

Nog open binnen deze fase:

- QA op budgetgroepbeheer
- eventueel extra schermtests voor beheerflows

### Fase 4 - Inkomenssemantiek voor teruggaves en overheidsontvangsten

Status: functioneel grotendeels klaar, productlaag nog niet af

Afgerond:

- gedeelde helper `resolveIncomeSemantics(...)` toegevoegd
- onderscheid live tussen:
  - structureel inkomen
  - incidentele belastingmeevallers
  - kostencompensaties
- `Budget` en `Forecast` gebruiken eenmalige teruggaves niet meer als vaste
  inkomensbasis
- `Insights` toont inkomsten uitgesplitst naar structureel, variabel,
  meevallers en kostencompensaties
- `Transactions` en `Transaction Detail` tonen de actieve inkomensduiding
- positieve `Belastingdienst`-correcties voor wegenbelasting ook heuristisch
  herkend
- unit tests toegevoegd voor income/refund-semantiek

Nog open binnen deze fase:

- aparte nudge of insightkaart voor `belastingmeevaller ontvangen`
- eenvoudige allocatiesuggestie:
  - eerst buffer
  - daarna jaarlijkse reserveringen
  - daarna spaardoel of schuld
- eventuele backfill of recategorisatie-run voor bestaande transacties

### Fase 5 - Verdere productverdieping

Status: gepland

Gepland:

- herverdeling-preview in `Budget > Beheer`
- `Wat is veranderd`-laag in `Insights`
- verdere verfijning van coach- en advieskaarten

### Fase 6 - Verdere polish en harmonisatie

Status: in uitvoering

Afgerond:

- `Settings` verder geharmoniseerd:
  - Nederlandstalige copy
  - logischere beheerstructuur
  - abonnementenbeheer directer bereikbaar
  - misleidende lokale weergavetoggle vervangen
- `Subscriptions` voorzien van overzichtskaart en duidelijkere sectie-opbouw
- `Transaction Detail` verder afgestemd op de abonnementenflow met statuschips
- web-fix toegevoegd voor de Material icon wrapper zodat style-arrays op web
  niet meer als ruwe CSS-style doorlekken
- extra tests toegevoegd voor:
  - budget save flows in `budget-plan-repository`
  - forecast-inkomensfilters voor structureel inkomen versus meevallers

Nog open binnen deze fase:

- volledige simulator-polish op spacing, animatie en mobile feel
- extra visuele QA op mobile interacties in `Settings`, `Subscriptions` en
  `Transaction Detail`
- eventueel nog schermtests toevoegen voor de geharmoniseerde flows

## Ideeën en backlog

### Kansrijke ideeën

- kleine timeline in `Insights`:
  - budget aangepast
  - risico veranderd
  - forecast verbeterd of verslechterd
- positieve feedbacklaag:
  - weken op rij onder budget
  - maandbuffer beter dan vorige maand
  - spaardoel sneller gehaald dan verwacht
- dashboard- of budgetnudges op basis van `lowest_expected_balance` of
  cash-gap-risico

### Forecast backlog

Niet blokkerend, wel waardevol voor later:

- seizoensinkomsten expliciet modelleren:
  - vakantiegeld
  - bonus
  - dertiende maand
- belastingteruggaves en fiscale correcties verder verfijnen voor
  uitzonderlijke patronen en seizoensgevallen
- forecastkaart uitbreiden naar dagniveau of mini-timeline
- modellering van variabele uitgaven verfijnen met seizoenspatronen of
  maandprofielen

## Open productvragen

- Willen we `Budget > Beheer` uiteindelijk als eigen scherm in plaats van als
  tab-segment?
- Willen we buiten-budget transacties ook direct recategoriseerbaar maken
  vanuit `Budget`?
- Willen we forecastbewerkingen expliciet tonen als `verwacht` versus
  `geboekt` per categorie?
- Willen we voor meevallers een vaste verdelingsnudge tonen richting buffer,
  jaarlijkse lasten en spaardoelen?

## UI/Design hardening open acties (na huidige batches)

- Grote cleanup van style literals in productsurfaces:
  - vooral `app/(tabs)/budget.tsx`, `app/transaction-detail.tsx`,
    `components/bank-accounts/bank-account-form-sheet.tsx`
  - literals gefaseerd vervangen door `FinTokens.spacing`,
    `FinTokens.typography` en gedeelde atomics
- Logic leakage verder reduceren:
  - renderpad-berekeningen uit `Dashboard`, `Budget`, `Insights`,
    `Transactions` centraliseren in selectors/`services/ui-formatters`
  - UI-componenten alleen formatteren en renderen
- Interactiepatronen verder harmoniseren:
  - overgebleven `TouchableOpacity`/`Pressable` op productoppervlakken
    migreren naar `FinanceButton` of `FinancePressableSurface`
- Inventory/governance:
  - `screen-inventory` up-to-date houden bij routewijzigingen
  - shell-check lijst uitbreiden wanneer extra routes canoniek zijn gemaakt
- Lint/tooling:
  - resterende warnings opruimen in testbestanden (`import/first`,
    `Array<T>`-notatie, oude eslint-disable comment)
