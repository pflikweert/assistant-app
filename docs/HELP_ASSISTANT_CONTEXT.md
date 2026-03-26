# Help Assistant Context Model

## Doel

Dit model zorgt dat de Help Assistant altijd dezelfde basiscontext krijgt, zonder
schermspecifieke ad-hoc objecten.

## Bronbestand

- `services/help-assistant-context.ts`

Belangrijkste exports:

- `HelpAssistantContext`
- `HelpAssistantPeriodContext`
- `HelpAssistantScreenId`
- `buildHelpAssistantContext(...)`
- `formatHelpAssistantContextChipLabel(...)`

## Basisvelden (v1)

- `routeName`
- `screenTitle`
- `selectedPeriod` (optioneel)
- `screenContext` (optioneel, schermspecifiek en veilig)
- `platform`

## Hoe het nu wordt gebruikt

- `components/ui/finance-help-assistant-trigger.tsx` bouwt context centraal met:
  - `screenId` (vanuit het scherm)
  - `routeName` (via `usePathname`)
  - `selectedPeriod` (indien beschikbaar)
  - `screenContext` (indien beschikbaar)

De trigger geeft dit contextobject door aan `HelpAssistantSheet`.

Ondersteunde `screenContext` varianten:

- `budget`: maandlabel, status/tone, budgetsamenvatting
- `transactions`: actieve maand/filterstatus
- `import`: bron, aantallen, periode, importfase

## Nieuwe schermen toevoegen

1. Voeg een nieuw `screenId` toe in `HelpAssistantScreenId`.
2. Voeg bijbehorende metadata toe in `SCREEN_DEFINITIONS`.
3. Gebruik op het scherm `FinanceHeaderActions` met:
   - `screenId="<nieuw-id>"`
   - optioneel `selectedPeriod={{ ... }}`
   - optioneel `screenContext={{ ... }}` met alleen veilige samenvatting

Gebruik hetzelfde periodemodel als bestaande schermen (`key`, `label`,
`startIso`, `endIsoExclusive`) zodat latere AI- en supportlogica direct op alle
schermen kan hergebruiken.
