---
name: budio-money-copilot
description: Use for Help Assistant and Money Copilot routing, hydration guardrails, and truth-safe AI response behavior.
---

# Budio Money Copilot

## Use when

- assistentroutering, intentflow of modekeuze verandert
- hydrationblokken of contextselectie verandert
- truth-safe AI-uitleg of antwoordstructuur verandert

## Do not use when

- algemene layoutwijzigingen zonder assistentimpact

## Fast path

- kleine route/promptfix binnen bestaande contracten
- geen nieuwe assistentmodus of waarheidlaag

## Full path

- nieuwe route of mode
- wijziging in hydrationcontract
- wijziging die factual guardrails kan verzwakken

## Source docs

- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `docs/BUDIO_FUNCTIONALITEITEN.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
- `OPEN_TAKEN_FINANCE_APP.md`

## Guardrails

- AI introduceert geen nieuwe financiële waarheid
- context blijft truth-safe en minimaal noodzakelijk
- geen chat-first productidentiteit

## Expected output / werkwijze

1. Benoem welke assistentlaag geraakt wordt.
2. Toets wijziging op truth-safe gedrag.
3. Beschrijf fallback en risicopunten.
4. Geef handmatige QA-focus voor route en antwoordkwaliteit.
