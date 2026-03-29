# Budio Design Sync Check Skill

Gebruik deze skill om prompt/design drift tussen codebase docs en Stitch state te detecteren.

## Doel

- `repo docs + stitch state -> drift report`
- Vroeg signaleren waar Stitch afwijkt van Budio source of truth.

## Bronnen

- `docs/design/stitch-design-md.md`
- `docs/design/design-tokens.md`
- `docs/design/stitch-project-registry.md`
- Stitch API state:
  - `list_design_systems`
  - `get_project`

## Output

- `design_refs/reports/design-sync-check/{yyyy-mm-dd}.md`
- Rapport bevat minimaal:
  - actief project id
  - actieve design system asset id + versie
  - gevonden mismatches per categorie
  - aanbevolen correctieactie

## Drift-categorieen

- kleuren (primary/secondary/tertiary/neutral)
- fonts (headline/body/label)
- roundness/radius-richting
- taalregel (Nederlandstalige copy)
- sourceAsset mismatch (registry vs project instance)
- ongewenste extra assets zonder duidelijke status
- meerdere `DESIGN_SYSTEM_INSTANCE` assets in project zonder canonical lock

## Uitvoerstappen

1. Lees registry en design docs.
2. Haal Stitch design systems en project instance op.
3. Vergelijk registry/default met echte `DESIGN_SYSTEM_INSTANCE.sourceAsset`.
4. Markeer drift als:
  - `kritiek`: default asset mismatch, canonical lock gebroken of nieuwe asset gebruikt in nieuwe flow
  - `waarschuwing`: extra assets als historiek zonder actief gebruik
5. Schrijf concreet hersteladvies.

## Wat we geleerd hebben

- Alleen `update_design_system` output vertrouwen is niet genoeg.
- `get_project` is leidend voor welke asset echt default actief is.
- Drift-check na elke grote designwijziging voorkomt prompt drifting.
- Voor Budio geldt single-asset policy: `assets/ead01f9cb9454e8da9de7ec3d8ef18e6` (`Budio Core Fintech`).
