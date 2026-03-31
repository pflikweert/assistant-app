# Codex Skills Aanbeveling (Budio) - Skill-v1

## Doel

Deze skilllaag is bedoeld om Codex sneller en scherper te maken in MVP-fase:

- standaard snel kunnen leveren via `fast path`
- alleen opschalen naar zwaardere flow bij duidelijke trigger
- strenger op product- en datarisico's dan op designrituelen

Primaire skillrouter: `.codex/skills/README.md`

## Skill-v1 set (formeel)

Top-level skills:

1. `budio-product-strategy` (bestaand)
2. `budio-financial-truth`
3. `budio-delivery-fast-path`
4. `budio-stitch-governance`
5. `budio-money-copilot`
6. `budio-import-and-accounts`
7. `budio-budget-setup`
8. `budio-rn-component-mapper`

## Belangrijkste regels

- `fast path` is default.
- `full path` alleen bij expliciete trigger.
- Geen top-level overlap tussen skills.
- Companion docs blijven bestaan, maar sturen niet de hoofdrouting.

## Triggers voor full path

- nieuw scherm
- groot redesign
- shell- of hiërarchie-impact
- multi-screen harmonisatie
- design-system drift
- asset/system-level Stitch wijziging

Escalatie:

- start altijd in fast path
- promoveer alleen bij trigger

## Matrix: bestaand item -> nieuwe status

| Item | Huidige status | Nieuwe status | Bestemming | Reden |
| --- | --- | --- | --- | --- |
| `.codex/skills/budio-product-strategy/SKILL.md` | echte skill | behouden | top-level | al passend |
| `.codex/skills/budio-design-system.md` | skill-achtig | companion inputdoc | `budio-stitch-governance` | detailbron voor governance |
| `.codex/skills/budio-stitch-design-system.md` | skill-achtig | companion inputdoc | `budio-stitch-governance` | detailbron voor governance |
| `.codex/skills/budio-design-sync-check.md` | skill-achtig | companion inputdoc | `budio-stitch-governance` | auditdetail binnen governance |
| `docs/design/stitch-codex-workflow.md` (governance-delen) | workflowdoc | companion workflowdoc | `budio-stitch-governance` | operationele details |
| `.codex/skills/budio-enhance-prompt.md` | skill-achtig | degraderen | companion doc | detail, niet top-level |
| `.codex/skills/budio-new-screen-flow.md` | skill-achtig | degraderen | companion doc | detail, niet top-level |
| `.codex/skills/budio-redesign-flow.md` | skill-achtig | degraderen | companion doc | detail, niet top-level |
| `.codex/skills/budio-component-flow.md` | skill-achtig | degraderen | companion doc | detail, niet top-level |
| `.codex/skills/budio-stitch-loop.md` | skill-achtig | degraderen | companion doc | detail, niet top-level |
| `.codex/skills/budio-rn-component-mapper.md` | skill-achtig | companion detaildoc | top-level `budio-rn-component-mapper` | top-level entry staat in `SKILL.md` |

## Companion docs (niet top-level routing)

- `.codex/skills/budio-enhance-prompt.md`
- `.codex/skills/budio-new-screen-flow.md`
- `.codex/skills/budio-redesign-flow.md`
- `.codex/skills/budio-component-flow.md`
- `.codex/skills/budio-stitch-loop.md`
- `.codex/skills/budio-design-system.md`
- `.codex/skills/budio-stitch-design-system.md`
- `.codex/skills/budio-design-sync-check.md`
- `.codex/skills/budio-rn-component-mapper.md`
- `docs/design/stitch-codex-workflow.md`

## Korte skillkaarten (v1)

### `budio-product-strategy`

- Doel: koers, prioritering, productcompressie.
- Gebruik: productkeuzes en backlog.
- Niet: kleine lokale fix zonder productimpact.

### `budio-financial-truth`

- Doel: semantiek, truth hierarchy, risico op betekenisfouten.
- Gebruik: bedragen/signalen/forecastbetekenis.
- Niet: puur visuele wijziging zonder semantische impact.

### `budio-delivery-fast-path`

- Doel: standaardpad voor snelle MVP-levering.
- Gebruik: kleine bugfixes, copy, lokale UI-fixes, docs.
- Niet: structurele design/system-wijzigingen.

### `budio-stitch-governance`

- Doel: full-path design-system governance.
- Gebruik: alleen bij full-path triggers.
- Niet: dagelijkse kleine taken.

### `budio-money-copilot`

- Doel: assistentroutering, hydration-guardrails, truth-safe AI.
- Gebruik: help assistant en AI-responsecontract.
- Niet: algemene UI-layout zonder assistentimpact.

### `budio-import-and-accounts`

- Doel: import, dedupe, matching, account/scope-impact.
- Gebruik: wijzigingen rond import/accountingang en datakwaliteit.
- Niet: losstaande designpolish.

### `budio-budget-setup`

- Doel: begeleide budgetflow en setupbeslissingen.
- Gebruik: setupflow, voorstel/review/verfijn.
- Niet: algemene budgetengine buiten setupcontext.

### `budio-rn-component-mapper`

- Doel: Stitch -> RN componentmapping.
- Gebruik: na ontwerpkeuze, vóór implementatie.
- Niet: productstrategie of semantische keuzes.

## Representatieve snippets

Bron: `.codex/skills/budio-product-strategy/SKILL.md`

> "Budio is niet primair een budgetapp. Budio is de dagelijkse financiële cockpit..."

Bron: `.codex/skills/budio-design-system.md`

> "Codex moet altijd eerst 2-3 design varianten maken."

Bron: `.codex/skills/budio-rn-component-mapper.md`

> "stitch screen -> RN component-structuur + mapping-notes"
