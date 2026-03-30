# Budget Setup V2 — Van Voorsteltool Naar Cockpit-Stuurervaring

## Doel

De slimme-budgetflow verschuift van een nette insteltool naar een rustige cockpit-stuurervaring:

1. betekenis van het voorstel eerst
2. veiligheid en risico expliciet
3. één beste volgende stap
4. verdeling en detailbeheer daarna

## Productkaders

- Budio blijft een dagelijkse financiële cockpit
- Budget blijft een ondersteunende motorlaag
- AI blijft context-first en niet chat-first
- Geen nieuwe financiële waarheid naast bestaande budget/forecast-services
- Harde data > afgeleide data > forecast > AI-uitleg

## Shell-keuze

- `app/budget/setup/proposal.tsx`: `utility/subscherm`
- `app/budget/setup/review.tsx`: `utility/subscherm`
- `app/(tabs)/budget.tsx`: `hoofdscherm` (entry blijft in Budget-tab)

## Proposal-structuur V2

Verplichte volgorde op het voorstel-scherm:

1. `Strategie en maandgevoel`
2. `Veiligheid en impact`
3. `Beste volgende stap`
4. `Verdeling over variabele categorieën`

### 1) Strategie en maandgevoel

Toont:

- geadviseerde strategie
- maandgevoel (`krap` / `haalbaar` / `ruim`)
- sturingsniveau (`licht` / `normaal` / `streng`)
- primaire reden in rustige producttaal

### 2) Veiligheid en impact

Toont compact:

- variabele maandruimte
- reservebescherming (`laag` / `middel` / `hoog`)
- grootste aandachtspunt

### 3) Beste volgende stap

Toont exact één dominante stap:

- wat nu doen
- waarom deze stap
- op basis van dominante constraint

Primair blijft: `Toepassen`.
Secundair: `1 ding aanpassen`, `Opnieuw verdelen`.

### 4) Verdeling daarna

Categorieverdeling blijft aanwezig, maar volgt ná de besluitlaag.

- persist waarheidslaag: bestaande 4 budgetcategorieën
- coach-uitleglaag: `suggestedCategoriesV2` (minimaal 5 focusposten, trend/forecast-based)

## Coach-interactie V2

Geen chat-first stap.
Wel in-place quick-actions:

- `Opnieuw verdelen`
- `Maak iets ruimer`
- `Maak iets zuiniger`
- `Bescherm sparen meer`

Deze acties blijven guidance/refinement op dezelfde flow.

## Review-structuur V2

Nieuwe volgorde:

1. `Wat dit plan betekent voor je maand`
2. `Ingesteld door Budio`
3. `Door jou aangepast`
4. `Waar finetunen nog zinvol is`

Review is betekenis-gedreven, niet administratief-gedreven.

## Data- en waarheidsgedrag

V2 gebruikt uitsluitend bestaande proposal- en apply-context:

- betekenislaag (`planMeaning`, `safetyImpact`, `nextBestStep`) is afgeleid uit bestaande context
- `applyPayload` blijft leidend voor gecontroleerde write
- geen direct model-write zonder apply-validatie
- forecast blijft verwachting, geen zekerheid

## Implementatie-impact (gericht)

Aangepast:

- `app/budget/setup/proposal.tsx`
- `app/budget/setup/review.tsx`
- `services/budget-setup-proposal-schema.ts`
- `services/budget-setup-tools.ts`
- `services/budget-setup-orchestrator.ts`
- `services/budget-setup-proposal-schema.test.ts`
- `services/budget-setup-apply.test.ts`

Documentatie:

- `docs/BUDIO_FUNCTIONALITEITEN.md`
- `docs/design/stitch-design-md.md`
- `docs/designs/budget-setup-v2.md`

## Niet in scope

- geen nieuwe backendarchitectuur
- geen route- of servicename-renames
- geen brede design language wijziging
- geen extra afhankelijkheden

## Strategiekaarten copy

De slimme instap gebruikt alleen de slimme varianten, maar de volledige copy blijft hier vastliggen voor hergebruik:

- `Normaal`
  - `Voor een gewone maand. Een rustige verdeling die past bij je normale uitgaven.`
  - korte kaartcopy: `Gewone maand, rustige verdeling`

- `Balans`
  - `Voor meer grip en wat extra zekerheid. We beschermen iets meer voordat we je budget verdelen.`
  - korte kaartcopy: `Meer grip en extra bescherming`

- `Bespaarmodus`
  - `Voor als je deze maand scherper moet sturen. We zetten je budgetten strakker zodat je meer overhoudt.`
  - korte kaartcopy: `Strakker budget, meer overhouden`

- `Handmatig`
  - `Voor als je liever zelf kiest. Je stelt alles zelf in, met volledige controle.`
  - korte kaartcopy: `Zelf alles instellen`

Smart flow-regel:

- op de eerste slimme setup-pagina zijn alleen `Normaal`, `Balans` en `Bespaarmodus` zichtbaar
- `Balans` is de standaard selectie
- `Handmatig` is documentair beschikbaar, maar niet zichtbaar in deze instap
- de gekozen strategie stuurt de volgende proposal-berekening
- de strategiekaarten zijn compact genoeg om naast elkaar op mobiel te passen
- in de modal blijft alleen de slimme 3-optie-keuze zichtbaar
- op de budget-beheerpagina gebruikt dezelfde selector ook de vierde keuze `Handmatig`
- op normale mobielbreedte blijven de drie slimme kaarten naast elkaar zichtbaar; pas op echt smalle schermen schuift de selector naar een horizontale slider
- de selector is dezelfde gedeelde component die ook in de admin design-system componentcatalogus staat
