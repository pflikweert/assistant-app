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
