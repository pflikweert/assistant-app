# Help Assistant Local Chat State

## Doel

Een lokale chatstate die nu al bruikbaar is zonder backend, maar klaar is voor
latere AI-antwoorden, issue-drafts en spending advice.

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

Per message slaan we o.a. op:

- `source`: `composer`, `quick_action`, `local_placeholder`
- `intent`: o.a. uitleg, foutmelding, idee, spending-vraag
- `target`: o.a. `issue_draft` of `spending_advice`
- `issueDraftCandidate` en `spendingAdviceCandidate`
- contextsnapshot (`routeName`, `screenId`, `screenTitle`, `periodLabel`, `platform`)

## Lokale acties

- `createInitialHelpAssistantThreadState()`
- `submitComposerMessageLocally(...)`
- `applyQuickActionLocally(...)`

Deze functies voegen user/assistant placeholders toe zonder netwerkverkeer.

## Toekomstige API-koppeling

1. Houd dezelfde `HelpAssistantMessage` vorm aan als client contract.
2. Vervang `local_placeholder` assistant-berichten door server-responses.
3. Gebruik `issueDraftCandidate` en `spendingAdviceCandidate` als routing-signaal:
   - issue draft endpoint
   - spending advice endpoint

Zo blijft de overgang van lokaal naar API incrementeel, zonder UI-refactor.
