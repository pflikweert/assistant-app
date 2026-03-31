---
name: budio-delivery-fast-path
description: Default delivery path for small, local MVP changes without unnecessary design-governance overhead.
---

# Budio Delivery Fast Path

## Use when

- kleine bugfixes
- lokale UI-correcties
- copyaanpassingen
- beperkte componentaanpassingen
- docs-updates
- niet-structurele flowfixes

## Do not use when

- nieuw scherm
- groot redesign
- shell- of hiërarchie-impact
- multi-screen harmonisatie
- design-system drift
- asset/system-level Stitch wijziging

## Fast path

- dit is de standaard
- los op met kleinste logische wijziging
- geen verplichte variantenloop

## Full path

- alleen bij expliciete trigger (zie hierboven)
- escaleren naar `budio-stitch-governance`

## Source docs

- `AGENTS.md`
- `docs/BUDIO_FUNCTIONALITEITEN.md`
- `docs/UI_PATTERNS.md`
- `docs/design/screen-inventory.md`
- `docs/CODEX_SKILLS_AANBEVELING.md`

## Guardrails

- voorkom governance-theater
- vermijd over-engineering
- bewaak product- en financiële consistentie
- verander geen semantiek zonder expliciete check

## Expected output / werkwijze

1. Classificeer taak als fast-path kandidaat.
2. Voer kleinste gerichte wijziging door.
3. Escaleer alleen bij trigger naar full path.
4. Rapporteer risico's en handmatige checks compact.
