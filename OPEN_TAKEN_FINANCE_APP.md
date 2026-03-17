# Openstaande Taken Finance App

## Huidige status

De grote herontwerpronde is inhoudelijk afgerond. De app heeft nu een nieuwe
informatie-architectuur, herbouwde hoofdschermen, uniforme budget- en
risicologica, verbeterde drilldowns en een timing-aware forecast met
cash-gap-signalen.

De laatste productlaag is ook al verder ingevuld:
- Insights heeft nu een extra laag voor zeldzame of verborgen abonnementen
- `Insights > Voorspelling` is herzien naar een echte maandcashflow met:
  - expliciete split tussen `geboekt` en `nog verwacht`
  - aparte cash-out naar sparen
  - huidige maand plus 6 maanden vooruit
  - timing uit recurring historie, subscription profiles en zeldzame abonnementen
  - dirty/stale recompute-aansturing met handmatige refreshknop
- forecast kan nu schakelen tussen `Trend` en `Budgetplan` als bron voor
  toekomstige uitgaven
- budgetweken worden nu daggewogen verdeeld, inclusief overlap met vorige en
  volgende maand in de eerste en laatste kalenderweek
- budgetgroepbeheer per categorie is live in `Settings`
- de app gebruikt nu effectieve budgetgroepen in `Budget`, `Insights`,
  transactielijst en transactiedetail
- de huidige budgetgroep-indeling van account `pflikweert` is gepromoveerd naar
  systeemdefault voor alle gebruikers
- inkomenssemantiek maakt nu onderscheid tussen structureel inkomen,
  incidentele belastingmeevallers en kostencompensaties
- Fase 6 is gestart met harmonisatie van `Settings`, `Subscriptions` en
  `Transaction Detail`, plus extra testdekking voor budget-save en forecast

De volgende stap is niet meer "groot herbouwen", maar gericht afronden:
- visuele QA en polish van de nieuwe interface
- laatste productlagen toevoegen waar nog duidelijk waarde zit
- spaarnudges en allocatie-advies verder verdiepen voor meevallers en reserves

## Afgerond per fase

### Fase 1 - Herontwerp en herstel kernflows

- Dashboard herontworpen en geïmplementeerd
- Transactielijst herontworpen en geïmplementeerd
- Transaction detail herontworpen en geïmplementeerd
- Budget en Insights opnieuw gestructureerd als samenhangend duo
- Budget teruggebracht naar `Week`, `Maand` en `Beheer`
- Insights teruggebracht naar `Trends`, `Voorspelling` en `Controle`
- Budget weekdetail, buiten-budget en maanddrilldowns hersteld
- Categorie-detail drilldown toegevoegd vanuit `Budget > Maand`
- Transactie-iconen app-breed gekoppeld aan echte transactiecategorieen
- Google Material iconensysteem met lokale fonts ingevoerd

### Fase 2 - Logica, semantiek en forecast

- Risicobalken en risk-logic uniform gemaakt
- `Nog vrij te besteden`, status en weektempo semantisch gelijkgetrokken op dashboard, budget en insights
- Week attentionlogica verplaatst naar gedeelde helper met unit tests
- Forecast fallbacklogica verbeterd met recente volledige maanden
- Forecastscenario's uitgebreid voor weinig historie en oude uitschieters
- Timing-aware forecast toegevoegd voor komende inkomsten en vaste uitgaven
- Insights toont nu laagste verwachte saldo, eerstvolgende verwachte beweging en cash-gap waarschuwing
- Forecastmodel uitgebreid met:
  - `booked` versus `remaining`
  - `expected_cash_out_total`
  - aparte `savings_outflow`
  - `forecast_reference_date`
- Forecast-refreshlaag toegevoegd met:
  - user-specifieke `forecast_refresh_state`
  - lazy recompute alleen bij `dirty` of `stale`
  - geplande achtergrond-refresh na categorisatie-, budget-, budgetgroep- of
    abonnementprofielwijzigingen
  - handmatige actie `Voorspelling vernieuwen` in `Insights`
- Forecast-uitgavenbron is nu instelbaar in `Budget > Beheer`:
  - `Trend`
  - `Budgetplan`
- Budget weekverdeling rekent nu per kalenderdag:
  - vorige maand telt mee in de eerste overlapweek
  - volgende maand telt mee in de laatste overlapweek
  - categorie-weekbudgetten volgen dezelfde daggewogen verdeling
- `Insights > Voorspelling` toont nu:
  - herokaarten voor eindsaldo, laagste saldo en status
  - maandstrip voor huidige maand plus 6 maanden vooruit
  - maandoverzicht met `geboekt` versus `nog verwacht`
  - aparte regels voor `uitgaven` en `naar sparen`
- Remote migratie uitgevoerd voor:
  - `monthly_cashflow_forecasts` cash-gap velden
  - `password_reset_events`
- Status- en tempocopy verder gelijkgetrokken op dashboard, budget en insights
- Budget Beheer-copy gepolijst en categorie-iconen consistenter gemaakt in budget-overzichten
- Unit tests toegevoegd of uitgebreid voor:
  - budget risk
  - week attention
  - forecast fallback
  - forecast timeline
  - category icon mapping

### Fase 3 - Productverdieping en beheerlagen

- `Verborgen` laag toegevoegd in `Insights` voor zeldzame abonnementen:
  - `1x per jaar`
  - `2x per jaar`
  - `1x gezien`
- Budgetgroepbeheer per categorie toegevoegd in `Settings`
- Nieuwe user-specifieke override-laag toegevoegd voor budgetgroepen
- Effectieve budgetgroepen doorgetrokken naar:
  - `Transactions`
  - `Transaction Detail`
  - `Budget`
  - `Insights`
  - `analysis-detail`
- Systeemdefaults voor budgetgroepen gelijkgetrokken met de actuele indeling van
  account `pflikweert`

## Wat nu nog openstaat

### Directe volgende acties

- Handmatige visuele QA in simulator of web:
  - status- en tempocopy nalopen
  - forecaststrip, maandnavigatie en empty states nalopen
  - iconen nalopen op variantkeuze, mapping en spacing per scherm
- QA op nieuwe forecaststuring:
  - `Budget > Beheer` bronwissel `Trend` versus `Budgetplan`
  - `Insights > Voorspelling` toont de actieve bron duidelijk
  - refreshstatus blijft logisch na budget-save, categoriseren en abonnementwijzigingen
- QA op overlapweken in budget:
  - maanden die midden in de week starten
  - maanden die midden in de week eindigen
  - eerste en laatste week tonen logische deelbudgetten per categorie
- QA op budgetgroepbeheer:
  - lange categorienamen
  - zoeken en filteren
  - refreshgedrag na wijzigen
  - consistentie tussen `Transactions`, detail en `Insights`
- QA op inkomenssemantiek:
  - belastingteruggave zichtbaar als incidentele meevaller
  - `KGB` en toeslagen zichtbaar als structureel inkomen
  - `ZVW` en wegenbelasting-correcties zichtbaar als kostencompensatie
  - forecast blijft vrij van eenmalige teruggaves
- QA op forecastherziening:
  - huidige maand toont logische `geboekt` en `nog verwacht` waardes
  - sparen telt mee in cash-out maar niet in gewone uitgaven
  - toekomstmaanden ketenen eindsaldo naar volgende maand
  - historische maanden tonen geen resterende momenten meer
  - dirty/stale refreshstatus en handmatige forecast-refresh correct nalopen

### Fase 4 - Inkomenssemantiek voor teruggaves en overheidsontvangsten

- Gedeelde helper `resolveIncomeSemantics(...)` toegevoegd
- Onderscheid live tussen:
  - structureel inkomen
  - incidentele belastingmeevallers
  - kostencompensaties
- `Budget` en `Forecast` gebruiken eenmalige teruggaves niet meer als vaste
  inkomensbasis
- `Insights` toont inkomsten nu uitgesplitst naar structureel, variabel,
  meevallers en kostencompensaties
- `Transactions` en `Transaction Detail` tonen de actieve inkomensduiding
- Positieve `Belastingdienst`-correcties voor wegenbelasting worden nu ook
  heuristisch herkend
- Unit tests toegevoegd voor income/refund-semantiek

Wat binnen dit thema nog openstaat:
- aparte nudge of insightkaart voor `belastingmeevaller ontvangen`
- eenvoudige allocatiesuggestie:
  - eerst buffer
  - daarna jaarlijkse reserveringen
  - daarna spaardoel of schuld
- backfill of recategorisatie-run voor bestaande transacties als QA laat zien
  dat oudere data nog scheef staat

### Fase 5 - Verdere productverdieping

- Herverdeling-preview in `Budget > Beheer` voordat de gebruiker opslaat
- `Wat is veranderd` laag in Insights
- Eventueel categorieadvies- of coachkaarten verfijnen

### Fase 6 - Verdere polish en harmonisatie

- `Settings` verder geharmoniseerd:
  - Nederlandstalige copy
  - logische beheerstructuur
  - abonnementenbeheer direct bereikbaar vanuit settings
  - misleidende lokale weergavetoggle vervangen door neutrale statusregel
- `Subscriptions` voorzien van overzichtskaart en duidelijkere sectie-opbouw
- `Transaction Detail` verder afgestemd op de abonnementenflow met statuschips
  voor gekoppelde of verdachte PSP-betalingen
- Unit tests toegevoegd voor:
  - budget save flows in `budget-plan-repository`
  - forecast-inkomensfilters voor structureel inkomen versus meevallers

Wat binnen Fase 6 nog openstaat:
- volledige simulator-polish op spacing, animatie en mobile feel
- extra visuele QA op mobile interacties in `Settings`, `Subscriptions` en
  `Transaction Detail`
- eventueel nog schermtests toevoegen voor de geharmoniseerde flows

## Forecast backlog

Deze punten zijn niet meer blokkerend, maar wel waardevol voor een volgende
forecast-iteratie:

- Seizoensinkomsten expliciet modelleren:
  - vakantiegeld
  - bonus
  - dertiende maand
- Belastingteruggaves en fiscale correcties verder verfijnen in forecasting voor
  uitzonderlijke patronen en seizoensgevallen
- `lowest_expected_balance` of cash-gap-risico ook gebruiken in dashboard- of budgetnudges
- forecastkaart eventueel nog uitbreiden naar dagniveau of mini-timeline binnen de maand
- modellering van variabele uitgaven verder verfijnen met seizoenspatronen of maandprofielen

## Ideeën

- Kleine timeline in Insights:
  - budget aangepast
  - risico veranderd
  - forecast verbeterd of verslechterd
- Positieve feedbacklaag:
  - weken op rij onder budget
  - maandbuffer beter dan vorige maand
  - spaardoel sneller gehaald dan verwacht

## Open productvragen

- Willen we Budget Beheer uiteindelijk als eigen scherm in plaats van tab-segment?
- Willen we buiten-budget transacties ook direct recategoriseerbaar maken vanuit Budget?
- Willen we forecastbewerkingen expliciet tonen als `verwacht` versus `geboekt` per categorie?
- Willen we voor meevallers een vaste verdelingsnudge tonen richting buffer,
  jaarlijkse lasten en spaardoelen?
