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
