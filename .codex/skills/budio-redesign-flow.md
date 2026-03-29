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
