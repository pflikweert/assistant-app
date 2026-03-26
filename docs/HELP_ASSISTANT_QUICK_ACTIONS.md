# Help Assistant Quick Actions

## Doel

Quick actions moeten direct bruikbaar zijn bij openen van de assistant, zonder
servercall. Daarom gebruiken we een centraal actie-model met lokaal gedrag.

## Bronbestand

- `services/help-assistant-quick-actions.ts`

Belangrijkste types:

- `HelpAssistantQuickActionId`
- `HelpAssistantQuickActionBehavior`
- `HelpAssistantQuickAction`

Belangrijkste functie:

- `listHelpAssistantQuickActions(context)`

## Gedrag

Elke actie heeft:

- `label` en `description` voor UI
- `behavior`:
  - `prefill_composer`: vult composer met startvraag
  - `start_local_thread`: plaatst lokale user+assistant placeholders
- `seedText`: de context-aware starttekst

## Schermkoppeling

`listHelpAssistantQuickActions` gebruikt `HelpAssistantContext` om:

- periodelabels in vragen te verwerken
- prioritering per schermtype te bepalen

Voor `budget` en `insights` staan spending-vragen bovenaan; op andere
schermen blijft de algemene supportvolgorde leidend.

## Uitbreiden

1. Voeg nieuw `id` toe in `HelpAssistantQuickActionId`.
2. Definieer label, beschrijving, behavior en seedText in de centrale service.
3. Pas eventueel prioritering per `screenId` aan in dezelfde service.

Zo blijft de quick action-logica op een plek en hoeven schermen geen eigen
actielijsten te bouwen.
