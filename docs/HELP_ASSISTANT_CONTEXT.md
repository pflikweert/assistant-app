# Help Assistant Context Model

## Doel

Dit model zorgt dat de Help Assistant altijd dezelfde basiscontext krijgt, zonder schermspecifieke ad-hoc objecten.

Binnen de nieuwe productvisie ondersteunt deze context vooral een contextuele `Money Copilot`-laag rondom de dagelijkse cockpit. De context is dus bedoeld om hulp precies op het juiste moment te geven, niet om van chat het primaire productoppervlak te maken.

## Bronbestand

- `services/help-assistant-context.ts`

Belangrijkste exports:

- `HelpAssistantContext`
- `HelpAssistantPeriodContext`
- `HelpAssistantScreenId`
- `buildHelpAssistantContext(...)`
- `formatHelpAssistantContextChipLabel(...)`

## Basisvelden

- `routeName`
- `screenTitle`
- `screenId`
- `selectedPeriod` (optioneel)
- `screenContext` (optioneel, schermspecifiek en veilig)
- `platform`

## Hoe het nu wordt gebruikt

- `components/ui/finance-help-assistant-trigger.tsx` bouwt context centraal met:
  - `screenId`
  - `routeName`
  - `selectedPeriod`
  - `screenContext`

Dezelfde context wordt gebruikt door planner, final prompts en issue-intake om:

- een route te bepalen
- een begrijpelijke `featureArea` te kiezen voor de reviewkaart
- de samenvatting op het juiste scherm en in de juiste periode te plaatsen

Voor de productrichting betekent dit:

- home- en dashboardcontext moet richting geven aan rustige, directe hulp
- budget-, insights- en transactieschermen leveren vooral verdiepende context
- de assistent blijft secundair aan de financiële waarheid in services

## Ondersteunde `screenContext` varianten

- `budget`: maandlabel, budgetstatus, weektempo en forecast-signalen
- `transactions`: actieve maand, filterstatus en zoekstatus
- `import`: bron, aantallen, periode en importfase
- `insights`: maandstatus, resterende-maandsignalen en forecast-headline

## Financiële vervolgcontext

De contextlaag is niet zelf de bron van waarheid voor geldlogica. Zij dient als veilige ingang voor vervolghydration in:

- `services/help-assistant-financial-context.ts`
- `services/help-assistant-hydration.ts`

Vanuit dezelfde context kan de app conditioneel extra blokken laden, zoals:

- maandbudget
- cashflowveiligheid
- expected end balance
- category summary
- transaction facts

Belangrijk:

- schermcontext alleen is niet genoeg voor feitelijke categorie- of transactieantwoorden
- voor lookupvragen hydrateert de app daarom extra aggregaten bovenop deze basiscontext
- geen ruwe transactierijen worden onderdeel van het contextcontract naar OpenAI

## Screen ids

Actuele `screenId` waarden:

- `dashboard`
- `transactions`
- `budget`
- `insights`
- `import`

## Nieuwe schermen toevoegen

1. Voeg een nieuw `screenId` toe in `HelpAssistantScreenId`.
2. Voeg bijbehorende metadata toe in `SCREEN_DEFINITIONS`.
3. Gebruik op het scherm `FinanceHeaderActions` met:
   - `screenId="<nieuw-id>"`
   - optioneel `selectedPeriod={{ ... }}`
   - optioneel `screenContext={{ ... }}` met alleen veilige samenvatting

Gebruik hetzelfde periodemodel als bestaande schermen (`key`, `label`, `startIso`, `endIsoExclusive`) zodat latere AI- en supportlogica direct op alle schermen kan hergebruiken.
