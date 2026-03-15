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

## Aanbevolen Volgende Fase

- Eerst afronden:
  - Extra tests voor week attentionlogica
  - Laatste visuele check in simulator of web voor status- en tempocopy
  - Eventueel forecastscenario's uitbreiden voor uitzonderlijke maanden of weinig historie
- Daarna oppakken:
  - Categorie-detail drilldown vanuit budget maandtab
  - Herverdeling-preview in beheer voor opslaan
  - `Wat is veranderd` laag in Insights

## Fase 1

- Eventueel subtielere copy voor `Binnen` / `Buiten`
- Laatste kleine copy-check in Budget-beheer

## Fase 2

- Extra tests voor week attentionlogica
- Laatste visuele check in simulator of web voor status- en tempocopy
- Eventueel forecastscenario's uitbreiden voor uitzonderlijke maanden of weinig historie

## Fase 3

- Categorie-detail drilldown vanuit budget maandtab
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
  - weektempo
  - recente transacties
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
