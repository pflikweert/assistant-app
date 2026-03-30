import "dotenv/config";

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { google } from "googleapis";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const execFileAsync = promisify(execFile);

const CURATED_FILES = [
  { sourcePath: "AGENTS.md", driveName: "AGENTS.md" },
  { sourcePath: "docs/BUDIO_PRODUCT_CONTRACT.md", driveName: "BUDIO_PRODUCT_CONTRACT.md" },
  {
    sourcePath: "docs/BUDIO_PRODUCTVISIE_ROADMAP.md",
    driveName: "BUDIO_PRODUCTVISIE_ROADMAP.md",
  },
  {
    sourcePath: "docs/BUDIO_COCKPIT_MIGRATION_MAP.md",
    driveName: "BUDIO_COCKPIT_MIGRATION_MAP.md",
  },
  {
    sourcePath: "docs/BUDIO_FUNCTIONALITEITEN.md",
    driveName: "BUDIO_FUNCTIONALITEITEN.md",
  },
  { sourcePath: "docs/UI_PATTERNS.md", driveName: "UI_PATTERNS.md" },
  { sourcePath: "docs/design/screen-inventory.md", driveName: "screen-inventory.md" },
  { sourcePath: "docs/design/stitch-design-md.md", driveName: "stitch-design-md.md" },
  { sourcePath: "OPEN_TAKEN_FINANCE_APP.md", driveName: "OPEN_TAKEN_FINANCE_APP.md" },
];

function escapeDriveQueryValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function resolveLocalPath(relativePath) {
  return path.resolve(ROOT, relativePath);
}

function readServiceAccountCredentials() {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyFile) {
    throw new Error(
      "Missing GOOGLE_APPLICATION_CREDENTIALS. Point it at a Google service account JSON key file.",
    );
  }

  if (!fs.existsSync(keyFile)) {
    throw new Error(`Google service account key file not found: ${keyFile}`);
  }

  return keyFile;
}

function readOAuthClientConfig() {
  const clientJsonPath = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_JSON?.trim();
  if (!clientJsonPath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(clientJsonPath)
    ? clientJsonPath
    : path.resolve(ROOT, clientJsonPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Google OAuth client JSON file not found: ${resolvedPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  const clientConfig = raw.installed ?? raw.web;
  if (!clientConfig?.client_id || !clientConfig?.client_secret) {
    throw new Error(
      "Invalid Google OAuth client JSON. Use a Desktop app or Web app OAuth client file with client_id and client_secret.",
    );
  }

  return {
    clientId: clientConfig.client_id,
    clientSecret: clientConfig.client_secret,
    clientJsonPath: resolvedPath,
  };
}

function getDriveFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_BUDIO_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error("Missing GOOGLE_DRIVE_BUDIO_FOLDER_ID.");
  }
  return folderId;
}

function getOAuthTokenPath() {
  const configured = process.env.GOOGLE_DRIVE_OAUTH_TOKEN_PATH?.trim();
  const defaultPath = path.join(ROOT, ".cache", "knowledge-sync", "oauth-token.json");
  return path.resolve(ROOT, configured || defaultPath);
}

async function openUrl(url) {
  try {
    if (process.platform === "darwin") {
      await execFileAsync("open", [url]);
      return true;
    }

    if (process.platform === "win32") {
      await execFileAsync("cmd", ["/c", "start", "", url]);
      return true;
    }

    await execFileAsync("xdg-open", [url]);
    return true;
  } catch {
    return false;
  }
}

async function authenticateWithOAuthClient(oauthClientConfig) {
  const tokenPath = getOAuthTokenPath();
  const savedTokenRaw = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, "utf8") : null;
  const savedToken = savedTokenRaw ? JSON.parse(savedTokenRaw) : null;

  const client = new google.auth.OAuth2(oauthClientConfig.clientId, oauthClientConfig.clientSecret);
  if (savedToken?.refresh_token) {
    client.setCredentials(savedToken);
    return client;
  }

  const server = http.createServer();
  const codePromise = new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname !== "/oauth2callback") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`OAuth failed: ${error}`);
        reject(new Error(`OAuth failed: ${error}`));
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Missing OAuth code");
        reject(new Error("Missing OAuth code"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Google Drive authorization complete. You can close this tab.");
      resolve(code);
    });

    server.listen(0, "127.0.0.1");
  });

  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start local OAuth callback server.");
  }

  const redirectUri = `http://localhost:${address.port}/oauth2callback`;
  const authClient = new google.auth.OAuth2(
    oauthClientConfig.clientId,
    oauthClientConfig.clientSecret,
    redirectUri,
  );
  const authUrl = authClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE],
  });

  console.log("[knowledge-sync] Google OAuth login required");
  console.log(`[knowledge-sync] opening ${authUrl}`);
  const opened = await openUrl(authUrl);
  if (!opened) {
    console.log("[knowledge-sync] open the URL above in your browser");
  }

  try {
    const code = await codePromise;
    const { tokens } = await authClient.getToken(code);
    authClient.setCredentials(tokens);
    await fs.promises.mkdir(path.dirname(tokenPath), { recursive: true });
    await fs.promises.writeFile(tokenPath, JSON.stringify(tokens, null, 2), "utf8");
    return authClient;
  } finally {
    server.close();
  }
}

async function createDriveClient() {
  const oauthClientConfig = readOAuthClientConfig();
  if (oauthClientConfig) {
    const auth = await authenticateWithOAuthClient(oauthClientConfig);
    return {
      authMode: "oauth",
      drive: google.drive({ version: "v3", auth }),
    };
  }

  const auth = new google.auth.GoogleAuth({
    scopes: [DRIVE_SCOPE],
    keyFile: readServiceAccountCredentials(),
  });

  return {
    authMode: "service-account",
    drive: google.drive({ version: "v3", auth }),
  };
}

async function validateTargetFolder(drive, folderId, authMode) {
  const folder = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: "id,name,driveId,mimeType",
  });

  if (authMode === "service-account" && !folder.data.driveId) {
    throw new Error(
      "The target folder is in a personal My Drive. Service accounts cannot write there. Use Google OAuth with a Desktop app client, or move the folder to a shared drive and share it with the service account.",
    );
  }
}

async function uploadOrUpdateFile(drive, folderId, fileEntry) {
  const localPath = resolveLocalPath(fileEntry.sourcePath);
  if (!fs.existsSync(localPath)) {
    return {
      status: "skipped",
      reason: `missing local file: ${fileEntry.sourcePath}`,
    };
  }

  const content = fs.readFileSync(localPath, "utf8");
  const search = await drive.files.list({
    q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false and name = '${escapeDriveQueryValue(fileEntry.driveName)}'`,
    spaces: "drive",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: "allDrives",
    pageSize: 10,
    fields: "files(id,name,modifiedTime)",
  });

  const existingFiles = search.data.files ?? [];
  if (existingFiles.length > 1) {
    return {
      status: "failed",
      reason: `found ${existingFiles.length} files named ${fileEntry.driveName} in the target folder`,
    };
  }

  const media = {
    mimeType: "text/markdown",
    body: Readable.from([content]),
  };

  if (existingFiles.length === 1) {
    const existingFile = existingFiles[0];
    await drive.files.update({
      fileId: existingFile.id,
      requestBody: {
        mimeType: "text/markdown",
      },
      media,
      supportsAllDrives: true,
      fields: "id,name",
    });

    return {
      status: "updated",
      fileId: existingFile.id,
    };
  }

  const created = await drive.files.create({
    requestBody: {
      name: fileEntry.driveName,
      parents: [folderId],
      mimeType: "text/markdown",
    },
    media,
    supportsAllDrives: true,
    fields: "id,name",
  });

  return {
    status: "created",
    fileId: created.data.id,
  };
}

async function main() {
  const folderId = getDriveFolderId();
  const { authMode, drive } = await createDriveClient();
  await validateTargetFolder(drive, folderId, authMode);

  console.log(`[knowledge-sync] syncing ${CURATED_FILES.length} curated markdown files`);
  console.log(`[knowledge-sync] target folder: ${folderId}`);

  const results = [];

  for (const fileEntry of CURATED_FILES) {
    try {
      const result = await uploadOrUpdateFile(drive, folderId, fileEntry);
      results.push({ ...fileEntry, ...result });

      if (result.status === "skipped") {
        console.warn(`[knowledge-sync] skipped ${fileEntry.driveName} (${result.reason})`);
        continue;
      }

      if (result.status === "failed") {
        console.error(`[knowledge-sync] failed ${fileEntry.driveName}: ${result.reason}`);
        continue;
      }

      console.log(
        `[knowledge-sync] ${result.status} ${fileEntry.driveName}${result.fileId ? ` (${result.fileId})` : ""}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...fileEntry, status: "failed", reason: message });
      console.error(`[knowledge-sync] failed ${fileEntry.driveName}: ${message}`);
    }
  }

  const summary = results.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
  );

  console.log(
    `[knowledge-sync] summary: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`,
  );

  if (summary.skipped > 0 || summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[knowledge-sync] fatal: ${message}`);
  process.exit(1);
});
