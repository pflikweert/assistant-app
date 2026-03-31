---
name: budio-stitch-governance
description: Full-path governance for Stitch/design-system work when explicit design triggers are present.
---

# Budio Stitch Governance

## Use when

- nieuw scherm
- groot redesign
- shell- of hiërarchie-impact
- multi-screen harmonisatie
- design-system drift
- asset/system-level Stitch wijziging

## Do not use when

- kleine lokale MVP-fixes zonder structurele designimpact

## Fast path

- niet default voor deze skill
- bij gebrek aan trigger: terug naar `budio-delivery-fast-path`

## Full path

- preflight op project/asset
- governancechecks en sync alleen waar relevant
- companion docs gebruiken voor operationele details

## Source docs

- `docs/design/stitch-codex-workflow.md`
- `docs/design/design-system-rules.md`
- `docs/UI_PATTERNS.md`
- `docs/design/screen-inventory.md`
- `docs/CODEX_SKILLS_AANBEVELING.md`

## Guardrails

- geen duplicatie van governance over meerdere top-level skills
- geen full-path afdwingen zonder trigger
- houd regels operationeel, niet ceremonieel

## Expected output / werkwijze

1. Bevestig trigger voor full path.
2. Maak compacte scope + risico-overzicht.
3. Voer alleen noodzakelijke governancechecks uit.
4. Leg regressie- en verificatiestappen vast.
