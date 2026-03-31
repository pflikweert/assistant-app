# Status

- Status: companion inputdoc voor governance
- Rol: detailregels voor Stitch design-system beheer
- Alleen gebruiken wanneer:
  - `budio-stitch-governance` al actief is in full path
- Niet gebruiken als top-level skillroutering:
  - gebruik `budio-stitch-governance` als centrale entry
- Primaire routing:
  - zie `.codex/skills/README.md`

# Budio Stitch Design System (Companion)

Gebruik deze companion voor design-system details binnen een al gekozen `budio-stitch-governance` traject.

## Doel

- Exact 1 canoniek Stitch design system afdwingen voor Budio.
- Voorkomen dat Stitch per scherm een nieuw design system aanmaakt.
- Design-system IDs en mapping expliciet registreren zodat we niet opnieuw hoeven uitzoeken.

## Source of truth

- `constants/theme.ts`
- `docs/design/design-tokens.md`
- `docs/design/design-foundation.md`
- `docs/UI_PATTERNS.md`
- `docs/design/stitch-project-registry.md`

## Standaard project en asset

- standaard project: `projects/12076228720239525233`
- canonieke design system asset: `assets/ead01f9cb9454e8da9de7ec3d8ef18e6`
- canonieke displayName: `Budio Core Fintech`
- canonieke asset versie: `version: 2` (na Budio update)
- let op:
  - Stitch UI kan soms een ID tonen als `asset-stub-assets-...`
  - canonical API resource name blijft `assets/{id}` (zonder `asset-stub-`)

## Harde regel

- Tijdens redesign/new-screen/component flows:
  - NOOIT `create_design_system` gebruiken
  - NOOIT nieuwe design-system asset maken
  - ALTIJD bestaande canonieke asset hergebruiken
- Alleen bij expliciete user-vraag voor een apart experiment mag een nieuwe asset worden gemaakt.

## Taalregel

- Alle zichtbare UI-copy in Stitch outputs is standaard Nederlands.
- Engels of andere taal alleen bij expliciete user-vraag.

## Stap 1 — Inventariseren

Voer uit:

- `npm run stitch:tool -- list_design_systems -d '{"projectId":"12076228720239525233"}'`
- `npm run stitch:tool -- get_project -d '{"name":"projects/12076228720239525233"}'`
- `npm run stitch:tool -- list_screens -d '{"projectId":"12076228720239525233"}'`

Controleer:

- welke `assets/{id}` al bestaan
- of displayName en theme afwijken van Budio tokens
- welke screen instances in project staan (nodig voor apply)

## Stap 2 — Beslissen: update of alleen apply

- Als canonieke asset bestaat (standaard): alleen `apply_design_system` gebruiken.
- `update_design_system` alleen inzetten als we de canonieke asset bewust bijwerken.
- `create_design_system` is verboden in normale Budio workflow.

## Stap 3 — Update payload bouwen

Minimale verplichte velden in Stitch theme:

- `colorMode`
- `headlineFont`
- `bodyFont`
- `customColor`
- `roundness`

Aanbevolen extra velden:

- `labelFont`
- `colorVariant`
- `spacingScale`
- `overridePrimaryColor`
- `overrideSecondaryColor`
- `overrideTertiaryColor`
- `overrideNeutralColor`
- `namedColors`
- `designMd`

## Stap 4 — Design system updaten

Voorbeeld:

- `npm run stitch:tool -- update_design_system -d '{"projectId":"12076228720239525233","name":"assets/ead01f9cb9454e8da9de7ec3d8ef18e6","designSystem":{"displayName":"Budio Design System","theme":{"colorMode":"LIGHT","colorVariant":"NEUTRAL","headlineFont":"MANROPE","bodyFont":"MANROPE","labelFont":"INTER","customColor":"#1A1A1A","roundness":"ROUND_EIGHT","spacingScale":2}}}'`

## Stap 5 — Toepassen op screens

1. Haal screen instances uit `get_project`.
2. Gebruik `apply_design_system` met `assetId` zonder `assets/` prefix.

Voorbeeld:

- `npm run stitch:tool -- apply_design_system -d '{"projectId":"12076228720239525233","assetId":"ead01f9cb9454e8da9de7ec3d8ef18e6","selectedScreenInstances":[{"id":"...","sourceScreen":"projects/12076228720239525233/screens/..."}]}'`

## Stap 6 — Verifiëren

- `list_design_systems` opnieuw draaien en controleren op versie-bump.
- `list_screens` + `get_screen_image` gebruiken om regressies te checken.
- Controleren dat copy nog Nederlands is.
- extra check:
  - `get_project` en controleer welke `sourceAsset` in de `DESIGN_SYSTEM_INSTANCE` staat.
  - die bepaalt welke asset als project-default is gekoppeld.
  - als je afwijkende `sourceAsset` ziet: eerst herstellen met `apply_design_system` op canonieke asset.

## Gedragsnotities uit praktijk

- `update_design_system` kan een sessie-response geven; verifieer altijd met `list_design_systems` of de asset echt is aangepast.
- `apply_design_system` kan nieuwe screen-versies genereren zonder automatisch de project-level `DESIGN_SYSTEM_INSTANCE` te wisselen.
- Gebruik daarom na iedere update deze volgorde:
  1. `list_design_systems`
  2. `get_project` (check `sourceAsset`)
  3. pas daarna concluderen welke asset actief is.

## Wat we geleerd hebben

- De actieve project-default wordt bepaald door `DESIGN_SYSTEM_INSTANCE.sourceAsset` in `get_project`.
- Een extra asset kan naast de default bestaan; markeer die altijd als `legacy` en gebruik hem niet opnieuw.
- Niet alle theme-velden zijn in elke update-call stabiel ondersteund; als update faalt, stuur een compactere payload met verplichte velden plus `designMd`.
- Gebruik `designMd` voor richting, maar behandel codebase-tokens als enige canonieke waarheid voor implementatie.

## Wat Stitch wel en niet kan

Wel:

- globale theme-richting, fonts, roundness, basiskleuren, spacingScale
- design instructions via `designMd`

Niet volledig afdwingbaar:

- exacte tokenmatrix uit app (`FinTokens.spacing`, volledige radius/shadow schaal)
- alle componentcontracts (button states, icon sizing, elevation per component)
- alle semantische color rules per context

Daarom:

- behandel Stitch design system als richtinggevende laag
- codebase + docs blijven de enige canonieke waarheid
- markeer afwijkingen als `legacy` of `stitch drift`, nooit als nieuwe standaard

## Verplichte registratie

Na elke design-system wijziging:

1. update `docs/design/stitch-project-registry.md` met actueel asset id
2. noteer in relevante proposal-README:
   - project id
   - asset id
   - screen id(s)
3. vermeld kort welke delen niet 1-op-1 in Stitch afdwingbaar zijn
