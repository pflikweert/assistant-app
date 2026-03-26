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

Adapter-gedrag:

- bouwt OpenAI `messages` uit system prompt + context + recente thread
- voegt schermspecifieke contextregels toe
- voor bestedingsvragen bouwt hij een gestandaardiseerde `SpendingAdviceContext`
  met budget-/planning-/forecast-signalen
- stuurt spending-requests via een expliciete help-assistant proxy use-case
- parseert antwoord schema-first (JSON velden) naar het vaste 4-delige patroon

Response bevat:

- `answerText`
- `model`
- `responseId`

### Spending advice schema

Voor bestedingsvragen verwacht de assistent JSON met:

- `conclusion`
- `why`
- `risk`
- `nextStep`

Optioneel:

- `confidence`
- `dataGaps` (array)

UI blijft altijd het vaste 4-stappenpatroon renderen.

## Privacy-aanpak

- Alleen veilige samenvatting gaat mee (labels, status, aantallen, periodes).
- Geen ruwe transactieregels, geen rekeningnummers, geen metadata blobs.
- Schermcontext wordt eerst centraal gesaneerd in `help-assistant-context.ts`.
- Spending context blijft geaggregeerd en uitlegbaar (geen ruwe transactiedumps).

## UI-koppeling

- `components/help-assistant/help-assistant-sheet.tsx`
  - maakt lokale user+pending assistant messages
  - roept `requestHelpAssistantReply(...)` aan
  - vervangt pending assistant met AI-antwoord of foutstatus

Zo blijft de UX direct bruikbaar, en kan de backend later per use case verder
gespecialiseerd worden zonder de sheet-architectuur om te gooien.

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
