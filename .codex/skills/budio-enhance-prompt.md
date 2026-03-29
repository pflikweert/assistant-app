# Budio Enhance Prompt Skill

Gebruik deze skill om een vage UI-vraag om te zetten naar een Stitch-ready prompt binnen het Budio design system.

## Doel

- `brief -> stitch-prompt.md`
- Hogere promptkwaliteit met minder design drift.
- Altijd in lijn met Budio shells, componenten en producttaal.

## Input

- Een korte schermbrief of redesigndoel, bijvoorbeeld:
  - "maak budget rustiger"
  - "nieuw utility scherm voor export"

## Output

- `design_refs/proposals/{screen}/{variant}/stitch-prompt.md`
- Inhoud bevat minimaal:
  - schermtype en shell-keuze
  - layouthiërarchie: stand -> ruimte -> risico/trend -> advies
  - relevante bestaande componentfamilies
  - expliciete taalregel: zichtbare copy in het Nederlands
  - expliciete design-system regel: gebruik bestaande `Budio Core Fintech`, maak geen nieuwe design-system asset
  - verbod op nieuwe design language en losse one-off patronen

## Prompt-structuur (vast)

1. Context: schermnaam, schermtype, doelgroep.
2. Shell: hoofdscherm of utility/detail/modal met bestaande Budio shell.
3. Layout: boven/midden/onder, met duidelijke prioriteit.
4. Componenten: alleen bestaande componentfamilies.
5. Copy: korte Nederlandstalige labels/CTA's.
6. Grenzen: geen nieuwe kleuren, shadows, componentpatronen.
7. Design-system guardrail: hergebruik `Budio Core Fintech` (`assets/ead01f9cb9454e8da9de7ec3d8ef18e6`) en maak geen nieuwe design system aan.

## Kwaliteitscheck

- Noemt de prompt bestaande Budio shells/componenten?
- Is de hiërarchie expliciet en rustig?
- Is alle zichtbare copy Nederlandstalig?
- Staat er expliciet "geen nieuwe design language"?
- Staat er expliciet dat bestaande `Budio Core Fintech` wordt hergebruikt?

## Wat we geleerd hebben

- Te vage prompts geven sneller generieke of Engelstalige output.
- Expliciete shell + componentfamilies verlagen kans op afwijkingen.
- Een goede prompt is kort, concreet en constraint-gedreven.
