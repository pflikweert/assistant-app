# Knowledge sync naar Google Drive

Deze repo bevat een kleine sync-tool voor de vaste Budio-bronnen die in ChatGPT Projects als source gebruikt worden. De sync loopt alleen over een curated set markdown-bestanden. Er is geen repo-wide scan, geen delete, geen rename en geen bidirectionele sync.

## Curated source map

De tool gebruikt deze expliciete mapping van lokale bron naar bestandsnaam in Google Drive:

| Lokale bron | Drive-bestandsnaam |
| --- | --- |
| `AGENTS.md` | `AGENTS.md` |
| `docs/BUDIO_PRODUCT_CONTRACT.md` | `BUDIO_PRODUCT_CONTRACT.md` |
| `docs/BUDIO_PRODUCTVISIE_ROADMAP.md` | `BUDIO_PRODUCTVISIE_ROADMAP.md` |
| `docs/BUDIO_COCKPIT_MIGRATION_MAP.md` | `BUDIO_COCKPIT_MIGRATION_MAP.md` |
| `docs/BUDIO_FUNCTIONALITEITEN.md` | `BUDIO_FUNCTIONALITEITEN.md` |
| `docs/UI_PATTERNS.md` | `UI_PATTERNS.md` |
| `docs/design/screen-inventory.md` | `screen-inventory.md` |
| `docs/design/stitch-design-md.md` | `stitch-design-md.md` |
| `OPEN_TAKEN_FINANCE_APP.md` | `OPEN_TAKEN_FINANCE_APP.md` |

## Auth-keuze

Er zijn twee geldige routes:

- `Google OAuth` voor een persoonlijke Drive-map in jouw eigen account
- `Service account` alleen als de doelmap in een shared drive staat en met het service account is gedeeld

De fout die je zag, betekent meestal dat de map in een persoonlijke My Drive staat. In dat geval heb je OAuth nodig.

## Setup

1. Maak in Google Cloud een project of gebruik een bestaand project.
2. Zet de Google Drive API aan.
3. Kies een van deze twee routes:
   - OAuth: maak een `Desktop app` OAuth client en download de JSON client secret file
   - Service account: maak een service account aan en download een JSON key file
4. Deel de doelmap in Google Drive met het juiste Google-account of service-account e-mailadres.
5. Noteer het folder ID uit de Drive-URL.

Voorbeeld van een Drive-URL:

```text
https://drive.google.com/drive/folders/<FOLDER_ID>
```

## Environment

Zet deze variabelen lokaal:

```bash
GOOGLE_DRIVE_BUDIO_FOLDER_ID=<folder-id>
GOOGLE_DRIVE_OAUTH_CLIENT_JSON=/absoluut/pad/naar/oauth-client.json
```

De eerste run opent je browser voor Google login en schrijft daarna een token weg naar `.cache/knowledge-sync/oauth-token.json`.

Gebruik je liever een service account, dan zet je in plaats daarvan:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absoluut/pad/naar/service-account-key.json
```

Dat werkt alleen als de map in een shared drive staat.

## Run

Start de sync met:

```bash
npm run knowledge:sync
```

Per bestand wordt gelogd of het is `created`, `updated`, `skipped` of `failed`. Als een lokaal bestand ontbreekt of de Drive-call faalt, eindigt het script met exit code `1`.

## ChatGPT Projects

Na een geslaagde sync kun je in ChatGPT Projects de Google Drive-folder toevoegen als source en daar deze set documenten laten uitlezen. De bedoeling is dat je de vaste Budio-bronnen in die ene map houdt en de tool alleen die map bijwerkt.
