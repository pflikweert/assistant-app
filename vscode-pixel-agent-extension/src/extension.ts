import * as vscode from 'vscode';

const DEV_SERVER_TIMEOUT_MS = 1200;

export function activate(context: vscode.ExtensionContext): void {
  const openPanelCommand = vscode.commands.registerCommand('pixelAgent.openPanel', async () => {
    const panel = vscode.window.createWebviewPanel(
      'pixelAgent.panel',
      'Pixel Agent',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
      },
    );

    const devServerUrl = process.env.PIXEL_AGENT_WEBVIEW_DEV_SERVER_URL || 'http://localhost:5173';
    const useDevServer = context.extensionMode === vscode.ExtensionMode.Development;

    const messageSubscription = panel.webview.onDidReceiveMessage(async (message: unknown) => {
      const payload = message as { type?: string };
      if (payload.type === 'retry-dev-server') {
        await renderPanelHtml(panel, context, devServerUrl, useDevServer);
        return;
      }

      if (payload.type === 'load-production') {
        panel.webview.html = getProdWebviewHtml(panel.webview, context.extensionUri);
      }
    });
    panel.onDidDispose(() => {
      messageSubscription.dispose();
    });

    await renderPanelHtml(panel, context, devServerUrl, useDevServer);
  });

  const helloCommand = vscode.commands.registerCommand('pixelAgent.hello', async () => {
    await vscode.window.showInformationMessage('Pixel Agent extension is running.');
  });

  context.subscriptions.push(openPanelCommand, helloCommand);
}

export function deactivate(): void {
  // No-op for now.
}

async function renderPanelHtml(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  devServerUrl: string,
  useDevServer: boolean,
): Promise<void> {
  if (!useDevServer) {
    panel.webview.html = getProdWebviewHtml(panel.webview, context.extensionUri);
    return;
  }

  const probe = await probeDevServer(devServerUrl);
  if (probe.ok) {
    panel.webview.html = getDevWebviewHtml(panel.webview, devServerUrl);
    return;
  }

  const productionBundleAvailable = await hasProductionBundle(context.extensionUri);
  panel.webview.html = getDevServerFallbackHtml(
    panel.webview,
    devServerUrl,
    probe.reason,
    productionBundleAvailable,
  );
}

async function probeDevServer(devServerUrl: string): Promise<{ ok: boolean; reason: string }> {
  const normalizedUrl = devServerUrl.replace(/\/$/, '');
  const clientUrl = `${normalizedUrl}/@vite/client`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DEV_SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(clientUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    return { ok: true, reason: '' };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, reason: error.message };
    }

    return { ok: false, reason: 'Unknown network error' };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function hasProductionBundle(extensionUri: vscode.Uri): Promise<boolean> {
  const scriptUri = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js');
  const styleUri = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css');

  try {
    await vscode.workspace.fs.stat(scriptUri);
    await vscode.workspace.fs.stat(styleUri);
    return true;
  } catch {
    return false;
  }
}

function getDevWebviewHtml(webview: vscode.Webview, devServerUrl: string): string {
  const normalizedUrl = devServerUrl.replace(/\/$/, '');
  const wsOrigin = toWebSocketOrigin(normalizedUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' ${normalizedUrl}; script-src 'unsafe-eval' ${normalizedUrl}; connect-src ${normalizedUrl} ${wsOrigin}; font-src ${webview.cspSource} ${normalizedUrl};"
    />
    <title>Pixel Agent</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${normalizedUrl}/@vite/client"></script>
    <script type="module" src="${normalizedUrl}/src/main.ts"></script>
  </body>
</html>`;
}

function getDevServerFallbackHtml(
  webview: vscode.Webview,
  devServerUrl: string,
  reason: string,
  productionBundleAvailable: boolean,
): string {
  const nonce = getNonce();
  const safeUrl = escapeHtml(devServerUrl);
  const safeReason = escapeHtml(reason);
  const productionButton = productionBundleAvailable
    ? '<button id="load-production" class="secondary">Load Production Bundle</button>'
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <title>Pixel Agent</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0a1626;
        --bg-card: #13253b;
        --line: #294666;
        --text: #ecf4ff;
        --muted: #96acc8;
        --accent: #7ad1ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        background: radial-gradient(circle at 20% 20%, #1e466b 0%, transparent 45%), var(--bg);
        color: var(--text);
        padding: 24px;
      }
      main {
        width: min(740px, 100%);
        background: linear-gradient(170deg, rgba(23, 43, 66, 0.96), var(--bg-card));
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 24px;
      }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p { margin: 0 0 10px; color: var(--muted); line-height: 1.45; }
      code {
        display: block;
        margin-top: 6px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(7, 17, 30, 0.75);
        color: var(--text);
        word-break: break-word;
      }
      .actions {
        margin-top: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      button {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        font-weight: 700;
        cursor: pointer;
      }
      button.primary { background: var(--accent); color: #05111d; }
      button.secondary { background: transparent; color: var(--text); border: 1px solid var(--line); }
    </style>
  </head>
  <body>
    <main>
      <h1>Webview dev server is offline</h1>
      <p>Pixel Agent tried to load the Vite dev server, but it was unreachable.</p>
      <p>Expected URL:</p>
      <code>${safeUrl}</code>
      <p>Reason:</p>
      <code>${safeReason || 'Connection failed'}</code>
      <p>Start it with:</p>
      <code>npm --prefix vscode-pixel-agent-extension run dev:webview</code>
      <div class="actions">
        <button id="retry" class="primary">Retry Dev Server</button>
        ${productionButton}
      </div>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.getElementById('retry')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'retry-dev-server' });
      });
      document.getElementById('load-production')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'load-production' });
      });
    </script>
  </body>
</html>`;
}

function getProdWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'main.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css'),
  );
  const nonce = getNonce();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Pixel Agent</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}

function toWebSocketOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}`;
  } catch {
    return 'ws://localhost:5173';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
