# Help Assistant AI Koppeling

## Bestaande infrastructuur (hergebruik)

- Client proxy helper: `services/openai-proxy.ts`
- Server proxy endpoint: `api/openai/chat-completions.ts`

De Help Assistant gebruikt deze bestaande route, inclusief bestaande auth-flow
met Supabase access token. Er worden geen client-side secrets toegevoegd.

## Nieuwe Help Assistant adapter

- `services/help-assistant-ai.ts`

Belangrijkste exports:

- `HelpAssistantAIRequest`
- `HelpAssistantAIResponse`
- `requestHelpAssistantReply(...)`

## Request/response model

Request bevat:

- `context` (`HelpAssistantContext`)
- `thread` (`HelpAssistantThreadState`)
- optioneel `issueFlowActive`

De adapter doet nu per beurt eerst een OpenAI-routerstap:

1. OpenAI bepaalt of de turn `issue_intake`, `spending_advice` of `general`
   is.
2. Alleen daarna bouwen we de uiteindelijke OpenAI-prompt voor die route.
3. Als er al een actieve issueflow is, blijft de router in issue-intake modus.

Belangrijke uitkomst:

- issue-/idee-/feedbackmeldingen worden niet meer primair op lokale keywordregels
  gerouteerd
- lokale intentheuristiek blijft alleen nog bruikbaar als fallback/transporthint
- `budget`, `grafiek` en `dashboard` mogen dus niet automatisch de spending-route winnen als de AI een idee of issue herkent

## Issue-intake schema

Voor issue-/idee-turns verwacht de assistent JSON met:

- `meta.route = "issue_intake"`
- `meta.type` en `meta.subtype`
- `meta.confidence`
- `meta.state`
- `meta.needsClarification`
- `meta.context`
- `answerText`
- `summary`
- `featureArea`
- `userNeed`
- `proposedChange`
- `followUpQuestion`
- `isReadyForSubmission`

Gedrag:

- de chatregel toont alleen de korte verdiepende vraag
- de samenvatting blijft in de vaste meldkaart boven de chat
- `Annuleren` sluit de kaart en houdt hem gesloten tot een nieuwe issue-signalering
- pas na expliciete klik op `Versturen` gaat de server-side GitHub-flow lopen

## Spending advice schema

Voor bestedingsvragen verwacht de assistent JSON met:

- `conclusion`
- `why`
- `risk`
- `nextStep`

Optioneel:

- `confidence`
- `dataGaps` (array)
- `meta` met `route = "spending_advice"`

UI blijft altijd het vaste 4-stappenpatroon renderen.

## Privacy-aanpak

- Alleen veilige context gaat mee: scherm, periode en geaggregeerde signalen.
- Geen client-side GitHub writes; issue creatie blijft server-side.
- De router gebruikt alleen de relevante recente thread en schermcontext, geen
  ruwe financiële dumps.
- Spending context blijft geaggregeerd en uitlegbaar (geen ruwe transactiedumps).
- Issue-intake responses bevatten alleen de samenvatting en een korte vraag
  voor de gebruiker; technische metadata blijft intern.
- Bij expliciete issue-submit voegen we de geauthenticeerde meldende gebruiker
  toe aan de GitHub issue-body met naam en gebruikers-ID, zodat het team kan
  herleiden wie de melding via chat heeft gedaan.

## UI-koppeling

- `components/help-assistant/help-assistant-sheet.tsx`
  - maakt lokale user+pending assistant messages
  - roept `requestHelpAssistantReply(...)` aan
  - vervangt pending assistant met AI-antwoord of foutstatus
  - plakt de reviewkaart vast boven de chat wanneer de AI een issue/idee meldt

Zo blijft de UX direct bruikbaar, terwijl de routering nu door OpenAI wordt
bepaald en de sheet-architectuur rustig en stabiel blijft.

## Spending Advice Patroon (v2)

Voor bestedingsruimte-vragen volgt de assistent nu expliciet:

1. conclusie
2. waarom
3. risico of nuance
4. slimmer alternatief of vervolgstap

Proxy- en fallbackgedrag:

- server/proxy valideert spending-schema voor de help use-case
- bij schema- of proxyfout geeft de server een veilige fallbackresponse terug
- client heeft daarnaast een lokale veilige fallback als laatste vangnet

## Geleerde lessen

- Een help-assistant router op basis van vaste woorden zoals `budget` of
  `grafiek` is te fragiel voor productchat.
- OpenAI moet eerst intent bepalen; de app mag die uitkomst daarna alleen
  veilig toepassen.
- De vaste meldkaart werkt beter als zichtbare samenvatting dan als los
  ticketsysteem.
- De chatregel mag niet samenvatten én doorsturen tegelijk doen; de kaart is de
  plek voor de samenvatting, de chat is voor de verdiepende vraag.
