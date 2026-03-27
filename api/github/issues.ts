import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GITHUB_API_BASE = "https://api.github.com";

type IssueDraftPayload = {
  sourceMessageId: string;
  type: "bug" | "feedback" | "feature_request";
  summary: string;
  context: {
    screenTitle: string;
    routeName: string;
    periodLabel: string | null;
    platform: string;
  };
  labels: string[];
  shortDescription: string;
};

type GithubConfig = {
  token: string;
  owner: string;
  repo: string;
  fullName: string;
};

type IssueReporter = {
  userId: string;
  displayName: string;
};

type HelpAssistantUserProfile = {
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    full_name?: string | null;
  } | null;
} | null | undefined;

function normalizeDisplayName(value: string | null | undefined) {
  return String(value || "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveHelpAssistantDisplayName(user: HelpAssistantUserProfile) {
  const metadataName = normalizeDisplayName(user?.user_metadata?.full_name)
    || normalizeDisplayName(user?.user_metadata?.name);
  if (metadataName) return metadataName;

  const localPart = String(user?.email || "").split("@")[0] || "";
  const normalizedLocalPart = normalizeDisplayName(localPart);
  if (normalizedLocalPart) return normalizedLocalPart;

  return "";
}

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    throw new Error(
      "Supabase config ontbreekt voor GitHub proxy (SUPABASE_URL + service role of anon key).",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normalizeGithubRepoName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function deriveGithubOwner(value: string, fallbackOwner: string | null) {
  const trimmed = value.trim();
  if (trimmed.includes("/")) {
    const [owner] = trimmed.split("/").filter(Boolean);
    if (owner) return owner;
  }
  return fallbackOwner?.trim() || "";
}

export function getGithubConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const rawOwner = process.env.GITHUB_OWNER;
  const rawRepo = process.env.GITHUB_REPO;
  if (!token || !rawRepo) {
    throw new Error(
      "GitHub config ontbreekt (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO).",
    );
  }

  const repo = normalizeGithubRepoName(rawRepo);
  const owner = deriveGithubOwner(rawRepo, rawOwner || null) || rawOwner || "";

  if (!owner || !repo) {
    throw new Error(
      "GitHub config ontbreekt of is ongeldig. Gebruik GITHUB_OWNER en GITHUB_REPO of een volledige owner/repo-waarde in GITHUB_REPO.",
    );
  }

  return {
    token,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

function withCors(res: any) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeText(value: string, maxLength: number) {
  const collapsed = value.replace(/\s+/g, " ").trim();
  const redactedEmail = collapsed.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[redacted-email]",
  );
  const redactedIban = redactedEmail.replace(
    /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi,
    "[redacted-iban]",
  );
  const redactedLongNumbers = redactedIban.replace(
    /\b(?:\d[ -]?){10,}\b/g,
    "[redacted-number]",
  );
  const redactedUrl = redactedLongNumbers.replace(
    /https?:\/\/\S+/gi,
    "[redacted-url]",
  );
  return redactedUrl.slice(0, maxLength).trim();
}

export function sanitizeLabel(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return normalized;
}

function parseIssueDraft(body: unknown): IssueDraftPayload | null {
  if (!isRecord(body)) return null;
  const draft = body.draft;
  if (!isRecord(draft)) return null;
  const context = draft.context;
  if (!isRecord(context)) return null;

  const sourceMessageId = String(draft.sourceMessageId || "").trim();
  const type = String(draft.type || "").trim();
  const summary = String(draft.summary || "").trim();
  const shortDescription = String(draft.shortDescription || "").trim();
  const screenTitle = String(context.screenTitle || "").trim();
  const routeName = String(context.routeName || "").trim();
  const periodLabel = context.periodLabel == null ? null : String(context.periodLabel).trim();
  const platform = String(context.platform || "").trim();
  const labels = Array.isArray(draft.labels)
    ? draft.labels.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!sourceMessageId || !summary || !shortDescription || !screenTitle || !routeName || !platform) {
    return null;
  }
  if (type !== "bug" && type !== "feedback" && type !== "feature_request") {
    return null;
  }

  return {
    sourceMessageId,
    type,
    summary,
    shortDescription,
    labels,
    context: {
      screenTitle,
      routeName,
      periodLabel,
      platform,
    },
  };
}

export function buildGithubIssuePayload(
  input: IssueDraftPayload,
  reporter?: IssueReporter | null,
) {
  const title = sanitizeText(input.summary, 120) || "Help Assistant melding";
  const cleanedLabels = Array.from(
    new Set(
      [...input.labels, "source:help-assistant"]
        .map((label) => sanitizeLabel(label))
        .filter(Boolean)
        .slice(0, 12),
    ),
  );

  const body = [
    "## Help Assistant issue draft",
    "",
    `Type: ${input.type}`,
    reporter
      ? `Naam melder: ${sanitizeText(reporter.displayName || "Onbekend", 80)}`
      : "",
    reporter
      ? `Gebruikers-ID: ${sanitizeText(reporter.userId || "onbekend", 80)}`
      : "",
    reporter ? "Bron: Help Assistant chat" : "",
    `Screen: ${sanitizeText(input.context.screenTitle, 60)}`,
    `Route: ${sanitizeText(input.context.routeName, 120)}`,
    `Periode: ${sanitizeText(input.context.periodLabel || "niet geselecteerd", 50)}`,
    `Platform: ${sanitizeText(input.context.platform, 20)}`,
    "",
    "## Korte beschrijving",
    sanitizeText(input.shortDescription, 2000) || "Geen beschrijving",
    "",
    "<!-- source=help-assistant -->",
    `<!-- sourceMessageId=${sanitizeText(input.sourceMessageId, 80)} -->`,
  ]
    .filter(Boolean)
    .join("\n");

  return { title, body, labels: cleanedLabels };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204);
      withCors(res);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405);
      withCors(res);
      res.json({ message: "Method not allowed" });
      return;
    }

    const authHeader = String(req.headers.authorization ?? "");
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      res.status(401);
      withCors(res);
      res.json({ message: "Missing access token" });
      return;
    }

    const token = authHeader.slice(7);
    const supabaseClient = getSupabaseAuthClient();
    const userResult = await supabaseClient.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      res.status(401);
      withCors(res);
      res.json({ message: "Invalid access token" });
      return;
    }

    const reporter = {
      userId: userResult.data.user.id,
      displayName:
        resolveHelpAssistantDisplayName(
          userResult.data.user as HelpAssistantUserProfile,
        ) || userResult.data.user.email || "Onbekend",
    };

    const draft = parseIssueDraft(req.body);
    if (!draft) {
      res.status(400);
      withCors(res);
      res.json({ message: "Invalid issue draft payload" });
      return;
    }

    const { token: githubToken, owner, repo, fullName } = getGithubConfig();
    const payload = buildGithubIssuePayload(draft, reporter);
    const githubResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${githubToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error("[github-issues] create failed", {
        status: githubResponse.status,
        repo: fullName,
        body: errorText.slice(0, 500),
      });
      const errorHint =
        githubResponse.status === 401 || githubResponse.status === 403
          ? "GitHub-token mist schrijfrechten voor issues."
          : githubResponse.status === 404
            ? `GitHub-repo niet gevonden of onjuist ingesteld: ${fullName}.`
            : "GitHub accepteerde de issue niet.";
      res.status(502);
      withCors(res);
      res.json({
        message: "GitHub issue aanmaken is mislukt.",
        hint: errorHint,
      });
      return;
    }

    const created = (await githubResponse.json()) as {
      number?: number;
      html_url?: string;
      node_id?: string;
      url?: string;
    };

    res.status(200);
    withCors(res);
    res.json({
      issueNumber: created.number ?? null,
      issueUrl: created.html_url ?? created.url ?? null,
      issueNodeId: created.node_id ?? null,
      labels: payload.labels,
      projectPreparation: {
        ready: Boolean(created.node_id),
        issueNodeId: created.node_id ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[github-issues] unexpected error",
      error instanceof Error ? error.message : error,
    );
    res.status(500);
    withCors(res);
    res.json({ message: "Onverwachte serverfout bij issue creatie." });
  }
}
