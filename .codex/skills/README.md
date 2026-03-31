# Skills Router (Budio)

Doel: snelle skillroutering zonder ruis.  
Fast path is standaard. Full path alleen bij trigger.

## Top-level skills (primair)

- `budio-product-strategy`
- `budio-financial-truth`
- `budio-delivery-fast-path`
- `budio-stitch-governance`
- `budio-money-copilot`
- `budio-import-and-accounts`
- `budio-budget-setup`
- `budio-rn-component-mapper`

## Fast Path vs Full Path

- Fast path (default):
  - kleine bugfixes, lokale UI-correcties, copy, docs, beperkte componentaanpassingen
- Full path (alleen bij trigger):
  - nieuw scherm
  - groot redesign
  - shell-/hierarchie-impact
  - multi-screen harmonisatie
  - design-system drift
  - asset/system-level Stitch wijziging
- Escalatie:
  - start altijd in `budio-delivery-fast-path`
  - promoveer alleen bij trigger naar `budio-stitch-governance`

## Companion docs (detailhulp, niet primair)

- `budio-enhance-prompt.md`
- `budio-new-screen-flow.md`
- `budio-redesign-flow.md`
- `budio-component-flow.md`
- `budio-stitch-loop.md`
- `budio-design-system.md`
- `budio-stitch-design-system.md`
- `budio-design-sync-check.md`
- `budio-rn-component-mapper.md`
- `docs/design/stitch-codex-workflow.md`

## Gebruik in volgorde

1. Begin bij `AGENTS.md` (always-on kern).
2. Kies taakafhankelijk een top-level skill.
3. Gebruik companion docs alleen als detailhulp.
