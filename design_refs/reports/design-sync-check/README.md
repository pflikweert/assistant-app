# Design Sync Check Reports

Deze map bevat drift-rapporten tussen:

- Budio design docs in de repo
- actieve Stitch design-system state

## Naamgeving

- Gebruik per run:
  - `YYYY-MM-DD.md`

## Minimale inhoud per rapport

- project id
- actieve `sourceAsset` uit `get_project`
- registry asset id en versie
- drift-overzicht per categorie (kleur, font, radius, taal, sourceAsset)
- severity (`kritiek` / `waarschuwing`)
- herstelactie
