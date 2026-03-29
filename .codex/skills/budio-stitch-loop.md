# Budio Stitch Loop Skill

Gebruik deze skill voor consistente redesign-verkenning over meerdere schermen.

## Doel

- `screen-set -> proposals per screen (v1/v2/v3)`
- Eén coherente redesign-richting over alle gekozen schermen.
- Preview-first per scherm, zonder directe implementatie.

## Input

- Schermset, bijvoorbeeld:
  - `Budget`, `Insights`
  - of een lijst routes uit `docs/design/screen-inventory.md`

## Output

- Per scherm:
  - `design_refs/proposals/{screen}/analysis.md`
  - `design_refs/proposals/{screen}/v1/README.md`
  - `design_refs/proposals/{screen}/v2/README.md`
  - `design_refs/proposals/{screen}/v3/README.md`
  - `design_refs/proposals/{screen}/v1|v2|v3/stitch-prompt.md`
- Per variant registreren:
  - project id
  - screen id
  - preview link

## Loop-stappen

1. Preflight: controleer met `get_project` dat canonieke asset actief is (`assets/ead01f9cb9454e8da9de7ec3d8ef18e6` / `Budio Core Fintech`).
2. Analyseer alle gekozen schermen op componentgebruik, hiërarchie en inconsistenties.
3. Definieer gedeelde redesign-doelen voor de hele set.
4. Maak per scherm 3 varianten binnen hetzelfde design system.
5. Genereer Stitch previews per variant.
6. Registreer ids/links in proposal README's.
7. Stop en wacht op user-keuze.

## Governance-regels

- Nooit direct implementeren.
- Geen nieuwe design language.
- Standaard Nederlandstalige zichtbare copy.
- Bestaande shells/componenten eerst.
- Geen nieuwe design-system asset aanmaken tijdens loop (`create_design_system` verboden).

## Wat we geleerd hebben

- Batchwerk zonder strakke registratie leidt tot contextverlies.
- `list_screens` direct na generatie kan achterlopen; altijd opnieuw controleren.
- Consistentie tussen schermen komt vooral uit gedeelde constraints, niet uit langere prompts.
