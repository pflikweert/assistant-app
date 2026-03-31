---
name: budio-import-and-accounts
description: Use for import, dedupe, matching, account-linking, and scope-impact changes with strong data-safety guardrails.
---

# Budio Import and Accounts

## Use when

- importflow (CSV/PDF) verandert
- dedupe of matchinglogica verandert
- accountkoppeling of scopefilters veranderen
- wijziging impact kan hebben op forecast/subscriptions via data-invoer

## Do not use when

- pure visual polish zonder data- of scope-impact

## Fast path

- kleine UX-fix rond import/account zonder logische wijziging

## Full path

- wijziging in dedupe/matchingregels
- wijziging in accountrol/scopebetekenis
- wijziging met doorwerking naar forecast of abonnementen

## Source docs

- `docs/BUDIO_FUNCTIONALITEITEN.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `OPEN_TAKEN_FINANCE_APP.md`

## Guardrails

- datakwaliteit eerst
- behoud referenties waar mogelijk
- geen semantische verschuiving via UI-only keuzes
- impact op downstream domeinen expliciet benoemen

## Expected output / werkwijze

1. Benoem welke import/accountlaag geraakt wordt.
2. Check impact op dedupe, categorisatie, subscriptions, forecast.
3. Kies de kleinste veilige wijziging.
4. Definieer handmatige verificatiestappen op echte importscenario's.
