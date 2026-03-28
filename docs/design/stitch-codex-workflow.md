# Stitch + Codex Workflow

Gebruik dit als vaste basis om Stitch vanuit Codex betrouwbaar te gebruiken.

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

## 4) Praktische richtlijn

- Gebruik in-chat MCP als primary pad.
- Als MCP niet opkomt, gebruik `npm run stitch:tool -- ...` als fallback.
- Bewaar `STITCH_API_KEY` buiten git en deel die nooit in repo-bestanden.
