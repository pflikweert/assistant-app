# Component Creation Flow

Gebruik deze flow bij het aanmaken van nieuwe componenten in Budio.

## Preview-first regel

- Codex mag een nieuwe component niet direct implementeren.
- Codex moet altijd eerst 2-3 design varianten maken.
- Gebruik voor Stitch-verkenning standaard project:
  - `projects/12076228720239525233`
- Varianten worden opgeslagen in:
  - `design_refs/proposals/{screen}/{variant}/`
- Elke variant bevat:
  - korte uitleg van het concept
  - component structuur, geen volledige code
  - optioneel lichte JSX preview
- Na de varianten stopt Codex en wacht op feedback.
- Pas na user keuze:
  - gekozen variant verplaatsen naar `design_refs/approved/{screen}/`
  - daarna pas implementatie starten
- Nieuwe componenten mogen alleen worden gebouwd nadat Stitch-designs expliciet zijn goedgekeurd in review.
- Project-id bron:
  - `docs/design/stitch-project-registry.md`

## Taalregel

- Alle zichtbare componentcopy en variantlabels zijn standaard Nederlands.
- Alleen bij expliciete user-vraag mag een andere taal worden gebruikt.

## Stitch quickstart voor componentvoorstellen

Gebruik dezelfde preview discipline als bij screens:

1. preflight design-system check met:
   - `npm run stitch:tool -- get_project -d '{"name":"projects/12076228720239525233"}'`
   - canonieke asset moet zijn: `assets/ead01f9cb9454e8da9de7ec3d8ef18e6` (`Budio Core Fintech`)
2. maak 2-3 componentvarianten onder:
   `design_refs/proposals/{screen-or-component}/v1|v2|v3/`
3. genereer varianten visueel in Stitch met:
   `npm run stitch:tool -- generate_screen_from_text -d '{"projectId":"12076228720239525233","deviceType":"MOBILE","prompt":"..."}'`
4. verifieer met:
   `npm run stitch:tool -- list_screens -d '{"projectId":"12076228720239525233"}'`
5. leg per variant vast:
   - project id
   - screen id
   - preview link

Fallback:

- Bij ontbrekende variant eerst opnieuw `list_screens`, daarna pas opnieuw genereren.
- Gebruik bij retry expliciete titel en `Do not edit existing screens` om overschrijven te voorkomen.
- Bij design-system drift of foutieve Stitch-stijl: gebruik `.codex/skills/budio-stitch-design-system.md`.
- Gebruik nooit `create_design_system` tijdens component-flow.

## Wat we geleerd hebben

- Component-varianten blijven beter vergelijkbaar als ze binnen één gedeelde shellcontext worden gepreviewd.
- Zonder strakke variantregistratie gaan componentkeuzes snel door elkaar lopen; registreer altijd ids en previewlinks.
- Houd componentcopy in preview standaard Nederlands om implementatiefrictie later te vermijden.

## Alleen toegestaan als

- component minimaal 3x herbruikbaar is
- component nog niet bestaat in het system
- er expliciete goedkeuring op de Stitch-variant bestaat

## Component engineering contract

- Gebruik componentnamen in het Engels met duidelijke intentie (`SmartBudgetSetupEntryCard`, `BudgetSetupReviewSummaryCard`).
- Gebruik logische mapstructuur:
  - domeincomponenten onder `components/{domain}/...`
  - generieke UI-primitives onder `components/ui/...`
- Nieuwe componenten moeten design-system-first zijn:
  - tokens uit `constants/theme.ts`
  - bestaande shells/patronen eerst
  - geen losse one-off styleblokken als een gedeelde variant mogelijk is
- Nieuwe componenten moeten herbruikbaar zijn:
  - heldere props
  - states expliciet (loading/empty/partial/error waar relevant)
  - geen verborgen koppeling aan één route

## Variantenfase

- maak 2-3 componentvarianten binnen het bestaande design system
- laat verschillen alleen zitten in generieke vorm, states, compositie of variant-contract
- kies geen one-off oplossing voor één scherm
- stop na het opleveren van de varianten en wacht op feedback

## Moet bevatten

- varianten
- states
- props
- usage rules

## Verboden

- one-off componenten
- directe implementatie zonder goedgekeurde preview
