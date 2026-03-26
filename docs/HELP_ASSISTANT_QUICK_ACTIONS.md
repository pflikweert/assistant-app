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

Belangrijk voor de huidige Help Assistant-flow:

- `Probleem melden` en `Idee melden` starten een gesprek, geen directe submit
- de AI-router bepaalt daarna of het gesprek echt in issue-intake, spending
  advice of algemene hulp landt
- als een issue/idee wordt herkend, toont de assistent een vaste reviewkaart
  boven de chat; quick actions zelf versturen niets naar GitHub
- `prefill_composer` blijft alleen voor spending-vragen en andere directe
  vragen waar een composervraag al voldoende is

## Schermkoppeling

`listHelpAssistantQuickActions` gebruikt `HelpAssistantContext` om:

- periodelabels in vragen te verwerken
- prioritering per schermtype te bepalen

Voor `budget` en `insights` staan spending-vragen bovenaan; op andere
schermen staan de meldchips direct bovenaan en blijft de algemene
supportvolgorde daaronder leidend.

De issue-actions blijven bewust lager-risico dan spending quick actions:

- ze mogen de intake wel starten
- ze mogen geen directe issuekaart-submit triggeren
- de gebruiker houdt altijd de regie via de reviewkaart en `Annuleren`

## Uitbreiden

1. Voeg nieuw `id` toe in `HelpAssistantQuickActionId`.
2. Definieer label, beschrijving, behavior en seedText in de centrale service.
3. Pas eventueel prioritering per `screenId` aan in dezelfde service.

Zo blijft de quick action-logica op een plek en hoeven schermen geen eigen
actielijsten te bouwen.
