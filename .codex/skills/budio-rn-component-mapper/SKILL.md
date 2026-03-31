---
name: budio-rn-component-mapper
description: Use to map approved Stitch output to React Native/Expo component structure with minimal implementation drift.
---

# Budio RN Component Mapper

## Use when

- een ontwerpkeuze al vastligt en vertaald moet worden naar RN/Expo componenten
- schermstructuur en bestaande componentmapping expliciet gemaakt moet worden

## Do not use when

- productstrategie, semantiek of prioritering nog onduidelijk is
- er nog geen duidelijke ontwerpkeuze bestaat

## Fast path

- map alleen de kernblokken naar bestaande componenten
- beperk je tot kleinste bruikbare mapping voor implementatie

## Full path

- bij nieuwe componentfamilies
- bij complexe shellmapping over meerdere schermen
- bij duidelijke risico's op componentdivergentie

## Source docs

- `docs/UI_PATTERNS.md`
- `docs/design/screen-inventory.md`
- `docs/design/design-system-rules.md`
- `docs/CODEX_SKILLS_AANBEVELING.md`

## Guardrails

- geen web-first defaults
- businesslogica niet naar UI-mapping trekken
- bestaande componenten en tokens eerst
- mapping compact en uitvoerbaar houden

## Expected output / werkwijze

1. Bevestig schermtype en shell.
2. Map top/midden/onderblokken op bestaande componenten.
3. Benoem alleen noodzakelijke gaps.
4. Sluit af met risico's en handmatige verificatiepunten.
