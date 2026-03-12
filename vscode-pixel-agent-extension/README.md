# Pixel Agent Extension

VS Code extensie met:
- Extension backend in TypeScript.
- Webview UI via Vite.
- HMR voor snelle UI-iteratie.
- Slimme fallback als de webview devserver niet draait.

## Structuur

- `src/extension.ts`: extension host code (commands, webview openen, fallback-logica).
- `webview-ui/src/*`: webview frontend (HMR).
- `dist/`: build output voor extension + production webview assets.

## Snel starten (aanrader)

1. Open de workspace root `assistant` in VS Code.
2. Installeer dependencies:
   - `cd vscode-pixel-agent-extension`
   - `npm install`
3. Start debugconfig **Run Pixel Agent Extension**.
   - Pre-launch start automatisch parallel:
     - TypeScript watch voor extension code.
     - Vite devserver voor de webview op `http://127.0.0.1:5173`.
4. In de Extension Development Host: run command **Pixel Agent: Open Panel**.

## Dagelijkse workflow

### Webview UI wijzigen

- Bewerk bestanden in `webview-ui/src/*`.
- Wijzigingen verschijnen direct in het panel via HMR.

### Extension backend wijzigen

- Bewerk `src/extension.ts`.
- Gebruik daarna in de Development Host: **Debug: Restart Extension Host**.
- Je hoeft geen nieuw debug-venster te starten.

## Devserver fallback in het panel

Als de webview devserver niet bereikbaar is, toont het panel automatisch een duidelijke fallback-pagina met:

- Verwachte devserver URL.
- Foutreden (bijvoorbeeld connectie geweigerd).
- Knop **Retry Dev Server**.
- Knop **Load Production Bundle** (alleen als production assets bestaan).

Dit voorkomt een leeg of kapot panel tijdens development.

## Scripts

- `npm run build`: bouwt extension + webview productie-assets.
- `npm run build:extension`: compileert alleen extension backend.
- `npm run build:webview`: buildt alleen webview assets naar `dist/webview`.
- `npm run watch`: alias naar extension watch.
- `npm run watch:extension`: TypeScript watch voor extension backend.
- `npm run dev:webview`: start Vite devserver voor webview.

## Handig vanaf verschillende mappen

Als je in `vscode-pixel-agent-extension` staat:

- `npm run dev:webview`

Als je in de repo-root `assistant` staat:

- `npm --prefix vscode-pixel-agent-extension run dev:webview`

## Productiebuild

Run:

- `npm run build`

Output:

- Extension JS in `dist/`
- Webview assets in `dist/webview/assets`

## Troubleshooting

### `Missing script: "dev:webview"`

Je draait het commando vanuit de verkeerde map. Gebruik:

- `cd vscode-pixel-agent-extension && npm run dev:webview`

of:

- `npm --prefix vscode-pixel-agent-extension run dev:webview`

### Panel toont fallback terwijl devserver draait

1. Check of Vite echt draait op `http://127.0.0.1:5173`.
2. Klik in het panel op **Retry Dev Server**.
3. Controleer of poort `5173` niet door een ander proces bezet is.

### Alleen production assets tonen

1. Run `npm run build`.
2. Open panel opnieuw.
3. Kies in fallback eventueel **Load Production Bundle**.

## Custom devserver URL

Je kunt de URL overschrijven met environment variable:

- `PIXEL_AGENT_WEBVIEW_DEV_SERVER_URL`

Voorbeeld:

- `PIXEL_AGENT_WEBVIEW_DEV_SERVER_URL=http://localhost:5174`
