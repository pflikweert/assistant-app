# Budio Redesign Flow

Gebruik deze flow bij redesign van bestaande schermen in Budio.

## Preview-first regel

- Codex mag NOOIT direct een redesign implementeren.
- Codex moet altijd eerst 2-3 design varianten maken.
- Gebruik voor Stitch-verkenning standaard project:
  - `projects/12076228720239525233`
- Varianten worden opgeslagen in:
  - `design_refs/proposals/{screen}/{variant}/`
- Elke variant bevat:
  - korte uitleg van het concept
  - component structuur, geen volledige code
  - optioneel lichte JSX preview
- Na de varianten stopt Codex en wacht op feedback.
- Pas na user keuze:
  - gekozen variant verplaatsen naar `design_refs/approved/{screen}/`
  - daarna pas implementatie starten
- Project-id bron:
  - `docs/design/stitch-project-registry.md`

## Taalregel

- Alle zichtbare UI-teksten in redesign-varianten zijn standaard Nederlands.
- Alleen bij expliciete user-vraag mag een andere taal worden gebruikt.

## Stitch quickstart voor redesign

Gebruik dit vaste volgorde:

1. preflight design-system check:
   - `npm run stitch:tool -- get_project -d '{"name":"projects/12076228720239525233"}'`
   - bevestig canonieke asset `assets/ead01f9cb9454e8da9de7ec3d8ef18e6` (`Budio Core Fintech`)
2. als nodig eerst herstellen:
   - `npm run stitch:tool -- apply_design_system -d '{"projectId":"12076228720239525233","assetId":"ead01f9cb9454e8da9de7ec3d8ef18e6","selectedScreenInstances":[...]}'
3. `npm run stitch:tool -- list_screens -d '{"projectId":"12076228720239525233"}'`
4. per variant prompt uit `design_refs/proposals/{screen}/v1|v2|v3/stitch-prompt.md` gebruiken met:
   `npm run stitch:tool -- generate_screen_from_text -d '{"projectId":"12076228720239525233","deviceType":"MOBILE","prompt":"..."}'`
5. opnieuw `list_screens` draaien en screen ids vastleggen
6. previewlink per variant registreren in variant-README

Fallback regels:

- Als een variant na succesvolle generatie niet direct in `list_screens` staat:
  - eerst nogmaals `list_screens` draaien
  - daarna pas opnieuw genereren met expliciete tekst:
    `Create a NEW mobile screen ... with title exactly "...". Do not edit existing screens.`
- Nooit direct implementeren voordat A/B/C previews zichtbaar en gedocumenteerd zijn.
- Bij design-system drift of foutieve Stitch-stijl: gebruik `.codex/skills/budio-stitch-design-system.md`.
- Gebruik nooit `create_design_system` tijdens redesign-flow.

## Wat we geleerd hebben

- Na `generate_screen_from_text` altijd nogmaals `list_screens` doen, omdat indexering soms vertraagt.
- Bij ontbrekende variant helpt een expliciete retry-prompt met vaste titel en `Do not edit existing screens`.
- Leg per variant direct `project`, `screen` en `preview` vast in de variant-README om verlies van context te voorkomen.

## Stap 1 — Analyse

- identificeer huidige componenten
- check tegen design foundation
- markeer inconsistenties
- bepaal wat behouden blijft

## Stap 2 — Structuur

- behoud bestaande schermshell
- verbeter hiërarchie
- verminder visuele drukte
- verwijder dubbele info

## Stap 3 — Component mapping

- vervang custom UI met bestaande componenten
- unify buttons, cards, spacing

## Stap 4 — Verbeteringen

- voeg alleen verbeteringen toe binnen bestaande systeem
- geen nieuwe patronen zonder reden

## Stap 5 — Varianten maken

- maak 2-3 duidelijke design varianten
- geef elke variant een eigen map onder `design_refs/proposals/{screen}/{variant}/`
- hou varianten dicht bij het bestaande systeem
- laat verschillen vooral zitten in hiërarchie, ritme, componentkeuze en informatiedichtheid
- stop na het opleveren van de varianten en wacht op feedback

## Stap 6 — Output

Codex moet ALTIJD:

1. benoemen welke bestanden veranderen
2. uitleggen wat er visueel verandert
3. risico's benoemen
4. teststappen geven

## Belangrijk

- redesign = evolutie, geen revolutie
- code moet simpeler worden, niet complexer
