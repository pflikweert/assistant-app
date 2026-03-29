# Help Assistant Local Chat State

## Doel

Een lokale chatstate die direct bruikbaar is in de UI, maar ook stabiel genoeg is voor planner-routing, issue-intake en spending advice.

## Bronbestand

- `services/help-assistant-chat.ts`

## Kernstructuren

- `HelpAssistantThreadState`
  - `messages`
  - `pendingIssueDraftIds`
  - `pendingSpendingAdviceIds`
- `HelpAssistantMessage`
  - `id`, `role`, `status`, `text`, `createdAtIso`
  - `metadata` met bron, intent, target en contextsnapshot

## Metadata voor vervolgflows

Per bericht slaan we onder meer op:

- `source`: `composer`, `quick_action`, `local_placeholder`, `ai_proxy`
- `intent`
- `target`
- `issueDraftCandidate`
- `spendingAdviceCandidate`
- contextsnapshot (`routeName`, `screenId`, `screenTitle`, `periodLabel`, `platform`)

Belangrijke leerpunten:

- `issueDraftCandidate` is geen bron van waarheid meer voor de uiteindelijke routing
- de AI-router in `services/help-assistant-ai.ts` bepaalt per turn opnieuw de route
- de AI-router classificeert ook `dataRequests`, terwijl hydration en privacy volledig in app-code blijven
- de orchestration kan category-scopes als veilige catalogus meesturen
- de thread bewaart genoeg context om `activeFlow` per antwoord opnieuw op te bouwen als soft prior

## Lokale acties

- `createInitialHelpAssistantThreadState()`
- `submitComposerMessageLocally(...)`
- `applyQuickActionLocally(...)`
- `resolveAssistantMessageSuccess(...)`
- `resolveAssistantMessageError(...)`

Deze functies voegen user- en assistant-placeholders toe en zetten pending berichten later om naar `ready` of `error`.

## Help Assistant issueflow

De issue-/idee-flow heeft een aparte state machine in `services/help-assistant-issue-flow.ts` met deze statussen:

- `idle`
- `collecting`
- `ready_to_review`
- `submitting`
- `submitted`
- `cancelled`

Gedrag:

- de vaste meldkaart verschijnt als compacte reviewbanner boven de chat
- de kaart blijft zichtbaar en update mee op nieuwe userberichten
- `Annuleren` sluit de kaart direct en laat hem niet vanzelf heropenen door oude threadinhoud
- alleen de reviewkaart mag naar GitHub submitten
- typed bevestigingen in de chat mogen nooit vanzelf versturen

## Toekomstige API-koppeling

1. Houd dezelfde `HelpAssistantMessage` vorm aan als clientcontract.
2. Vervang `local_placeholder` assistant-berichten door server-responses.
3. Gebruik `issueDraftCandidate` en `spendingAdviceCandidate` alleen nog als transport- of fallbacksignalen.
4. Laat nieuwe issue/idee-standaarden altijd via de AI-router lopen.
5. Houd flowcontinuatie generiek via `activeFlow`, niet issue-specifiek.
