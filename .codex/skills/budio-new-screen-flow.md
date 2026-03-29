# Budio New Screen Flow

Gebruik deze flow bij het bouwen van nieuwe schermen in Budio.

## Preview-first regel

- Codex mag een nieuw scherm niet direct implementeren.
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
- Project-id bron:
  - `docs/design/stitch-project-registry.md`

## Taalregel

- Alle zichtbare UI-teksten in nieuwe schermvarianten zijn standaard Nederlands.
- Alleen bij expliciete user-vraag mag een andere taal worden gebruikt.

## Stitch quickstart voor nieuwe schermen

Vaste workflow:

1. preflight design-system check met:
   - `npm run stitch:tool -- get_project -d '{"name":"projects/12076228720239525233"}'`
   - canonieke asset moet zijn: `assets/ead01f9cb9454e8da9de7ec3d8ef18e6` (`Budio Core Fintech`)
2. classificeer schermtype eerst (hoofdscherm, detail, utility, modal/sheet)
3. maak 2-3 varianten in `design_refs/proposals/{screen}/v1|v2|v3/`
4. genereer elke variant met:
   `npm run stitch:tool -- generate_screen_from_text -d '{"projectId":"12076228720239525233","deviceType":"MOBILE","prompt":"..."}'`
5. controleer resultaat met:
   `npm run stitch:tool -- list_screens -d '{"projectId":"12076228720239525233"}'`
6. registreer per variant project/screen/preview in variant-README

Fallback:

- Als een variant ontbreekt in screenlijst na generatie:
  - opnieuw `list_screens` draaien
  - zo nodig opnieuw genereren met expliciete `Create a NEW mobile screen` prompt en vaste titel
- Geen implementatie starten zonder zichtbare en vastgelegde previews.
- Bij design-system drift of foutieve Stitch-stijl: gebruik `.codex/skills/budio-stitch-design-system.md`.
- Gebruik nooit `create_design_system` tijdens new-screen flow.

## Wat we geleerd hebben

- Classificatie (hoofdscherm/detail/utility/modal) vroeg doen voorkomt verkeerde shell-keuze in Stitch.
- Als prompts te generiek zijn, wijkt Stitch sneller af; noem daarom altijd bestaande shell en bestaande componentfamilies expliciet.
- Nederlandstalige labels expliciet opnemen in prompt verlaagt kans op Engelstalige output.

## Stap 1 — Classificatie

Bepaal eerst het schermtype:

- hoofdscherm
- detail
- utility
- modal/sheet

## Stap 2 — Gebruik bestaande shell

- kies de juiste screen shell uit het design system
- bedenk nooit een nieuwe layout als een bestaande shell past

## Stap 3 — Component selectie

- gebruik bestaande componenten
- maak geen nieuwe component tenzij die generiek inzetbaar is

## Stap 4 — Content hiërarchie

- top: belangrijkste info
- midden: actie
- onder: detail

## Stap 5 — Varianten maken

- maak 2-3 schermvarianten binnen dezelfde shell-familie
- gebruik alleen bestaande shells en zoveel mogelijk bestaande componenten
- documenteer per variant wat het verschil is in hiërarchie, componentkeuze en interactieritme
- stop na het opleveren van de varianten en wacht op feedback

## Stap 6 — Output

- component structuur
- benodigde nieuwe componenten, alleen indien echt nodig
- risico's
