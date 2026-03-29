# Stitch Project Registry

Dit bestand legt de vaste Stitch-projecten voor Budio vast.

## Actief standaardproject

- naam: `Budio Design System 2026`
- Stitch project code id: `projects/12076228720239525233`
- actief design system asset id: `assets/ead01f9cb9454e8da9de7ec3d8ef18e6`
- actief design system displayName: `Budio Core Fintech`
- actief design system asset version: `2`
- Stitch UI stub-id variant: `asset-stub-assets-ead01f9cb9454e8da9de7ec3d8ef18e6-1774771984947` (niet gebruiken als API resource name)
- type: `PROJECT_DESIGN`
- visibility: `PRIVATE`
- status: actief standaardproject voor alle toekomstige Budio UI- en designverkenningen

## Single Design System Policy (verplicht)

- In dit project gebruiken we exact 1 canonieke design system asset:
  - `assets/ead01f9cb9454e8da9de7ec3d8ef18e6` (`Budio Core Fintech`)
- Nieuwe schermen, redesigns en refactors moeten deze bestaande asset hergebruiken.
- Geen `create_design_system` tijdens normaal schermwerk.
- Geen nieuwe design-system asset aanmaken tenzij expliciet gevraagd voor een apart experiment.

## Legacy assets (niet gebruiken voor nieuw werk)

- `assets/12156226123322521191` (`Budio Core Fintech`) -> legacy duplicaat
- `assets/7fe824a3c7c64c0ab0c203eca1578022` (`Budio Core`) -> legacy
- `assets/d410893e2893436e92eee168211a660c` (`Budio Foundry`) -> legacy
- Deze assets mogen bestaan als historiek, maar zijn niet toegestaan als basis voor nieuwe flows.

## Gebruik

- Gebruik dit project als default bij nieuw Stitch-werk voor Budio.
- Vraag niet opnieuw naar een Stitch project id als dit standaardproject volstaat.
- Alleen afwijken als er expliciet een apart experiment, tijdelijke spike of los klantproject nodig is.

## Werkwijze

- Alle nieuwe UI-verkenningen volgen eerst de lokale preview-first flow in:
  - `design_refs/proposals/{screen}/{variant}/`
  - daarna `design_refs/approved/{screen}/`
- Stitch wordt gebruikt als visuele ontwerpruimte, maar blijft gekoppeld aan dezelfde Budio designregels en design-docs in deze repo.
- Voor elke nieuwe generatie:
  1. check `get_project` op actieve `DESIGN_SYSTEM_INSTANCE.sourceAsset`
  2. als die afwijkt van canoniek: eerst `apply_design_system` met canonieke asset
  3. pas daarna varianten genereren

## Referentie

- workflow: `docs/design/stitch-codex-workflow.md`
- design basis:
  - `docs/design/design-system-rules.md`
  - `docs/UI_PATTERNS.md`
  - `docs/design/design-foundation.md`
  - `docs/design/design-tokens.md`
  - `docs/design/component-inventory.md`
  - `docs/design/screen-shells.md`
