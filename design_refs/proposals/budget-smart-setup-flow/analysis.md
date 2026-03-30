# Analyse — Budget Smart Setup Flow (29 maart 2026)

## Productmatig nog niet sterk genoeg

- De bestaande budgetinstap voelt te veel als beheer en te weinig als voorstelgestuurde setup.
- `Handmatig` stond te dicht op het primaire pad, waardoor het slimme voorstelpad minder dominant was.
- Er was geen duidelijke review-state na toepassen van een voorstel.
- Componentniveau-bewerking zat wel in de logica, maar niet als expliciet, rustig onderdeel in de flow.

## Geraakte schermen en flows

- Hoofdscherm: `/budget` (nieuw premium voorstelblok bovenin).
- Utilityflow: `/budget/setup` (instap, voorsteloverzicht, componentniveau-bewerking, review-state).
- Utilityflow: budgetbeheer-keuzevlak met segment `Slim met Budio` / `Handmatig`.

## Shell-keuze

- `/budget`: `hoofdscherm` (bestaande hoofdtab blijft primair als stuurlaag).
- `/budget/setup`: `utility/subscherm` (begeleide flow, geen tweede hoofdscherm).
- Onderdeel-bewerking en review-state: `utility/subscherm` binnen dezelfde flow.

## Hergebruikte Budio UI-patronen

- `FinanceHeroShell`-ritme voor hoofdtabcontext.
- utility-opbouw via compacte kaarten/rows in de stijl van `FinanceUtilityShell`.
- `FinanceSettingsGroup`/settings-row-achtige hiërarchie voor secundaire blokken.
- CTA-hiërarchie: 1 primaire actie, secundair pad als rustige fallback.
- Geen chat-first patroon, geen nieuwe design language.
