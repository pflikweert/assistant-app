# Stitch + Codex Workflow

Gebruik dit als vaste basis om Stitch vanuit Codex betrouwbaar te gebruiken.

## Standaard Budio project

- Gebruik standaard Stitch-project:
  - `projects/12076228720239525233`
- Titel:
  - `Budio Design System 2026`
- Centrale registratie:
  - `docs/design/stitch-project-registry.md`
- Vraag niet opnieuw naar een project-id als dit standaardproject van toepassing is.

## Canonieke design system policy

- Gebruik in dit project exact 1 design system:
  - `assets/ead01f9cb9454e8da9de7ec3d8ef18e6` (`Budio Core Fintech`)
- Nieuwe schermen/refactors/redesigns hergebruiken altijd deze asset.
- Tijdens normaal schermwerk is `create_design_system` verboden.

## 1) Eenmalig of bij nieuwe machine

```bash
npm run stitch:codex:setup
```

Dit script:
- zoekt `STITCH_API_KEY` eerst in env
- valt terug op VS Code MCP config (`~/Library/Application Support/Code/User/mcp.json`)
- registreert Stitch in Codex via `codex mcp add stitch ...`

Belangrijk: na setup altijd je Codex sessie herstarten.

## 2) Snel controleren

```bash
codex mcp list
codex mcp get stitch
```

Verwacht: `stitch` staat op `enabled`.

## 3) Fallback als MCP-handshake tijdelijk faalt

Gebruik direct de Stitch CLI-wrapper (zelfde backend/API):

```bash
npm run stitch:tools:list
npm run stitch:tool -- get_screen_code -d '{"projectId":"<id>","screenId":"<id>"}'
npm run stitch:tool -- edit_screens -d '{"projectId":"<id>","selectedScreenIds":["<id>"],"prompt":"..."}'
```

Voor Budio is `<id>` standaard:

```bash
projects/12076228720239525233
```

## 4) Praktische richtlijn

- Gebruik in-chat MCP als primary pad.
- Als MCP niet opkomt, gebruik `npm run stitch:tool -- ...` als fallback.
- Bewaar `STITCH_API_KEY` buiten git en deel die nooit in repo-bestanden.
- Gebruik voor Budio standaard het geregistreerde project uit `docs/design/stitch-project-registry.md`.
- Doe vóór elke generatie een preflight met `get_project` en controleer canonical asset.

## 5) Companion skills (standaard)

Voor Budio workflows gebruik je deze skills samen:

- `.codex/skills/budio-enhance-prompt.md`
- `.codex/skills/budio-stitch-loop.md`
- `.codex/skills/budio-design-sync-check.md`
- `.codex/skills/budio-rn-component-mapper.md`
- `.codex/skills/budio-stitch-design-system.md`

## 6) Verplicht sync-rondje na grote designwijziging

Volg dit altijd in deze volgorde:

1. Werk `docs/design/stitch-design-md.md` bij.
2. Verifieer Stitch state:
   - `npm run stitch:tool -- list_design_systems -d '{"projectId":"12076228720239525233"}'`
   - `npm run stitch:tool -- get_project -d '{"name":"projects/12076228720239525233"}'`
3. Controleer dat `DESIGN_SYSTEM_INSTANCE.sourceAsset` en registry overeenkomen.
4. Registreer project/asset/screen ids in:
   - `docs/design/stitch-project-registry.md`
   - relevante `design_refs/proposals/{screen}/{variant}/README.md`
5. Als de sourceAsset afwijkt:
   - eerst herstellen met `apply_design_system` op canonieke asset
   - daarna pas nieuwe varianten genereren

## 7) Pilotflow acceptatie (Budget + Insights)

Voor de eerste volledige loop geldt als minimum:

- `budio-stitch-loop` uitgevoerd op `budget-screen` en `insights-screen`
- per scherm 3 varianten met geregistreerde previewlinks
- `budio-design-sync-check` rapport zonder kritieke drift op:
  - actieve sourceAsset
  - fonts
  - kleur-richting
  - taalregel (Nederlands)

Vaste pilot-rapportage:

- `design_refs/reports/pilot-budget-insights-loop.md`
