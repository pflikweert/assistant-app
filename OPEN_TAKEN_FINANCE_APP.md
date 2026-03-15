# Openstaande Taken Finance App

## Status

- Afgerond:
  - Dashboard herontwerp en implementatie
  - Transactielijst herontwerp en implementatie
  - Transaction detail herontwerp en implementatie
  - Budget + Insights nieuwe informatie-architectuur
  - Budget week/maand/beheer hersteld
  - Insights trends/voorspelling/controle hersteld
  - Risicobalken en risk-logic uniform gemaakt
  - Weekdetail en buiten-budget drilldowns gepolijst
  - Forecast fallbacklogica verbeterd met recente volledige maanden
  - `Nog vrij te besteden`, status en weektempo semantisch gelijkgetrokken op dashboard, budget en insights
  - Unit tests toegevoegd voor budget risk, forecast fallback en locklogica
  - Week attentionlogica verplaatst naar gedeelde helper met unit tests
  - Forecasttests uitgebreid voor weinig historie en oude uitschieters
  - Forecast uitgebreid met timing-aware cashflow voor komende inkomsten en vaste uitgaven
  - Insights toont nu laagste verwachte saldo, eerstvolgende verwachte beweging en cash-gap waarschuwing
  - Remote migratie uitgevoerd voor `monthly_cashflow_forecasts` cash-gap velden en `password_reset_events`
  - Categorie-detail drilldown vanuit budget maandtab
  - Budget weeklabels verduidelijkt met kalenderweeknotatie en overlaplabels in weekdetail
  - Categorieoverzicht op de maandtab verrijkt met categorie-iconen
  - Transactie-iconen app-breed gekoppeld aan de echte transactiecategorie met centrale mapping en unit tests
  - Google Material iconensysteem met lokale fonts geïmplementeerd en app-breed vervangen

## Aanbevolen Volgende Fase

- Fase 2 code is afgerond.
- Nog handmatig nalopen:
  - Laatste visuele check in simulator of web voor status- en tempocopy
  - Iconen visueel nalopen op variantkeuze, mapping en spacing per scherm
- Daarna oppakken:
  - Herverdeling-preview in beheer voor opslaan
  - `Wat is veranderd` laag in Insights

## Fase 1

- Eventueel subtielere copy voor `Binnen` / `Buiten`
- Laatste kleine copy-check in Budget-beheer

## Fase 2

- Afgerond in code:
  - Extra tests voor week attentionlogica
  - Forecastscenario's uitgebreid voor weinig historie en oude uitschieters
  - Gedeelde helper voor week attention zodat budget-UI en tests dezelfde logica gebruiken
  - Cashflow-timelinelaag voor komende inkomsten, vaste lasten en abonnementen
  - `lowest_expected_balance`, volgende verwachte beweging en `cash_gap_warning` in forecast
  - Inkomensankers verbeterd: `last_detected_at` gebruikt nu de transactiedatum in plaats van `nu`
  - Remote schema bijgewerkt met forecast cash-gap velden
- Handmatige QA:
  - Laatste visuele check in simulator of web voor status- en tempocopy
  - Iconen visueel nalopen op variantkeuze, mapping en spacing per scherm
- Forecast onderzoek / volgende backendstap:
  - Huidige timinglaag gebruikt nu historische recurring patronen en income sources voor komende vaste bewegingen
  - Logische vervolgstap:
    - seizoensinkomsten zoals vakantiegeld, bonus en 13e maand expliciet modelleren
    - subscriptions verrijken met `subscription_profiles.expected_day_of_month` als extra bron
    - eventueel `lowest_expected_balance` ook meenemen in dashboard of budget-nudges

## Fase 3

- Herverdeling-preview in beheer voor opslaan
- `Wat is veranderd` laag in Insights
- Mogelijke categorieadvies- of coachkaarten verfijnen

## Fase 4

- Volledige simulator-polish op spacing, animatie en mobile feel
- Meer testdekking voor budget save flows en forecast
- Laatste harmonisatieronde voor Settings, Subscriptions en Transaction Detail

## Ideeën

- Compacte categorie-detailpagina met:
  - maandbudget
  - maandtempo
  - transacties deze maand
  - advies
- Kleine timeline in Insights:
  - budget aangepast
  - risico veranderd
  - forecast verbeterd of verslechterd
- Positieve feedbacklaag:
  - weken op rij onder budget
  - maandbuffer beter dan vorige maand
  - spaardoel sneller gehaald dan verwacht

## Open vragen

- Willen we budgetbeheer uiteindelijk als eigen scherm in plaats van tab-segment?
- Willen we buiten-budget transacties ook direct recategoriseerbaar maken vanuit Budget?
- Willen we forecastbewerkingen expliciet tonen als `verwacht` versus `geboekt` per categorie?
