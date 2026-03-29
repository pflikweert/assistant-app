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
- Project-id bron:
  - `docs/design/stitch-project-registry.md`

## Alleen toegestaan als

- component minimaal 3x herbruikbaar is
- component nog niet bestaat in het system

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
