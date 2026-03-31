---
name: budio-financial-truth
description: Use when work can affect financial meaning, truth hierarchy, safe-to-spend semantics, or forecast interpretation.
---

# Budio Financial Truth

## Use when

- bedragen, labels of signalen semantisch kunnen veranderen
- `Veilig tot volgende inkomen`, `Nu vrij`, risico- of forecastbetekenis geraakt wordt
- er kans is op inconsistentie tussen services en UI-betekenis

## Do not use when

- alleen visuele styling of copy zonder semantische impact verandert

## Fast path

- kleine wijziging met snelle truth-check op bestaande contracten
- geen nieuwe betekenislaag introduceren

## Full path

- nieuwe of gewijzigde semantiek
- conflict tussen bronnen van waarheid
- impact op meerdere domeinen (dashboard/budget/insights/assistant)

## Source docs

- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
- `docs/BUDIO_FUNCTIONALITEITEN.md`
- `AGENTS.md`

## Guardrails

- UI introduceert geen nieuwe financiële waarheid
- forecast blijft verwachting
- bij twijfel conservatief
- wijzig semantiek alleen met expliciete impactuitleg

## Expected output / werkwijze

1. Benoem geraakt begrip of signaal.
2. Toets tegen contract en bestaande service-waarheid.
3. Beschrijf kleinste veilige wijziging.
4. Benoem regressierisico op forecast, budget, import, categorisatie.
