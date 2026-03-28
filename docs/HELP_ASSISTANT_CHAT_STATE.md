# Help Assistant Local Chat State

## Doel

Een lokale chatstate die nu al bruikbaar is zonder backend, maar klaar is voor
latere AI-antwoorden, issue-intake en spending advice.

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

- `source`: `composer`, `quick_action`, `local_placeholder`, `ai_proxy`
- `intent`: o.a. uitleg, foutmelding, idee, spending-vraag
- `target`: o.a. `issue_draft` of `spending_advice`
- `issueDraftCandidate` en `spendingAdviceCandidate`
- contextsnapshot (`routeName`, `screenId`, `screenTitle`, `periodLabel`, `platform`)

Belangrijk leerpunt:

- `issueDraftCandidate` is geen bron van waarheid meer voor de uiteindelijke
  routing
- de AI-router in `services/help-assistant-ai.ts` bepaalt per turn opnieuw de route
- de AI-router classificeert nu ook generieke `dataRequests` (databehoeftehints),
  terwijl hydration/privacy volledig in de app-code blijft
- de orchestration kan beschikbare category-scopes (slug + label) als veilige
  catalogus meesturen voor scopekeuze en verduidelijkingsvragen
- de issueflow-reducer gebruikt daarna de gestructureerde AI-response en een
  vaste anchor om de kaart in sync te houden
- een actieve flow wordt als `activeFlow` descriptor meegestuurd (soft prior),
  niet als harde route-lock

## Lokale acties

- `createInitialHelpAssistantThreadState()`
- `submitComposerMessageLocally(...)`
- `applyQuickActionLocally(...)`

Deze functies voegen user/assistant placeholders toe zonder netwerkverkeer.

## Help Assistant issueflow

De issue-/idee-flow heeft nu een aparte state machine in
`services/help-assistant-issue-flow.ts` met deze statussen:

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

1. Houd dezelfde `HelpAssistantMessage` vorm aan als client contract.
2. Vervang `local_placeholder` assistant-berichten door server-responses.
3. Gebruik `issueDraftCandidate` en `spendingAdviceCandidate` alleen nog als
   transport-/fallbacksignalen.
4. Laat nieuwe issue/idee-standaarden altijd via de AI-router lopen.
5. Houd flowcontinuatie generiek (`continueActiveFlow` / intent-shift), niet
   issue-specifiek.

Zo blijft de overgang van lokaal naar API incrementeel, zonder UI-refactor,
maar wel met een duidelijke bron van waarheid voor issue-routing.
